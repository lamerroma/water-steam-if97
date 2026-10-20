"""Vendor pinned, unmodified upstream wheels/runtime; no runtime CDN/PyPI access."""
from pathlib import Path
import base64
import hashlib
import io
import json
import tarfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'vendor/python'
PYODIDE = '314.0.7'
CORE_INTEGRITY = '0YvXxEhfEdpLfb/XkM2BFAeMROq0iMUX2bzzH9pOttyMcWkwq+HbE5uyuGD82LN7y2q+SNvi/6V5JEsOlD2R1A=='
PINS = {
    'ht': ('1.2.0', 'a4716bc3c8a9ef5e3dfff68d552232ba6f05c0edd3caa07fb72bee2306975ace'),
    'fluids': ('1.3.1', 'd9097efe57c910ac14b89a1984d5e7062ee9df1afc84e089d944fdd85404e361'),
}
files = []

def download(url):
    with urllib.request.urlopen(url, timeout=120) as response:
        return response.read()

def save(name, data, source, license_name):
    target = DEST / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    files.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'source': source, 'license': license_name})

metadata = json.loads(download(f'https://registry.npmjs.org/pyodide/{PYODIDE}'))
core_url = metadata['dist']['tarball']
core = download(core_url)
assert base64.b64encode(hashlib.sha512(core).digest()).decode() == CORE_INTEGRITY
with tarfile.open(fileobj=io.BytesIO(core), mode='r:gz') as archive:
    for name in ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']:
        save('pyodide/' + name, archive.extractfile('package/' + name).read(), core_url, 'MPL-2.0 / bundled CPython and third-party notices')
lock = json.loads((DEST / 'pyodide/pyodide-lock.json').read_text())
packages = {}

def dependency(name):
    if name in packages:
        return
    entry = lock['packages'][name]
    packages[name] = {'version': entry['version'], 'file': 'pyodide/' + entry['file_name']}
    for child in entry.get('depends', []):
        dependency(child)
    url = f"https://cdn.jsdelivr.net/pyodide/v{PYODIDE}/full/{entry['file_name']}"
    data = download(url)
    assert hashlib.sha256(data).hexdigest() == entry['sha256'], name
    save('pyodide/' + entry['file_name'], data, url, 'Upstream license and bundled notices inside unchanged wheel')

for name in ['numpy', 'scipy']:
    dependency(name)
for name, (version, expected) in PINS.items():
    data = json.loads(download(f'https://pypi.org/pypi/{name}/{version}/json'))
    wheel = next(item for item in data['urls'] if item['filename'].endswith('-py3-none-any.whl'))
    assert wheel['digests']['sha256'] == expected
    raw = download(wheel['url'])
    assert hashlib.sha256(raw).hexdigest() == expected
    save('wheels/' + wheel['filename'], raw, wheel['url'], 'MIT; original bundled notices preserved')
    packages[name] = {'version': version, 'file': 'wheels/' + wheel['filename']}
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        license_path = next(path for path in archive.namelist() if path.endswith('.dist-info/licenses/LICENSE.txt'))
        save(f'licenses/{name}-LICENSE.txt', archive.read(license_path), wheel['url'] + '#' + license_path, 'MIT')
for name, url, license_name in [
    ('pyodide-LICENSE.txt', f'https://raw.githubusercontent.com/pyodide/pyodide/{PYODIDE}/LICENSE', 'MPL-2.0'),
    ('cpython-LICENSE.txt', 'https://raw.githubusercontent.com/python/cpython/v3.14.2/LICENSE', 'PSF-2.0 and bundled notices'),
    ('emscripten-LICENSE.txt', 'https://raw.githubusercontent.com/emscripten-core/emscripten/5.0.3/LICENSE', 'MIT / LLVM-exception and bundled notices'),
]:
    save('licenses/' + name, download(url), url, license_name)
manifest = {'format': 1, 'pyodide': PYODIDE, 'python': lock['info']['python'], 'abi': lock['info']['abi_version'], 'coreIntegritySha512': CORE_INTEGRITY, 'packages': packages, 'files': sorted(files, key=lambda item: item['path'])}
(DEST / 'manifest.json').write_bytes((json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode())
hashes_path = ROOT / 'vendor/SHA256.json'
hashes = json.loads(hashes_path.read_text())
for file in DEST.rglob('*'):
    if file.is_file():
        hashes[file.relative_to(ROOT / 'vendor').as_posix()] = hashlib.sha256(file.read_bytes()).hexdigest()
hashes_path.write_bytes((json.dumps(hashes, indent=2, sort_keys=True) + '\n').encode())
print(json.dumps({'packages': packages, 'files': len(files), 'bytes': sum(item['bytes'] for item in files)}, indent=2))
