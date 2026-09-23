from __future__ import annotations

import json
import re
from typing import Any
from uuid import uuid4

from makma.models import ChatMessage, PlanStep
from makma.tools import ToolDefinition, ToolRegistry

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


def _validate_value(value: object, schema: dict[str, object], field_name: str) -> None:
    expected = schema.get("type")
    if expected == "string":
        if not isinstance(value, str):
            raise ValueError(f"{field_name} must be a string.")
        minimum = schema.get("minLength")
        maximum = schema.get("maxLength")
        if isinstance(minimum, int) and len(value) < minimum:
            raise ValueError(f"{field_name} is shorter than allowed.")
        if isinstance(maximum, int) and len(value) > maximum:
            raise ValueError(f"{field_name} is longer than allowed.")
    elif expected == "integer":
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValueError(f"{field_name} must be an integer.")
    elif expected == "number":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{field_name} must be a number.")
    elif expected == "boolean" and not isinstance(value, bool):
        raise ValueError(f"{field_name} must be a boolean.")


def validate_tool_arguments(definition: ToolDefinition, arguments: dict[str, Any]) -> None:
    schema = definition.input_schema
    if schema.get("type") not in (None, "object"):
        raise ValueError("Tool input schema must describe an object.")

    properties = schema.get("properties", {})
    if not isinstance(properties, dict):
        raise ValueError("Tool properties schema is invalid.")
    required = schema.get("required", [])
    if not isinstance(required, list) or not all(isinstance(item, str) for item in required):
        raise ValueError("Tool required-fields schema is invalid.")

    missing = [name for name in required if name not in arguments]
    if missing:
        raise ValueError(f"Missing required tool arguments: {', '.join(missing)}")

    if schema.get("additionalProperties") is False:
        extras = sorted(set(arguments) - set(properties))
        if extras:
            raise ValueError(f"Unexpected tool arguments: {', '.join(extras)}")

    for name, value in arguments.items():
        property_schema = properties.get(name)
        if isinstance(property_schema, dict):
            _validate_value(value, property_schema, name)


class StructuredModelPlanner:
    """Schema-constrained optional planner with deterministic fallback."""

    def __init__(
        self,
        *,
        provider: Any,
        registry: ToolRegistry,
        fallback: Planner | None = None,
        prefer_deterministic: bool = False,
        max_tool_steps: int = 4,
    ) -> None:
        if not 1 <= max_tool_steps <= 8:
            raise ValueError("max_tool_steps must be between 1 and 8.")
        self.provider = provider
        self.registry = registry
        self.fallback = fallback or Planner()
        self.prefer_deterministic = prefer_deterministic
        self.max_tool_steps = max_tool_steps

    def _system_prompt(self) -> str:
        tools = [
            {
                "name": item["name"],
                "description": item["description"],
                "risk_level": item["risk_level"],
                "requires_approval": item["requires_approval"],
                "input_schema": item["input_schema"],
            }
            for item in self.registry.describe()
        ]
        return (
            "You are a planning component, not the final assistant. Return JSON only with "
            'shape {"steps":[{"tool":"registered_tool","arguments":{},"reason":"..."}]}. '
            f"Use at most {self.max_tool_steps} tool steps. Never invent tools or arguments. "
            "A tool marked approval-required may be proposed; execution policy will gate it. "
            'If no tool is useful, return {"steps":[]}. Available tools: '
            + json.dumps(tools, sort_keys=True)
        )

    @staticmethod
    def _decode_json(raw: str) -> dict[str, object]:
        text = raw.strip()
        fence = chr(96) * 3
        if text.startswith(fence) and text.endswith(fence):
            lines = text.splitlines()
            if len(lines) >= 3:
                text = "\n".join(lines[1:-1]).strip()
        payload = json.loads(text)
        if not isinstance(payload, dict):
            raise ValueError("Planner output must be a JSON object.")
        return payload

    async def plan(self, message: str) -> list[PlanStep]:
        deterministic = self.fallback.plan(message)
        if self.prefer_deterministic and any(step.kind == "tool" for step in deterministic):
            return deterministic

        try:
            raw = await self.provider.generate(
                [ChatMessage(role="user", content=message)],
                system_prompt=self._system_prompt(),
                tool_results=[],
            )
            payload = self._decode_json(raw)
            raw_steps = payload.get("steps", [])
            if not isinstance(raw_steps, list):
                raise ValueError("Planner steps must be a list.")
            if len(raw_steps) > self.max_tool_steps:
                raise ValueError("Planner returned too many tool steps.")

            steps: list[PlanStep] = []
            for raw_step in raw_steps:
                if not isinstance(raw_step, dict):
                    raise ValueError("Each planner step must be an object.")
                tool_name = raw_step.get("tool")
                arguments = raw_step.get("arguments", {})
                reason = raw_step.get("reason", "Execute a validated planned tool step.")
                if not isinstance(tool_name, str):
                    raise ValueError("Planner tool name must be a string.")
                definition = self.registry.definition(tool_name)
                if definition is None:
                    raise ValueError(f"Planner selected unknown tool: {tool_name}")
                if not isinstance(arguments, dict):
                    raise ValueError("Planner tool arguments must be an object.")
                validate_tool_arguments(definition, arguments)
                if not isinstance(reason, str) or not reason.strip():
                    reason = "Execute a validated planned tool step."
                steps.append(
                    PlanStep(
                        id=str(uuid4()),
                        kind="tool",
                        description=reason.strip()[:500],
                        tool_name=tool_name,
                        arguments=arguments,
                    )
                )
            return [*steps, Planner._respond_step()]
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            return deterministic
