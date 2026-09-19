from dataclasses import dataclass
from math import isfinite


class BudgetExceeded(RuntimeError):
    """Raised when an execution would exceed an explicit runtime budget."""


def _positive_int(name: str, value: int) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError(f"{name} must be a positive integer")


def _non_negative_int(name: str, value: int) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{name} must be a non-negative integer")


def _non_negative_number(name: str, value: float) -> None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} must be a finite non-negative number")
    if not isfinite(float(value)) or value < 0:
        raise ValueError(f"{name} must be a finite non-negative number")


@dataclass(frozen=True, slots=True)
class ExecutionBudget:
    max_steps: int = 12
    max_tool_calls: int = 8
    max_model_calls: int = 6
    max_cost_usd: float = 1.0
    max_elapsed_ms: float = 30_000.0

    def __post_init__(self) -> None:
        _positive_int("max_steps", self.max_steps)
        _positive_int("max_tool_calls", self.max_tool_calls)
        _positive_int("max_model_calls", self.max_model_calls)
        _non_negative_number("max_cost_usd", self.max_cost_usd)
        _non_negative_number("max_elapsed_ms", self.max_elapsed_ms)
        if self.max_cost_usd == 0 or self.max_elapsed_ms == 0:
            raise ValueError("cost and elapsed-time budgets must be greater than zero")


@dataclass(frozen=True, slots=True)
class BudgetSnapshot:
    steps: int
    tool_calls: int
    model_calls: int
    cost_usd: float
    elapsed_ms: float


class BudgetLedger:
    """Atomic budget accounting for agent/model/tool execution."""

    def __init__(self, budget: ExecutionBudget) -> None:
        self.budget = budget
        self._steps = 0
        self._tool_calls = 0
        self._model_calls = 0
        self._cost_usd = 0.0
        self._elapsed_ms = 0.0

    def snapshot(self) -> BudgetSnapshot:
        return BudgetSnapshot(
            steps=self._steps,
            tool_calls=self._tool_calls,
            model_calls=self._model_calls,
            cost_usd=self._cost_usd,
            elapsed_ms=self._elapsed_ms,
        )

    def consume(
        self,
        *,
        steps: int = 0,
        tool_calls: int = 0,
        model_calls: int = 0,
        cost_usd: float = 0.0,
        elapsed_ms: float = 0.0,
    ) -> BudgetSnapshot:
        _non_negative_int("steps", steps)
        _non_negative_int("tool_calls", tool_calls)
        _non_negative_int("model_calls", model_calls)
        _non_negative_number("cost_usd", cost_usd)
        _non_negative_number("elapsed_ms", elapsed_ms)

        candidate = BudgetSnapshot(
            steps=self._steps + steps,
            tool_calls=self._tool_calls + tool_calls,
            model_calls=self._model_calls + model_calls,
            cost_usd=self._cost_usd + float(cost_usd),
            elapsed_ms=self._elapsed_ms + float(elapsed_ms),
        )
        exceeded: list[str] = []
        if candidate.steps > self.budget.max_steps:
            exceeded.append("step budget")
        if candidate.tool_calls > self.budget.max_tool_calls:
            exceeded.append("tool-call budget")
        if candidate.model_calls > self.budget.max_model_calls:
            exceeded.append("model-call budget")
        if candidate.cost_usd > self.budget.max_cost_usd:
            exceeded.append("cost budget")
        if candidate.elapsed_ms > self.budget.max_elapsed_ms:
            exceeded.append("elapsed-time budget")
        if exceeded:
            raise BudgetExceeded("Execution would exceed: " + ", ".join(exceeded))

        self._steps = candidate.steps
        self._tool_calls = candidate.tool_calls
        self._model_calls = candidate.model_calls
        self._cost_usd = candidate.cost_usd
        self._elapsed_ms = candidate.elapsed_ms
        return candidate
