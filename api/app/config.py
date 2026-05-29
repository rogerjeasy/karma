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

    # Model for the lightweight 'Ask Karma' chat (direct Gemini generateContent,
    # not the Agent Engine pipeline). Flash keeps interactive Q&A cheap and fast.
    chat_model: str = "gemini-2.5-flash"

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

    # ── Watcher auto-completion ───────────────────────────────────────────────
    # Number of consecutive clean watcher cycles (zero violations) required
    # to automatically transition a service from haunting → completed.
    watcher_clean_runs_to_complete: int = 3

    # Optional webhook URL — receives a POST when a ghost report is saved.
    # Leave blank to disable.
    webhook_url: str = ""

    # ── Dynatrace / OpenTelemetry ─────────────────────────────────────────────
    # DT environment ID, e.g. "slm61962" — used to derive the OTLP endpoint.
    dt_env: str = ""
    # DT API token with openTelemetryTrace.ingest + metrics.ingest scopes.
    dt_otel_token: str = ""
    # DT API token with storage:logs:read + storage:events:read scopes (Grail DQL).
    dt_query_token: str = ""
    # DT Platform Token (Bearer) for the hosted Dynatrace MCP gateway — powers the
    # "Ask Karma" console's Davis CoPilot natural-language→DQL translation. Same
    # token the agents use (DT_API_TOKEN). Leave blank to disable the Davis CoPilot
    # path: the console then degrades to a contracts-grounded Gemini answer.
    dt_api_token: str = ""
    # MCP gateway tool name for Davis CoPilot NL→DQL. Overridable because the hosted
    # gateway uses kebab-case tool names that may differ from the OSS server.
    dt_copilot_nl2dql_tool: str = "generate-dql-from-natural-language"

    @field_validator(
        "dt_query_token", "dt_otel_token", "dt_env", "api_secret_key",
        "dt_api_token", "github_token", "github_write_token",
        mode="after",
    )
    @classmethod
    def _strip_whitespace(cls, v: str) -> str:
        # Cloud Run secrets are sometimes stored with a trailing \r\n which causes
        # httpx to raise "Illegal header value".  Strip all leading/trailing whitespace.
        return v.strip()

    # ── GitHub ────────────────────────────────────────────────────────────────
    # Fine-grained PAT with Contents:read + Pull requests:read on the repo(s).
    # Used by the cutover endpoint to attach real engineering metrics to the
    # karma.deployment OTel span (commits, PRs, lines added/removed).
    github_token: str = ""
    # Default "owner/repo" used when a service has no per-service github_repo.
    # Example: "rogerjeasy/karma"
    github_repo: str = ""
    # Fine-grained PAT with Contents:write + Pull requests:write — used by the
    # "Open draft PR" action to push the Forensic agent's remediation patch as a
    # draft pull request. Kept separate from github_token (read-only) for least
    # privilege. Leave blank to disable PR creation.
    github_write_token: str = ""
    # Branch that remediation PRs target.
    github_pr_base_branch: str = "main"

    @property
    def dt_otel_endpoint(self) -> str:
        if self.dt_env:
            return f"https://{self.dt_env}.live.dynatrace.com/api/v2/otlp"
        return ""

    @property
    def dt_mcp_endpoint(self) -> str:
        """Hosted Dynatrace MCP gateway endpoint (MCP Streamable HTTP)."""
        if self.dt_env:
            return (
                f"https://{self.dt_env}.apps.dynatrace.com/platform-reserved"
                "/mcp-gateway/v0.1/servers/dynatrace-mcp/mcp"
            )
        return ""

    @property
    def davis_copilot_enabled(self) -> bool:
        return bool(self.dt_env and self.dt_api_token)

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
