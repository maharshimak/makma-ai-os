from __future__ import annotations

import json
import math
from typing import Protocol
from urllib import request


class MemoryEmbeddingProvider(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class OpenAICompatibleMemoryEmbeddings:
    """Small adapter for OpenAI-compatible /embeddings endpoints."""

    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        api_key: str = "",
        timeout_seconds: float = 30.0,
    ) -> None:
        if not base_url.strip() or not model.strip():
            raise ValueError("base_url and model are required")
        self.endpoint = base_url.rstrip("/") + "/embeddings"
        self.model = model
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    def embed(self, texts: list[str]) -> list[list[float]]:
        payload = json.dumps({"model": self.model, "input": texts}).encode()
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        req = request.Request(self.endpoint, data=payload, headers=headers, method="POST")
        with request.urlopen(req, timeout=self.timeout_seconds) as response:
            body = json.loads(response.read().decode())
        ordered = sorted(body["data"], key=lambda item: item["index"])
        vectors = [[float(value) for value in item["embedding"]] for item in ordered]
        if len(vectors) != len(texts):
            raise ValueError("Embedding provider returned the wrong number of vectors.")
        invalid_vector = any(
            not vector or not all(math.isfinite(value) for value in vector)
            for vector in vectors
        )
        if invalid_vector:
            raise ValueError("Embedding vectors must be non-empty and finite.")
        return vectors


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or len(left) != len(right):
        return 0.0
    if not all(math.isfinite(value) for value in [*left, *right]):
        return 0.0
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if not left_norm or not right_norm:
        return 0.0
    return sum(a * b for a, b in zip(left, right, strict=True)) / (left_norm * right_norm)
