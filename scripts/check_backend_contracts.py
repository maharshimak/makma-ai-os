"""Verify every pinned MAK'MA backend was fetched with its expected package contract."""

from pathlib import Path

BACKENDS = {
    "agentic-rag-engine": "rag_engine",
    "multimodal-ai-studio": "multimodal_studio",
    "knowledge-twin": "knowledge_twin",
    "clinical-document-intelligence": "clinical_intel",
    "secure-data-copilot": "data_copilot",
    "llm-eval-observability": "llm_eval",
    "mlops-control-plane": "mlops_cp",
    "mlops-production-pipeline": "mlops_pipeline",
}

root = Path("parity-backends")
missing: list[str] = []
for repository, package in BACKENDS.items():
    repo_root = root / repository
    required = [
        repo_root / "pyproject.toml",
        repo_root / "src" / package / "__init__.py",
    ]
    for path in required:
        if not path.is_file():
            missing.append(str(path))

if missing:
    raise SystemExit(
        "Pinned backend contract is incomplete:\n" + "\n".join(f"- {path}" for path in missing)
    )

print(f"Backend contract PASS: {len(BACKENDS)} pinned packages present.")
