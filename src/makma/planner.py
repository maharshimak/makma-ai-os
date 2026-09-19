from __future__ import annotations

import re
from uuid import uuid4

from makma.models import PlanStep

_MATH_COMMAND = re.compile(
    r"\b(?:calculate|compute|evaluate)\s+([0-9\s+\-*/().%]+)",
    flags=re.IGNORECASE,
)
_PURE_MATH = re.compile(r"^[0-9\s+\-*/().%]+$")
_MEMORY_COMMAND = re.compile(
    r"\b(?:search|check|look in|find in)\s+(?:my\s+)?memory(?:\s+for)?\s*(.*)",
    flags=re.IGNORECASE,
)


class Planner:
    """Deterministic planner that turns obvious intents into auditable tool steps."""

    def plan(self, message: str) -> list[PlanStep]:
        text = message.strip()
        math_match = _MATH_COMMAND.search(text)
        if math_match:
            return [
                PlanStep(
                    id=str(uuid4()),
                    kind="tool",
                    description="Calculate the requested arithmetic expression.",
                    tool_name="calculator",
                    arguments={"expression": math_match.group(1).strip()},
                ),
                self._respond_step(),
            ]

        if _PURE_MATH.fullmatch(text) and any(character.isdigit() for character in text):
            return [
                PlanStep(
                    id=str(uuid4()),
                    kind="tool",
                    description="Evaluate the arithmetic expression.",
                    tool_name="calculator",
                    arguments={"expression": text},
                ),
                self._respond_step(),
            ]

        memory_match = _MEMORY_COMMAND.search(text)
        if memory_match:
            query = memory_match.group(1).strip() or text
            return [
                PlanStep(
                    id=str(uuid4()),
                    kind="tool",
                    description="Search persisted session memory.",
                    tool_name="memory_search",
                    arguments={"query": query},
                ),
                self._respond_step(),
            ]

        return [self._respond_step()]

    @staticmethod
    def _respond_step() -> PlanStep:
        return PlanStep(
            id=str(uuid4()),
            kind="respond",
            description="Synthesize a final answer from context and tool results.",
        )
