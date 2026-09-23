from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MAKMA_", env_file=None, extra="ignore")

    provider: Literal["local", "openai", "ollama"] = "local"
    planner_mode: Literal["deterministic", "hybrid", "model"] = "deterministic"
    model: str = "qwen2.5:7b"
    api_key: str | None = None
    base_url: str = "http://localhost:11434"
    database_path: str = "./data/makma.db"
    memory_embedding_base_url: str | None = None
    memory_embedding_model: str | None = None
    memory_embedding_api_key: str | None = None
    api_token: str | None = None
    request_timeout_seconds: float = Field(default=60.0, gt=0, le=300)
    max_history_messages: int = Field(default=20, ge=1, le=200)
    cors_origins: str = (
        "http://localhost:3000,"
        "http://127.0.0.1:5500,"
        "https://maharshimak.github.io"
    )

    @property
    def allowed_cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
