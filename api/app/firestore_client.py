"""Firestore client — thin wrapper around google-cloud-firestore.

Collections:
  users/           — user profiles (uid, email, display_name, …)
  services/        — registered services and their phase (per user)
  contracts/       — validated implicit contracts (mirrored from Memory Bank)
  violations/      — watcher-detected violation candidates
  ghost_reports/   — forensic ghost reports
"""
from __future__ import annotations

import asyncio
import datetime as dt
from datetime import datetime, timedelta
from typing import Any

import structlog
from fastapi import HTTPException
from google.auth.exceptions import DefaultCredentialsError
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app import webhooks
from app.config import settings

logger = structlog.get_logger(__name__)

_db: firestore.AsyncClient | None = None


def get_db() -> firestore.AsyncClient:
    global _db
    if _db is None:
        try:
            _db = firestore.AsyncClient(
                project=settings.gcp_project_id,
                database=settings.firestore_database,
            )
        except DefaultCredentialsError as exc:
            raise HTTPException(
                status_code=503,
                detail=(
                    "GCP credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS"
                    " or run 'gcloud auth application-default login'."
                ),
            ) from exc
    return _db


# ── Users ─────────────────────────────────────────────────────────────────────

async def upsert_user(uid: str, data: dict[str, Any]) -> None:
    db = get_db()
    ref = db.collection("users").document(uid)
    doc = await ref.get()
    if not doc.exists:
        # First sign-up — seed with default role. roles is a list so
        # array_contains queries work natively in Firestore.
        await ref.set({**data, "roles": ["user"]})
    else:
        # Subsequent syncs — update profile fields only; never overwrite roles.
        await ref.set(data, merge=True)


async def get_user(uid: str) -> dict[str, Any] | None:
    db = get_db()
    doc = await db.collection("users").document(uid).get()
    return doc.to_dict() if doc.exists else None


# ── Services ──────────────────────────────────────────────────────────────────

async def create_service(service_id: str, data: dict[str, Any]) -> None:
    db = get_db()
    now = datetime.now(dt.UTC)
    await db.collection("services").document(service_id).set(
        {**data, "created_at": now, "updated_at": now, "phase": "registered"}
    )


async def get_service(service_id: str) -> dict[str, Any] | None:
    db = get_db()
    doc = await db.collection("services").document(service_id).get()
    return doc.to_dict() if doc.exists else None


async def list_services(user_id: str) -> list[dict[str, Any]]:
    db = get_db()
    query = db.collection("services").where(
        filter=FieldFilter("user_id", "==", user_id)
    )
    svcs = [d async for doc in query.stream() if (d := doc.to_dict()) is not None]
    # System services are shown only in the admin panel, not in the user's list.
    return [s for s in svcs if not s.get("is_system")]


async def list_system_services() -> list[dict[str, Any]]:
    """Return all services tagged as Karma infrastructure (is_system=True)."""
    db = get_db()
    query = db.collection("services").where(
        filter=FieldFilter("is_system", "==", True)
    )
    return [d async for doc in query.stream() if (d := doc.to_dict()) is not None]


async def save_service_doc(service_id: str, data: dict[str, Any]) -> None:
    """Write a service document verbatim — used by admin to create system services."""
    db = get_db()
    await db.collection("services").document(service_id).set(data)


async def get_user_service_ids(user_id: str) -> list[str]:
    """Return the service_id values owned by this user (cheap: only reads that field)."""
    services = await list_services(user_id)
    return [s["service_id"] for s in services if "service_id" in s]


async def list_all_haunting_services() -> list[dict[str, Any]]:
    """Return all services that need watcher runs across all users.

    Includes:
    - Services in 'haunting' phase (migration monitoring or standalone)
    - System services in 'completed' phase — these never auto-complete and must
      be watched continuously even after the phase was set.

    Called by the Cloud Scheduler Pub/Sub tick — no user filter.
    """
    db = get_db()
    haunting_query = db.collection("services").where(
        filter=FieldFilter("phase", "==", "haunting")
    )
    haunting = [d async for doc in haunting_query.stream() if (d := doc.to_dict()) is not None]

    completed_system_query = (
        db.collection("services")
        .where(filter=FieldFilter("phase", "==", "completed"))
        .where(filter=FieldFilter("is_system", "==", True))
    )
    completed_system = [
        d async for doc in completed_system_query.stream() if (d := doc.to_dict()) is not None
    ]

    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for svc in haunting + completed_system:
        sid = svc.get("service_id", "")
        if sid and sid not in seen:
            seen.add(sid)
            result.append(svc)
    return result


