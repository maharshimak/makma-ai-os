# Design and operating boundaries

Personal AI runtime with ranked SQLite memory recall, deterministic multi-intent tool planning, permission checks, bounded telemetry and local/model-server adapters.

## Scope

The default local provider is deterministic, not an LLM. Ranked memory recall uses lexical overlap, phrase matching and recency rather than embeddings, so it must not be described as semantic memory. SSE replays a completed answer rather than streaming model tokens. Sessions are identifiers, not authentication boundaries. API-provided approvals are intended for a trusted local client, not multi-user authorization. Run history persists responses and metadata; full tool traces are returned with the response, not persisted. Runtime telemetry is bounded and process-local. SQLite operations are synchronous. No shell, filesystem, browser or autonomous background execution is implemented.

## Execution model

The planner recognizes explicit supported intents and can emit multiple ordered tool steps before a final response step. Memory tools execute before the current user message is persisted so a recall request cannot retrieve itself. Tool, provider and full-run latency/success measurements are recorded in a bounded telemetry collector and per-run execution metrics are returned with chat responses.

## Interfaces

Implementation lives in `src/makma/`. Public examples in the README use its Python API. FastAPI exposes the same local capabilities; `/openapi.json` is the endpoint schema. Ranked recall is available separately from the compatibility search endpoint, and telemetry summaries can be queried by operation.

## Validation

Tests include synthetic regression fixtures. Package and container checks verify installation separately from source-tree imports. Tests do not certify general model quality, clinical correctness or multi-tenant isolation.

## Planned evolution

Authenticated sessions; semantic/vector memory; durable tool traces; native provider streaming; schema-validated model planning; OpenTelemetry export; isolated workers for any future higher-risk tools.
