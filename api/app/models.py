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


class ServiceResponse(BaseModel):
    service_id: str
    service_name: str
    dynatrace_entity_id: str
    deprecation_date: datetime
    replacement_service_id: str | None
    phase: Literal["registered", "learning", "ready", "haunting", "completed", "error"]
    error_message: str | None = None
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


class GhostReportResponse(BaseModel):
    report_id: str
    violation_id: str
    contract_id: str
    category: str
    summary: str
    root_cause: str
    downstream_impact: str
    davis_ai_insights: str | None = None
    severity: Literal["low", "medium", "high", "critical"]
    evidence_links: list[str]
    remediation_suggestions: list[str]
    cost_estimate_usd: float | None = None
    investigation_input_tokens: int | None = None
    investigation_output_tokens: int | None = None
    dynatrace_event_id: str | None = None
    created_at: datetime


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
