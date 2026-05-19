"""Pydantic models for Karma's implicit contract schema.

These are the source of truth for contract structure. The JSON Schema in
agents/karma/prompts/contract_schema.json is derived from these models.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator


class ContractCategory(StrEnum):
    LATENCY = "latency"
    ERROR_SEMANTICS = "error_semantics"
    THROUGHPUT = "throughput"
    SIDE_EFFECT = "side_effect"
    TIMING = "timing"
    DEPENDENCY = "dependency"
    RESOURCE = "resource"
    SEQUENCING = "sequencing"


class ViolationPredicateType(StrEnum):
    ABSENCE = "absence"
    THRESHOLD_BREACH = "threshold_breach"
    DISTRIBUTION_SHIFT = "distribution_shift"
    PATTERN_MISMATCH = "pattern_mismatch"


class DqlEvidence(BaseModel):
    type: Literal["dql_query"] = "dql_query"
    dql: str = Field(description="Exact DQL used to derive this evidence")
    sample_count: int = Field(ge=1)
    timespan: str = Field(description="Human-readable range, e.g. '14d'")
    result_summary: str | None = None


class TracePatternEvidence(BaseModel):
    type: Literal["trace_pattern"] = "trace_pattern"
    pattern: str = Field(description="Span pattern, e.g. 'service.write -> redis.SET'")
    frequency: str = Field(description="Observed frequency, e.g. '32 ± 4 per minute'")
    sample_count: int = Field(ge=1)


Evidence = Annotated[DqlEvidence | TracePatternEvidence, Field(discriminator="type")]


class ViolationPredicate(BaseModel):
    type: ViolationPredicateType
    test_dql: str = Field(
        description=(
            "DQL evaluated against the NEW service. "
            "A failure (predicate not met) triggers Forensic."
        )
    )
    threshold: str = Field(
        description="Human-readable threshold, e.g. 'count >= 20 over any 5-minute window'"
    )
    tolerance_window_seconds: int = Field(
        default=300,
        ge=60,
        description="How long the predicate must fail before triggering Forensic",
    )


class LearningWindow(BaseModel):
    start: datetime
    end: datetime

    @field_validator("end")
    @classmethod
    def end_after_start(cls, end: datetime, info: object) -> datetime:
        # info.data may not have 'start' if validation failed earlier
        data = getattr(info, "data", {})
        start = data.get("start")
        if start and end <= start:
            raise ValueError("end must be after start")
        return end


class Contract(BaseModel):
    contract_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    service_id: str = Field(description="Dynatrace entity ID of the observed service")
    category: ContractCategory
    subcategory: str = Field(description="Fine-grained label, e.g. 'cache_warming'")
    description: str = Field(description="Factual observation about the contract")
    evidence: list[Evidence] = Field(min_length=1)
    downstream_dependents: list[str] = Field(
        default_factory=list,
        description="Dynatrace entity IDs of dependent services",
    )
    confidence: float = Field(ge=0.0, le=1.0)
    detected_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC)
    )
    learning_window: LearningWindow
    violation_predicate: ViolationPredicate
    validated: bool = False
    false_positive_count: int = Field(default=0, ge=0)
    validation_run_count: int = Field(default=0, ge=0)

    def is_ready_for_watching(self) -> bool:
        return self.validated and self.false_positive_count == 0

    def to_firestore_dict(self) -> dict[str, object]:
        return self.model_dump(mode="json")


class ContractViolation(BaseModel):
    violation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    contract_id: str
    service_id: str
    detected_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    predicate_dql: str
    raw_dql_result: dict[str, object]
    downstream_impact_summary: str | None = None
    ghost_report_id: str | None = None
    dynatrace_event_id: str | None = None
    resolved: bool = False

    def to_firestore_dict(self) -> dict[str, object]:
        return self.model_dump(mode="json")


class GhostReport(BaseModel):
    report_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    violation_id: str
    contract: Contract
    summary: str = Field(description="One-paragraph executive summary of the violation")
    root_cause: str = Field(description="Technical root cause explanation")
    downstream_impact: str = Field(description="Observed impact on downstream services")
    evidence_links: list[str] = Field(
        description="Dynatrace deep-link URLs to supporting evidence"
    )
    remediation_suggestions: list[str]
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    dynatrace_event_id: str | None = None

    def to_firestore_dict(self) -> dict[str, object]:
        return self.model_dump(mode="json")
