# Orchestration core

This document describes the workflow engine (`makma.workflows`), the `makma.v1` contract
(`makma.contracts`) and the specialist adapters (`makma.specialists`). Every guarantee listed
here is covered by a test in `tests/test_workflow_engine.py`, `tests/test_specialists.py`,
`tests/test_contracts.py`, `tests/test_orchestrator_api.py` or `tests/test_tool_hardening.py`.

## Workflow definition

```python
from makma.workflows import WorkflowSpec, WorkflowStep

spec = WorkflowSpec(
    name="retrieve-then-ingest",
    input_schema={"type": "object", "required": ["q"], "properties": {"q": {"type": "string"}}},
    steps=(
        # tool step: registered ToolRegistry tool
        WorkflowStep("calc", "calculator", {"expression": "2 * 21"}),
        # specialist step: makma.v1 operation of another system
        WorkflowStep("r", specialist="agentic-rag-engine", operation="retrieve",
                     arguments={"query": "${inputs.q}", "top_k": 3},
                     retryable=True, max_attempts=3, timeout_s=10),
        WorkflowStep("i", specialist="agentic-rag-engine", operation="ingest",
                     arguments={"doc": "${steps.r.data.hits.0.id}"}, depends_on=("r",)),
    ),
    permissions=None,  # None = exactly the actions the steps use
)
```

References are whole-string values and must point at a declared input or a transitive
dependency, otherwise validation fails before anything runs:

| Reference | Value |
| --- | --- |
| `${inputs.NAME[.path]}` | validated workflow input |
| `${steps.ID.output}` | exact output string (tool output, or canonical JSON of the specialist envelope) |
| `${steps.ID.data[.path]}` | specialist envelope `data` (or parsed JSON tool output); list indices are numeric path parts |

Step fields: `retryable` (default False) is required for `max_attempts > 1` (1–10);
`timeout_s` in (0, 3600]; `requires_approval` can only add a gate. A non-idempotent
side-effecting tool cannot be declared retryable.

Specialist approval translation (opt-in, specialist steps only):

* `approval_argument="approved"` — after *this engine* recorded an approval for the step, it
  sets the specialist's own approval flag to `true`. The key may not appear in the workflow
  arguments (validation error), so a client or model cannot supply it.
* `accept_pending_approval=True` — a specialist `pending_approval` envelope completes the step
  with its data (trace detail `specialist_requires_approval`, policy reasons). The human
  decision must be taken by an approval-gated downstream step. Without the flag such an
  envelope fails the step with `SPECIALIST_REQUIRES_APPROVAL`.

## Execution guarantees

* **Pre-flight:** inputs are validated against `input_schema` (JSON Schema 2020-12); every tool
  must exist and every action (`tool_name` or `"<system>.<operation>"`) must be in
  `engine.policy.allowed_tools ∩ spec.permitted_actions()`.
* **State machines:** runs `pending → running → {paused, succeeded, failed, blocked,
  cancelled}`, `paused → {running, cancelled}`; steps `pending → {awaiting_approval, running,
  failed, cancelled}`, `running → {succeeded, failed, blocked, pending (retry/recovery),
  uncertain, cancelled}`,
  `uncertain → {awaiting_approval, cancelled}`. Anything else raises `IllegalTransition`.
* **Durability:** a step's `running` state and idempotency key are committed before it runs;
  its exact result is committed atomically with `succeeded`, together with the trace events.
  Completed steps are never re-executed.
* **Approval:** a gated step pauses the run. `resume(run_id, approved_steps={step})` accepts
  only the step that is `awaiting_approval`, bound to the SHA-256 of its resolved arguments.
  Approvals cannot be passed to `start()`; they are never read from arguments, tool output or
  model output. Over HTTP, `/approve` requires the separate `MAKMA_APPROVAL_TOKEN`.
  Gates: tool `requires_approval`/`side_effects`/`risk_level == "high"`; specialist operation
  `side_effects`/`requires_approval` from its capabilities; policy `approval_required_tools`.
* **Crash recovery:** `recover(run_id)` on a run left `running` re-executes interrupted
  read-only (or `idempotent=True`) steps with the same idempotency key, and moves an
  interrupted non-idempotent side-effecting step to `uncertain → awaiting_approval`
  (`pending_reason="uncertain_side_effect"`) instead of repeating it.
