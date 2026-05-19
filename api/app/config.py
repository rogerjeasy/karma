from __future__ import annotations

from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve the repo-root .env regardless of which directory the process starts from.
# api/app/config.py → parents: [api/app, api, repo-root]
_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Root .env is the single source of truth for all services.
        # A local api/.env can be added for service-specific overrides (it wins).
        env_file=[str(_ROOT_ENV), ".env"],
        env_file_encoding="utf-8",
        extra="ignore",
    )

    gcp_project_id: str = ""
    gcp_location: str = "us-central1"
    firestore_database: str = "(default)"
    agent_engine_resource_name: str = ""
    api_secret_key: str = ""
    allowed_origins: str = "http://localhost:3000"
    log_level: str = "INFO"

    @field_validator("gcp_project_id", mode="after")
    @classmethod
    def _require_gcp_project(cls, v: str) -> str:
        if not v:
            raise ValueError("GCP_PROJECT_ID must be set in the root .env file")
        return v

    @field_validator("api_secret_key", mode="after")
    @classmethod
    def _require_secret_key(cls, v: str) -> str:
        if not v:
            raise ValueError("API_SECRET_KEY must be set in the root .env file")
        return v

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


settings = Settings()
