"""Generate browser expectations by executing pinned Python domain packages."""

import argparse
import hashlib
import json
import sys
from dataclasses import asdict
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--backend-root", type=Path, default=Path(".."))
parser.add_argument("--check", action="store_true")
args = parser.parse_args()
for name in ("agentic-rag-engine", "mlops-production-pipeline", "mlops-control-plane"):
    sys.path.insert(0, str(args.backend_root / name / "src"))
from mlops_cp.canary import CanarySnapshot, evaluate_canary  # noqa: E402
from mlops_pipeline.core import mae, psi, train  # noqa: E402
from rag_engine.embeddings import HashEmbeddingProvider  # noqa: E402
from rag_engine.evaluation import evaluate_retrieval  # noqa: E402
from rag_engine.models import Chunk  # noqa: E402
from rag_engine.rerank import TransparentReranker  # noqa: E402
from rag_engine.retrieval import BM25Index, VectorIndex, reciprocal_rank_fusion  # noqa: E402

texts = ["MAKMA RAG RAG", "Café 世界 __proto__", "", "token, token. token"]
docs = [
    dict(id="a", text="Hybrid retrieval ranks evidence."),
    dict(id="b", text="Memory stores facts."),
    dict(id="c", text="Retrieval combines lexical evidence and vectors."),
]
chunks = [
    Chunk(
        id=d["id"],
        document_id=d["id"],
        text=d["text"],
        start_token=0,
        end_token=len(d["text"].split()),
    )
    for d in docs
]
query = "retrieval evidence"
lexical = BM25Index(chunks).search(query)
semantic = VectorIndex(chunks).search(query)
fused = reciprocal_rank_fusion([lexical, semantic])
ranked = TransparentReranker().rerank(query, fused, 3)


def rows(items):
    return [dict(id=x.chunk.id, score=x.score) for x in items]


expected = [25, 25, 25, 25]
actual = [24, 26, 27, 23]
model = train([1, 2, 3, 4], [2, 4, 6, 8])
prod = CanarySnapshot(2000, 0.015, 620, 0.9)
candidate = CanarySnapshot(350, 0.018, 710, 0.91)
fixture = dict(
    texts=texts,
    vectors=HashEmbeddingProvider().embed(texts),
    docs=docs,
    query=query,
    lexical=rows(lexical),
    semantic=rows(semantic),
    fused=rows(fused),
    ranked=rows(ranked),
    metrics=[
        dict(
            relevant=relevant,
            result=asdict(evaluate_retrieval(set(relevant), [x.chunk.id for x in ranked], 3)),
        )
        for relevant in (["a", "c"], [])
    ],
    psi=dict(expected=expected, actual=actual, value=psi(expected, actual)),
    model=dict(slope=model.slope, intercept=model.intercept, mae=mae(model, [5, 6], [10, 12])),
    canary=dict(
        production=asdict(prod),
        candidate=asdict(candidate),
        decision=asdict(evaluate_canary(prod, candidate, 20)),
    ),
    sha256=dict(
        payload='{"intercept":0,"slope":2,"version":"1.0.0"}',
        value=hashlib.sha256(b'{"intercept":0,"slope":2,"version":"1.0.0"}').hexdigest(),
    ),
)
target = Path("tests/fixtures/python-parity.json")
content = json.dumps(fixture, indent=2, ensure_ascii=False) + "\n"
if args.check:
    if target.read_text() != content:
        raise SystemExit("Python parity fixtures changed: investigate browser/backend drift.")
else:
    target.write_text(content)
