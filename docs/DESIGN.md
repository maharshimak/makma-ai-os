# Design and operating boundaries

Personal AI runtime with ranked SQLite memory recall, deterministic plus optional schema-constrained model planning, permission checks, bounded telemetry and local/model-server adapters.

## Scope

The default local provider is deterministic, not an LLM. Ranked memory recall uses lexical overlap, phrase matching and recency rather than embeddings, so it must not be described as semantic memory. OpenAI-compatible and Ollama adapters stream provider chunks natively; local deterministic mode emits one completed local chunk. Protected API routes are local-first and single-owner: non-loopback clients require `MAKMA_API_TOKEN`, but sessions are still identifiers rather than per-user authorization boundaries. Client chat payloads cannot assert approvals. No high-risk tools are registered by default; any tool marked approval-required is gated by a server-created, expiring, one-time challenge bound to the session, tool and canonical argument hash. Run lifecycle status and failures persist. Tool attempts also persist digest-only audit metadata (tool/step, argument/result hashes, outcome and latency) without copying raw tool payloads into the audit table. Runtime telemetry is bounded and process-local. SQLite operations are synchronous. No shell, filesystem, browser or autonomous background execution is implemented.

## Execution model

The default deterministic planner recognizes explicit supported intents and can emit multiple ordered tool steps before a final response step. Optional `hybrid` and `model` modes ask the configured provider for a JSON tool plan, then reject unknown tools, validate declared argument schemas, enforce a step cap and fall back to deterministic planning when model output is malformed or unsafe. The runtime policy and one-time approval layer remains authoritative regardless of planner mode. Memory tools execute before the current user message is persisted so a recall request cannot retrieve itself. Tool, provider and full-run latency/success measurements are recorded in a bounded telemetry collector and per-run execution metrics are returned with chat responses.

## Interfaces

Implementation lives in `src/makma/`. Public examples in the README use its Python API. FastAPI exposes the same local capabilities; `/openapi.json` is the endpoint schema. Ranked recall is available separately from the compatibility search endpoint, and telemetry summaries can be queried by operation.

The static runtime console in `demo/` is intentionally split into two modes. Browser Demo Mode reproduces the public request/response contract for supported calculator and lexical-memory flows without claiming backend execution. Connected Runtime mode verifies a real `/health` endpoint before sending requests to the FastAPI service. Cross-origin access is restricted to configured origins through `MAKMA_CORS_ORIGINS`.

## Validation

Tests include synthetic regression fixtures. Package and container checks verify installation separately from source-tree imports. Tests do not certify general model quality, clinical correctness or multi-tenant isolation.

## Planned evolution

Semantic/vector memory; multi-user identity/session ownership if needed; async database access; pooled provider clients; OpenTelemetry export; cross-product service adapters; isolated workers and sandboxes for long-running or higher-risk tools.
