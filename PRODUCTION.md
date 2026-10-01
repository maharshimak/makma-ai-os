# Production engineering

Mak'ma contains execution-budget primitives in `makma.reliability`, but they are **not yet wired into every runtime/provider/tool path**. They should therefore be treated as reusable building blocks rather than an enforced production guarantee.

## Controls enforced today

- Remote runtime endpoints require `MAKMA_API_TOKEN` unless both the peer and Host header are local.
- Privileged workflow actions pause at the exact pending step.
- Ordinary workflow resume requests cannot grant approval.
- Privileged approval requires a separate `MAKMA_APPROVAL_TOKEN` and authorizes only that persisted pending step.
- Tool allow-lists, input schemas and risk metadata are enforced by the registry.
- Run and tool-call outcomes are persisted for audit.
- CI runs linting, tests, package/container validation and full-history secret scanning.

## Controls not yet fully integrated

- Execution budgets are implemented as primitives but are not yet mandatory around every planner, provider and tool call.
- Retry/circuit-breaker primitives are not yet a universal runtime boundary.
- Multi-user identity, session ownership and approver identity are not implemented.
- Approval tokens are server-held shared secrets rather than signed, expiring per-action challenges.

Do not describe the items above as enforced production controls until they are connected to the primary execution path and covered by integration tests.

## Release gate

Run installation, Ruff, pytest, wheel/container checks, security-history scanning and browser/product verification before release. Keep provider and approval credentials outside the repository.
