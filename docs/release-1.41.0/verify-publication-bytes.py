from pathlib import Path
import urllib.request,urllib.parse,hashlib,json,re,subprocess,concurrent.futures,datetime
root=Path.cwd();base=root/'.release/publication-1.41.0';url='https://lamerroma.github.io/water-steam-if97/';commit='5dc609c92fe80a7ffe050b4cc0696d6876628ac2'
def gitfile(name):return subprocess.check_output(['git','-c','safe.directory='+root.as_posix(),'show',commit+':'+name])
def sha(raw):return hashlib.sha256(raw).hexdigest()
def fetch(resource):
 target=urllib.parse.urljoin(url,resource);request=urllib.request.Request(target,headers={'Cache-Control':'no-cache','Pragma':'no-cache'})
 with urllib.request.urlopen(request,timeout=60) as r:
  assert urllib.parse.urlparse(r.url).netloc=='lamerroma.github.io'
  return r.read(),{'url':target,'HTTPStatus':r.status,'etag':r.headers.get('ETag'),'lastModified':r.headers.get('Last-Modified')}
sw=gitfile('service-worker.js');text=sw.decode();parse=lambda name:json.loads(re.search('const '+name+r'=(.*?);',text).group(1));build=parse('BUILD');assert build['id']=='a8e94fb1e643'
resources=parse('RESOURCES');digests=parse('DIGESTS');expected={'service-worker.js':sha(sw)}
for name in resources:expected[name]=digests[name]
config=json.loads(gitfile('assets/python-package.json'))
for f in config['files']:expected[f['url']]=f['sha256']
def verify(item):
 name,digest=item;raw,meta=fetch(name);actual=sha(raw);assert actual==digest,(name,actual,digest);return {'resource':name,'bytes':len(raw),'sha256':actual,'matchesAcceptedCommit':True,**meta}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:records=list(pool.map(verify,expected.items()))
report={'status':'passed','dateUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':url,'commit':commit,'build':build,'scope':'Live HTTP bytes compared with immutable accepted Git commit and its core/optional digest manifests. No browser cache or numerical parity claim.','resources':records,'count':len(records),'allHashesMatch':True}
(base/'live-byte-verification.json').write_bytes((json.dumps(report,indent=2)+'\n').encode());print('PASS live published bytes:',len(records),'resources, build',build['id'])
