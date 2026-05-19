"""Unit tests for ContractValidator."""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from karma.schemas.contract import (
    Contract,
    ContractCategory,
    DqlEvidence,
    LearningWindow,
    ViolationPredicate,
    ViolationPredicateType,
)
from karma.tools.contract_validator import ContractValidator


def _make_contract() -> Contract:
    return Contract(
        service_id="SERVICE-SVC-PAYMENTS-V2",
        category=ContractCategory.SIDE_EFFECT,
        subcategory="cache_warming",
        description="Writes to Redis every 30s",
        evidence=[
            DqlEvidence(
                dql='fetch logs | filter service.name == "svc-payments-v2" | summarize count()',
                sample_count=14000,
                timespan="14d",
            )
        ],
        confidence=0.95,
        learning_window=LearningWindow(
            start=datetime(2026, 5, 12, tzinfo=timezone.utc),
            end=datetime(2026, 5, 26, tzinfo=timezone.utc),
        ),
        violation_predicate=ViolationPredicate(
            type=ViolationPredicateType.ABSENCE,
            test_dql='fetch logs | filter service.name == "svc-payments-v3" | summarize count()',
            threshold="count >= 1 over any 5-minute window",
            tolerance_window_seconds=300,
        ),
    )


class TestContractValidator:
    async def test_validates_when_predicate_passes(self) -> None:
        execute_dql = AsyncMock(return_value=[{"count": 100}])
        validator = ContractValidator(execute_dql_fn=execute_dql)

        contract = await validator.validate(_make_contract())

        assert contract.validated is True
        assert contract.false_positive_count == 0
        assert contract.validation_run_count == 1

    async def test_rejects_when_predicate_returns_empty(self) -> None:
        execute_dql = AsyncMock(return_value=[])
        validator = ContractValidator(execute_dql_fn=execute_dql)

        contract = await validator.validate(_make_contract())

        assert contract.validated is False
        assert contract.false_positive_count == 1

    async def test_rejects_when_predicate_returns_zero(self) -> None:
        execute_dql = AsyncMock(return_value=0)
        validator = ContractValidator(execute_dql_fn=execute_dql)

        contract = await validator.validate(_make_contract())

        assert contract.validated is False

    async def test_rejects_on_tool_error(self) -> None:
        execute_dql = AsyncMock(side_effect=RuntimeError("DQL execution failed"))
        validator = ContractValidator(execute_dql_fn=execute_dql)

        contract = await validator.validate(_make_contract())

        assert contract.validated is False
        assert contract.false_positive_count == 1

    async def test_batch_returns_only_passing(self) -> None:
        execute_dql = AsyncMock(
            side_effect=[
                [{"count": 100}],  # contract 1 passes
                [],                 # contract 2 fails
            ]
        )
        validator = ContractValidator(execute_dql_fn=execute_dql)
        contracts = [_make_contract(), _make_contract()]

        result = await validator.validate_batch(contracts)

        assert len(result) == 1
        assert result[0].validated is True
