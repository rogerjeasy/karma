"""Service registration and management routes."""
from __future__ import annotations

import datetime as dt
import uuid
from datetime import datetime

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

    # Fire-and-forget: kick off learning
    await agent_client.trigger_learning(
        service_id=service_id,
        service_name=payload.service_name,
        dynatrace_entity_id=payload.dynatrace_entity_id,
        learning_window_days=payload.learning_window_days,
    )

    await firestore_client.update_service_phase(service_id, "learning")
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
async def trigger_learning(service_id: str, hint: str | None = None) -> dict:
    doc = await firestore_client.get_service(service_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Service not found")

    await agent_client.trigger_learning(
        service_id=service_id,
        service_name=doc["service_name"],
        dynatrace_entity_id=doc["dynatrace_entity_id"],
        learning_window_days=doc.get("learning_window_days", 14),
    )
    return {"status": "accepted", "service_id": service_id}


def _doc_to_response(doc: dict) -> ServiceResponse:
    return ServiceResponse(
        service_id=doc["service_id"],
        service_name=doc["service_name"],
        dynatrace_entity_id=doc["dynatrace_entity_id"],
        deprecation_date=_parse_dt(doc["deprecation_date"]),
        replacement_service_id=doc.get("replacement_service_id"),
        phase=doc.get("phase", "registered"),
        created_at=_parse_dt(doc.get("created_at", datetime.now(dt.UTC))),
        updated_at=_parse_dt(doc.get("updated_at", datetime.now(dt.UTC))),
    )


def _parse_dt(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value))
