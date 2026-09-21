"""Build static Pages output with content-derived asset versions and release provenance."""

import hashlib
import json
import os
import re
import shutil
from pathlib import Path

source, target = Path("demo"), Path("dist-site")
if target.exists():
    shutil.rmtree(target)
shutil.copytree(source, target)
for page in target.rglob("*.html"):

    def version(match, page=page):
        attr, url = match.groups()
        clean = url.split("?")[0]
        asset = (page.parent / clean).resolve()
        if clean.startswith(("https:", "http:", "//", "#")) or asset.suffix not in (".js", ".css"):
            return match.group(0)
        if not asset.is_relative_to(target.resolve()) or not asset.is_file():
            raise ValueError(f"Missing local asset {url} in {page}")
        digest = hashlib.sha256(asset.read_bytes()).hexdigest()[:16]
        return f'{attr}="{clean}?v={digest}"'

    page.write_text(re.sub(r'(src|href)="([^"]+)"', version, page.read_text()))
files = {
    str(p.relative_to(target)): hashlib.sha256(p.read_bytes()).hexdigest()
    for p in sorted(target.rglob("*"))
    if p.is_file()
}
(target / "release.json").write_text(
    json.dumps({"commit": os.environ.get("GITHUB_SHA", "local"), "assets": files}, indent=2)
)
print(f"Built {len(files)} files with content-derived versions.")
