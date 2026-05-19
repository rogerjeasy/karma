"""Contract retrieval routes."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app import firestore_client
from app.models import ContractResponse

router = APIRouter(prefix="/contracts", tags=["contracts"])


@router.get("/{service_id}", response_model=list[ContractResponse])
async def list_contracts(service_id: str) -> list[ContractResponse]:
    docs = await firestore_client.list_contracts_for_service(service_id)
    return [_doc_to_response(d) for d in docs]


def _doc_to_response(doc: dict[str, Any]) -> ContractResponse:
    from datetime import datetime
    return ContractResponse(
        contract_id=doc["contract_id"],
        service_id=doc["service_id"],
        category=doc["category"],
        subcategory=doc["subcategory"],
        description=doc["description"],
        confidence=doc["confidence"],
        validated=doc.get("validated", False),
        detected_at=datetime.fromisoformat(str(doc["detected_at"])),
    )
