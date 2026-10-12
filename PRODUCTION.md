# Production engineering

Mak'ma applies per-request `ExecutionBudget` and `BudgetLedger` controls to the primary chat run and streaming paths. The planner, tool calls, and provider generation are bounded by a monotonic per-request deadline. This is a bounded **single-request** contract, not global worker or monetary-cost enforcement.

## Controls enforced today

- Remote runtime endpoints require `MAKMA_API_TOKEN` unless both the peer and Host header are local.
- Privileged workflow actions pause at the exact pending step.
- Ordinary workflow resume requests cannot grant approval.
- Privileged approval requires a separate `MAKMA_APPROVAL_TOKEN` and authorizes only that persisted pending step.
- Tool allow-lists, input schemas and risk metadata are enforced by the registry.
- Run and tool-call outcomes are persisted for audit.
- Chat run/stream limit planned steps, tool-call count, and model-call count; provider and tool await points respect a per-run deadline. Budget exceptions fail the recorded run.
- CI runs linting, tests, package/container validation and full-history secret scanning.

## Controls not yet fully integrated

- Workflow-engine/background-worker paths do not yet share the chat runtime budget ledger. Concurrent users are not governed by a global quota.
- `max_cost_usd` remains a configuration guard only; accurate dollar-cost enforcement requires validated provider usage and pricing telemetry.
- Retry/circuit-breaker primitives are not yet a universal runtime boundary.
- Multi-user identity, session ownership and approver identity are not implemented.
- Approval tokens are server-held shared secrets rather than signed, expiring per-action challenges.

Do not describe monetary spending caps, global concurrency limits, or workflow execution budgets as enforced until their dedicated metering and integration tests exist.

## Release gate

Run installation, Ruff, pytest, wheel/container checks, security-history scanning and browser/product verification before release. Keep provider and approval credentials outside the repository.
