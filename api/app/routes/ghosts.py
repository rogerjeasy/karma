"""Ghost report retrieval routes."""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app import firestore_client
from app.auth import get_current_user
from app.chat_client import ask_gemini
from app.models import (
    GhostAskRequest,
    GhostAskResponse,
    GhostReportResponse,
    RemediationPatch,
)

router = APIRouter(prefix="/ghosts", tags=["ghosts"])


@router.get("", response_model=list[GhostReportResponse])
async def list_ghost_reports(
    service_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    user: dict[str, Any] = Depends(get_current_user),
) -> list[GhostReportResponse]:
    # If filtering by service, verify ownership first.
    if service_id is not None:
        svc = await firestore_client.get_service(service_id)
        if svc is None or svc.get("user_id") != user["uid"]:
            raise HTTPException(status_code=404, detail="Service not found")

    docs = await firestore_client.list_ghost_reports(
        user_id=user["uid"], service_id=service_id, limit=limit
    )
    return [_doc_to_response(d) for d in docs]


@router.get("/{report_id}", response_model=GhostReportResponse)
async def get_ghost_report(
    report_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> GhostReportResponse:
    doc = await firestore_client.get_ghost_report(report_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Ghost report not found")

    # Verify the report belongs to a service owned by this user.
    karma_service_id = doc.get("karma_service_id", "")
    if karma_service_id:
        svc = await firestore_client.get_service(karma_service_id)
        if svc is None or svc.get("user_id") != user["uid"]:
            raise HTTPException(status_code=404, detail="Ghost report not found")

    return _doc_to_response(doc)


_ASK_SYSTEM_PROMPT = """You are Karma, an SRE assistant answering questions about ONE specific \
ghost report (a detected behavioral-contract regression during a service migration).

Rules:
- Answer ONLY from the GHOST REPORT CONTEXT below. Do not invent telemetry, numbers, \
service names, or root causes that are not present in the context.
- If the answer is not in the context, say so plainly (e.g. "That's not captured in this \
report") and, if useful, suggest what the user could check in Dynatrace.
- Be concise and concrete. Prefer 1-4 sentences. Use the report's own numbers verbatim.
- You may explain, summarize, prioritize remediation steps, or restate the diff — but never \
fabricate. You cannot run queries or take actions; you only reason over this report.

GHOST REPORT CONTEXT (JSON):
{context}
"""


def _build_ask_context(doc: dict[str, Any]) -> str:
    """Assemble the grounded JSON context from a persisted ghost report.

    Only fields the user already has access to are included — this is the same
    data the dashboard renders, so the chat reveals nothing new.
    """
    contract = doc.get("contract") or {}
    context = {
        "severity": doc.get("severity"),
        "category": contract.get("category"),
        "subcategory": contract.get("subcategory"),
        "summary": doc.get("summary"),
        "root_cause": doc.get("root_cause"),
        "downstream_impact": doc.get("downstream_impact"),
        "davis_ai_insights": doc.get("davis_ai_insights"),
        "evidence_dql": doc.get("evidence_links", []),
        "remediation_suggestions": doc.get("remediation_suggestions", []),
        "remediation_patch": doc.get("remediation_patch"),
        "avoided_incident_cost_usd": doc.get("avoided_incident_cost_usd"),
        "contract": contract,
    }
    return json.dumps(context, default=str, indent=2)


@router.post("/{report_id}/ask", response_model=GhostAskResponse)
async def ask_about_ghost(
    report_id: str,
    body: GhostAskRequest,
    user: dict[str, Any] = Depends(get_current_user),
) -> GhostAskResponse:
    """Answer a question about a single ghost report, grounded in that report only.

    Lightweight: one direct Gemini call over context the dashboard already shows.
    No agent pipeline, no new telemetry queries.
    """
    doc = await firestore_client.get_ghost_report(report_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Ghost report not found")

    karma_service_id = doc.get("karma_service_id", "")
    if karma_service_id:
        svc = await firestore_client.get_service(karma_service_id)
        if svc is None or svc.get("user_id") != user["uid"]:
            raise HTTPException(status_code=404, detail="Ghost report not found")

    system_prompt = _ASK_SYSTEM_PROMPT.format(context=_build_ask_context(doc))
    answer = await ask_gemini(
        system_instruction=system_prompt,
        question=body.question,
        history=[t.model_dump() for t in body.history],
    )
    return GhostAskResponse(answer=answer)


def _parse_remediation_patch(raw: Any) -> RemediationPatch | None:
    """Coerce a stored remediation_patch dict into the response model.

    Tolerant of missing optional keys and of malformed agent output — returns
    None rather than raising so a bad patch never breaks the ghost feed.
    """
    if not isinstance(raw, dict):
        return None
    try:
        return RemediationPatch(
            pr_title=str(raw["pr_title"]),
            pr_body=str(raw["pr_body"]),
            target_file=str(raw["target_file"]),
            language=str(raw.get("language", "")),
            patch_diff=str(raw["patch_diff"]),
            github_url=raw.get("github_url"),
        )
    except (KeyError, TypeError, ValueError):
        return None


def _doc_to_response(doc: dict[str, Any]) -> GhostReportResponse:
    from datetime import datetime
    dt_evidence: dict[str, Any] = doc.get("dynatrace_evidence") or {}
    return GhostReportResponse(
        remediation_patch=_parse_remediation_patch(doc.get("remediation_patch")),
        report_id=doc["report_id"],
        violation_id=doc["violation_id"],
        contract_id=doc.get("contract", {}).get("contract_id", ""),
        karma_service_id=doc.get("karma_service_id"),
        category=doc.get("contract", {}).get("category", ""),
        summary=doc["summary"],
        root_cause=doc["root_cause"],
        downstream_impact=doc["downstream_impact"],
        davis_ai_insights=doc.get("davis_ai_insights"),
        severity=doc.get("severity", "medium"),
        evidence_links=doc.get("evidence_links", []),
        remediation_suggestions=doc.get("remediation_suggestions", []),
        cost_estimate_usd=doc.get("cost_estimate_usd"),
        investigation_input_tokens=doc.get("investigation_input_tokens"),
        investigation_output_tokens=doc.get("investigation_output_tokens"),
        dynatrace_event_id=doc.get("dynatrace_event_id"),
        avoided_incident_cost_usd=doc.get("avoided_incident_cost_usd"),
        dynatrace_notebook_url=doc.get("dynatrace_notebook_url"),
        dynatrace_workflow_id=doc.get("dynatrace_workflow_id"),
        slack_notification_sent=bool(doc.get("slack_notification_sent", False)),
        davis_problem_id=dt_evidence.get("related_davis_problem_id"),
        new_service_entity_id=doc.get("new_service_id"),
        created_at=datetime.fromisoformat(str(doc.get("created_at") or doc["saved_at"])),
    )
