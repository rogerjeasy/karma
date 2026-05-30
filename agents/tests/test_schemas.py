"""Unit tests for contract Pydantic schemas."""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from karma.schemas.contract import (
    Contract,
    ContractCategory,
    ContractViolation,
    DqlEvidence,
    GhostReport,
    LearningWindow,
    TracePatternEvidence,
    ViolationPredicate,
    ViolationPredicateType,
)


def _make_learning_window() -> LearningWindow:
    return LearningWindow(
        start=datetime(2026, 5, 12, tzinfo=timezone.utc),
        end=datetime(2026, 5, 26, tzinfo=timezone.utc),
    )


def _make_dql_evidence() -> DqlEvidence:
    return DqlEvidence(
        dql='fetch logs | filter service.name == "svc-payments-v2" | summarize count()',
        sample_count=14000,
        timespan="14d",
        result_summary="2 writes per 30s",
    )


def _make_contract(category: ContractCategory = ContractCategory.SIDE_EFFECT) -> Contract:
    return Contract(
        service_id="SERVICE-SVC-PAYMENTS-V2",
        category=category,
        subcategory="cache_warming",
        description="Service writes recent_charges:summary to Redis every ~30s.",
        evidence=[_make_dql_evidence()],
        downstream_dependents=["SERVICE-SVC-REPORTING"],
        confidence=0.95,
        learning_window=_make_learning_window(),
        violation_predicate=ViolationPredicate(
            type=ViolationPredicateType.ABSENCE,
            test_dql='fetch logs | filter service.name == "svc-payments-v3" and contains(content, "redis.SET") | summarize count()',
            threshold="count >= 1 over any 5-minute window",
            tolerance_window_seconds=300,
        ),
    )


class TestContract:
    def test_create_minimal(self) -> None:
        contract = _make_contract()
        assert contract.contract_id  # auto-generated UUID
        assert contract.category == ContractCategory.SIDE_EFFECT
        assert not contract.validated

    def test_is_ready_for_watching_false_when_not_validated(self) -> None:
        contract = _make_contract()
        assert not contract.is_ready_for_watching()

    def test_is_ready_for_watching_true_when_validated_no_fp(self) -> None:
        contract = _make_contract()
        contract.validated = True
        contract.false_positive_count = 0
        assert contract.is_ready_for_watching()

    def test_is_ready_for_watching_false_when_has_false_positives(self) -> None:
        contract = _make_contract()
        contract.validated = True
        contract.false_positive_count = 1
        assert not contract.is_ready_for_watching()

    def test_confidence_bounds(self) -> None:
        with pytest.raises(ValueError):
            Contract.model_validate({**_make_contract().model_dump(), "confidence": 1.5})

    def test_to_firestore_dict_is_json_serializable(self) -> None:
        import json
        contract = _make_contract()
        contract.validated = True
        d = contract.to_firestore_dict()
        json.dumps(d)  # must not raise

    def test_learning_window_end_must_be_after_start(self) -> None:
        with pytest.raises(ValueError):
            LearningWindow(
                start=datetime(2026, 5, 26, tzinfo=timezone.utc),
                end=datetime(2026, 5, 12, tzinfo=timezone.utc),
            )

    def test_all_eight_categories(self) -> None:
        for category in ContractCategory:
            contract = _make_contract(category=category)
            assert contract.category == category


class TestEvidence:
    def test_dql_evidence_discriminator(self) -> None:
        evidence = DqlEvidence(
            dql="fetch logs | summarize count()",
            sample_count=1000,
            timespan="7d",
        )
        assert evidence.type == "dql_query"

    def test_trace_pattern_evidence_discriminator(self) -> None:
        evidence = TracePatternEvidence(
            pattern="service.write -> redis.SET",
            frequency="2 per 30s",
            sample_count=5000,
        )
        assert evidence.type == "trace_pattern"

    def test_evidence_in_contract_discriminated_union(self) -> None:
        contract = Contract(
            service_id="SERVICE-X",
            category=ContractCategory.LATENCY,
            subcategory="p95_band",
            description="p95 < 150ms",
            evidence=[
                DqlEvidence(dql="fetch spans | summarize p95(duration)", sample_count=1000, timespan="7d"),
                TracePatternEvidence(pattern="handler -> db.query", frequency="1 per req", sample_count=1000),
            ],
            confidence=0.88,
            learning_window=_make_learning_window(),
            violation_predicate=ViolationPredicate(
                type=ViolationPredicateType.THRESHOLD_BREACH,
                test_dql="fetch spans | summarize p95(duration)",
                threshold="p95 < 150ms",
                tolerance_window_seconds=120,
            ),
        )
        assert len(contract.evidence) == 2
