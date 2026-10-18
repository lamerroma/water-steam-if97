"""Independent openpyxl / odfpy / xlrd / stdlib CSV acceptance of exported cells."""
import csv
import hashlib
import io
import json
import math
import sys
import zipfile
from pathlib import Path
import openpyxl
import xlrd
from odf.opendocument import load
from odf.table import Table, TableRow, TableCell, CoveredTableCell
from odf import teletype
from odf.text import P

def read_sheets(file, fmt):
    raw = file.read_bytes()
    if fmt == 'xlsx':
        assert raw[:2] == b'PK'
        book = openpyxl.load_workbook(file, data_only=False)
        result = {}
        for sheet in book:
            rows = []
            for row in sheet:
                assert all(c.data_type != 'f' for c in row), 'Unexpected formula'
                rows.append([c.value for c in row])
            result[sheet.title] = rows
        return result
    if fmt == 'xls':
        assert raw[:8] == bytes.fromhex('d0cf11e0a1b11ae1')
        book = xlrd.open_workbook(file)
        assert book.biff_version == 80, 'Not Excel 97–2003 BIFF8'
        return {s.name: [[bool(s.cell_value(r,c)) if s.cell_type(r,c)==xlrd.XL_CELL_BOOLEAN else s.cell_value(r,c) for c in range(s.ncols)] for r in range(s.nrows)] for s in book.sheets()}
    if fmt == 'ods':
        with zipfile.ZipFile(file) as z:
            assert z.testzip() is None
            assert z.read('mimetype') == b'application/vnd.oasis.opendocument.spreadsheet'
            assert z.infolist()[0].filename == 'mimetype' and z.infolist()[0].compress_type == 0, 'ODF mimetype must be first and uncompressed'
        book = load(str(file))
        result = {}
        for sheet in book.getElementsByType(Table):
            rows = []
            for row in sheet.getElementsByType(TableRow):
                cells = []
                for c in row.childNodes:
                    if getattr(c,'qname',None) not in [('urn:oasis:names:tc:opendocument:xmlns:table:1.0','table-cell'),('urn:oasis:names:tc:opendocument:xmlns:table:1.0','covered-table-cell')]:
                        continue
                    assert c.getAttribute('formula') is None, 'Unexpected ODS formula'
                    typ = c.getAttribute('valuetype')
                    value = float(c.getAttribute('value')) if typ == 'float' else c.getAttribute('booleanvalue')=='true' if typ == 'boolean' else '\n'.join(teletype.extractText(p) for p in c.getElementsByType(P)) if typ == 'string' else None
                    cells.extend([value] * int(c.getAttribute('numbercolumnsrepeated') or 1))
                rows.extend([cells] * int(row.getAttribute('numberrowsrepeated') or 1))
            result[sheet.getAttribute('name')] = rows
        return result
    raise AssertionError(fmt)

def same(expected, actual):
    if expected is None or expected == '':
        assert actual is None or actual == '', (expected,actual)
    elif isinstance(expected, bool):
        assert type(actual) is bool and actual == expected, (expected,actual)
    elif isinstance(expected, (int,float)):
        assert type(actual) in (int,float) and math.isclose(expected,actual,rel_tol=2e-14,abs_tol=1e-13), (expected,actual)
    else:
        assert type(actual) is str and actual == expected, (expected,actual)

def verify(manifest):
    checks=[]
    for record in manifest['files']:
        file=Path(record['file']); raw=file.read_bytes()
        assert hashlib.sha256(raw).hexdigest()==record['sha256']
        sheets=record['document']['sheets']; cells=0
        if record['format']=='csv':
            assert raw.startswith(b'\xef\xbb\xbf')
            actual=list(csv.reader(io.StringIO(raw.decode('utf-8-sig')),delimiter=';'))
            expected=[]
            for s in sheets: expected.extend([['worksheet',s['name']],*s['rows'],[]])
            while expected and not expected[-1]: expected.pop()
            while actual and not actual[-1]: actual.pop()
            assert len(actual)==len(expected)
            for er,ar in zip(expected,actual):
                assert len(er)==len(ar)
                for e,a in zip(er,ar):
                    if isinstance(e,str):
                        guarded=e.lstrip().startswith(('=','+','-','@'))
                        assert a==("'"+e if guarded else e),(e,a)
                    elif type(e) is bool: assert a==str(e).lower()
                    elif e is None: assert a==''
                    else: assert math.isclose(float(a),e,rel_tol=2e-14,abs_tol=1e-13)
                    cells+=1
        else:
            actual=read_sheets(file,record['format'])
            assert list(actual)==[s['name'] for s in sheets]
            for s in sheets:
                ar=actual[s['name']]
                for i,er in enumerate(s['rows']):
                    for j,e in enumerate(er):
                        a=ar[i][j] if i<len(ar) and j<len(ar[i]) else None
                        try: same(e,a)
                        except AssertionError as error: raise AssertionError((file.name,s['name'],i,j,str(error))) from error
                        cells+=1
                # No extra nonblank values or truncated/misplaced rows.
                for i,row in enumerate(ar):
                    for j,a in enumerate(row):
                        if i>=len(s['rows']) or j>=len(s['rows'][i]): assert a is None or a==''
        checks.append({'id':record['id'],'format':record['format'],'cells':cells,'status':'passed'})
    return {'status':'passed','version':manifest['version'],'readers':{'openpyxl':openpyxl.__version__,'xlrd':xlrd.__version__,'odfpy':'1.4.1','csv':'Python stdlib'},'files':len(checks),'cells':sum(c['cells'] for c in checks),'checks':checks}

def verify_browser(manifest):
    count=0
    for record in manifest['files']:
        file=Path(record['file']);fmt=record['format']
        if fmt=='csv':
            actual={};current=None
            for row in csv.reader(io.StringIO(file.read_text(encoding='utf-8-sig')),delimiter=';'):
                if len(row)==2 and row[0]=='worksheet': current=row[1];actual[current]=[]
                elif current is not None: actual[current].append(row)
        else: actual=read_sheets(file,fmt)
        metadata=dict(r[:2] for r in actual['Metadata'] if len(r)>=2)
        assert metadata['appVersion']==manifest['version']
        if manifest.get('buildId'): assert metadata['buildId']==manifest['buildId']
        assert metadata['pressure_basis']=='absolute'
        for check in record['checks']:
            rows=actual[check['sheet']];prefix=check['prefix']
            def prefix_matches(row):
                if len(row)<len(prefix): return False
                for e,a in zip(prefix,row):
                    if type(e) in (int,float):
                        try:
                            if float(a)!=e: return False
                        except (ValueError,TypeError): return False
                    elif a!=e and not (fmt=='csv' and a=="'"+e): return False
                return True
            matches=[r for r in rows if prefix_matches(r)]
            assert len(matches)==1,(file.name,prefix,len(matches))
            actual_value=matches[0][check['column']];expected=check['value']
            if fmt=='csv' and isinstance(expected,(int,float)): actual_value=float(actual_value)
            if type(expected) in (int,float):
                assert type(actual_value) in (int,float) and math.isclose(expected,actual_value,rel_tol=2e-7,abs_tol=2e-8),(file.name,expected,actual_value)
            else: same(expected,actual_value)
            count+=1
    return {'status':'passed','files':len(manifest['files']),'checks':count,'version':manifest['version']}

if __name__=='__main__':
    manifest_path=Path(sys.argv[1]);manifest=json.loads(manifest_path.read_text());report=verify_browser(manifest) if manifest.get('browser') else verify(manifest)
    (manifest_path.parent/'reader-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='checks'},ensure_ascii=False,indent=2))
