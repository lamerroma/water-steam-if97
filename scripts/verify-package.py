"""Validate packaged content with an independent standard-library ZIP reader."""
from pathlib import Path
import json
import re
import hashlib
import zipfile

root = Path(__file__).resolve().parent.parent
with zipfile.ZipFile(root / 'dist/water-steam-calculator.zip') as archive:
    assert archive.testzip() is None, 'CRC failure'
    worker = (root / 'dist/service-worker.js').read_text(encoding='utf-8')
    resources = json.loads(re.search(r'const RESOURCES=(\[[^;]+\]);', worker)[1])
    hashes = json.loads(re.search(r'const DIGESTS=(\{[^;]+\});', worker)[1])
    expected = {name.split('?')[0] for name in resources} | {'service-worker.js', 'serve.py', 'README.txt', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'QUICK_START_UK.md', 'PWA_UK.md', 'PWA_ARCHITECTURE_UK.md', 'CALCULATION_MODULES_UK.md', 'PYTHON_LIBRARIES_UK.md', 'FLUIDS_PIPE_UK.md', 'BUILD_INFO.json'}
    python_package = json.loads(archive.read('assets/python-package.json'))
    expected |= {item['url'] for item in python_package['files']}
    assert set(archive.namelist()) == expected, 'Unexpected or missing members'
    for name in resources:
        member = name.split('?')[0]
        assert archive.read(member) == (root / 'dist' / member).read_bytes(), member
        assert hashlib.sha256(archive.read(member)).hexdigest() == hashes[name], member
    for item in python_package['files']:
        data = archive.read(item['url'])
        assert len(data) == item['bytes'] and hashlib.sha256(data).hexdigest() == item['sha256'], item['url']
    for member, original in [('service-worker.js', 'dist/service-worker.js'), ('serve.py', 'scripts/serve-pwa.py'), ('LICENSE', 'LICENSE'), ('THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'), ('QUICK_START_UK.md', 'docs/QUICK_START_UK.md'), ('PWA_UK.md', 'docs/PWA_UK.md'), ('PWA_ARCHITECTURE_UK.md', 'docs/PWA_ARCHITECTURE_UK.md'), ('CALCULATION_MODULES_UK.md', 'docs/CALCULATION_MODULES_UK.md'), ('PYTHON_LIBRARIES_UK.md', 'docs/PYTHON_LIBRARIES_UK.md'), ('FLUIDS_PIPE_UK.md', 'docs/FLUIDS_PIPE_UK.md')]:
        assert archive.read(member) == (root / original).read_bytes(), member
    metadata = json.loads(archive.read('BUILD_INFO.json'))
    assert metadata['version'] == json.loads((root / 'package.json').read_text())['version']
    assert metadata['id'] in archive.read('assets/app.js').decode('utf-8')
    assert all(item.date_time == (1980, 1, 1, 0, 0, 0) for item in archive.infolist())
print('PASS: PWA ZIP integrity, all offline resource hashes, exact docs/launcher, build metadata and reproducible timestamps.')
