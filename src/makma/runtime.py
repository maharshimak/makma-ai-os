from __future__ import annotations

import time
from collections.abc import AsyncIterator
from uuid import uuid4

from makma.config import Settings
from makma.memory import SQLiteMemory
from makma.models import ChatMessage, ChatResponse, PlanStep, ToolResult
from makma.planner import Planner
from makma.providers import ModelProvider, build_provider
from makma.tools import PermissionPolicy, ToolRegistry, build_default_registry

SYSTEM_PROMPT = """You are Mak'ma, a tool-using personal AI runtime.
Use conversation context and tool results faithfully.
Never claim a tool action happened unless a successful tool result is present.
Be concise, explicit about failures, and preserve user control over risky actions.
"""


class MakmaRuntime:
    def __init__(
        self,
        *,
        settings: Settings,
        memory: SQLiteMemory,
        provider: ModelProvider,
        registry: ToolRegistry,
        planner: Planner | None = None,
        policy: PermissionPolicy | None = None,
    ) -> None:
        self.settings = settings
        self.memory = memory
        self.provider = provider
        self.registry = registry
        self.planner = planner or Planner()
        self.policy = policy or PermissionPolicy(allowed_tools=frozenset(registry.names))

    async def run(
        self,
        message: str,
        session_id: str = "default",
        *,
        approvals: set[str] | None = None,
        tools_enabled: bool = True,
    ) -> ChatResponse:
        started = time.perf_counter()
        run_id = str(uuid4())
        history = await self.memory.load(
            session_id,
            limit=self.settings.max_history_messages,
        )
        plan = self.planner.plan(message)
        await self.memory.append(session_id, "user", message)

        tool_results: list[ToolResult] = []
        if tools_enabled:
            tool_results = await self._execute_plan(
                plan,
                session_id=session_id,
                approvals=approvals or set(),
            )

        messages = [*history, ChatMessage(role="user", content=message)]
        response = await self.provider.generate(
            messages,
            system_prompt=SYSTEM_PROMPT,
            tool_results=tool_results,
        )
        await self.memory.append(session_id, "assistant", response)

        latency_ms = round((time.perf_counter() - started) * 1000, 3)
        await self.memory.record_run(
            run_id=run_id,
            session_id=session_id,
            user_message=message,
            response=response,
            provider=self.provider.name,
            latency_ms=latency_ms,
        )
        return ChatResponse(
            response=response,
            session_id=session_id,
            run_id=run_id,
            provider=self.provider.name,
            latency_ms=latency_ms,
            plan=plan,
            tool_results=tool_results,
        )

    async def _execute_plan(
        self,
        plan: list[PlanStep],
        *,
        session_id: str,
        approvals: set[str],
    ) -> list[ToolResult]:
        results: list[ToolResult] = []
        for step in plan:
            if step.kind != "tool" or not step.tool_name:
                continue
            results.append(
                await self.registry.execute(
                    step.tool_name,
                    step.arguments,
                    session_id=session_id,
                    policy=self.policy,
                    approvals=approvals,
                )
            )
        return results

    async def stream(
        self,
        message: str,
        session_id: str = "default",
        *,
        approvals: set[str] | None = None,
        tools_enabled: bool = True,
    ) -> AsyncIterator[str]:
        result = await self.run(
            message,
            session_id,
            approvals=approvals,
            tools_enabled=tools_enabled,
        )
        for token in result.response.split():
            yield token + " "


def build_runtime(settings: Settings | None = None) -> MakmaRuntime:
    settings = settings or Settings()
    memory = SQLiteMemory(settings.database_path)
    provider = build_provider(settings)
    registry = build_default_registry(memory)
    return MakmaRuntime(
        settings=settings,
        memory=memory,
        provider=provider,
        registry=registry,
    )
