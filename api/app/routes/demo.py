"""Demo seed route — pre-populates Firestore with the canonical svc-payments scenario."""
from __future__ import annotations

import datetime as dt
import uuid
from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, status

from app import firestore_client
from app.auth import get_current_user

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/demo", tags=["demo"])

_DEMO_MARKER = "[demo]"

_CONTRACTS_TEMPLATE = [
    {
        "category": "side_effect",
        "subcategory": "cache_warming",
        "description": (
            "svc-payments-v2 writes to Redis key `recent_charges:summary` every 30 s via a "
            "background loop. svc-reporting consumes this key for fast charge-summary lookups "
            "and degrades to a 550 ms direct API call when the key is absent."
        ),
        "confidence": 0.97,
        "violation_predicate": {
            "type": "absence",
            "test_dql": (
                'fetch spans | filter service.name == "svc-payments-v3" '
                'and span.name == "redis.SET" and db.statement contains "recent_charges:summary" '
                "| summarize count = count() by bin(timestamp, 5m) | filter count == 0"
            ),
            "threshold": "count >= 0 writes over any 5-minute window (must be > 0)",
            "tolerance_window_seconds": 300,
        },
        "evidence": [
            {
                "type": "dql_query",
                "dql": (
                    'fetch spans, from:now()-14d | filter service.name == "svc-payments-v2" '
                    'and span.name == "redis.SET" '
                    'and db.statement contains "recent_charges:summary" '
                    "| summarize count = count() by bin(timestamp, 1h)"
                ),
                "sample_count": 4032,
                "timespan": "14d",
                "result_summary": "32 ± 4 writes per minute, continuous over 14-day window",
            },
            {
                "type": "trace_pattern",
                "pattern": "svc-payments-v2.background_loop -> redis.SET(recent_charges:summary)",
                "frequency": "32 ± 4 per minute",
                "sample_count": 4032,
            },
        ],
        "downstream_dependents": ["SERVICE-REPORTING1111111111111111"],
    },
    {
        "category": "latency",
        "subcategory": "p95_charge_latency",
        "description": (
            "The /charge endpoint sustains p95 latency ≤ 120 ms at 500 RPS. "
            "Latency exceeding 200 ms for > 5 consecutive minutes indicates a regression."
        ),
        "confidence": 0.93,
        "violation_predicate": {
            "type": "threshold_breach",
            "test_dql": (
                'fetch spans | filter service.name == "svc-payments-v3" '
                'and http.url contains "/charge" '
                "| summarize p95 = percentile(duration, 95) by bin(timestamp, 5m) "
                "| filter p95 > 200000000"
            ),
            "threshold": "p95 latency > 200 ms for any 5-minute window",
            "tolerance_window_seconds": 300,
        },
        "evidence": [
            {
                "type": "dql_query",
                "dql": (
                    'fetch spans, from:now()-14d | filter service.name == "svc-payments-v2" '
                    'and http.url contains "/charge" '
                    "| summarize p50 = percentile(duration, 50), p95 = percentile(duration, 95) "
                    "by bin(timestamp, 1h)"
                ),
                "sample_count": 8760,
                "timespan": "14d",
                "result_summary": "p50=42 ms, p95=118 ms at 500 RPS baseline",
            }
        ],
        "downstream_dependents": [],
    },
    {
        "category": "dependency",
        "subcategory": "redis_cache_hit_rate",
        "description": (
            "svc-reporting maintains a Redis cache hit rate ≥ 80 % for the `recent_charges:*` "
            "key namespace. A drop below 50 % indicates the upstream cache-warming "
            "contract was violated."
        ),
        "confidence": 0.89,
        "violation_predicate": {
            "type": "threshold_breach",
            "test_dql": (
                'fetch spans | filter service.name == "svc-reporting" '
                'and span.name contains "redis.GET" and db.statement contains "recent_charges" '
                '| summarize hits = countIf(redis.hit == "true"), '
                "total = count() by bin(timestamp, 5m) | filter (hits / total) < 0.50"
            ),
            "threshold": "cache hit rate < 50 % for any 5-minute window",
            "tolerance_window_seconds": 300,
        },
        "evidence": [
            {
                "type": "dql_query",
                "dql": (
                    'fetch spans, from:now()-14d | filter service.name == "svc-reporting" '
                    'and span.name contains "redis.GET" and db.statement contains "recent_charges" '
                    '| summarize hit_rate = avg(redis.hit == "true") by bin(timestamp, 1h)'
                ),
                "sample_count": 672,
                "timespan": "14d",
                "result_summary": "Average cache hit rate 91.4 % (σ=2.1 %) over 14-day window",
            }
        ],
        "downstream_dependents": ["SERVICE-REPORTING1111111111111111"],
    },
    {
        "category": "error_semantics",
        "subcategory": "409_conflict_body",
        "description": (
            "svc-payments-v2 includes `original_txn_id` in 409 Conflict response bodies. "
            "Downstream clients rely on this field for idempotency checks."
        ),
        "confidence": 0.85,
        "violation_predicate": {
            "type": "absence",
            "test_dql": (
                'fetch logs | filter service.name == "svc-payments-v3" '
                'and http.status_code == "409" '
                'and not(content contains "original_txn_id") '
                "| summarize count = count() by bin(timestamp, 5m) | filter count > 0"
            ),
            "threshold": "any 409 response missing original_txn_id field",
            "tolerance_window_seconds": 60,
        },
        "evidence": [
            {
                "type": "dql_query",
                "dql": (
                    'fetch logs, from:now()-14d | filter service.name == "svc-payments-v2" '
                    'and http.status_code == "409" '
                    "| parse content, \"JSON:body\" | filter isNotNull(body[original_txn_id])"
                ),
                "sample_count": 143,
                "timespan": "14d",
                "result_summary": "143 of 143 sampled 409 responses contained original_txn_id",
            }
        ],
        "downstream_dependents": ["SERVICE-REPORTING1111111111111111"],
    },
]


