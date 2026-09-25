# Open-source architecture benchmark

This document records the engineering patterns MAK'MA uses as external benchmarks. It is
not a claim of feature parity and no third-party source code is copied into MAK'MA.

## Benchmark principles

| Reference project / ecosystem | Architectural principle used as a benchmark | MAK'MA direction |
| --- | --- | --- |
| LangGraph | Durable execution, checkpoints and human-in-the-loop interrupts | SQLite-backed workflow checkpoints, dependency-aware execution, pause/resume approval gates |
| Dify | Composable workflows, tools and integrations | AI OS as the orchestrator for specialist MAK'MA services rather than isolated demos |
| Letta | Long-lived stateful agents and memory | Durable session/run state, hybrid recall and explicit memory/provider boundaries |
| RAGFlow / modern RAG stacks | Multi-stage retrieval rather than a single similarity search | BM25 + embeddings + fusion + model query decomposition + MMR / learned reranking |
| Microsoft GraphRAG | Extracted knowledge graphs and community-level context | Evidence-anchored model extraction plus optional graph community analytics |
| Langfuse / Arize Phoenix | Traces, datasets, experiments and evaluation as first-class infrastructure | Versioned eval datasets, live runs, semantic judges and optional OTLP metrics export |
| DB-GPT / enterprise text-to-SQL systems | Data access policy must remain independent of model planning | SQL AST sandbox plus table/column/row-scope authorization after planning |
| Docling | Layout- and OCR-aware document understanding | Optional Docling ingestion feeding evidence-grounded structured extraction |
| MLflow | Run identity, parameters, metrics, artifacts and lifecycle are connected | Durable experiment ledger, model fingerprints, quality gates and control-plane state |
| Diffusers / ComfyUI | Modular model backends and explicit execution graphs | Optional real Whisper/Diffusers backends alongside deterministic FFmpeg execution |

## Non-negotiable MAK'MA engineering rules

1. **A demo must never claim an action that did not happen.** Browser-only simulations stay
   visibly separated from backend/model execution.
2. **Model output is untrusted.** Tool arguments, SQL, extracted facts, graph relationships
   and judge outputs pass deterministic validation before they affect state.
3. **Side effects require an explicit boundary.** Read-only tools can compose freely; lifecycle
   mutations and future external actions require approval-aware execution.
4. **Evidence travels with claims.** Retrieval citations, document spans and graph-edge evidence
   remain inspectable instead of being collapsed into an opaque answer.
5. **Optional AI dependencies stay optional.** Heavy model runtimes are lazy adapters, so the
   core remains testable without GPUs, API keys or model downloads.
6. **Reproducibility beats screenshots.** Fingerprints, datasets, run manifests, experiment
   records and CI should make important behavior repeatable.
7. **Observability is infrastructure.** Local summaries are useful, but production integrations
   need exportable telemetry and evaluators.
8. **Every product needs a real job.** New MAK'MA repositories should only be created when the
   capability cannot sensibly live as a module/tool of an existing system.

## Target platform shape

```text
                         MAK'MA AI OS
                  durable workflow / approvals
                              |
        +---------------------+----------------------+
        |                     |                      |
   RAG / Knowledge       Secure Data            Multimodal /
      services             Copilot               Document AI
        |                     |                      |
        +---------------------+----------------------+
                              |
                    LLM Eval & Observability
                              |
                 MLOps Pipeline / Control Plane
```

The goal is depth and composition: fewer disconnected showcase pages, more specialist
capabilities that can be invoked, measured, audited and governed through one runtime.