* **Retries/timeouts:** timeouts and unexpected exceptions are retryable failures; schema and
  permission rejections are not. Retries happen only for `retryable=True` steps, up to
  `max_attempts`. An unexpected exception fails the run (`STEP_EXCEPTION`) instead of leaving it
  `running`.
* **Cancellation:** `cancel(run_id)` cancels a paused run immediately and an in-flight step in
  the same process (`step_interrupted` with `outcome_uncertain: true`).
* **Trace:** `engine.trace(run_id)` returns events with `run_id`, `correlation_id`, `trace_id`
  (32 hex), `span_id` (16 hex, one per step, shared by its attempts), `parent_span_id`
  (the run's root span), `step_id`, `attempt` and `detail` (output SHA-256, idempotency key,
  linked specialist `trace_id`/`span_id`).

Limitations: steps run sequentially in topological order; one orchestrator process per
SQLite store (the in-process lock rejects concurrent advances with `WorkflowBusy`, but there is
no cross-process lease); execution budgets from PR #17 are not yet applied to workflows.
A specialist answering `blocked` ends the run `blocked` with the specialist's own error code
and policy reasons in the trace.

## Cross-system workflows

`makma.crosssystem` defines three workflows over the real specialist packages, plus the
translation tools that close the gaps between specialist contracts (each is deterministic and
refuses to invent data). `tests/integration/test_cross_system.py` runs them in-process against
the revisions pinned in `backend-lock.json` (CI workflow `Cross-system integration`; locally:
`python scripts/install_specialists.py` then `MAKMA_INTEGRATION=1 pytest -m integration`).

| Workflow | Execution path | Approval gates |
| --- | --- | --- |
| A `research-evidence` | clinical-document-intelligence `extract` → `evidence_entities` → knowledge-twin `extract` → `candidate_graph` → knowledge-twin `import_graph` → `query_path` → agentic-rag-engine `ingest` → `answer` + `retrieve` → llm-eval-observability `validate_citations`; `relevance_judgment` → `score_retrieval` | `rag_ingest` |
| B `governed-ml` | secure-data-copilot `query` (server access policy) → mlops-production-pipeline `validate_dataset` → `train` → `evaluate_candidate`; `artifact_reference` → mlops-control-plane `register_candidate` (pipeline export) → `verify_artifact` → `evaluate_promotion` (`accept_pending_approval`) → `record_lifecycle_transition` (simulated) | `train`, `register`, `verify_artifact` (declared side effects), `transition` |
| C `media-edit` | multimodal-ai-studio `plan` → `execute` (`approval_argument="approved"`) → `verify_artifact` | `execute` |

What the integration tests assert (recomputed, not hard-coded): A — clinical document SHA-256
and knowledge-twin `source_sha256` equal the SHA-256 of the input text, every evidence span and
edge quote is the exact substring, the 2-hop path relations, ingested document hashes, answer
citations ⊆ retrieved ids, `validate_citations` over exactly those ids, and recall recomputed
from the knowledge-twin evidence document. B — query rows equal a direct SQLite read (denied
column absent), one dataset SHA-256 across validation/training/evaluation, the artifact file's
SHA-256 equals the pipeline claim, the registered claim and the verified artifact, evidence
SHA-256 carried into the transition record; a noisy dataset fails the pipeline gate and the run
ends `blocked` at `evaluate_promotion` (`PROMOTION_DENIED`) with no transition; querying the
denied column ends `blocked` (`POLICY_DENIED`). C — without FFmpeg the run fails with
`FFMPEG_UNAVAILABLE` after approval and writes nothing; with FFmpeg (CI `media` job) the output
file's SHA-256 equals the render and verification results and ffprobe reports `verified`.

Contract gaps found and how they are handled (orchestrator side only):

* multimodal-ai-studio `execute` takes its own `approved` flag → `approval_argument`.
* mlops-control-plane `evaluate_promotion` returns `pending_approval` with data, and its
  makma.v1 contract has no approve/promote operation → `accept_pending_approval` plus an
  AI OS-gated **simulated** `record_lifecycle_transition`; the control plane stays unchanged
  (a later `evaluate_promotion` still answers `pending_approval`).
* mlops-control-plane `verify_artifact` needs a path relative to its artifact root, the
  pipeline returns an absolute path → `artifact_reference`; both must share one root.
* knowledge-twin needs explicit entities and a serialized graph → `evidence_entities`,
  `candidate_graph`.
* agentic-rag-engine `answer` returns chunk ids without document ids → a read-only `retrieve`
  step feeds `relevance_judgment`.
