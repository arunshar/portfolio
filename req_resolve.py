"""Dry-run pip resolve on space/requirements.txt minus the git+ ref."""
from __future__ import annotations

import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path


def main(req_path: Path) -> int:
    if not req_path.exists():
        print(f"FAIL: {req_path} not found")
        return 1

    lines = req_path.read_text().splitlines()
    keep, skipped = [], []
    for ln in lines:
        if not ln.strip() or ln.lstrip().startswith("#"):
            keep.append(ln)
            continue
        if "git+http" in ln or re.match(r"^[A-Za-z0-9_\-]+\s*@\s*git\+", ln):
            skipped.append(ln)
            continue
        keep.append(ln)

    if not keep:
        print("FAIL: no resolvable lines")
        return 1

    print(f"Skipping {len(skipped)} git+ ref(s)")
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as fh:
        fh.write("\n".join(keep))
        tmp = Path(fh.name)

    venv = os.environ.get("VIRTUAL_ENV", "")
    cmd = ["uv", "pip", "install", "--dry-run", "-r", str(tmp)]
    print("Running:", " ".join(cmd))
    env = os.environ.copy()
    proc = subprocess.run(cmd, capture_output=True, text=True, env=env)
    out = proc.stdout + proc.stderr
    if proc.returncode != 0:
        print("FAIL: resolve failed")
        print(out[-2500:])
        return 1
    # uv prints "Would download/install ..." lines on success.
    print("OK: pip resolve clean")
    print(out[-500:])
    return 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1])))
