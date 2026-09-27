"""Reconstruct Portfolio V4 from committed source manifest parts."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "portfolio-v4-source"
TARGET = ROOT / "portfolio-v4"

if TARGET.exists():
    shutil.rmtree(TARGET)
TARGET.mkdir(parents=True, exist_ok=True)

parts = sorted(SOURCE.glob("part*.json"))
if not parts:
    raise SystemExit("No Portfolio V4 manifests found")

count = 0
for part in parts:
    payload = json.loads(part.read_text(encoding="utf-8"))
    for relative, text in payload.items():
        dest = TARGET / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(text, encoding="utf-8")
        count += 1

print(f"Materialized Portfolio V4: {count} files")
