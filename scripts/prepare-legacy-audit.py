"""Prepare and verify an exact pre-PWA snapshot; never overwrite a changed snapshot."""
from pathlib import Path
import hashlib
import io
import subprocess
import zipfile

root = Path(__file__).resolve().parent.parent
commit = '6bae91383df7085f73dd1cc2f3eb462571143867'
target = (root / '.release/functional-restore/baseline-6bae913').resolve()
assert target.is_relative_to((root / '.release').resolve())
raw = subprocess.check_output(['git', '-c', 'safe.directory=' + root.as_posix(), 'archive', '--format=zip', commit], cwd=root)
with zipfile.ZipFile(io.BytesIO(raw)) as archive:
    assert archive.testzip() is None
    files = [item for item in archive.infolist() if not item.is_dir()]
    for item in files:
        destination = (target / item.filename).resolve()
        assert destination.is_relative_to(target), item.filename
        if destination.exists():
            if not destination.is_file() or destination.read_bytes() != archive.read(item):
                raise SystemExit('Existing historical snapshot differs; preserved: ' + str(destination))
    target.mkdir(parents=True, exist_ok=True)
    for item in files:
        destination = target / item.filename
        if not destination.exists():
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(archive.read(item))
print(target)
