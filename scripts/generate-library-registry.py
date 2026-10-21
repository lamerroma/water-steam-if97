"""Generate/check the developer registry offline from byte-verified pinned wheels."""
from pathlib import Path
import argparse
import hashlib
import importlib
import json
import runpy
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'docs/library-registry/surface.json'
COLLECTOR = ROOT / 'scripts/reference/library_registry_collector.py'
BRIDGE = ROOT / 'src/python-library-bridge.py'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def generate():
    manifest_path = ROOT / 'vendor/python/manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    sources = {entry['path']: entry for entry in manifest['files']}
    wheel_info, checked = {}, {}
    for package in ('ht', 'fluids'):
        item = manifest['packages'][package]
        wheel = ROOT / 'vendor/python' / item['file']
        raw = wheel.read_bytes()
        if sha(raw) != sources[item['file']]['sha256']:
            raise ValueError('Pinned wheel checksum mismatch: ' + str(wheel))
        installed = Path(importlib.import_module(package).__file__).resolve().parent.parent
        count = 0
        with zipfile.ZipFile(wheel) as archive:
            for name in archive.namelist():
                if name.startswith(package + '/') and not name.endswith('/'):
                    if (installed / name).read_bytes() != archive.read(name):
                        raise ValueError('Installed package differs from pinned wheel: ' + name)
                    count += 1
        checked[package] = count
        wheel_info[package] = {'version': item['version'], 'file': item['file'], 'sha256': sha(raw)}
    namespace = runpy.run_path(str(BRIDGE))
    exec(compile(COLLECTOR.read_text(encoding='utf-8'), str(COLLECTOR), 'exec'), namespace)
    result = namespace['collect_library_registry']()
    result['inputs'] = {'bridgeSHA256': sha(BRIDGE.read_bytes()), 'collectorSHA256': sha(COLLECTOR.read_bytes()),
                        'vendorManifestSHA256': sha(manifest_path.read_bytes()), 'wheels': wheel_info,
                        'verifiedInstalledPackageFiles': checked}
    result['scope'] = {'inventory': 'recursive public exports, known callable identity/vectorize links, data bindings and static class members',
                       'unknowns': 'Optional modules, dynamic instance state, contracts and scientific validity remain explicit review work.',
                       'dataPolicy': 'Different public data paths are kept even when their values are equal.',
                       'identityPolicy': 'Object identity is grouped within a process; canonical public paths form stable IDs. Counts are not independent algorithms.'}
    runtime = {'environment': {'python': '.'.join(map(str, sys.version_info[:2])),
                **{name: importlib.metadata.version(name) for name in ('ht', 'fluids', 'numpy', 'scipy')}},
               'signatures': namespace['_registry_runtime_signatures'],
               'qualification': 'Runtime/dependency signatures, not pinned ht/fluids source declarations. Review status remains unreviewed.'}
    return result, runtime


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true', help='Update generated surface.json; default checks it.')
    args = parser.parse_args()
    result, runtime = generate()
    content = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + '\n'
    runtime_content = json.dumps(runtime, ensure_ascii=False, indent=2, sort_keys=True) + '\n'
    runtime_dest = DEST.with_name('runtime-signatures-native.json')
    if args.write:
        DEST.parent.mkdir(parents=True, exist_ok=True)
        DEST.write_bytes(content.encode('utf-8'))
        runtime_dest.write_bytes(runtime_content.encode('utf-8'))
    elif not DEST.exists() or DEST.read_text(encoding='utf-8') != content or not runtime_dest.exists() or runtime_dest.read_text(encoding='utf-8') != runtime_content:
        print('Library registry is stale; regenerate with the pinned environment and --write.', file=sys.stderr)
        sys.exit(1)
    print(json.dumps({'status': 'written' if args.write else 'current', 'summary': result['summary'],
                      'packages': [{k: p[k] for k in ('package', 'catalogPaths', 'callableObjects', 'baseObjectFamilies', 'dataBindings', 'classObjects', 'staticClassMembers')} for p in result['packages']]}, indent=2))
