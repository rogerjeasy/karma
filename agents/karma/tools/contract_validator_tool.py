"""Contract validator as a synchronous agent tool.

Exposes contract predicate validation as a tool the Learner can call before
saving contracts. A predicate that fires false positives on the OLD service's
own historical data is too noisy — it would trigger Forensic investigations
on the watching service even when the replacement is behaving correctly.

Only contracts with validated=True and false_positive_count=0 should be
passed to save_contracts_to_firestore.
"""
from __future__ import annotations

from typing import Any

import structlog

from karma.tools.dynatrace_api_tools import execute_dql

logger = structlog.get_logger(__name__)


def validate_contract_predicate(
    contract_id: str,
    service_id: str,
    test_dql: str,
    learning_window_start: str,
    learning_window_end: str,
    category: str = "",
) -> dict[str, Any]:
    """Validate a contract's violation predicate against the old service's historical data.

    The predicate DQL is designed to PASS (return results) when the contracted
    behavior IS present. Running it against the old service's own data must
    return results — otherwise the predicate is wrong or too narrow.

    Call this for every proposed contract BEFORE calling save_contracts_to_firestore.
    Only include contracts where the returned validated=True in the saved list.

    Args:
        contract_id: Contract UUID (for log correlation, use any string if not yet assigned)
        service_id: Dynatrace entity ID of the OLD service being analyzed
        test_dql: The violation_predicate.test_dql — should return rows when behavior IS present
        learning_window_start: ISO 8601 start of the historical window (e.g. "2026-05-01T00:00:00Z")
        learning_window_end: ISO 8601 end of the historical window (e.g. "2026-05-15T00:00:00Z")
        category: Contract category label for log context (optional)

    Returns:
        {
            "validated": bool,            # True = ready for watching; False = predicate rejected
            "false_positive_count": int,  # 0 if validated; 1 if predicate returned no results
            "reason": str,                # Human-readable explanation of the decision
            "dql_result_summary": str     # First few records from the DQL result
        }
    """
    log = logger.bind(
        contract_id=contract_id,
        service_id=service_id,
        category=category,
    )
    log.info("validating_contract_predicate")

    scoped_dql = _inject_timeframe(test_dql, learning_window_start, learning_window_end)

    try:
        result = execute_dql(scoped_dql)
    except Exception as exc:
        log.warning("validation_dql_exception", error=str(exc))
        return {
            "validated": False,
            "false_positive_count": 1,
            "reason": f"DQL execution raised an exception: {exc}",
            "dql_result_summary": "",
        }

    if "error" in result:
        log.warning("validation_dql_error", error=result["error"])
        return {
            "validated": False,
            "false_positive_count": 1,
            "reason": f"DQL returned an error: {result['error']}",
            "dql_result_summary": str(result)[:300],
        }

    records: list[Any] = result.get("result", {}).get("records", [])

    if not records:
        log.info("contract_rejected_no_records")
        return {
            "validated": False,
            "false_positive_count": 1,
            "reason": (
                "Predicate returned zero records on the old service's historical data. "
                "The predicate would fire a false positive on a correctly-behaving service. "
                "Either the predicate DQL is wrong, or the behavior was not actually present."
            ),
            "dql_result_summary": str(result)[:300],
        }

    log.info("contract_validated", record_count=len(records))
    return {
        "validated": True,
        "false_positive_count": 0,
        "reason": f"Predicate confirmed: {len(records)} record(s) found in historical data — behavior was present.",
        "dql_result_summary": str(records[:3])[:400],
    }


def _inject_timeframe(dql: str, start: str, end: str) -> str:
    """Force the learning-window timeframe onto a DQL statement.

    Violation predicate DQLs use relative windows like 'from:now()-10m' for the
    watcher (checking current traffic). During validation we must override this
    with the historical learning window — otherwise the DQL runs against a
    deprecated service that has no current traffic and returns 0 records,
    causing every contract to be rejected.
    """
    import re

    stripped = dql.strip()

    # Replace any existing from: clause (relative or absolute) with the learning window.
    # Handles: from:now()-14d  from:"2026-05-01T..."  from:now()
    replaced, n_from = re.subn(
        r'from:(?:"[^"]*"|now\(\)[^\s,|]*)',
        f'from:"{start}"',
        stripped,
        flags=re.IGNORECASE,
    )
    # Replace any existing to: clause with the end boundary.
    replaced, n_to = re.subn(
        r'to:(?:"[^"]*"|now\(\)[^\s,|]*)',
        f'to:"{end}"',
        replaced,
        flags=re.IGNORECASE,
    )

    if n_from:
        # Had a from: — also append to: if it was not already there / replaced.
        if not n_to and "to:" not in replaced.lower():
            replaced = re.sub(
                r'(from:"[^"]*")',
                rf'\1, to:"{end}"',
                replaced,
                flags=re.IGNORECASE,
            )
        return replaced

    # No from: at all — append the window to the first fetch line.
    if not stripped.lower().startswith("fetch ") and not stripped.lower().startswith("timeseries "):
        return dql
    newline = stripped.find("\n")
    if newline == -1:
        return f'{stripped}, from:"{start}", to:"{end}"'
    return f'{stripped[:newline]}, from:"{start}", to:"{end}"{stripped[newline:]}'
