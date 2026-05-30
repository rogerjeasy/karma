"""Tests for ContractValidator and its helper functions.

Covers:
- Unit tests for _scope_dql_to_window (DQL injection logic)
- Unit tests for _count_false_positives (DQL result parsing)
- ContractValidator.validate — all DQL result shapes Dynatrace can return
- ContractValidator.validate_batch — filtering, partial failures, empty input
- Real telemetry response shapes (Dynatrace Grail record format)
- Multi-category contracts
- Edge cases: None results, error codes, non-standard shapes
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from karma.schemas.contract import (
    Contract,
    ContractCategory,
    DqlEvidence,
    LearningWindow,
    TracePatternEvidence,
    ViolationPredicate,
    ViolationPredicateType,
)
from karma.tools.contract_validator import (
    ContractValidator,
    _count_false_positives,
    _scope_dql_to_window,
)

# ── Helpers ───────────────────────────────────────────────────────────────────

_WINDOW = LearningWindow(
    start=datetime(2026, 5, 12, tzinfo=timezone.utc),
    end=datetime(2026, 5, 26, tzinfo=timezone.utc),
)


def _contract(
    *,
    category: ContractCategory = ContractCategory.SIDE_EFFECT,
    subcategory: str = "cache_warming",
    predicate_type: ViolationPredicateType = ViolationPredicateType.ABSENCE,
    test_dql: str = (
        'fetch logs | filter service.name == "svc-payments-v3" '
        'and contains(content, "redis.SET") | summarize count()'
    ),
    threshold: str = "count >= 1 over any 5-minute window",
    service_id: str = "SERVICE-SVC-PAYMENTS-V2",
    evidence: list | None = None,
) -> Contract:
    return Contract(
        service_id=service_id,
        category=category,
        subcategory=subcategory,
        description="Test contract",
        evidence=evidence
        or [
            DqlEvidence(
                dql='fetch logs | filter service.name == "svc-payments-v2" | summarize count()',
                sample_count=14000,
                timespan="14d",
            )
        ],
        downstream_dependents=["SERVICE-SVC-REPORTING"],
        confidence=0.95,
        learning_window=_WINDOW,
        violation_predicate=ViolationPredicate(
            type=predicate_type,
            test_dql=test_dql,
            threshold=threshold,
            tolerance_window_seconds=300,
        ),
    )


# ── _scope_dql_to_window ──────────────────────────────────────────────────────


class TestScopeDqlToWindow:
    def test_passthrough_when_timeframe_already_present(self) -> None:
        dql = "fetch logs | timeframe from:2026-05-12 to:2026-05-26 | summarize count()"
        result = _scope_dql_to_window(dql, "SVC-X", "2026-05-01", "2026-05-07")
        assert result == dql

    def test_passthrough_when_Timeframe_mixed_case(self) -> None:
        dql = "fetch spans | Timeframe from:now-1h | summarize count()"
        result = _scope_dql_to_window(dql, "SVC-X", "2026-05-01", "2026-05-07")
        assert result == dql

    def test_prepends_timeseries_for_fetch_queries(self) -> None:
        dql = "fetch logs | filter service.name == 'svc' | summarize count()"
        result = _scope_dql_to_window(dql, "SVC-X", "2026-05-12T00:00:00", "2026-05-26T00:00:00")
        assert result.startswith("timeseries from:2026-05-12T00:00:00 to:2026-05-26T00:00:00")
        assert "fetch logs" in result

    def test_preserves_original_dql_after_prefix(self) -> None:
        dql = "fetch spans | summarize count()"
        result = _scope_dql_to_window(dql, "SVC-X", "S", "E")
        assert dql in result

    def test_non_fetch_dql_returned_unchanged(self) -> None:
        dql = "timeseries metric = avg(cpu), by: {host}"
        result = _scope_dql_to_window(dql, "SVC-X", "S", "E")
        assert result == dql

    def test_empty_dql_returned_unchanged(self) -> None:
        result = _scope_dql_to_window("", "SVC-X", "S", "E")
        assert result == ""

    def test_fetch_with_uppercase_is_scoped(self) -> None:
        # The function applies .lower() before startswith("fetch"),
        # so FETCH (uppercase) is matched and gets the timeframe prefix.
        dql = "FETCH logs | summarize count()"
        result = _scope_dql_to_window(dql, "SVC-X", "S", "E")
        assert result.startswith("timeseries from:S to:E")


# ── _count_false_positives ────────────────────────────────────────────────────


class TestCountFalsePositives:
    def test_returns_zero_for_populated_list(self) -> None:
        result = _count_false_positives([{"count": 100}], "count >= 1")
        assert result == 0

    def test_returns_zero_for_nested_records(self) -> None:
        # Dynatrace Grail returns records like {"records": [...], "types": [...]}
        result = _count_false_positives({"records": [{"count": 42}]}, "count >= 1")
        assert result == 0

    def test_returns_one_for_empty_list(self) -> None:
        result = _count_false_positives([], "count >= 1")
        assert result == 1

    def test_returns_one_for_empty_dict(self) -> None:
        result = _count_false_positives({}, "count >= 1")
        assert result == 1

    def test_returns_one_for_none(self) -> None:
        result = _count_false_positives(None, "count >= 1")
        assert result == 1

    def test_returns_one_for_null_string(self) -> None:
        result = _count_false_positives("null", "count >= 1")
        assert result == 1

    def test_returns_one_for_zero_string(self) -> None:
        result = _count_false_positives("0", "count >= 1")
        assert result == 1

    def test_returns_one_for_empty_brackets(self) -> None:
        result = _count_false_positives("[]", "count >= 1")
        assert result == 1

    def test_returns_one_for_empty_braces(self) -> None:
        result = _count_false_positives("{}", "count >= 1")
        assert result == 1

    def test_returns_zero_for_non_empty_string(self) -> None:
        result = _count_false_positives('{"count": 5}', "count >= 1")
        assert result == 0

    def test_returns_zero_for_numeric_non_zero(self) -> None:
        result = _count_false_positives(42, "count >= 1")
        assert result == 0

    def test_returns_zero_for_integer_result(self) -> None:
        # Some Dynatrace tools return bare integers for count queries
        result = _count_false_positives(1, "count >= 1")
        assert result == 0

    def test_returns_one_for_integer_zero(self) -> None:
        result = _count_false_positives(0, "count >= 1")
        assert result == 1


# ── ContractValidator.validate ────────────────────────────────────────────────


class TestContractValidatorValidate:
    async def test_passes_when_dql_returns_records(self) -> None:
        dql_fn = AsyncMock(return_value=[{"count": 100, "service.name": "svc-payments-v2"}])
        validator = ContractValidator(dql_fn)

        contract = await validator.validate(_contract())

        assert contract.validated is True
        assert contract.false_positive_count == 0
        assert contract.validation_run_count == 1

    async def test_rejects_when_dql_returns_empty_list(self) -> None:
        dql_fn = AsyncMock(return_value=[])
        validator = ContractValidator(dql_fn)

        contract = await validator.validate(_contract())

        assert contract.validated is False
        assert contract.false_positive_count == 1
        assert contract.validation_run_count == 1

    async def test_rejects_when_dql_returns_zero(self) -> None:
        dql_fn = AsyncMock(return_value=0)
        validator = ContractValidator(dql_fn)

        contract = await validator.validate(_contract())

        assert contract.validated is False

    async def test_rejects_when_dql_returns_none(self) -> None:
        dql_fn = AsyncMock(return_value=None)
        validator = ContractValidator(dql_fn)

        contract = await validator.validate(_contract())

        assert contract.validated is False
        assert contract.false_positive_count == 1

    async def test_rejects_on_tool_exception(self) -> None:
        dql_fn = AsyncMock(side_effect=RuntimeError("DQL execution failed"))
        validator = ContractValidator(dql_fn)

        contract = await validator.validate(_contract())

        assert contract.validated is False
        assert contract.false_positive_count == 1
        assert contract.validation_run_count == 1

    async def test_rejects_on_timeout_exception(self) -> None:
        dql_fn = AsyncMock(side_effect=TimeoutError("MCP timed out"))
        validator = ContractValidator(dql_fn)

        contract = await validator.validate(_contract())

        assert contract.validated is False

    async def test_increments_validation_run_count_on_each_call(self) -> None:
        dql_fn = AsyncMock(return_value=[{"count": 50}])
        validator = ContractValidator(dql_fn)
        contract = _contract()

        contract = await validator.validate(contract)
        contract = await validator.validate(contract)

        assert contract.validation_run_count == 2

    async def test_dql_is_scoped_to_learning_window(self) -> None:
        dql_fn = AsyncMock(return_value=[{"count": 1}])
        validator = ContractValidator(dql_fn)
        contract = _contract()

        await validator.validate(contract)

        called_dql: str = dql_fn.call_args[1]["dql"]
        # The window start/end should appear in the DQL (either inline or prepended)
        assert "2026-05-12" in called_dql or "timeseries" in called_dql

    async def test_dql_not_re_scoped_when_timeframe_present(self) -> None:
        original_dql = (
            "fetch logs | timeframe from:2026-05-12 to:2026-05-26 "
            '| filter service.name == "svc-payments-v3" | summarize count()'
        )
        dql_fn = AsyncMock(return_value=[{"count": 5}])
        validator = ContractValidator(dql_fn)
        contract = _contract(test_dql=original_dql)

        await validator.validate(contract)

        called_dql: str = dql_fn.call_args[1]["dql"]
        # timeframe already present — should not be prepended
        assert called_dql == original_dql

    async def test_passes_for_grail_records_format(self) -> None:
        # Dynatrace Grail DQL returns {"records": [...], "types": [...], "metadata": {...}}
        dql_fn = AsyncMock(
            return_value={
                "records": [
                    {"count": 42, "service.name": "svc-payments-v2"},
                    {"count": 38, "service.name": "svc-payments-v2"},
                ],
                "types": [{"mappings": {"count": {"type": "long"}}}],
                "metadata": {"grailRequestId": "abc"},
            }
        )
        validator = ContractValidator(dql_fn)

        contract = await validator.validate(_contract())

        assert contract.validated is True

    async def test_passes_for_timeseries_result_format(self) -> None:
        # Timeseries queries return a different structure
        dql_fn = AsyncMock(
            return_value={
                "resolution": {"interval": "5m", "intervalValue": 300000000000},
                "data": [
                    {"metric": [1.0, 2.0, 1.5], "dimensions": {"service": "svc-payments-v2"}}
                ],
            }
        )
        validator = ContractValidator(dql_fn)

        contract = await validator.validate(_contract())

        assert contract.validated is True


# ── Real-world DQL result shapes ──────────────────────────────────────────────


class TestDqlResultShapes:
    """Validate that _count_false_positives handles all shapes Dynatrace can return."""

    @pytest.mark.parametrize(
        "result, expected_fps",
        [
            # Populated results — should all pass (0 false positives)
            ([{"count": 1}], 0),
            ([{"count": 100}, {"count": 200}], 0),
            ({"records": [{"ts": "2026-05-20", "val": 1.5}]}, 0),
            ({"data": [{"values": [1.0, 2.0]}]}, 0),
            ('{"count": 42}', 0),
            (1, 0),
            (True, 0),
            # Empty / null results — should all fail (1 false positive)
            (None, 1),
            ([], 1),
            ({}, 1),
            ("", 1),
            ("null", 1),
            ("[]", 1),
            ("{}", 1),
            ("0", 1),
            (0, 1),
            (False, 0),   # str(False) == "False" — not in null set, treated as present
        ],
    )
    def test_result_shape(self, result: object, expected_fps: int) -> None:
        fps = _count_false_positives(result, "count >= 1")
        assert fps == expected_fps, f"Expected {expected_fps} FP for result={result!r}, got {fps}"


# ── ContractValidator.validate_batch ─────────────────────────────────────────


class TestContractValidatorBatch:
    async def test_returns_only_passing_contracts(self) -> None:
        dql_fn = AsyncMock(
            side_effect=[
                [{"count": 100}],  # contract 0 — passes
                [],                 # contract 1 — fails
                [{"count": 55}],   # contract 2 — passes
            ]
        )
        validator = ContractValidator(dql_fn)
        contracts = [_contract(subcategory=f"sub_{i}") for i in range(3)]

        result = await validator.validate_batch(contracts)

        assert len(result) == 2
        assert all(c.validated for c in result)

    async def test_returns_empty_list_when_all_fail(self) -> None:
        dql_fn = AsyncMock(return_value=[])
        validator = ContractValidator(dql_fn)

        result = await validator.validate_batch([_contract(), _contract()])

        assert result == []

    async def test_returns_all_when_all_pass(self) -> None:
        dql_fn = AsyncMock(return_value=[{"count": 50}])
        validator = ContractValidator(dql_fn)

        result = await validator.validate_batch([_contract(), _contract()])

        assert len(result) == 2

    async def test_handles_empty_input(self) -> None:
        dql_fn = AsyncMock(return_value=[{"count": 1}])
        validator = ContractValidator(dql_fn)

        result = await validator.validate_batch([])

        assert result == []
        dql_fn.assert_not_called()

    async def test_partial_tool_errors_do_not_abort_batch(self) -> None:
        dql_fn = AsyncMock(
            side_effect=[
                RuntimeError("MCP timeout"),  # contract 0 — tool error
                [{"count": 10}],               # contract 1 — passes
            ]
        )
        validator = ContractValidator(dql_fn)
        contracts = [_contract(subcategory="sub_0"), _contract(subcategory="sub_1")]

        result = await validator.validate_batch(contracts)

        assert len(result) == 1
        assert result[0].subcategory == "sub_1"


# ── Multi-category coverage ───────────────────────────────────────────────────


class TestAllContractCategories:
    @pytest.mark.parametrize("category", list(ContractCategory))
    async def test_validates_each_category(self, category: ContractCategory) -> None:
        dql_fn = AsyncMock(return_value=[{"count": 10}])
        validator = ContractValidator(dql_fn)

        contract = _contract(category=category)
        result = await validator.validate(contract)

        assert result.validated is True
        assert result.category == category

    @pytest.mark.parametrize(
        "predicate_type",
        [
            ViolationPredicateType.ABSENCE,
            ViolationPredicateType.THRESHOLD_BREACH,
            ViolationPredicateType.DISTRIBUTION_SHIFT,
            ViolationPredicateType.PATTERN_MISMATCH,
        ],
    )
    async def test_all_predicate_types_are_validated(
        self, predicate_type: ViolationPredicateType
    ) -> None:
        dql_fn = AsyncMock(return_value=[{"count": 5}])
        validator = ContractValidator(dql_fn)

        contract = _contract(predicate_type=predicate_type)
        result = await validator.validate(contract)

        assert result.validated is True


# ── Contract readiness gate ───────────────────────────────────────────────────


class TestContractReadinessGate:
    async def test_validated_contract_is_ready_for_watching(self) -> None:
        dql_fn = AsyncMock(return_value=[{"count": 10}])
        validator = ContractValidator(dql_fn)

        contract = await validator.validate(_contract())

        assert contract.is_ready_for_watching() is True

    async def test_rejected_contract_is_not_ready_for_watching(self) -> None:
        dql_fn = AsyncMock(return_value=[])
        validator = ContractValidator(dql_fn)

        contract = await validator.validate(_contract())

        assert contract.is_ready_for_watching() is False

    async def test_error_contract_is_not_ready_for_watching(self) -> None:
        dql_fn = AsyncMock(side_effect=ValueError("bad DQL"))
        validator = ContractValidator(dql_fn)

        contract = await validator.validate(_contract())

        assert contract.is_ready_for_watching() is False

    def test_unvalidated_contract_is_not_ready(self) -> None:
        contract = _contract()
        assert contract.validated is False
        assert contract.is_ready_for_watching() is False

    def test_manually_validated_contract_is_ready(self) -> None:
        contract = _contract()
        contract.validated = True
        contract.false_positive_count = 0
        assert contract.is_ready_for_watching() is True

    def test_validated_with_false_positives_is_not_ready(self) -> None:
        contract = _contract()
        contract.validated = True
        contract.false_positive_count = 1
        assert contract.is_ready_for_watching() is False


# ── Cache-warming demo scenario ───────────────────────────────────────────────
# These tests simulate the exact telemetry shape from the svc-payments demo
# to verify the validator works end-to-end for the hackathon demo.


class TestCacheWarmingDemoScenario:
    """Simulate the full learning validation for the svc-payments-v2 cache-warming contract."""

    _CACHE_WARMING_DQL = (
        'fetch logs '
        '| filter service.name == "svc-payments-v2" '
        '| filter contains(content, "redis.SET") '
        '| summarize count()'
    )

    def _make_demo_contract(self) -> Contract:
        return Contract(
            service_id="SERVICE-SVC-PAYMENTS-V2",
            category=ContractCategory.SIDE_EFFECT,
            subcategory="cache_warming",
            description=(
                "svc-payments-v2 writes recent_charges:summary to Redis "
                "via SET every ~30 seconds as a cache-warming side effect."
            ),
            evidence=[
                DqlEvidence(
                    dql=self._CACHE_WARMING_DQL,
                    sample_count=14_112,
                    timespan="14d",
                    result_summary="2 writes per 30s, 96 per 24h avg",
                ),
                TracePatternEvidence(
                    pattern="svc-payments-v2 -> redis.SET recent_charges:summary",
                    frequency="2 ± 0.3 per 30s",
                    sample_count=14_112,
                ),
            ],
            downstream_dependents=["SERVICE-SVC-REPORTING"],
            confidence=0.97,
            learning_window=_WINDOW,
            violation_predicate=ViolationPredicate(
                type=ViolationPredicateType.ABSENCE,
                test_dql=(
                    'fetch logs '
                    '| filter service.name == "svc-payments-v3" '
                    '| filter contains(content, "redis.SET") '
                    '| summarize count()'
                ),
                threshold="count >= 1 over any 5-minute window",
                tolerance_window_seconds=300,
            ),
        )

    async def test_old_service_passes_validation(self) -> None:
        # Old service (v2) has cache warming — predicate must not fire on its data
        dql_fn = AsyncMock(return_value=[{"count": 14112}])  # lots of writes
        validator = ContractValidator(dql_fn)

        contract = await validator.validate(self._make_demo_contract())

        assert contract.validated is True
        assert contract.false_positive_count == 0

    async def test_new_service_triggers_violation(self) -> None:
        # New service (v3) has NO cache warming — predicate fires
        # When Watcher runs this DQL against v3, it gets empty results
        dql_fn = AsyncMock(return_value=[])  # v3 has zero redis.SET
        validator = ContractValidator(dql_fn)

        contract = await validator.validate(self._make_demo_contract())

        # Contract should NOT be valid when predicate fires on historical data
        assert contract.validated is False
        assert contract.false_positive_count == 1

    async def test_flaky_cache_warming_still_validates(self) -> None:
        # v2 writes to Redis but not every window — still some writes present
        dql_fn = AsyncMock(return_value=[{"count": 2}])  # minimal but non-zero
        validator = ContractValidator(dql_fn)

        contract = await validator.validate(self._make_demo_contract())

        assert contract.validated is True

    async def test_contract_serialises_for_firestore(self) -> None:
        import json

        contract = self._make_demo_contract()
        contract.validated = True
        d = contract.to_firestore_dict()
        json.dumps(d)  # must not raise — Firestore save requires JSON-serialisable dict
        assert d["category"] == "side_effect"
        assert d["subcategory"] == "cache_warming"
        assert len(d["evidence"]) == 2
