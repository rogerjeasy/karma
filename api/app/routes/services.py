"""Service registration and management routes."""
from __future__ import annotations

import asyncio
import datetime as dt
import uuid
from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from app import agent_client, firestore_client
from app.auth import get_current_user
from app.models import ServiceRegistration, ServiceResponse

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/services", tags=["services"])


async def _get_owned_service(service_id: str, user_id: str) -> dict[str, Any]:
    """Fetch a service and verify it belongs to this user.

    Returns 404 (not 403) in both the missing and wrong-owner cases to
    avoid leaking existence information to other users.
    """
    doc = await firestore_client.get_service(service_id)
    if doc is None or doc.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Service not found")
    return doc


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
async def register_service(
    payload: ServiceRegistration,
    user: dict[str, Any] = Depends(get_current_user),
) -> ServiceResponse:
    service_id = str(uuid.uuid4())
    log = logger.bind(service_id=service_id, service_name=payload.service_name, uid=user["uid"])
    log.info("registering_service")

    data = {
        "service_id": service_id,
        "user_id": user["uid"],
        "service_name": payload.service_name,
        "dynatrace_entity_id": payload.dynatrace_entity_id,
        "deprecation_date": payload.deprecation_date.isoformat(),
        "replacement_service_id": payload.replacement_service_id,
        "learning_window_days": payload.learning_window_days,
    }

    await firestore_client.create_service(service_id, data)
    await firestore_client.update_service_phase(service_id, "learning")

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
async def list_services(user: dict[str, Any] = Depends(get_current_user)) -> list[ServiceResponse]:
    docs = await firestore_client.list_services(user["uid"])
    return [_doc_to_response(d) for d in docs]


@router.get("/{service_id}", response_model=ServiceResponse)
async def get_service(
    service_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> ServiceResponse:
    doc = await _get_owned_service(service_id, user["uid"])
    return _doc_to_response(doc)


@router.delete("/{service_id}", status_code=status.HTTP_200_OK)
async def delete_service(
    service_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Delete a service and all associated contracts and ghost reports.

    Also stops the watcher — the scheduler tick only picks up services in
    haunting phase, so removing the document prevents any further runs.
    """
    await _get_owned_service(service_id, user["uid"])
    log = logger.bind(service_id=service_id)
    log.info("service_delete_requested")

    result = await firestore_client.delete_service_cascade(service_id)
    log.info("service_deleted", **{k: v for k, v in result.items() if k != "deleted"})
    return {"service_id": service_id, **result}


@router.post("/{service_id}/learn", status_code=status.HTTP_202_ACCEPTED)
async def trigger_learning(
    service_id: str,
    hint: str | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    doc = await _get_owned_service(service_id, user["uid"])

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
