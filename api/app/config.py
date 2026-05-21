from __future__ import annotations

import logging
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load .env only when the file actually exists (local dev).
# In containers the path resolves outside the image and the file is absent —
# all settings come from Cloud Run environment variables instead.
_candidates = [
    Path(__file__).resolve().parents[2] / ".env",  # repo-root .env (local dev)
    Path(".env"),                                    # cwd fallback
]
_env_files = [str(p) for p in _candidates if p.exists()]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_env_files or None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Google Cloud ──────────────────────────────────────────────────────────
    gcp_project_id: str = ""
    gcp_location: str = "us-central1"
    firestore_database: str = "(default)"

    # ── Agent Engine ──────────────────────────────────────────────────────────
    # Full Vertex AI resource name, e.g.:
    # projects/<id>/locations/us-central1/reasoningEngines/<id>
    agent_engine_resource_name: str = ""

    # ── Firebase Auth ─────────────────────────────────────────────────────────
    # Project that issued the client-side ID tokens we verify server-side.
    # Separate from gcp_project_id (which is the GCP infra project).
    firebase_project_id: str = "gptuesser-firebase"

    # ── API ───────────────────────────────────────────────────────────────────
    api_secret_key: str = ""

    # Comma-separated list of allowed CORS origins.
    # Production: set to the deployed web URL via Cloud Run env var ALLOWED_ORIGINS.
    # Local dev:  set in .env or defaults to localhost.
    allowed_origins: str = "http://localhost:3000"

    log_level: str = "INFO"

    @field_validator("gcp_project_id", mode="after")
    @classmethod
    def _require_gcp_project(cls, v: str) -> str:
        if not v:
            logging.warning(
                "GCP_PROJECT_ID is not set — Firestore and Agent Engine will be unavailable"
            )
        return v

    @field_validator("agent_engine_resource_name", mode="after")
    @classmethod
    def _warn_missing_agent_engine(cls, v: str) -> str:
        if not v:
            logging.warning(
                "AGENT_ENGINE_RESOURCE_NAME is not set — agent dispatch will be skipped"
            )
        return v

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()