* secure-data-copilot reads its database and access policy only from process environment
  variables, so one orchestrator process can host one copilot configuration in-process.
* All eight packages echo `run_id`/`correlation_id`; no translation was needed there.

### Proposed merge order

1. Specialist PRs (independent of each other; mlops-production-pipeline before
   mlops-control-plane because the control plane consumes the pipeline export format).
2. Re-pin `backend-lock.json` to the merged `main` SHAs (the current pins are feature-branch
   heads) and regenerate `tests/fixtures/python-parity.json`.
3. makma-ai-os: #19, #17, then this PR (expect a one-line README conflict with #17).

## makma.v1 (orchestrator side)

`contracts/makma.v1.schema.json` is the shared schema (byte-identical copy packaged as
`makma/schemas/makma.v1.schema.json`; a test checks the SHA-256).

* `validate_envelope(payload, expected_system=, expected_operation=, expected_run_id=,
  expected_correlation_id=) -> list[str]` — schema violations plus RFC3339-UTC `started_at`,
  finite `duration_ms` and request expectations. Messages give location and keyword only and
  never echo values.
* `capabilities()` / `run_operation(operation, payload, *, run_id=None, correlation_id=None)`
  for the orchestrator's own operations, all `execution_mode: deterministic_offline`:

| Operation | Input | `data` |
| --- | --- | --- |
| `calculate` | `expression` | `{expression, result}` (AST-restricted arithmetic) |
| `plan_message` | `message` | `{planner: "rule_based", steps: [...]}` |
| `validate_workflow` | `name`, `steps`, `input_schema?` | `{valid, order, errors}` |
| `validate_envelope` | `envelope`, `expected_system?` | `{valid, violations}` |

## Specialist adapters

```python
from makma.specialists import (HttpSpecialistAdapter, InProcessSpecialistAdapter,
                               SpecialistRegistry)

specialists = SpecialistRegistry([
    InProcessSpecialistAdapter.from_module("knowledge-twin", "knowledge_twin.contracts"),
    HttpSpecialistAdapter("agentic-rag-engine", "https://rag.internal",
                          token_env="MAKMA_SPECIALIST_AGENTIC_RAG_ENGINE_TOKEN"),
])
outcome = await specialists.get("agentic-rag-engine").call(
    "retrieve", {"query": "q"}, run_id="r1", correlation_id="c1", retry_safe=True)
```

`call()` returns `SpecialistOutcome(system, operation, status, envelope, error, attempts)` with
`status` in `ok | error | blocked | pending_approval | unavailable`. `envelope` is set only for
envelopes that validated and matched the request; otherwise `error.code` is
`CONTRACT_VIOLATION` and nothing from the response is passed through.

HTTP transport: `POST {base}/v1/ops/{operation}` with the payload as JSON body (or
`{"payload", "run_id", "correlation_id"}` with `wrap_payload=True`), headers
`Authorization: Bearer <token from env at call time>`, `X-Makma-Run-Id`,
`X-Makma-Correlation-Id`, `traceparent`, `Idempotency-Key`. Redirects are refused
(`REDIRECT_REFUSED`); proxies/`.netrc` from the environment are ignored; a bearer token is never
sent over plain HTTP to a non-loopback host (`INSECURE_TRANSPORT`); responses are capped at 5 MiB.
Retries (default 3 attempts) happen only for retryable failures (connect errors, timeouts,
429/502/503/504, envelope `error.retryable`) of calls marked `retry_safe`; the engine marks a
call retry-safe only for `retryable=True` steps of operations declared without side effects.
Transport and step retries compose, so a read-only retryable step makes at most
`3 × max_attempts` calls.

The API builds its registry from `MAKMA_SPECIALIST_<SYSTEM>_URL` /
`MAKMA_SPECIALIST_<SYSTEM>_TOKEN` (system upper-snake-cased, e.g.
`MAKMA_SPECIALIST_AGENTIC_RAG_ENGINE_URL`). Workflow specialist actions are denied unless
listed in `MAKMA_WORKFLOW_SPECIALIST_ALLOWLIST` (comma-separated `system.operation`).
Unconfigured specialists report `unavailable` in `GET /v1/specialists` and fail steps with
`SPECIALIST_UNAVAILABLE`.

The older `rag_answer`, `data_ask`, `eval_judge` and `mlops_*` tools (`makma.integrations`)
still call the services' pre-contract endpoints and are unchanged.
