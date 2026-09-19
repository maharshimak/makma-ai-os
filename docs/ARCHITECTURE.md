# Mak'ma AI OS V2 Architecture

Mak'ma V2 is organized around five boundaries:

1. **Runtime** — owns one request lifecycle and emits an auditable `ChatResponse`.
2. **Memory** — persists session messages and run metadata in SQLite.
3. **Planner** — creates explicit plan steps before tool execution.
4. **Tool Registry + Permission Policy** — separates capability discovery from authorization.
5. **Provider Layer** — keeps the orchestration independent from Ollama or OpenAI-compatible model servers.

## Request lifecycle

1. Load prior messages for the session.
2. Plan the incoming message.
3. Persist the new user message.
4. Execute permitted tool steps.
5. Send history + tool results to the configured provider.
6. Persist the assistant response.
7. Persist run metadata including provider and latency.
8. Return response, plan, and tool traces to the caller.

## Security boundary

No generic Python execution, shell execution, or unrestricted filesystem tool ships in V2. New tools must be registered explicitly and can be placed behind `approval_required_tools` in `PermissionPolicy`.
