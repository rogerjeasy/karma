"""Contract retrieval routes."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app import firestore_client
from app.auth import get_current_user
from app.models import ContractResponse

router = APIRouter(prefix="/contracts", tags=["contracts"])


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
    from datetime import datetime
    ts_raw = doc.get("saved_at") or doc.get("detected_at") or datetime.utcnow().isoformat()
    return ContractResponse(
        contract_id=doc["contract_id"],
        service_id=doc["service_id"],
        category=doc["category"],
        subcategory=doc["subcategory"],
        description=doc["description"],
        confidence=doc["confidence"],
        validated=doc.get("validated", False),
        detected_at=datetime.fromisoformat(str(ts_raw)),
    )
