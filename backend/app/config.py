from __future__ import annotations

import json
from typing import Any
from functools import lru_cache
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-1.5-flash"
    gemini_api_url: str = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-1.5-flash:generateContent"
    )
    cors_allow_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )
    ws_allowed_origins: list[str] | None = None
    cors_allow_methods: list[str] = Field(default_factory=lambda: ["*"])
    cors_allow_headers: list[str] = Field(default_factory=lambda: ["*"])
    cors_allow_credentials: bool = True
    webrtc_ice_servers: list[dict[str, Any]] = Field(
        default_factory=lambda: [
            {"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]}
        ]
    )
    webrtc_disconnect_grace_seconds: int = 15
    webrtc_session_ttl_seconds: int = 300
    ws_heartbeat_seconds: int = 20

    @field_validator(
        "cors_allow_origins",
        "ws_allowed_origins",
        "cors_allow_methods",
        "cors_allow_headers",
        "webrtc_ice_servers",
        mode="before",
    )
    @classmethod
    def _parse_list_setting(cls, value: object) -> object:
        if value is None or isinstance(value, list):
            return value

        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []

            if raw.startswith("["):
                parsed = json.loads(raw)
                if not isinstance(parsed, list):
                    raise ValueError("Expected a JSON list for list-based settings.")
                return [str(item).strip() for item in parsed if str(item).strip()]

            return [item.strip() for item in raw.split(",") if item.strip()]

        raise TypeError("List-based settings must be a list or string.")

    @property
    def effective_ws_allowed_origins(self) -> set[str]:
        return set(self.ws_allowed_origins or self.cors_allow_origins)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
