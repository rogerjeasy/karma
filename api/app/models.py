"""Request/response models for the API gateway.

These are transport-layer models, separate from the agent-layer Pydantic
models in agents/karma/schemas/contract.py.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

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
    severity: Literal["low", "medium", "high", "critical"]
    evidence_links: list[str]
    remediation_suggestions: list[str]
    created_at: datetime


class WatcherRunRequest(BaseModel):
    service_id: str | None = None  # None = run for all active services


class UserSyncResponse(BaseModel):
    uid: str
    email: str


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    version: str = "0.1.0"
    firestore: bool = False
    agent_engine: bool = False
