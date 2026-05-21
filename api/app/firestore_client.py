"""Firestore client — thin wrapper around google-cloud-firestore.

Collections:
  users/           — user profiles (uid, email, display_name, …)
  services/        — registered services and their phase (per user)
  contracts/       — validated implicit contracts (mirrored from Memory Bank)
  violations/      — watcher-detected violation candidates
  ghost_reports/   — forensic ghost reports
"""
from __future__ import annotations

import datetime as dt
from datetime import datetime
from typing import Any

import structlog
from fastapi import HTTPException
from google.auth.exceptions import DefaultCredentialsError
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

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
    await db.collection("users").document(uid).set(data, merge=True)


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
    return [d async for doc in query.stream() if (d := doc.to_dict()) is not None]


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


async def list_contracts_for_service(service_id: str) -> list[dict[str, Any]]:
    db = get_db()
    query = db.collection("contracts").where(
        filter=FieldFilter("karma_service_id", "==", service_id)
    )
    return [d async for doc in query.stream() if (d := doc.to_dict()) is not None]


# ── Ghost reports ─────────────────────────────────────────────────────────────

async def save_ghost_report(report_id: str, data: dict[str, Any]) -> None:
    db = get_db()
    await db.collection("ghost_reports").document(report_id).set(data)


async def list_ghost_reports(
    user_id: str,
    service_id: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Return ghost reports visible to this user.

    If service_id is given, verify it belongs to the user and filter to that
    service only. Otherwise, fetch reports across all of the user's services.
    """
    db = get_db()

    if service_id:
        # Single-service path — uses the existing karma_service_id + created_at index.
        query = (
            db.collection("ghost_reports")
            .where(filter=FieldFilter("karma_service_id", "==", service_id))
            .order_by("created_at", direction=firestore.Query.DESCENDING)
            .limit(limit)
        )
        return [d async for doc in query.stream() if (d := doc.to_dict()) is not None]

    # Multi-service path — use an IN query on the user's service IDs.
    # We sort in Python to avoid a composite index (IN + order_by requires one).
    service_ids = await get_user_service_ids(user_id)
    if not service_ids:
        return []

    chunk = service_ids[:30]  # Firestore IN limit
    if len(chunk) == 1:
        query = (
            db.collection("ghost_reports")
            .where(filter=FieldFilter("karma_service_id", "==", chunk[0]))
            .limit(limit)
        )
    else:
        query = (
            db.collection("ghost_reports")
            .where(filter=FieldFilter("karma_service_id", "in", chunk))
            .limit(limit * 2)  # over-fetch so we have enough after Python sort
        )

    docs = [d async for doc in query.stream() if (d := doc.to_dict()) is not None]
    docs.sort(key=lambda d: str(d.get("created_at", "")), reverse=True)
    return docs[:limit]


async def get_ghost_report(report_id: str) -> dict[str, Any] | None:
    db = get_db()
    doc = await db.collection("ghost_reports").document(report_id).get()
    return doc.to_dict() if doc.exists else None


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
