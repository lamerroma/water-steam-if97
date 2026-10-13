"""Validate packaged content with an independent standard-library ZIP reader."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parent.parent
with zipfile.ZipFile(root / 'dist/water-steam-calculator.zip') as archive:
    assert archive.testzip() is None, 'CRC failure'
    expected = {'calculator.html', 'README.txt', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'QUICK_START_UK.md', 'BUILD_INFO.json'}
    assert set(archive.namelist()) == expected, 'Unexpected or missing members'
    for member, original in [('calculator.html', 'standalone.html'), ('LICENSE', 'LICENSE'), ('THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'), ('QUICK_START_UK.md', 'docs/QUICK_START_UK.md')]:
        assert archive.read(member) == (root / original).read_bytes(), member
    metadata = json.loads(archive.read('BUILD_INFO.json'))
    assert metadata['version'] == json.loads((root / 'package.json').read_text())['version']
    assert metadata['id'] in archive.read('calculator.html').decode('utf-8')
    assert all(item.date_time == (1980, 1, 1, 0, 0, 0) for item in archive.infolist())
print('PASS: ZIP integrity, exact HTML/docs, build metadata and reproducible timestamps.')
