from __future__ import annotations

import ast
import math
import operator
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Literal

from makma.memory import SQLiteMemory
from makma.models import ToolResult

ToolHandler = Callable[[dict[str, Any], str], Awaitable[str]]
RiskLevel = Literal["low", "medium", "high"]


class ToolPermissionError(PermissionError):
    pass


@dataclass(frozen=True)
class ToolDefinition:
    name: str
    description: str
    handler: ToolHandler
    requires_approval: bool = False
    risk_level: RiskLevel = "low"
    side_effects: bool = False
    input_schema: dict[str, Any] = field(default_factory=dict)
    output_schema: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class PermissionPolicy:
    allowed_tools: frozenset[str]
    approval_required_tools: frozenset[str] = frozenset()

    def check(self, tool_name: str, approvals: set[str]) -> None:
        if tool_name not in self.allowed_tools:
            raise ToolPermissionError(f"Tool '{tool_name}' is not allowed.")
        if tool_name in self.approval_required_tools and tool_name not in approvals:
            raise ToolPermissionError(f"Tool '{tool_name}' requires explicit approval.")


def _validate_arguments(schema: dict[str, Any], arguments: dict[str, Any]) -> None:
    if not schema:
        return
    if schema.get("type") not in (None, "object"):
        raise ValueError("Tool input schema must describe an object.")

    properties = schema.get("properties", {})
    required = schema.get("required", [])
    if not isinstance(properties, dict) or not isinstance(required, list):
        raise ValueError("Invalid tool input schema.")

    missing = [name for name in required if name not in arguments]
    if missing:
        raise ValueError("Missing required tool arguments: " + ", ".join(sorted(missing)))

    if schema.get("additionalProperties") is False:
        extras = sorted(set(arguments) - set(properties))
        if extras:
            raise ValueError("Unexpected tool arguments: " + ", ".join(extras))

    for name, value in arguments.items():
        rule = properties.get(name)
        if not isinstance(rule, dict):
            continue
        expected = rule.get("type")
        if expected == "string":
            if not isinstance(value, str):
                raise ValueError(f"Tool argument '{name}' must be a string.")
            minimum = rule.get("minLength")
            maximum = rule.get("maxLength")
            if minimum is not None and len(value) < int(minimum):
                raise ValueError(f"Tool argument '{name}' is too short.")
            if maximum is not None and len(value) > int(maximum):
                raise ValueError(f"Tool argument '{name}' is too long.")
        elif expected == "integer":
            if isinstance(value, bool) or not isinstance(value, int):
                raise ValueError(f"Tool argument '{name}' must be an integer.")
        elif expected == "number":
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError(f"Tool argument '{name}' must be a number.")
        elif expected == "boolean" and not isinstance(value, bool):
            raise ValueError(f"Tool argument '{name}' must be a boolean.")
        elif expected == "object" and not isinstance(value, dict):
            raise ValueError(f"Tool argument '{name}' must be an object.")
        elif expected == "array" and not isinstance(value, list):
            raise ValueError(f"Tool argument '{name}' must be an array.")


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ToolDefinition] = {}

    def register(self, definition: ToolDefinition) -> None:
        if definition.name in self._tools:
            raise ValueError(f"Tool '{definition.name}' is already registered.")
        self._tools[definition.name] = definition

    @property
    def names(self) -> list[str]:
        return sorted(self._tools)

    def describe(self) -> list[dict[str, object]]:
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "requires_approval": tool.requires_approval,
                "risk_level": tool.risk_level,
                "side_effects": tool.side_effects,
                "input_schema": tool.input_schema,
                "output_schema": tool.output_schema,
            }
            for tool in sorted(self._tools.values(), key=lambda item: item.name)
        ]

    async def execute(
        self,
        name: str,
        arguments: dict[str, Any],
        *,
        session_id: str,
        policy: PermissionPolicy,
        approvals: set[str] | None = None,
    ) -> ToolResult:
        approvals = approvals or set()
        tool = self._tools.get(name)
        if tool is None:
            return ToolResult(
                tool_name=name,
                ok=False,
                output="",
                error="Unknown tool.",
                trusted=False,
                provenance=f"tool:{name}",
            )
        try:
            policy.check(name, approvals)
            if tool.requires_approval and name not in approvals:
                raise ToolPermissionError(f"Tool '{name}' requires explicit approval.")
            _validate_arguments(tool.input_schema, arguments)
            output = await tool.handler(arguments, session_id)
            return ToolResult(
                tool_name=name,
                ok=True,
                output=output,
                trusted=False,
                provenance=f"tool:{name}",
            )
        except (ToolPermissionError, ValueError) as error:
            return ToolResult(
                tool_name=name,
                ok=False,
                output="",
                error=str(error),
                trusted=False,
                provenance=f"tool:{name}",
            )


