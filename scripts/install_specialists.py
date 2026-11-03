"""pip-install the eight specialist packages at the revisions pinned in backend-lock.json.

Used by the integration CI jobs. Any failure (unknown entry, network, build) exits
non-zero so the job fails instead of silently testing against a missing specialist.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

lock = json.loads(Path("backend-lock.json").read_text(encoding="utf-8"))
requirements = []
for name, revision in sorted(lock.items()):
    if not re.fullmatch(r"[a-z0-9-]+", name) or not re.fullmatch(r"[a-f0-9]{40}", revision):
        raise SystemExit(f"Invalid backend lock entry: {name!r}")
    requirements.append(f"{name} @ git+https://github.com/maharshimak/{name}.git@{revision}")
if len(requirements) != 8:
    raise SystemExit(f"Expected 8 pinned specialists, found {len(requirements)}")
subprocess.run([sys.executable, "-m", "pip", "install", *requirements], check=True)
print(f"Installed {len(requirements)} pinned specialists.")
