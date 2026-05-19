from __future__ import annotations

from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# URL path segments — centralised here so no caller ever hardcodes a fragment.
_MCP_PATH        = "/platform-reserved/mcp-gateway/v0.1/servers/dynatrace-mcp/mcp"
_LOGS_INGEST_PATH = "/api/v2/logs/ingest"
_OTEL_PATH       = "/api/v2/otlp"

# Resolve the repo-root .env regardless of which directory the process starts from.
# agents/karma/config.py → parents: [agents/karma, agents, repo-root]
_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Root .env is the single source of truth for all services.
        # A local agents/.env can be added for service-specific overrides (it wins).
        env_file=[str(_ROOT_ENV), ".env"],
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Google Cloud ──────────────────────────────────────────────────────────
    gcp_project_id: str = ""
    gcp_location: str = "us-central1"

    # ── Dynatrace ─────────────────────────────────────────────────────────────
    # DT_ENV is the subdomain of your tenant:
    #   https://<dt_env>.apps.dynatrace.com   (platform API)
    #   https://<dt_env>.live.dynatrace.com   (classic API)
    # All Dynatrace URLs are derived from this single value — no caller should
    # ever construct a Dynatrace URL directly.
    dt_env: str = ""

    # Platform Token — Bearer auth for the MCP gateway.
    # Required scopes: see docs/DYNATRACE_SETUP.md §2.
    dt_api_token: str = ""

    # Override the MCP endpoint only when necessary (e.g. local stdio dev).
    # Leave blank — the derived dt_mcp_endpoint builds the canonical URL.
    # WARNING: pydantic-settings does NOT expand ${VAR} references in .env
    # values. The field validator below clears any unexpanded templates.
    dt_mcp_url: str = ""

    # Classic API token — Api-Token auth for the Logs Ingest API.
    # This is the same token used for OTel trace/metric ingest.
    # Required scopes: logs.ingest  (already included with OTel token scopes)
    # Set as DT_OTEL_TOKEN in .env — the same token serves both purposes.
    dt_otel_token: str = ""

    # ── Vertex AI / Agent Engine ──────────────────────────────────────────────
    memory_bank_id: str = ""
    agent_engine_resource_name: str = ""

    # ── Firestore ─────────────────────────────────────────────────────────────
    firestore_database: str = "(default)"

    # ── Gemini models ─────────────────────────────────────────────────────────
    model_pro: str = "gemini-2.5-pro"
    model_flash: str = "gemini-2.5-flash"

    # ── Watcher schedule ──────────────────────────────────────────────────────
    watcher_interval_seconds: int = 600  # 10 minutes

    # ── Contract validation ───────────────────────────────────────────────────
    max_false_positives_allowed: int = 0
    validation_historical_days: int = 14
    min_confidence_threshold: float = 0.75

    # ── Logging ───────────────────────────────────────────────────────────────
    log_level: str = "INFO"

    # ── Field validators ─────────────────────────────────────────────────────

    @field_validator("gcp_project_id", mode="after")
    @classmethod
    def _require_gcp_project(cls, v: str) -> str:
        if not v:
            raise ValueError("GCP_PROJECT_ID must be set in your .env file")
        return v

    @field_validator("dt_mcp_url", mode="before")
    @classmethod
    def _clear_unexpanded_template(cls, v: object) -> str:
        """Reject ${VAR} templates that pydantic-settings cannot expand."""
        if isinstance(v, str) and "${" in v:
            return ""
        return v if isinstance(v, str) else ""

    # ── Derived URL properties ────────────────────────────────────────────────

    @property
    def dt_base_url(self) -> str:
        """Platform SaaS base URL — https://<dt_env>.apps.dynatrace.com"""
        self._assert_dt_env()
        return f"https://{self.dt_env}.apps.dynatrace.com"

    @property
    def dt_classic_base_url(self) -> str:
        """Classic SaaS base URL — https://<dt_env>.live.dynatrace.com"""
        self._assert_dt_env()
        return f"https://{self.dt_env}.live.dynatrace.com"

    @property
    def dt_mcp_endpoint(self) -> str:
        """Full MCP gateway URL (platform API, Bearer auth)."""
        if self.dt_mcp_url:
            return self.dt_mcp_url
        return f"{self.dt_base_url}{_MCP_PATH}"

    @property
    def dt_logs_endpoint(self) -> str:
        """Logs Ingest API v2 URL (classic API, Api-Token auth).

        Karma uses this to write self-observability records queryable via:
          fetch logs | filter log.source == "karma-agent"

        Required classic token scope: logs.ingest
        This scope is included with the OTel token (DT_OTEL_TOKEN).
        """
        return f"{self.dt_classic_base_url}{_LOGS_INGEST_PATH}"

    @property
    def dt_otel_endpoint(self) -> str:
        """OTLP/HTTP ingest endpoint for the synthetic environment services."""
        return f"{self.dt_classic_base_url}{_OTEL_PATH}"

    def _assert_dt_env(self) -> None:
        if not self.dt_env:
            raise ValueError(
                "DT_ENV is not configured. "
                "Set DT_ENV=<your-environment-name> in your .env file. "
                "See docs/DYNATRACE_SETUP.md for instructions."
            )


settings = Settings()
