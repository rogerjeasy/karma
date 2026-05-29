"""Request/response models for the API gateway.

These are transport-layer models, separate from the agent-layer Pydantic
models in agents/karma/schemas/contract.py.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ServiceRegistration(BaseModel):
    service_name: str = Field(description="Human-readable service name")
    dynatrace_entity_id: str = Field(description="Dynatrace entity ID (SERVICE-...)")
    deprecation_date: datetime
    replacement_service_id: str | None = None
    learning_window_days: int = Field(default=14, ge=1, le=30)
    github_repo: str | None = Field(
        default=None,
        description="GitHub repo in 'owner/repo' format — used to attach real "
                    "engineering metrics (commits, PRs, lines changed) to deployment spans",
    )


class ServiceResponse(BaseModel):
    service_id: str
    service_name: str
    dynatrace_entity_id: str
    deprecation_date: datetime
    replacement_service_id: str | None
    phase: Literal["registered", "learning", "ready", "haunting", "completed", "error"]
    error_message: str | None = None
    github_repo: str | None = None
    created_at: datetime
    updated_at: datetime


class CutoverRequest(BaseModel):
    replacement_service_id: str = Field(description="Dynatrace entity ID of the new service")
    cutover_time: datetime | None = Field(
        default=None,
        description="Defaults to now if omitted",
    )


class CutoverResponse(BaseModel):
    service_id: str
    replacement_service_id: str
    cutover_time: datetime
    watcher_activated: bool


class ContractResponse(BaseModel):
    contract_id: str
    service_id: str
    category: str
    subcategory: str
    description: str
    confidence: float
    validated: bool
    detected_at: datetime


class RemediationPatch(BaseModel):
    """Agent-generated code fix for the violated contract (preview-only)."""
    pr_title: str
    pr_body: str
    target_file: str
    language: str = ""
    patch_diff: str
    github_url: str | None = None


class GhostReportResponse(BaseModel):
    report_id: str
    violation_id: str
    contract_id: str
    karma_service_id: str | None = None
    category: str
    summary: str
    root_cause: str
    downstream_impact: str
    davis_ai_insights: str | None = None
    severity: Literal["low", "medium", "high", "critical"]
    evidence_links: list[str]
    remediation_suggestions: list[str]
    # Structured, copyable code fix (unified diff + PR body). None if not generated.
    remediation_patch: RemediationPatch | None = None
    # URL of the draft PR opened from the remediation patch, once a user opens one.
    remediation_pr_url: str | None = None
    cost_estimate_usd: float | None = None
    investigation_input_tokens: int | None = None
    investigation_output_tokens: int | None = None
    dynatrace_event_id: str | None = None
    # Avoided-incident cost estimated by the Forensic agent
    avoided_incident_cost_usd: float | None = None
    # Dynatrace Notebook created for HIGH/CRITICAL reports
    dynatrace_notebook_url: str | None = None
    # Dynatrace Workflow created for CRITICAL reports
    dynatrace_workflow_id: str | None = None
    # Whether a Slack notification was sent
    slack_notification_sent: bool = False
    # Deep-link fields for direct Dynatrace navigation
    davis_problem_id: str | None = None        # from dynatrace_evidence.related_davis_problem_id
    new_service_entity_id: str | None = None   # Dynatrace entity ID of replacement service
    created_at: datetime


class ChatTurn(BaseModel):
    role: Literal["user", "model"]
    text: str = Field(max_length=4000)


class GhostAskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)


class GhostAskResponse(BaseModel):
    answer: str


class ConsoleAskRequest(BaseModel):
    """A natural-language question for the global 'Ask Karma' console."""
    question: str = Field(min_length=1, max_length=2000)
    # Optional: scope the answer to one service the user owns (adds its contracts as
    # grounding and lets the fallback path cite that service's ghost reports).
    service_id: str | None = None
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)


class ConsoleAskResponse(BaseModel):
    """Answer from the 'Ask Karma' console.

    ``dql_source`` tells the UI how the answer was produced:
      - ``davis_copilot`` — Davis CoPilot wrote the DQL, executed live on Grail
      - ``contracts``     — Davis CoPilot unavailable; grounded in stored contracts/ghosts
    """
    answer: str
    dql: str | None = None
    dql_source: Literal["davis_copilot", "contracts"] = "contracts"
    row_count: int = 0
    davis_available: bool = False


class OpenPrResponse(BaseModel):
    """Result of opening (or finding) a draft remediation PR for a ghost report."""
    pr_url: str
    pr_number: int
    branch: str
    repo: str
    created: bool   # True if newly opened this call, False if it already existed


class LiveProofContract(BaseModel):
    """A single contract Karma learned from a real (non-synthetic) service."""
    category: str
    subcategory: str
    description: str
    confidence: float
    validated: bool
    evidence_dql: str | None = None


class LiveProofResponse(BaseModel):
    """Public believability payload: a contract learned from a REAL service.

    Proves the Learner works on live production telemetry, not just the scripted
    synthetic demo. ``available`` is False until a real service has been learned.
    """
    available: bool
    service_name: str | None = None
    dynatrace_entity_id: str | None = None
    dt_env: str | None = None
    learned_at: datetime | None = None
    contract_count: int = 0
    contracts: list[LiveProofContract] = Field(default_factory=list)


class CategoryCompliance(BaseModel):
    category: str
    total_contracts: int
    compliant: int
    violated: int
    score: float | None = None    # 0–100, None if no contracts in this category
    weight: float                  # relative weight used in overall score


class MigrationReadinessResponse(BaseModel):
    service_id: str
    service_name: str
    phase: str
    overall_score: float | None = None   # 0–100 weighted compliance score; None if no contracts
    category_breakdown: list[CategoryCompliance]
    total_contracts: int
    total_violations_active: int
    avoided_incident_cost_total_usd: float   # sum from all ghost reports for this service
    recommendation: str
    computed_at: datetime


class ContractDetailResponse(BaseModel):
    contract_id: str
    service_id: str
    karma_service_id: str | None = None
    category: str
    subcategory: str
    description: str
    confidence: float
    validated: bool
    detected_at: datetime
    predicate_type: str | None = None
    predicate_test_dql: str | None = None
    predicate_threshold: str | None = None
    predicate_tolerance_seconds: int | None = None
    evidence: list[dict[str, Any]] | None = None
    downstream_dependents: list[str] | None = None
    slo_id: str | None = None  # Dynatrace SLO ID created by Learner for this contract


class WatcherRunRequest(BaseModel):
    service_id: str | None = None  # None = run for all active services


class WatcherRunResponse(BaseModel):
    run_id: str
    service_id: str
    service_name: str | None = None
    run_at: datetime
    contracts_checked: int
    violations_found: int
    duration_seconds: float | None = None


class UserSyncResponse(BaseModel):
    uid: str
    email: str
    roles: list[str] = Field(default_factory=lambda: ["user"])


class UserProfile(BaseModel):
    uid: str
    email: str
    display_name: str = ""
    photo_url: str = ""
    roles: list[str] = Field(default_factory=lambda: ["user"])


class SystemServiceCreate(BaseModel):
    service_name: str = Field(description="Human-readable name, e.g. 'Karma API'")
    dynatrace_entity_id: str = Field(description="Dynatrace entity ID (SERVICE-…)")
    replacement_service_id: str | None = Field(
        default=None,
        description="Entity ID of the new version currently being monitored",
    )
    description: str | None = None
    url: str | None = Field(default=None, description="Cloud Run service URL")


class SystemServiceResponse(BaseModel):
    service_id: str
    service_name: str
    dynatrace_entity_id: str
    replacement_service_id: str | None = None
    phase: Literal["registered", "learning", "ready", "haunting", "completed", "error"]
    error_message: str | None = None
    description: str | None = None
    url: str | None = None
    is_system: bool = True
    created_at: datetime
    updated_at: datetime


class StatsResponse(BaseModel):
    total_services: int
    total_contracts: int
    total_ghost_reports: int
    avg_contracts_per_service: float | None
    avg_minutes_to_first_alert: float | None
    pct_services_with_violations: float | None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    version: str = "0.1.0"
    firestore: bool = False
    agent_engine: bool = False


class RecordDeploymentRequest(BaseModel):
    commit_sha: str | None = Field(
        default=None,
        description="Git commit SHA — used as the dedup key; omit for a date-keyed record",
    )
    deployed_at: datetime | None = Field(
        default=None,
        description="Deployment timestamp (UTC); defaults to now",
    )
    github_repo: str | None = Field(
        default=None,
        description="'owner/repo' override; falls back to project-level GITHUB_REPO config",
    )
    # Manual overrides — if supplied, the GitHub API is not called
    commits: int | None = None
    pull_requests: int | None = None
    lines_added: int | None = None
    lines_removed: int | None = None


class RecordDeploymentResponse(BaseModel):
    deployment_id: str
    service_id: str
    service_name: str
    deployed_at: datetime
    commits: int
    pull_requests: int
    lines_added: int
    lines_removed: int
    github_repo: str
    already_existed: bool
