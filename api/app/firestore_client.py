"""Firestore client — thin wrapper around google-cloud-firestore.

Collections:
  services/        — registered services and their phase
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


async def list_services() -> list[dict[str, Any]]:
    db = get_db()
    docs = db.collection("services").stream()
    return [d async for doc in docs if (d := doc.to_dict()) is not None]


async def update_service_phase(
    service_id: str, phase: str, extra: dict[str, Any] | None = None
) -> None:
    db = get_db()
    payload: dict[str, Any] = {"phase": phase, "updated_at": datetime.now(dt.UTC)}
    if extra:
        payload.update(extra)
    await db.collection("services").document(service_id).update(payload)


# ── Contracts ─────────────────────────────────────────────────────────────────

async def save_contract(contract_id: str, data: dict[str, Any]) -> None:
    db = get_db()
    await db.collection("contracts").document(contract_id).set(data)


async def list_contracts_for_service(service_id: str) -> list[dict[str, Any]]:
    db = get_db()
    # karma_service_id is the Karma UUID written by save_contracts_to_firestore.
    # service_id in the contract document is the Dynatrace entity ID (schema field).
    query = db.collection("contracts").where(
        filter=FieldFilter("karma_service_id", "==", service_id)
    )
    return [d async for doc in query.stream() if (d := doc.to_dict()) is not None]


# ── Ghost reports ─────────────────────────────────────────────────────────────

async def save_ghost_report(report_id: str, data: dict[str, Any]) -> None:
    db = get_db()
    await db.collection("ghost_reports").document(report_id).set(data)


async def list_ghost_reports(
    service_id: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    db = get_db()
    query = db.collection("ghost_reports").order_by(
        "created_at", direction=firestore.Query.DESCENDING
    ).limit(limit)
    if service_id:
        query = query.where(filter=FieldFilter("karma_service_id", "==", service_id))
    return [d async for doc in query.stream() if (d := doc.to_dict()) is not None]


async def get_ghost_report(report_id: str) -> dict[str, Any] | None:
    db = get_db()
    doc = await db.collection("ghost_reports").document(report_id).get()
    return doc.to_dict() if doc.exists else None
