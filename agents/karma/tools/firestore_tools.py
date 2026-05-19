"""Firestore persistence tools for Karma agents.

Agents run on Agent Engine and write directly to Firestore using the
service account credentials provisioned by Terraform (roles/datastore.user).
The sync Firestore client is used so the function signature stays simple
and ADK can call it without async wrapping.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import structlog
from google.cloud import firestore

from karma.config import settings

logger = structlog.get_logger(__name__)


def save_ghost_report_to_firestore(
    karma_service_id: str,
    report: dict[str, Any],
) -> dict[str, Any]:
    """Persist a ghost report to Firestore and return its report_id.

    Call this as the FINAL step of forensic investigation, before emitting
    the Dynatrace BizEvent. The SSE stream will broadcast the new document
    to the dashboard within seconds of this call.

    Args:
        karma_service_id: The Karma service UUID (from the run_forensic task
            payload). Used by the dashboard to list reports per service.
        report: Complete GhostReport dict. Must include at minimum:
            violation_id, contract, summary, root_cause, downstream_impact,
            evidence_links, remediation_suggestions, severity.

    Returns:
        {"saved": True, "report_id": "<uuid>"}
    """
    db = firestore.Client(
        project=settings.gcp_project_id,
        database=settings.firestore_database,
    )
    report_id = report.get("report_id") or str(uuid.uuid4())
    doc: dict[str, Any] = {
        **report,
        "report_id": report_id,
        "karma_service_id": karma_service_id,
        "saved_at": datetime.now(timezone.utc).isoformat(),
    }
    db.collection("ghost_reports").document(report_id).set(doc)
    logger.info(
        "ghost_report_saved",
        report_id=report_id,
        karma_service_id=karma_service_id,
        severity=report.get("severity"),
    )
    return {"saved": True, "report_id": report_id}


def save_contracts_to_firestore(
    karma_service_id: str,
    contracts: list[dict[str, Any]],
) -> dict[str, Any]:
    """Persist validated contracts to Firestore.

    Call this as the FINAL step of learning, after proposing and validating
    all contracts. Do not call it per-contract — pass all contracts at once.

    Args:
        karma_service_id: The Karma service UUID supplied in the begin_learning
            task payload. Used by the dashboard to list contracts per service.
        contracts: List of contract objects conforming to contract_schema.json.
            Each must have at minimum: service_id, category, subcategory,
            description, evidence, confidence, learning_window,
            violation_predicate.

    Returns:
        {
            "saved": <count of successfully written contracts>,
            "skipped": <count of contracts that failed validation or write>,
            "contract_ids": [<list of saved contract_id strings>]
        }
    """
    db = firestore.Client(
        project=settings.gcp_project_id,
        database=settings.firestore_database,
    )
    collection = db.collection("contracts")
    now = datetime.now(timezone.utc).isoformat()

    saved_ids: list[str] = []
    skipped = 0

    for raw in contracts:
        try:
            contract_id = raw.get("contract_id") or str(uuid.uuid4())
            doc: dict[str, Any] = {
                **raw,
                "contract_id": contract_id,
                # karma_service_id lets the dashboard query by UUID while
                # service_id preserves the Dynatrace entity ID in the schema.
                "karma_service_id": karma_service_id,
                "saved_at": now,
                "validated": raw.get("validated", True),
            }
            collection.document(contract_id).set(doc)
            saved_ids.append(contract_id)
            logger.info(
                "contract_saved",
                contract_id=contract_id,
                category=raw.get("category"),
                subcategory=raw.get("subcategory"),
            )
        except Exception as exc:
            logger.warning("contract_save_failed", error=str(exc), contract=raw)
            skipped += 1

    logger.info(
        "contracts_persist_complete",
        karma_service_id=karma_service_id,
        saved=len(saved_ids),
        skipped=skipped,
    )
    return {"saved": len(saved_ids), "skipped": skipped, "contract_ids": saved_ids}
