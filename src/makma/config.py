from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MAKMA_", env_file=None, extra="ignore")

    provider: Literal["local", "openai", "ollama"] = "local"
    model: str = "qwen2.5:7b"
    api_key: str | None = None
    base_url: str = "http://localhost:11434"
    database_path: str = "./data/makma.db"
    request_timeout_seconds: float = Field(default=60.0, gt=0, le=300)
    max_history_messages: int = Field(default=20, ge=1, le=200)
