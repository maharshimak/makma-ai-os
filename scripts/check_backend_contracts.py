"""Validate all eight immutable satellite backends before browser parity checks."""

from __future__ import annotations

import ast
import json
from pathlib import Path

EXPECTED = {
    "agentic-rag-engine": ("rag_engine", "storage.py"),
    "multimodal-ai-studio": ("multimodal_studio", "executor.py"),
    "knowledge-twin": ("knowledge_twin", "storage.py"),
    "clinical-document-intelligence": ("clinical_intel", "provenance.py"),
    "secure-data-copilot": ("data_copilot", "safety.py"),
    "llm-eval-observability": ("llm_eval", "providers.py"),
    "mlops-control-plane": ("mlops_cp", "registry.py"),
    "mlops-production-pipeline": ("mlops_pipeline", "pipeline.py"),
}


def main() -> None:
    locks = json.loads(Path("backend-lock.json").read_text())
    if set(locks) != set(EXPECTED):
        missing = sorted(set(EXPECTED) - set(locks))
        extra = sorted(set(locks) - set(EXPECTED))
        raise SystemExit(f"backend lock mismatch: missing={missing}, extra={extra}")

    total_files = 0
    for repository, (package, required_module) in EXPECTED.items():
        root = Path("parity-backends") / repository
        package_root = root / "src" / package
        required = package_root / required_module
        if not (root / "pyproject.toml").is_file():
            raise SystemExit(f"{repository}: missing pyproject.toml")
        if not package_root.is_dir():
            raise SystemExit(f"{repository}: missing package {package}")
        if not required.is_file():
            raise SystemExit(f"{repository}: missing required capability {required_module}")

        files = sorted(package_root.rglob("*.py"))
        if not files:
            raise SystemExit(f"{repository}: no Python source files found")
        for path in files:
            try:
                ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            except (SyntaxError, UnicodeError) as error:
                raise SystemExit(f"{repository}: invalid Python source {path}: {error}") from error
        total_files += len(files)
        print(
            f"BACKEND CONTRACT PASS {repository} "
            f"{locks[repository][:12]} files={len(files)} required={required_module}"
        )

    print(f"All {len(EXPECTED)} backend locks validated; parsed {total_files} Python files.")


if __name__ == "__main__":
    main()
