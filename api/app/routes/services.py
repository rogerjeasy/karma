"""Service registration and management routes."""
from __future__ import annotations

import asyncio
import datetime as dt
import uuid
from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, status

from app import agent_client, firestore_client
from app.models import ServiceRegistration, ServiceResponse

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/services", tags=["services"])


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
async def register_service(payload: ServiceRegistration) -> ServiceResponse:
    service_id = str(uuid.uuid4())
    log = logger.bind(service_id=service_id, service_name=payload.service_name)
    log.info("registering_service")

    data = {
        "service_id": service_id,
        "service_name": payload.service_name,
        "dynatrace_entity_id": payload.dynatrace_entity_id,
        "deprecation_date": payload.deprecation_date.isoformat(),
        "replacement_service_id": payload.replacement_service_id,
        "learning_window_days": payload.learning_window_days,
    }

    await firestore_client.create_service(service_id, data)
    await firestore_client.update_service_phase(service_id, "learning")

    # stream_query blocks for 2-5 min — run in background so 201 returns now.
    asyncio.create_task(
        _run_learning_task(
            service_id=service_id,
            service_name=payload.service_name,
            dynatrace_entity_id=payload.dynatrace_entity_id,
            learning_window_days=payload.learning_window_days,
        )
    )
    log.info("service_registered_learning_started")

    now = datetime.now(dt.UTC)
    return ServiceResponse(
        service_id=service_id,
        service_name=payload.service_name,
        dynatrace_entity_id=payload.dynatrace_entity_id,
        deprecation_date=payload.deprecation_date,
        replacement_service_id=payload.replacement_service_id,
        phase="learning",
        created_at=now,
        updated_at=now,
    )


@router.get("", response_model=list[ServiceResponse])
async def list_services() -> list[ServiceResponse]:
    docs = await firestore_client.list_services()
    return [_doc_to_response(d) for d in docs]


@router.get("/{service_id}", response_model=ServiceResponse)
async def get_service(service_id: str) -> ServiceResponse:
    doc = await firestore_client.get_service(service_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Service not found")
    return _doc_to_response(doc)


@router.post("/{service_id}/learn", status_code=status.HTTP_202_ACCEPTED)
async def trigger_learning(service_id: str, hint: str | None = None) -> dict[str, Any]:
    doc = await firestore_client.get_service(service_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Service not found")

    # Reset to learning (clears any previous error), then dispatch in background.
    await firestore_client.update_service_phase(
        service_id, "learning", extra={"error_message": None}
    )
    asyncio.create_task(
        _run_learning_task(
            service_id=service_id,
            service_name=doc["service_name"],
            dynatrace_entity_id=doc["dynatrace_entity_id"],
            learning_window_days=doc.get("learning_window_days", 14),
        )
    )
    return {"status": "accepted", "service_id": service_id}


async def _run_learning_task(
    service_id: str,
    service_name: str,
    dynatrace_entity_id: str,
    learning_window_days: int,
) -> None:
    """Background wrapper: run learning and persist any error to Firestore."""
    log = logger.bind(service_id=service_id)
    try:
        result = await agent_client.trigger_learning(
            service_id=service_id,
            service_name=service_name,
            dynatrace_entity_id=dynatrace_entity_id,
            learning_window_days=learning_window_days,
        )
        if result.get("status") == "error":
            msg = result.get("message", "Agent invocation failed")
            log.warning("learning_agent_error", error=msg)
            await firestore_client.update_service_phase(
                service_id, "error", extra={"error_message": msg}
            )
        else:
            await firestore_client.update_service_phase(service_id, "ready")
            log.info("learning_complete_phase_ready", service_id=service_id)
    except Exception as exc:
        log.error("learning_task_exception", error=str(exc))
        await firestore_client.update_service_phase(
            service_id, "error", extra={"error_message": str(exc)}
        )


def _doc_to_response(doc: dict[str, Any]) -> ServiceResponse:
    return ServiceResponse(
        service_id=doc["service_id"],
        service_name=doc["service_name"],
        dynatrace_entity_id=doc["dynatrace_entity_id"],
        deprecation_date=_parse_dt(doc["deprecation_date"]),
        replacement_service_id=doc.get("replacement_service_id"),
        phase=doc.get("phase", "registered"),
        error_message=doc.get("error_message"),
        created_at=_parse_dt(doc.get("created_at", datetime.now(dt.UTC))),
        updated_at=_parse_dt(doc.get("updated_at", datetime.now(dt.UTC))),
    )


def _parse_dt(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value))
