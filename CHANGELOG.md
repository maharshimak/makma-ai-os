# Changelog

All notable engineering changes to this repository are documented here.

The format follows the intent of [Keep a Changelog](https://keepachangelog.com/) and uses semantic versioning principles where releases are created.

## [Unreleased]

### Orchestration core
- Workflow engine: explicit run/step state machines, JSON-Schema-validated inputs, DAG pre-flight (tools, permissions, references), idempotency keys, crash recovery, per-step timeouts, bounded retries for declared-retryable steps, cancellation and a persisted trace with run/correlation/trace/span ids.
- Approvals are bound to the awaiting step and its resolved-argument digest; they can no longer be pre-granted at workflow start.
- Fixed: workflow API failed with `sqlite3.ProgrammingError` when requests were served on a different thread than the one that created the store.
- Fixed: an unexpected tool exception left the workflow persisted as `running`; it now fails the run with `STEP_EXCEPTION`.
- Tool arguments are additionally validated with full JSON Schema 2020-12; invalid tool schemas are rejected at registration.
- Cross-system workflows A (research evidence), B (governed ML) and C (media) over the real specialist packages, with explicit translation tools, a `blocked` run state, `approval_argument` and `accept_pending_approval` step translations, and a CI integration workflow (pinned packages + real FFmpeg job).
- `backend-lock.json` re-pinned to the specialist `feat/makma-labs-vnext-20261103` heads (agentic-rag-engine at `6750978`, which trims leading/trailing `.`, `-`, `_` from tokens so sentence-final terms match). The browser RAG tool mirrors that tokenizer and the deterministic `(-score, chunk_id)` tie-break; the regenerated parity fixture is identical to the previous one.
- Added `makma.v1` contract support: envelope model, schema validator for any specialist envelope, orchestrator operations (`/v1/capabilities`, `/v1/ops/{operation}`), and typed in-process/HTTP specialist adapters with an explicit `unavailable` state.

### Runtime intelligence
- Added relevance-ranked session memory recall while preserving strict session isolation.
- Added ordered multi-intent deterministic planning for explicit memory and calculator requests.
- Wired runtime, provider and tool execution into bounded telemetry.
- Added per-response execution metrics and telemetry/recall API endpoints.
- Prevented memory-search requests from retrieving the current search prompt itself.

### Engineering
- Added repository ownership and structured contribution workflows.
- Added Dependabot coverage for Python and GitHub Actions dependencies.
- Added issue and pull-request templates focused on reproducibility, validation, risk, and rollback.
- Added consistent editor configuration and engineering standards.

## Release policy

A release should describe user-visible behavior, compatibility notes, validation evidence, and any migration or rollback requirements. Repository history remains the source of truth for individual commits.
