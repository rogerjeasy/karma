"""Contract retrieval routes."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app import firestore_client
from app.auth import get_current_user
from app.models import ContractDetailResponse, ContractResponse

router = APIRouter(prefix="/contracts", tags=["contracts"])


@router.get("/detail/{contract_id}", response_model=ContractDetailResponse)
async def get_contract_detail(
    contract_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> ContractDetailResponse:
    doc = await firestore_client.get_contract_by_id(contract_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Contract not found")
    karma_service_id = doc.get("karma_service_id", "")
    if not karma_service_id:
        raise HTTPException(status_code=404, detail="Contract not found")
    svc = await firestore_client.get_service(karma_service_id)
    if svc is None or svc.get("user_id") != user["uid"]:
        raise HTTPException(status_code=404, detail="Contract not found")
    return _doc_to_detail_response(doc)


@router.get("/{service_id}", response_model=list[ContractResponse])
async def list_contracts(
    service_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> list[ContractResponse]:
    # Verify the service belongs to this user before returning its contracts.
    svc = await firestore_client.get_service(service_id)
    if svc is None or svc.get("user_id") != user["uid"]:
        raise HTTPException(status_code=404, detail="Service not found")

    docs = await firestore_client.list_contracts_for_service(service_id)
    return [_doc_to_response(d) for d in docs]


def _doc_to_response(doc: dict[str, Any]) -> ContractResponse:
    ts_raw = doc.get("saved_at") or doc.get("detected_at") or datetime.utcnow().isoformat()
    return ContractResponse(
        contract_id=doc["contract_id"],
        # service_id in the contract schema is the Dynatrace entity ID;
        # fall back to karma_service_id so malformed docs don't 500 the endpoint.
        service_id=doc.get("service_id") or doc.get("karma_service_id", ""),
        category=doc["category"],
        subcategory=doc["subcategory"],
        description=doc["description"],
        confidence=doc["confidence"],
        validated=doc.get("validated", False),
        detected_at=datetime.fromisoformat(str(ts_raw)),
    )


def _doc_to_detail_response(doc: dict[str, Any]) -> ContractDetailResponse:
    ts_raw = doc.get("saved_at") or doc.get("detected_at") or datetime.utcnow().isoformat()
    pred = doc.get("violation_predicate") or {}
    return ContractDetailResponse(
        contract_id=doc["contract_id"],
        service_id=doc.get("service_id") or doc.get("karma_service_id", ""),
        karma_service_id=doc.get("karma_service_id"),
        category=doc["category"],
        subcategory=doc["subcategory"],
        description=doc["description"],
        confidence=doc["confidence"],
        validated=doc.get("validated", False),
        detected_at=datetime.fromisoformat(str(ts_raw)),
        predicate_type=pred.get("type"),
        predicate_test_dql=pred.get("test_dql"),
        predicate_threshold=pred.get("threshold"),
        predicate_tolerance_seconds=pred.get("tolerance_window_seconds"),
        evidence=doc.get("evidence"),
        downstream_dependents=doc.get("downstream_dependents"),
        slo_id=doc.get("slo_id"),
    )
