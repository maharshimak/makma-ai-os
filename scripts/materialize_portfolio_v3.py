"""Reconstruct the Portfolio V3 Next.js source tree from committed manifest parts."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "portfolio-v3-source"
TARGET_DIR = ROOT / "portfolio-v3"

if TARGET_DIR.exists():
    shutil.rmtree(TARGET_DIR)
TARGET_DIR.mkdir(parents=True, exist_ok=True)

parts = sorted(SOURCE_DIR.glob("part*.json"))
if not parts:
    raise SystemExit("No Portfolio V3 source manifest parts found")

written = 0
for part in parts:
    payload = json.loads(part.read_text(encoding="utf-8"))
    for relative, text in payload.items():
        destination = TARGET_DIR / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(text, encoding="utf-8")
        written += 1

print(f"Materialized Portfolio V3: {written} source files from {len(parts)} manifest parts")
