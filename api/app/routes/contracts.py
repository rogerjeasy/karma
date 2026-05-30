"""Contract retrieval routes."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException

from app import dt_notebook, firestore_client
from app.auth import get_current_user
from app.models import (
    ContractDetailResponse,
    ContractResponse,
    NotebookResponse,
)

logger = structlog.get_logger(__name__)
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


async def _load_owned_contract(contract_id: str, user: dict[str, Any]) -> dict[str, Any]:
    """Fetch a contract and verify the caller owns its service, or raise 404."""
    doc = await firestore_client.get_contract_by_id(contract_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Contract not found")
    karma_service_id = doc.get("karma_service_id", "")
    if not karma_service_id:
        raise HTTPException(status_code=404, detail="Contract not found")
    svc = await firestore_client.get_service(karma_service_id)
    if svc is None or svc.get("user_id") != user["uid"]:
        raise HTTPException(status_code=404, detail="Contract not found")
    return doc


@router.post("/detail/{contract_id}/verify-notebook", response_model=NotebookResponse)
async def create_verification_notebook(
    contract_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> NotebookResponse:
    """Create (or return a cached) Dynatrace Notebook for this contract's DQL.

    Powers the "Verify in Dynatrace" button: instead of opening the generic
    getting-started notebook, the user lands on a notebook whose cells are this
    contract's evidence + violation-test DQL, runnable against their own Grail.

    Idempotent: the notebook URL is cached on the contract, so repeat clicks
    return the same notebook instead of creating duplicates.
    """
    doc = await _load_owned_contract(contract_id, user)

    cached = doc.get("verification_notebook_url")
    if cached:
        return NotebookResponse(notebook_url=cached, created=False)

    name, cells, description = _build_notebook(doc)
    url = await dt_notebook.create_notebook(name=name, content=cells, description=description)
    if not url:
        raise HTTPException(
            status_code=503,
            detail=(
                "Could not create a Dynatrace Notebook "
                "(Dynatrace not configured or gateway unavailable)."
            ),
        )

    # Best-effort cache — a failed write just means the next click recreates it.
    try:
        await firestore_client.update_contract(contract_id, {"verification_notebook_url": url})
    except Exception as exc:  # noqa: BLE001
        logger.warning("verify_notebook_cache_failed", contract_id=contract_id, error=str(exc))

    logger.info("verify_notebook_created", contract_id=contract_id)
    return NotebookResponse(notebook_url=url, created=True)


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
        verification_notebook_url=doc.get("verification_notebook_url"),
    )


def _build_notebook(doc: dict[str, Any]) -> tuple[str, list[dict[str, str]], str]:
    """Assemble a Dynatrace Notebook (name, cells, description) from a contract.

    Cells are an intro + each DQL-evidence query + the violation-test predicate,
    so the user can run the exact queries behind the contract against live Grail.
    """
    category = doc.get("category", "contract")
    subcategory = doc.get("subcategory", "")
    description = doc.get("description", "")
    contract_id = doc.get("contract_id", "")
    today = datetime.now(UTC).strftime("%Y-%m-%d")

    label = f"{category}/{subcategory}" if subcategory else category
    name = f"[Karma] {label} — verify — {today}"

    cells: list[dict[str, str]] = [
        {
            "type": "markdown",
            "text": (
                f"# Verify contract — {label}\n\n"
                f"{description}\n\n"
                f"**Contract:** `{contract_id}`  ·  Every DQL cell below runs against "
                f"**your own Grail data** — no fabricated numbers."
            ),
        }
    ]

    # Evidence DQL cells — the queries that backed the original discovery.
    evidence = doc.get("evidence") or []
    dql_evidence = [
        e for e in evidence
        if isinstance(e, dict) and e.get("type") == "dql_query" and e.get("dql")
    ]
    for i, ev in enumerate(dql_evidence, start=1):
        header = f"## Evidence #{i}"
        if ev.get("result_summary"):
            header += f"\n\n_Expected: {ev['result_summary']}_"
        cells.append({"type": "markdown", "text": header})
        cells.append({"type": "dql", "text": str(ev["dql"])})

    # Violation-test predicate — returns rows when the contract is broken.
    pred = doc.get("violation_predicate") or {}
    test_dql = pred.get("test_dql")
    if test_dql:
        threshold = pred.get("threshold")
        intro = (
            "## Violation test\n\nThis predicate flags the contract "
            "as **violated** when it returns rows."
        )
        if threshold:
            intro += f"\n\n**Threshold:** {threshold}"
        cells.append({"type": "markdown", "text": intro})
        cells.append({"type": "dql", "text": str(test_dql)})

    description_text = f"Karma verification notebook for contract {contract_id} ({label})."
    return name, cells, description_text
