from __future__ import annotations

import json
from uuid import uuid4

import httpx

from makma.config import Settings
from makma.models import PlanStep


class StructuredPlannerError(ValueError):
    pass


class StructuredModelPlanner:
    """Schema-constrained planner for configured OpenAI-compatible or Ollama models."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def plan(
        self,
        message: str,
        *,
        tools: list[dict[str, object]],
        max_steps: int = 4,
    ) -> list[PlanStep]:
        if not message.strip():
            raise StructuredPlannerError("message must be non-empty")
        if max_steps < 1 or max_steps > 12:
            raise StructuredPlannerError("max_steps must be between 1 and 12")

        allowed = {str(tool["name"]) for tool in tools}
        tool_contract = [
            {
                "name": tool["name"],
                "description": tool.get("description"),
                "input_schema": tool.get("input_schema", {}),
                "risk_level": tool.get("risk_level", "low"),
                "side_effects": tool.get("side_effects", False),
            }
            for tool in tools
        ]
        system = (
            "You are the planning component of MAK'MA. Return only JSON with a top-level "
            "'steps' array. Each step must contain 'tool', 'arguments', and 'reason'. "
            "Use only tools from the supplied registry. Never invent a tool. Never place "
            "instructions inside tool arguments that are unrelated to that tool schema. "
            f"Return at most {max_steps} tool steps. If no tool is needed, return {{\"steps\":[]}}."
        )
        user = json.dumps(
            {"request": message, "tools": tool_contract},
            ensure_ascii=False,
        )

        if self.settings.provider == "openai":
            raw = await self._openai(system, user)
        elif self.settings.provider == "ollama":
            raw = await self._ollama(system, user)
        else:
            raise StructuredPlannerError(
                "Model planning requires MAKMA_PROVIDER=openai or MAKMA_PROVIDER=ollama."
            )

        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as error:
            raise StructuredPlannerError("Planner returned invalid JSON.") from error
        raw_steps = payload.get("steps")
        if not isinstance(raw_steps, list):
            raise StructuredPlannerError("Planner JSON must contain a steps array.")

        steps: list[PlanStep] = []
        for raw_step in raw_steps[:max_steps]:
            if not isinstance(raw_step, dict):
                raise StructuredPlannerError("Planner steps must be JSON objects.")
            tool_name = str(raw_step.get("tool", "")).strip()
            if tool_name not in allowed:
                raise StructuredPlannerError(f"Planner requested unknown tool: {tool_name}")
            arguments = raw_step.get("arguments", {})
            if not isinstance(arguments, dict):
                raise StructuredPlannerError("Planner tool arguments must be an object.")
            reason = str(raw_step.get("reason", "")).strip() or f"Use {tool_name}."
            steps.append(
                PlanStep(
                    id=str(uuid4()),
                    kind="tool",
                    description=reason,
                    tool_name=tool_name,
                    arguments=arguments,
                )
            )

        steps.append(
            PlanStep(
                id=str(uuid4()),
                kind="respond",
                description="Synthesize a final answer from context and tool results.",
            )
        )
        return steps

    async def _openai(self, system: str, user: str) -> str:
        headers = {"Content-Type": "application/json"}
        if self.settings.api_key:
            headers["Authorization"] = f"Bearer {self.settings.api_key}"
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(
                self.settings.base_url.rstrip("/") + "/chat/completions",
                headers=headers,
                json={
                    "model": self.settings.model,
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                },
            )
            response.raise_for_status()
            data = response.json()
        return str(data["choices"][0]["message"]["content"]).strip()

    async def _ollama(self, system: str, user: str) -> str:
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(
                self.settings.base_url.rstrip("/") + "/api/chat",
                json={
                    "model": self.settings.model,
                    "stream": False,
                    "format": "json",
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                },
            )
            response.raise_for_status()
            data = response.json()
        return str(data["message"]["content"]).strip()
