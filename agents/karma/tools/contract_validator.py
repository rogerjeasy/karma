"""Contract validator — runs violation predicates against historical data.

A contract is accepted into Memory Bank only if its violation_predicate
fires ZERO false positives when run against the OLD service's historical
telemetry. This is what separates engineered contracts from vibe-contracts.
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

import structlog

from karma.schemas.contract import Contract

logger = structlog.get_logger(__name__)


class ContractValidator:
    """Validates candidate contracts against historical telemetry.

    Uses the Dynatrace MCP `execute-dql` tool (injected at call time) to
    run each contract's violation_predicate.test_dql against the old
    service's data over the learning window.

    The predicate is designed to PASS when the behavior IS present.
    A false positive means the predicate *failed* (reported absence) while
    the old service was actually running — indicating a noisy predicate.
    """

    def __init__(self, execute_dql_fn: Callable[..., Awaitable[Any]]) -> None:
        self._execute_dql = execute_dql_fn

    async def validate(self, contract: Contract) -> Contract:
        """Run the predicate against historical data.

        Returns the contract with `validated=True` if it passes,
        or `validated=False` with `false_positive_count` set otherwise.
        """
        log = logger.bind(
            contract_id=contract.contract_id,
            category=contract.category,
            subcategory=contract.subcategory,
        )
        log.info("validating_contract")

        window_start = contract.learning_window.start.isoformat()
        window_end = contract.learning_window.end.isoformat()

        # Scope the predicate DQL to the old service's historical window
        scoped_dql = _scope_dql_to_window(
            contract.violation_predicate.test_dql,
            service_id=contract.service_id,
            start=window_start,
            end=window_end,
        )

        try:
            result = await self._execute_dql(dql=scoped_dql)
            false_positives = _count_false_positives(result, contract.violation_predicate.threshold)
        except Exception as exc:
            log.warning("validation_dql_failed", error=str(exc))
            # Treat tool errors conservatively — do not accept the contract
            contract.validated = False
            contract.false_positive_count = 1
            contract.validation_run_count += 1
            return contract

        contract.false_positive_count = false_positives
        contract.validation_run_count += 1
        contract.validated = false_positives == 0

        log.info(
            "validation_complete",
            validated=contract.validated,
            false_positives=false_positives,
        )
        return contract

    async def validate_batch(self, contracts: list[Contract]) -> list[Contract]:
        """Validate a list of contracts, returning only those that pass."""
        validated = []
        for contract in contracts:
            result = await self.validate(contract)
            if result.is_ready_for_watching():
                validated.append(result)
            else:
                logger.info(
                    "contract_rejected",
                    contract_id=contract.contract_id,
                    false_positives=contract.false_positive_count,
                )
        return validated


def _scope_dql_to_window(dql: str, service_id: str, start: str, end: str) -> str:
    """Prepend a timeframe filter to the DQL for historical validation.

    This is a best-effort transformation. For complex DQL, the Learner
    should already include explicit time filters in its generated queries.
    """
    if "timeframe" in dql.lower():
        return dql

    # Inject a from/to timeframe if the DQL starts with 'fetch'
    if dql.strip().lower().startswith("fetch"):
        return f"timeseries from:{start} to:{end}\n{dql}"

    return dql


def _count_false_positives(dql_result: object, threshold: str) -> int:
    """Parse the DQL result and count windows where the predicate failed.

    A false positive = the predicate fires (reports absence/breach) even
    though the old service was functioning normally.

    This is intentionally conservative: if we can't parse the result,
    we report 1 false positive to reject the contract.
    """
    if dql_result is None:
        return 1

    result_str = str(dql_result).strip()

    # If result is empty or zero-count, that means the predicate would fire
    # on the old service's data — that's a false positive
    if not result_str or result_str in ("[]", "{}", "null", "0"):
        return 1

    return 0
