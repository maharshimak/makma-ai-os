"""Fetch only immutable public backend revisions used by the parity contract."""

import json
import re
import subprocess
from pathlib import Path

for name, revision in json.loads(Path("backend-lock.json").read_text()).items():
    if not re.fullmatch(r"[a-z0-9-]+", name) or not re.fullmatch(r"[a-f0-9]{40}", revision):
        raise ValueError("Invalid backend lock entry")
    path = Path("parity-backends") / name
    path.mkdir(parents=True, exist_ok=True)
    subprocess.run(["git", "init", "-q", str(path)], check=True)
    subprocess.run(
        [
            "git",
            "-C",
            str(path),
            "fetch",
            "--depth=1",
            f"https://github.com/maharshimak/{name}.git",
            revision,
        ],
        check=True,
    )
    subprocess.run(["git", "-C", str(path), "checkout", "--detach", "FETCH_HEAD"], check=True)
