# Production engineering

Mak'ma now includes explicit execution-budget accounting in `makma.reliability`. Agent runs can enforce hard ceilings for planning steps, tool calls, model calls, cost and elapsed time before state is committed.

## Operational gates

- Treat `BudgetExceeded` as a controlled stop, not an infrastructure failure.
- Configure budgets per environment and workload instead of silently allowing unbounded agent loops.
- Persist `BudgetSnapshot` with run traces so cost and tool usage are auditable.
- Keep provider credentials outside the repository and continue using the existing history security audit.
- Run installation, Ruff, pytest, wheel and Docker checks before release.

The ledger is atomic: a rejected consumption request does not partially mutate counters. This makes it suitable for permissioned tool execution and deterministic run histories.
