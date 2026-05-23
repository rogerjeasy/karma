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
from datetime import datetime
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
    """Return all services in haunting phase across all users.

    Called by the Cloud Scheduler Pub/Sub tick — no user filter.
    """
    db = get_db()
    query = db.collection("services").where(
        filter=FieldFilter("phase", "==", "haunting")
    )
    return [d async for doc in query.stream() if (d := doc.to_dict()) is not None]


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


# ── Watcher runs ──────────────────────────────────────────────────────────────

async def save_watcher_run(run_id: str, data: dict[str, Any]) -> None:
    db = get_db()
    await db.collection("watcher_runs").document(run_id).set(data)


async def list_watcher_runs(service_id: str, limit: int = 20) -> list[dict[str, Any]]:
    db = get_db()
    query = (
        db.collection("watcher_runs")
        .where(filter=FieldFilter("service_id", "==", service_id))
        .limit(limit * 2)  # over-fetch; sorted in Python to avoid composite index
    )
    docs = [d async for doc in query.stream() if (d := doc.to_dict()) is not None]
    docs.sort(key=lambda d: str(d.get("run_at", "")), reverse=True)
    return docs[:limit]


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

    await db.collection("services").document(service_id).delete()

    logger.info(
        "service_cascade_deleted",
        service_id=service_id,
        contracts_deleted=contracts_deleted,
        ghost_reports_deleted=ghost_reports_deleted,
    )
    return {
        "deleted": True,
        "contracts_deleted": contracts_deleted,
        "ghost_reports_deleted": ghost_reports_deleted,
    }