_BINARY_OPERATORS: dict[type[ast.operator], Callable[[float, float], float]] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_UNARY_OPERATORS: dict[type[ast.unaryop], Callable[[float], float]] = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}


def _evaluate_math(node: ast.AST) -> float:
    if isinstance(node, ast.Expression):
        return _evaluate_math(node.body)
    if isinstance(node, ast.Constant) and type(node.value) in (int, float):
        return float(node.value)
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY_OPERATORS:
        return _UNARY_OPERATORS[type(node.op)](_evaluate_math(node.operand))
    if isinstance(node, ast.BinOp) and type(node.op) in _BINARY_OPERATORS:
        left = _evaluate_math(node.left)
        right = _evaluate_math(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > 10:
            raise ValueError("Exponent is too large.")
        return _BINARY_OPERATORS[type(node.op)](left, right)
    raise ValueError("Expression contains unsupported syntax.")


async def calculator(arguments: dict[str, Any], session_id: str) -> str:
    del session_id
    expression = str(arguments.get("expression", "")).strip()
    if not expression or len(expression) > 200:
        raise ValueError("A short arithmetic expression is required.")
    try:
        tree = ast.parse(expression, mode="eval")
        value = _evaluate_math(tree)
        if not isinstance(value, float) or not math.isfinite(value):
            raise ValueError("Result must be a finite real number.")
    except (SyntaxError, ArithmeticError, RecursionError) as error:
        raise ValueError("Invalid or out-of-range arithmetic expression.") from error
    rendered = int(value) if value.is_integer() else round(value, 10)
    return f"{expression} = {rendered}"


def memory_search_tool(memory: SQLiteMemory) -> ToolHandler:
    async def search_memory(arguments: dict[str, Any], session_id: str) -> str:
        query = str(arguments.get("query", "")).strip()
        if not query:
            raise ValueError("A memory search query is required.")
        matches = await memory.recall(session_id, query, limit=5)
        if not matches:
            return "No matching memories found."
        return " | ".join(
            f"[score={match.score:.3f}] {match.role}: {match.content}" for match in matches
        )

    return search_memory


def build_default_registry(memory: SQLiteMemory) -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(
        ToolDefinition(
            name="calculator",
            description="Safely evaluate arithmetic expressions without arbitrary code execution.",
            handler=calculator,
            risk_level="low",
            side_effects=False,
            input_schema={
                "type": "object",
                "properties": {"expression": {"type": "string", "maxLength": 200}},
                "required": ["expression"],
                "additionalProperties": False,
            },
            output_schema={"type": "string"},
        )
    )
    registry.register(
        ToolDefinition(
            name="memory_search",
            description="Recall relevance-ranked memories from the current persisted session.",
            handler=memory_search_tool(memory),
            risk_level="low",
            side_effects=False,
            input_schema={
                "type": "object",
                "properties": {"query": {"type": "string", "minLength": 1}},
                "required": ["query"],
                "additionalProperties": False,
            },
            output_schema={"type": "string"},
        )
    )
    return registry
