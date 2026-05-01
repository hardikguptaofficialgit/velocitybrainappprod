from pathlib import Path
import subprocess
import sys


def test_public_package_does_not_import_private_runtime():
    repo_root = Path(__file__).resolve().parents[1]
    script = repo_root / "scripts" / "check_public_boundary.py"
    completed = subprocess.run([sys.executable, str(script)], capture_output=True, text=True, check=False)
    assert completed.returncode == 0, completed.stdout + completed.stderr

