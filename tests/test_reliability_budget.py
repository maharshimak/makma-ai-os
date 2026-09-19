import pytest

from makma.reliability import BudgetExceeded, BudgetLedger, ExecutionBudget


def test_budget_ledger_commits_usage_atomically() -> None:
    ledger = BudgetLedger(
        ExecutionBudget(
            max_steps=2,
            max_tool_calls=2,
            max_model_calls=2,
            max_cost_usd=0.5,
            max_elapsed_ms=1_000,
        )
    )
    first = ledger.consume(steps=1, tool_calls=1, cost_usd=0.1, elapsed_ms=100)
    assert first.steps == 1
    assert first.cost_usd == pytest.approx(0.1)

    with pytest.raises(BudgetExceeded, match="step budget"):
        ledger.consume(steps=2, cost_usd=0.1)

    assert ledger.snapshot() == first


def test_budget_rejects_invalid_configuration_and_usage() -> None:
    with pytest.raises(ValueError):
        ExecutionBudget(max_steps=0)

    ledger = BudgetLedger(ExecutionBudget())
    with pytest.raises(ValueError):
        ledger.consume(tool_calls=-1)