@router.post("/seed", status_code=status.HTTP_200_OK)
async def seed_demo(
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Seed Firestore with the canonical svc-payments demo scenario.

    Idempotent: if demo data already exists for this user it returns the existing IDs.
    """
    uid = user["uid"]

    # Check for existing demo service
    existing = await firestore_client.list_services(uid)
    for svc in existing:
        if _DEMO_MARKER in svc.get("service_name", ""):
            contracts = await firestore_client.list_contracts_for_service(svc["service_id"])
            return {
                "already_seeded": True,
                "service_id": svc["service_id"],
                "contracts": len(contracts),
            }

    now = datetime.now(dt.UTC)
    service_id = str(uuid.uuid4())
    dt_entity_id = "SERVICE-DEMO000000000000000001"

    svc_data: dict[str, Any] = {
        "service_id": service_id,
        "user_id": uid,
        "service_name": f"svc-payments-v2 {_DEMO_MARKER}",
        "dynatrace_entity_id": dt_entity_id,
        "deprecation_date": (now + dt.timedelta(days=30)).isoformat(),
        "replacement_service_id": "SERVICE-DEMO000000000000000002",
        "learning_window_days": 14,
        "phase": "haunting",
        "cutover_time": now.isoformat(),
        "created_at": now,
        "updated_at": now,
    }
    await firestore_client.get_db().collection("services").document(service_id).set(svc_data)

    contract_ids: list[str] = []
    for tmpl in _CONTRACTS_TEMPLATE:
        cid = str(uuid.uuid4())
        contract_ids.append(cid)
        c_data: dict[str, Any] = {
            "contract_id": cid,
            "karma_service_id": service_id,
            "service_id": dt_entity_id,
            "category": tmpl["category"],
            "subcategory": tmpl["subcategory"],
            "description": tmpl["description"],
            "confidence": tmpl["confidence"],
            "validated": True,
            "detected_at": now.isoformat(),
            "saved_at": now.isoformat(),
            "violation_predicate": tmpl["violation_predicate"],
            "evidence": tmpl["evidence"],
            "downstream_dependents": tmpl["downstream_dependents"],
        }
        await firestore_client.save_contract(cid, c_data)

    # Ghost report for the cache-warming violation
    report_id = str(uuid.uuid4())
    violation_id = str(uuid.uuid4())
    ghost_data: dict[str, Any] = {
        "report_id": report_id,
        "violation_id": violation_id,
        "karma_service_id": service_id,
        "contract": {
            "contract_id": contract_ids[0],
            "category": "side_effect",
            "subcategory": "cache_warming",
        },
        "summary": (
            "svc-payments-v3 has silently dropped the Redis cache-warming contract. "
            "The `recent_charges:summary` key is no longer written, causing svc-reporting "
            "to fall back to direct API calls (+540 ms p95 latency, −7.8 % throughput)."
        ),
        "root_cause": (
            "The background cache-warming loop present in svc-payments-v2 was not ported to v3 "
            "during the migration. Redis key `recent_charges:summary` is absent from the new "
            "service, violating the implicit side-effect contract observed over a 14-day window."
        ),
        "downstream_impact": (
            "svc-reporting /summary endpoint degraded from p95=58 ms to p95=598 ms. "
            "Throughput dropped 7.8 % (420 → 387 RPS). "
            "3 downstream batch jobs have exceeded their SLA windows."
        ),
        "severity": "critical",
        "davis_ai_insights": (
            "Davis AI detected a performance anomaly on svc-reporting 4 minutes after the "
            "svc-payments-v3 cutover. Root cause: Redis miss-rate spike (0 % → 100 %) correlated "
            "with the disappearance of background writes from the payments service. "
            "Problem ID: P-1234567."
        ),
        "evidence_links": [
            (
                "DQL#1 (cache miss rate spike): fetch spans, from:now()-1h"
                ' | filter service.name == "svc-reporting"'
                ' and span.name contains "redis.GET"'
                ' and db.statement contains "recent_charges"'
                " | summarize hit_rate = avg(redis.hit == \"true\") by bin(timestamp, 5m)"
            ),
            (
                "DQL#2 (p95 latency regression): fetch spans, from:now()-1h"
                ' | filter service.name == "svc-reporting"'
                ' and http.url contains "/summary"'
                " | summarize p95 = percentile(duration, 95) by bin(timestamp, 5m)"
            ),
            (
                "DQL#3 (missing Redis SET spans): fetch spans, from:now()-1h"
                ' | filter service.name == "svc-payments-v3"'
                ' and span.name == "redis.SET"'
                ' and db.statement contains "recent_charges" | count'
            ),
        ],
        "remediation_suggestions": [
            (
                "Port the cache-warming background loop from svc-payments-v2 to v3 "
                "(see PaymentsService._cache_warming_loop in v2 codebase)."
            ),
            (
                "Add a synchronous Redis write to the /charge endpoint in v3 to maintain "
                "key freshness until the background loop is restored."
            ),
            (
                "Add a contract test to the v3 CI pipeline that verifies "
                "`recent_charges:summary` is written within 60 s of startup."
            ),
            (
                "Alert on Redis miss rate for `recent_charges:*` exceeding 20 % "
                "as an early-warning indicator."
            ),
        ],
        "cost_estimate_usd": 0.0042,
        "investigation_input_tokens": 8240,
        "investigation_output_tokens": 1890,
        "dynatrace_event_id": "e-demo-karma-001",
        "created_at": now.isoformat(),
        "saved_at": now.isoformat(),
    }
    await firestore_client.save_ghost_report(report_id, ghost_data)

    # Seed a deployment metric record so the observability dashboard shows
    # engineering metrics for the demo scenario (mirrors what the cutover endpoint
    # would have written had the demo gone through the normal cutover flow).
    deployment_id = str(uuid.uuid4())
    await firestore_client.save_deployment_metrics(
        deployment_id,
        {
            "service_id": service_id,
            "service_name": f"svc-payments-v2 {_DEMO_MARKER}",
            "deployed_at": now.isoformat(),
            "commits": 47,
            "pull_requests": 9,
            "lines_added": 1823,
            "lines_removed": 412,
            "github_repo": "rogerjeasy/karma",
        },
    )

    logger.info("demo_seeded", uid=uid, service_id=service_id, contracts=len(contract_ids))
    return {
        "already_seeded": False,
        "service_id": service_id,
        "contracts": len(contract_ids),
        "ghost_reports": 1,
    }


@router.delete("/reset", status_code=status.HTTP_200_OK)
async def reset_demo(
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Delete all demo data for the authenticated user.

    Removes the demo service, all its contracts, ghost reports, and watcher runs.
    Safe to call multiple times — returns 200 even when nothing was found.
    """
    uid = user["uid"]
    existing = await firestore_client.list_services(uid)

    deleted_services = 0
    for svc in existing:
        if _DEMO_MARKER not in svc.get("service_name", ""):
            continue
        await firestore_client.delete_service_cascade(svc["service_id"])
        deleted_services += 1

    logger.info("demo_reset", uid=uid, deleted_services=deleted_services)
    return {"deleted_services": deleted_services}
