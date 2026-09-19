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
_NEXT_TOOL_COMMAND = re.compile(
    r"\s+and\s+(?=(?:calculate|compute|evaluate)\b)",
    flags=re.IGNORECASE,
)


class Planner:
    """Deterministic planner that turns explicit intents into auditable tool steps."""

    def plan(self, message: str) -> list[PlanStep]:
        text = message.strip()
        candidates: list[tuple[int, PlanStep]] = []

        math_matches = list(_MATH_COMMAND.finditer(text))
        for match in math_matches:
            expression = match.group(1).strip()
            if expression:
                candidates.append(
                    (
                        match.start(),
                        PlanStep(
                            id=str(uuid4()),
                            kind="tool",
                            description="Calculate the requested arithmetic expression.",
                            tool_name="calculator",
                            arguments={"expression": expression},
                        ),
                    )
                )

        if not math_matches and _PURE_MATH.fullmatch(text) and any(
            character.isdigit() for character in text
        ):
            candidates.append(
                (
                    0,
                    PlanStep(
                        id=str(uuid4()),
                        kind="tool",
                        description="Evaluate the arithmetic expression.",
                        tool_name="calculator",
                        arguments={"expression": text},
                    ),
                )
            )

        memory_match = _MEMORY_COMMAND.search(text)
        if memory_match:
            raw_query = memory_match.group(1).strip()
            query = _NEXT_TOOL_COMMAND.split(raw_query, maxsplit=1)[0].strip() or text
            candidates.append(
                (
                    memory_match.start(),
                    PlanStep(
                        id=str(uuid4()),
                        kind="tool",
                        description="Recall relevant persisted session memories.",
                        tool_name="memory_search",
                        arguments={"query": query},
                    ),
                )
            )

        candidates.sort(key=lambda item: item[0])
        tool_steps = [step for _, step in candidates[:4]]
        return [*tool_steps, self._respond_step()]

    @staticmethod
    def _respond_step() -> PlanStep:
        return PlanStep(
            id=str(uuid4()),
            kind="respond",
            description="Synthesize a final answer from context and tool results.",
        )