async def update_service_phase(
    service_id: str, phase: str, extra: dict[str, Any] | None = None
) -> None:
    db = get_db()
    payload: dict[str, Any] = {"phase": phase, "updated_at": datetime.now(dt.UTC)}
    if extra:
        payload.update(extra)
    await db.collection("services").document(service_id).update(payload)


async def record_clean_watcher_run(service_id: str, threshold: int) -> bool:
    """Atomically increment the clean-run counter and return True when threshold is reached."""
    db = get_db()
    ref = db.collection("services").document(service_id)
    await ref.update({
        "clean_watcher_runs": firestore.Increment(1),
        "updated_at": datetime.now(dt.UTC),
    })
    snap = await ref.get()
    data = snap.to_dict() or {}
    return int(data.get("clean_watcher_runs") or 0) >= threshold


async def reset_clean_watcher_runs(service_id: str) -> None:
    """Reset the clean-run counter to 0 when a violation is detected."""
    db = get_db()
    await db.collection("services").document(service_id).update({
        "clean_watcher_runs": 0,
        "updated_at": datetime.now(dt.UTC),
    })


# ── Contracts ─────────────────────────────────────────────────────────────────

async def save_contract(contract_id: str, data: dict[str, Any]) -> None:
    db = get_db()
    await db.collection("contracts").document(contract_id).set(data)


async def get_contract_by_id(contract_id: str) -> dict[str, Any] | None:
    db = get_db()
    doc = await db.collection("contracts").document(contract_id).get()
    return doc.to_dict() if doc.exists else None


async def list_contracts_for_service(service_id: str) -> list[dict[str, Any]]:
    db = get_db()
    query = db.collection("contracts").where(
        filter=FieldFilter("karma_service_id", "==", service_id)
    )
    return [d async for doc in query.stream() if (d := doc.to_dict()) is not None]


# ── Ghost reports ─────────────────────────────────────────────────────────────

async def save_ghost_report(report_id: str, data: dict[str, Any]) -> None:
    db = get_db()
    # Backfill user_id from the service doc if not already present.
    if not data.get("user_id"):
        karma_service_id = data.get("karma_service_id", "")
        if karma_service_id:
            svc = await get_service(karma_service_id)
            if svc:
                data = {**data, "user_id": svc.get("user_id", "")}
    await db.collection("ghost_reports").document(report_id).set(data)
    asyncio.create_task(webhooks.notify_ghost_report(data))


async def update_ghost_report(report_id: str, payload: dict[str, Any]) -> None:
    db = get_db()
    await db.collection("ghost_reports").document(report_id).update(payload)


