# Design and operating boundaries

Personal AI runtime with SQLite memory, deterministic tool planning, permission checks and local/model-server adapters.

## Scope

The default local provider is deterministic, not an LLM. SSE replays a completed answer rather than streaming model tokens. Sessions are identifiers, not authentication boundaries. API-provided approvals are intended for a trusted local client, not multi-user authorization. Run history persists responses and metadata; full tool traces are returned with the response, not persisted. SQLite operations are synchronous. No shell, filesystem, browser or autonomous background execution is implemented.

## Interfaces

Implementation lives in `src/makma/`. Public examples in the README use its Python API. FastAPI exposes the same local capabilities; `/openapi.json` is the endpoint schema.

## Validation

Tests include synthetic regression fixtures. Package and container checks verify installation separately from source-tree imports. Tests do not certify general model quality, clinical correctness or multi-tenant isolation.

## Planned evolution

Authenticated sessions; durable tool traces; native provider streaming; structured model planning; isolated workers for any future higher-risk tools.
