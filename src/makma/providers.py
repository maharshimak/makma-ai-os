from __future__ import annotations

from typing import Protocol

import httpx

from makma.config import Settings
from makma.models import ChatMessage, ToolResult


class ModelProvider(Protocol):
    name: str

    async def generate(
        self,
        messages: list[ChatMessage],
        *,
        system_prompt: str,
        tool_results: list[ToolResult],
    ) -> str: ...


class LocalProvider:
    """Deterministic offline provider used for tests and zero-config local startup."""

    name = "local"

    async def generate(
        self,
        messages: list[ChatMessage],
        *,
        system_prompt: str,
        tool_results: list[ToolResult],
    ) -> str:
        del system_prompt
        latest = next(
            (message.content for message in reversed(messages) if message.role == "user"),
            "",
        )
        if tool_results:
            successful = [result.output for result in tool_results if result.ok]
            if successful:
                return "Mak'ma completed the requested tool work: " + " | ".join(successful)
            return "Mak'ma could not complete the requested tool work safely."
        return f"Mak'ma AI OS is online. I received: {latest}"


class OpenAICompatibleProvider:
    name = "openai"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def generate(
        self,
        messages: list[ChatMessage],
        *,
        system_prompt: str,
        tool_results: list[ToolResult],
    ) -> str:
        headers = {"Content-Type": "application/json"}
        if self.settings.api_key:
            headers["Authorization"] = f"Bearer {self.settings.api_key}"

        payload_messages = [{"role": "system", "content": system_prompt}]
        payload_messages.extend(message.model_dump() for message in messages)
        if tool_results:
            payload_messages.append(
                {
                    "role": "system",
                    "content": "Tool execution results:\n"
                    + "\n".join(
                        f"- {result.tool_name}: {result.output if result.ok else result.error}"
                        for result in tool_results
                    ),
                }
            )

        url = self.settings.base_url.rstrip("/") + "/chat/completions"
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(
                url,
                headers=headers,
                json={
                    "model": self.settings.model,
                    "messages": payload_messages,
                    "temperature": 0.2,
                },
            )
            response.raise_for_status()
            data = response.json()
        return str(data["choices"][0]["message"]["content"]).strip()


class OllamaProvider:
    name = "ollama"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def generate(
        self,
        messages: list[ChatMessage],
        *,
        system_prompt: str,
        tool_results: list[ToolResult],
    ) -> str:
        payload_messages = [{"role": "system", "content": system_prompt}]
        payload_messages.extend(message.model_dump() for message in messages)
        if tool_results:
            payload_messages.append(
                {
                    "role": "system",
                    "content": "Tool results:\n"
                    + "\n".join(
                        f"{result.tool_name}: {result.output if result.ok else result.error}"
                        for result in tool_results
                    ),
                }
            )
        url = self.settings.base_url.rstrip("/") + "/api/chat"
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(
                url,
                json={
                    "model": self.settings.model,
                    "messages": payload_messages,
                    "stream": False,
                },
            )
            response.raise_for_status()
            data = response.json()
        return str(data["message"]["content"]).strip()


def build_provider(settings: Settings) -> ModelProvider:
    if settings.provider == "openai":
        return OpenAICompatibleProvider(settings)
    if settings.provider == "ollama":
        return OllamaProvider(settings)
    return LocalProvider()