async def list_ghost_reports(
    user_id: str,
    service_id: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Return ghost reports visible to this user.

    If service_id is given, filter to that service (ownership already verified
    by the route). Otherwise, query directly by user_id field (fast path) with
    a fallback join on service_ids for older documents that predate user_id stamping.
    """
    db = get_db()

    if service_id:
        # Single-service path — uses the karma_service_id + created_at index.
        query = (
            db.collection("ghost_reports")
            .where(filter=FieldFilter("karma_service_id", "==", service_id))
            .order_by("created_at", direction=firestore.Query.DESCENDING)
            .limit(limit)
        )
        return [d async for doc in query.stream() if (d := doc.to_dict()) is not None]

    # Fast path — query directly by user_id field (set on all new ghost reports).
    direct_query = (
        db.collection("ghost_reports")
        .where(filter=FieldFilter("user_id", "==", user_id))
        .limit(limit * 2)
    )
    docs = [d async for doc in direct_query.stream() if (d := doc.to_dict()) is not None]

    # Fallback: also pull reports that predate user_id stamping (via service_id join).
    seen_ids = {d["report_id"] for d in docs if "report_id" in d}
    service_ids = await get_user_service_ids(user_id)
    legacy_chunk = [sid for sid in service_ids[:30] if sid]
    if legacy_chunk:
        if len(legacy_chunk) == 1:
            legacy_q = (
                db.collection("ghost_reports")
                .where(filter=FieldFilter("karma_service_id", "==", legacy_chunk[0]))
                .limit(limit)
            )
        else:
            legacy_q = (
                db.collection("ghost_reports")
                .where(filter=FieldFilter("karma_service_id", "in", legacy_chunk))
                .limit(limit * 2)
            )
        for doc in (await legacy_q.get()):
            d = doc.to_dict()
            if d and d.get("report_id") not in seen_ids:
                docs.append(d)

    docs.sort(key=lambda d: str(d.get("created_at", "")), reverse=True)
    return docs[:limit]


async def get_ghost_report(report_id: str) -> dict[str, Any] | None:
    db = get_db()
    doc = await db.collection("ghost_reports").document(report_id).get()
    return doc.to_dict() if doc.exists else None


async def compute_user_stats(user_id: str) -> dict[str, Any]:
    """Aggregate stats scoped to a single user's services."""
    db = get_db()

    services = await list_services(user_id)
    if not services:
        return {
            "total_services": 0,
            "total_contracts": 0,
            "total_ghost_reports": 0,
            "avg_contracts_per_service": None,
            "avg_minutes_to_first_alert": None,
            "pct_services_with_violations": None,
        }

    service_ids = [s["service_id"] for s in services if "service_id" in s]

    # Count contracts
    contracts: list[dict[str, Any]] = []
    for sid in service_ids:
        chunk = await list_contracts_for_service(sid)
        contracts.extend(chunk)

    contracts_by_service: dict[str, int] = {}
    for c in contracts:
        sid = c.get("karma_service_id", "")
        if sid:
            contracts_by_service[sid] = contracts_by_service.get(sid, 0) + 1

    services_with_contracts = len(contracts_by_service)
    avg_contracts: float | None = (
        round(len(contracts) / services_with_contracts, 1)
        if services_with_contracts > 0
        else None
    )

    # Ghost reports and violation timing
    haunted = [s for s in services if s.get("phase") in ("haunting", "completed")]
    services_with_violations: set[str] = set()
    alert_times_minutes: list[float] = []
    total_ghost_reports = 0

    for svc in haunted[:50]:
        sid = svc.get("service_id", "")
        cutover_raw = svc.get("cutover_time")
        if not sid:
            continue

        query = (
            db.collection("ghost_reports")
            .where(filter=FieldFilter("karma_service_id", "==", sid))
            .order_by("created_at")
            .limit(10)
        )
        first_docs = [d async for doc in query.stream() if (d := doc.to_dict()) is not None]
        total_ghost_reports += len(first_docs)

        if not first_docs:
            continue

        services_with_violations.add(sid)
        if cutover_raw:
            try:
                cutover_dt = (
                    cutover_raw
                    if isinstance(cutover_raw, datetime)
                    else datetime.fromisoformat(str(cutover_raw))
                )
                cr_raw = first_docs[0].get("created_at") or first_docs[0].get("saved_at")
                if cr_raw:
                    cr_dt = (
                        cr_raw
                        if isinstance(cr_raw, datetime)
                        else datetime.fromisoformat(str(cr_raw))
                    )
                    delta = (cr_dt - cutover_dt).total_seconds() / 60
                    if 0 < delta < 60 * 24:
                        alert_times_minutes.append(delta)
            except Exception:
                pass

    pct_violations: float | None = (
        round(len(services_with_violations) / len(haunted) * 100, 1)
        if haunted
        else None
    )
    avg_alert_minutes: float | None = (
        round(sum(alert_times_minutes) / len(alert_times_minutes), 1)
        if alert_times_minutes
        else None
    )

    return {
        "total_services": len(services),
        "total_contracts": len(contracts),
        "total_ghost_reports": total_ghost_reports,
        "avg_contracts_per_service": avg_contracts,
        "avg_minutes_to_first_alert": avg_alert_minutes,
        "pct_services_with_violations": pct_violations,
    }


async def compute_platform_stats() -> dict[str, Any]:
    """Aggregate platform-wide stats for the public /stats endpoint.

    Streams all three collections once; does per-service first-ghost queries
    only for services that went through haunting (typically small count).
    """
    db = get_db()

    services = [
        d async for doc in db.collection("services").stream()
        if (d := doc.to_dict()) is not None
    ]
    contracts = [
        d async for doc in db.collection("contracts").stream()
        if (d := doc.to_dict()) is not None
    ]

    # Contracts per karma_service_id
    contracts_by_service: dict[str, int] = {}
    for c in contracts:
        sid = c.get("karma_service_id", "")
        if sid:
            contracts_by_service[sid] = contracts_by_service.get(sid, 0) + 1

    services_with_contracts = len(contracts_by_service)
    avg_contracts: float | None = (
        round(len(contracts) / services_with_contracts, 1)
        if services_with_contracts > 0
        else None
    )

    # Per-service violation rate + timing for haunting/completed services
    haunted = [s for s in services if s.get("phase") in ("haunting", "completed")]
    services_with_violations: set[str] = set()
    alert_times_minutes: list[float] = []

    for svc in haunted[:50]:
        sid = svc.get("service_id", "")
        cutover_raw = svc.get("cutover_time")
        if not sid:
            continue

        query = (
            db.collection("ghost_reports")
            .where(filter=FieldFilter("karma_service_id", "==", sid))
            .order_by("created_at")
            .limit(1)
        )
        first_docs = [
            d async for doc in query.stream()
            if (d := doc.to_dict()) is not None
        ]

        if not first_docs:
            continue

        services_with_violations.add(sid)

        if cutover_raw:
            try:
                cutover_dt = (
                    cutover_raw
                    if isinstance(cutover_raw, datetime)
                    else datetime.fromisoformat(str(cutover_raw))
                )
                cr_raw = first_docs[0].get("created_at") or first_docs[0].get("saved_at")
                if cr_raw:
                    cr_dt = (
                        cr_raw
                        if isinstance(cr_raw, datetime)
                        else datetime.fromisoformat(str(cr_raw))
                    )
                    delta = (cr_dt - cutover_dt).total_seconds() / 60
                    if 0 < delta < 60 * 24:  # sanity: must be positive and < 24 h
                        alert_times_minutes.append(delta)
            except Exception:
                pass

    # Total ghost reports (reuse violation check data + count all)
    all_ghosts = [
        d async for doc in db.collection("ghost_reports").stream()
        if (d := doc.to_dict()) is not None
    ]

    pct_violations: float | None = (
        round(len(services_with_violations) / len(haunted) * 100, 1)
        if haunted
        else None
    )
    avg_alert_minutes: float | None = (
        round(sum(alert_times_minutes) / len(alert_times_minutes), 1)
        if alert_times_minutes
        else None
    )

    return {
        "total_services": len(services),
        "total_contracts": len(contracts),
        "total_ghost_reports": len(all_ghosts),
        "avg_contracts_per_service": avg_contracts,
        "avg_minutes_to_first_alert": avg_alert_minutes,
        "pct_services_with_violations": pct_violations,
    }


# ── Migration Readiness Score ─────────────────────────────────────────────────

# Weights for each contract category in the overall readiness score.
# Weights sum to 1.0. Higher weight = more impact on the cutover decision.
_CATEGORY_WEIGHTS: dict[str, float] = {
    "latency":         0.20,
    "error_semantics": 0.20,
    "throughput":      0.15,
    "side_effect":     0.15,
    "timing":          0.10,
    "dependency":      0.10,
    "resource":        0.05,
    "sequencing":      0.05,
}

_SEVERITY_INCIDENT_RATE: dict[str, float] = {
    "critical": 50_000.0,
    "high":     10_000.0,
    "medium":    2_000.0,
    "low":         500.0,
}


async def compute_readiness_score(service_id: str) -> dict[str, Any]:
    """Compute a 0–100 Migration Readiness Score for a service.

    The score is a weighted average of per-category contract compliance rates:
    - 1.0 (100%) if no recent violations exist for that category's contracts
    - linearly reduced by (violated / total) per category
    Categories with zero contracts are excluded from the weight pool.

    Also computes the total avoided-incident cost from all ghost reports for this service.
    """
    db = get_db()

    # Pull all contracts and recent ghost reports in parallel
    contracts = await list_contracts_for_service(service_id)

    ghost_query = (
        db.collection("ghost_reports")
        .where(filter=FieldFilter("karma_service_id", "==", service_id))
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(200)
    )
    ghost_docs: list[dict[str, Any]] = [
        d async for doc in ghost_query.stream() if (d := doc.to_dict()) is not None
    ]

    # Build a set of contract IDs that have a recent ghost report (i.e. active violation).
    # "Recent" = within the last 7 days.
    recent_cutoff = datetime.now(dt.UTC) - timedelta(days=7)
    violated_contract_ids: set[str] = set()
    for ghost in ghost_docs:
        raw_ts = ghost.get("created_at") or ghost.get("saved_at")
        if raw_ts:
            try:
                ts = raw_ts if isinstance(raw_ts, datetime) else datetime.fromisoformat(str(raw_ts))
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=dt.UTC)
                if ts >= recent_cutoff:
                    cid = ghost.get("contract", {}).get("contract_id") or ghost.get("contract_id")
                    if cid:
                        violated_contract_ids.add(cid)
            except Exception:
                pass

    # Build per-category compliance data
    from collections import defaultdict
    category_contracts: dict[str, list[str]] = defaultdict(list)
    for c in contracts:
        cat = c.get("category", "")
        cid = c.get("contract_id", "")
        if cat and cid:
            category_contracts[cat].append(cid)

    breakdown: list[dict[str, Any]] = []
    weighted_sum = 0.0
    active_weight = 0.0

    for category, weight in _CATEGORY_WEIGHTS.items():
        cat_ids = category_contracts.get(category, [])
        total = len(cat_ids)
        if total == 0:
            breakdown.append({
                "category": category,
                "total_contracts": 0,
                "compliant": 0,
                "violated": 0,
                "score": None,
                "weight": weight,
            })
            continue

        violated = len([cid for cid in cat_ids if cid in violated_contract_ids])
        compliant = total - violated
        cat_score = compliant / total

        weighted_sum += cat_score * weight
        active_weight += weight

        breakdown.append({
            "category": category,
            "total_contracts": total,
            "compliant": compliant,
            "violated": violated,
            "score": round(cat_score * 100, 1),
            "weight": weight,
        })

    overall_score: float | None = None
    if active_weight > 0:
        overall_score = round((weighted_sum / active_weight) * 100, 1)

    # Sum avoided-incident costs from all ghost reports
    avoided_total = sum(
        float(g.get("avoided_incident_cost_usd") or 0.0)
        for g in ghost_docs
    )

    recommendation = _readiness_recommendation(overall_score, len(contracts))
    return {
        "overall_score": overall_score,
        "category_breakdown": breakdown,
        "total_contracts": len(contracts),
        "total_violations_active": len(violated_contract_ids),
        "avoided_incident_cost_total_usd": round(avoided_total, 2),
        "recommendation": recommendation,
    }


