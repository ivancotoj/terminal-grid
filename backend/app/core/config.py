from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="APP_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        # Treat list fields as plain strings from env; our validator splits them
        env_parse_none_str="",
    )

    host: str = "127.0.0.1"
    port: int = 8000
    reload: bool = False
    log_level: str = "INFO"

    # Stored as comma-separated string in .env; validator converts to list
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Empty string = auto-detect per platform
    default_shell: str = ""

    # Replay ring-buffer cap (bytes)
    pty_buffer_limit: int = 65536

    # Working directory for new terminal sessions; empty = inherit from server process
    start_dir: str = ""

    @field_validator("log_level", mode="before")
    @classmethod
    def _upper_level(cls, v: object) -> object:
        return str(v).upper() if isinstance(v, str) else v

    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