def _readiness_recommendation(score: float | None, total_contracts: int) -> str:
    if total_contracts == 0:
        return "No contracts found — run the Learner agent first to discover implicit contracts."
    if score is None:
        return "Score unavailable — check if learning is complete."
    if score >= 95:
        return "Ready for cutover — all critical contracts are compliant. Proceed with confidence."
    if score >= 80:
        return "Nearly ready — minor violations detected. Review open ghost reports before cutover."
    if score >= 60:
        return (
            "Caution — significant violations present. "
            "Investigate ghost reports and remediate before cutover."
        )
    return (
        "Not ready — critical contract violations detected. "
        "Cutover is high risk. Remediate immediately."
    )


# ── Watcher runs ──────────────────────────────────────────────────────────────

async def save_watcher_run(run_id: str, data: dict[str, Any]) -> None:
    db = get_db()
    await db.collection("watcher_runs").document(run_id).set(data)


async def list_watcher_runs(service_id: str, limit: int = 20) -> list[dict[str, Any]]:
    db = get_db()
    query = (
        db.collection("watcher_runs")
        .where(filter=FieldFilter("service_id", "==", service_id))
        .order_by("run_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
    )
    return [d async for doc in query.stream() if (d := doc.to_dict()) is not None]


async def list_recent_watcher_runs(limit: int = 30) -> list[dict[str, Any]]:
    """Most recent runs across all services — for the dashboard overview panel."""
    db = get_db()
    query = (
        db.collection("watcher_runs")
        .order_by("run_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
    )
    return [d async for doc in query.stream() if (d := doc.to_dict()) is not None]


# ── Service cascade delete ─────────────────────────────────────────────────────

async def delete_service_cascade(service_id: str) -> dict[str, Any]:
    """Delete a service and all its associated Firestore data.

    Deletes (in order): contracts → ghost_reports → service document.
    The watcher stops automatically because the service doc (and its haunting
    phase) no longer exist; no in-flight agent calls are cancelled since they
    are stateless one-shot invocations.
    """
    db = get_db()
    contracts_deleted = 0
    ghost_reports_deleted = 0

    contracts_q = db.collection("contracts").where(
        filter=FieldFilter("karma_service_id", "==", service_id)
    )
    async for doc in contracts_q.stream():
        await doc.reference.delete()
        contracts_deleted += 1

    ghosts_q = db.collection("ghost_reports").where(
        filter=FieldFilter("karma_service_id", "==", service_id)
    )
    async for doc in ghosts_q.stream():
        await doc.reference.delete()
        ghost_reports_deleted += 1

    watcher_runs_deleted = 0
    runs_q = db.collection("watcher_runs").where(
        filter=FieldFilter("service_id", "==", service_id)
    )
    async for doc in runs_q.stream():
        await doc.reference.delete()
        watcher_runs_deleted += 1

    await db.collection("services").document(service_id).delete()

    logger.info(
        "service_cascade_deleted",
        service_id=service_id,
        contracts_deleted=contracts_deleted,
        ghost_reports_deleted=ghost_reports_deleted,
        watcher_runs_deleted=watcher_runs_deleted,
    )
    return {
        "deleted": True,
        "contracts_deleted": contracts_deleted,
        "ghost_reports_deleted": ghost_reports_deleted,
        "watcher_runs_deleted": watcher_runs_deleted,
    }


# ── Deployment metrics ────────────────────────────────────────────────────────

async def save_deployment_metrics(deployment_id: str, data: dict[str, Any]) -> None:
    db = get_db()
    await db.collection("deployment_metrics").document(deployment_id).set(data)


async def get_platform_observability(dt_configured: bool, dt_env: str) -> dict[str, Any]:
    """Aggregate platform observability data for the admin dashboard."""
    db = get_db()
    now = datetime.now(dt.UTC)
    cutoff_24h = (now - timedelta(hours=24)).isoformat()
    cutoff_7d = (now - timedelta(days=7)).isoformat()

    all_runs = [
        d async for doc in db.collection("watcher_runs").stream()
        if (d := doc.to_dict()) is not None
    ]
    runs_24h = [r for r in all_runs if str(r.get("run_at", "")) >= cutoff_24h]
    runs_7d = [r for r in all_runs if str(r.get("run_at", "")) >= cutoff_7d]
    durations = [r["duration_seconds"] for r in all_runs if r.get("duration_seconds") is not None]
    avg_duration = round(sum(durations) / len(durations), 2) if durations else None
    total_violations = sum(r.get("violations_found", 0) for r in all_runs)

    services = [
        d async for doc in db.collection("services").stream()
        if (d := doc.to_dict()) is not None
    ]
    phases: dict[str, int] = {}
    for s in services:
        p = s.get("phase", "registered")
        phases[p] = phases.get(p, 0) + 1

    user_count = len([d async for d in db.collection("users").stream()])

    deploys = [
        d async for doc in db.collection("deployment_metrics").stream()
        if (d := doc.to_dict()) is not None
    ]
    deploys.sort(key=lambda d: str(d.get("deployed_at", "")), reverse=True)

    return {
        "session_activity": {
            "total_watcher_runs": len(all_runs),
            "runs_last_24h": len(runs_24h),
            "runs_last_7d": len(runs_7d),
            "avg_duration_seconds": avg_duration,
            "total_violations_found": total_violations,
            "services_by_phase": phases,
            "total_users": user_count,
        },
        "engineering_metrics": {
            "total_deployments": len(deploys),
            "total_commits": sum(d.get("commits", 0) for d in deploys),
            "total_prs": sum(d.get("pull_requests", 0) for d in deploys),
            "total_lines_added": sum(d.get("lines_added", 0) for d in deploys),
            "total_lines_removed": sum(d.get("lines_removed", 0) for d in deploys),
            "recent_deployments": deploys[:10],
        },
        "otel_pipeline": {
            "configured": dt_configured,
            "dt_env": dt_env or None,
            "traces": dt_configured,
            "metrics": dt_configured,
            "logs": dt_configured,
        },
    }


# ── AI Investigation Engine ───────────────────────────────────────────────────

async def get_investigation_engine_stats(
    user_id_filter: str | None = None,
) -> dict[str, Any]:
    """Aggregate ghost report AI investigation stats across all users.

    Performs two collection scans (ghost_reports + users) then groups in
    Python — avoids composite indexes and is fast enough for the expected
    cardinality (hundreds of reports, tens of users).
    """
    db = get_db()

    # Single scan of all ghost reports.
    all_reports: list[dict[str, Any]] = [
        d async for doc in db.collection("ghost_reports").stream()
        if (d := doc.to_dict()) is not None
    ]

    # Group reports by user_id.
    reports_by_uid: dict[str, list[dict[str, Any]]] = {}
    for report in all_reports:
        uid = report.get("user_id") or "unknown"
        reports_by_uid.setdefault(uid, []).append(report)

    # Load user profiles (document ID = Firebase UID).
    user_profiles: dict[str, dict[str, Any]] = {}
    async for doc in db.collection("users").stream():
        data = doc.to_dict()
        if data:
            user_profiles[doc.id] = data

    # Determine which user IDs to include.
    relevant_uids: set[str] = (
        {user_id_filter} if user_id_filter else set(reports_by_uid.keys())
    )

    user_stats: list[dict[str, Any]] = []
    for uid in relevant_uids:
        reports = reports_by_uid.get(uid, [])
        profile = user_profiles.get(uid, {})

        total_cost = round(
            sum((r.get("cost_estimate_usd") or 0.0) for r in reports), 6
        )
        total_input = sum((r.get("investigation_input_tokens") or 0) for r in reports)
        total_output = sum((r.get("investigation_output_tokens") or 0) for r in reports)
        davis_count = sum(1 for r in reports if r.get("davis_ai_insights"))

        sev_breakdown: dict[str, int] = {
            "critical": 0, "high": 0, "medium": 0, "low": 0
        }
        for r in reports:
            sev = r.get("severity", "medium")
            if sev in sev_breakdown:
                sev_breakdown[sev] += 1

        # Compute most-recent report timestamp.
        last_at: str | None = None
        raw_dates = [r.get("created_at") or r.get("saved_at") for r in reports]
        valid_dates = [str(d) for d in raw_dates if d is not None]
        if valid_dates:
            last_at = max(valid_dates)

        display = profile.get("display_name") or profile.get("email") or uid
        user_stats.append({
            "user_id": uid,
            "email": profile.get("email", ""),
            "display_name": display,
            "total_reports": len(reports),
            "total_cost_usd": total_cost,
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "davis_enriched_count": davis_count,
            "severity_breakdown": sev_breakdown,
            "last_report_at": last_at,
        })

    # Sort: highest spend first; break ties by report count.
    user_stats.sort(key=lambda u: (-u["total_cost_usd"], -u["total_reports"]))

    aggregate = {
        "total_reports": sum(u["total_reports"] for u in user_stats),
        "total_cost_usd": round(sum(u["total_cost_usd"] for u in user_stats), 6),
        "total_input_tokens": sum(u["total_input_tokens"] for u in user_stats),
        "total_output_tokens": sum(u["total_output_tokens"] for u in user_stats),
        "davis_enriched_count": sum(u["davis_enriched_count"] for u in user_stats),
        "severity_breakdown": {
            sev: sum(u["severity_breakdown"].get(sev, 0) for u in user_stats)
            for sev in ("critical", "high", "medium", "low")
        },
    }

    return {"aggregate": aggregate, "users": user_stats}
