"""Ghost report retrieval routes."""
from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query

from app import dt_notebook, firestore_client, github_client
from app.auth import get_current_user, require_registered_user
from app.chat_client import ask_gemini
from app.config import settings
from app.models import (
    GhostAskRequest,
    GhostAskResponse,
    GhostReportResponse,
    NotebookResponse,
    OpenPrResponse,
    RemediationPatch,
)

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/ghosts", tags=["ghosts"])

# Evidence link strings may carry a "DQL#1 (label): " prefix and a trailing
# "-- RESULT: …" annotation. Mirror the dashboard's extractDql() to recover the
# raw query before placing it in an executable notebook cell.
_DQL_PREFIX_RE = re.compile(r"^DQL#?\d*\s*[^:]*:\s*", re.IGNORECASE)
_DQL_RESULT_RE = re.compile(r"\s*--\s*RESULT:[\s\S]*$", re.IGNORECASE)
_DQL_VERBS = ("fetch", "timeseries", "data", "describe")


def _extract_dql(raw: str) -> str | None:
    """Recover a runnable DQL string from an evidence_links entry, or None."""
    if not isinstance(raw, str) or raw.strip().lower().startswith(("http://", "https://")):
        return None
    cleaned = _DQL_RESULT_RE.sub("", _DQL_PREFIX_RE.sub("", raw)).strip()
    head = cleaned.lstrip("|").strip().lower()
    return cleaned if head.startswith(_DQL_VERBS) else None


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


@router.post("/{report_id}/open-pr", response_model=OpenPrResponse)
async def open_remediation_pr(
    report_id: str,
    user: dict[str, Any] = Depends(require_registered_user),
) -> OpenPrResponse:
    """Open a draft pull request from this ghost report's remediation patch.

    Closes the detect → diagnose → fix loop: the Forensic agent already generated
    the patch; this pushes it to GitHub as a draft PR for a human to review. Safe and
    idempotent — re-invoking returns the PR that was already opened for this report.
    """
    doc = await firestore_client.get_ghost_report(report_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Ghost report not found")

    svc: dict[str, Any] | None = None
    karma_service_id = doc.get("karma_service_id", "")
    if karma_service_id:
        svc = await firestore_client.get_service(karma_service_id)
        if svc is None or svc.get("user_id") != user["uid"]:
            raise HTTPException(status_code=404, detail="Ghost report not found")

    # Already opened for this report — return it without calling GitHub again.
    existing = doc.get("remediation_pr") or {}
    if existing.get("pr_url"):
        return OpenPrResponse(
            pr_url=existing["pr_url"],
            pr_number=int(existing.get("pr_number") or 0),
            branch=existing.get("branch", ""),
            repo=existing.get("repo", ""),
            created=False,
        )

    patch = _parse_remediation_patch(doc.get("remediation_patch"))
    if patch is None:
        raise HTTPException(
            status_code=400,
            detail="This ghost report has no remediation patch to open as a PR.",
        )

    if not settings.github_write_token:
        raise HTTPException(
            status_code=503,
            detail="PR creation is not configured on this server (no GitHub write token).",
        )

    repo = (svc.get("github_repo") if svc else None) or settings.github_repo
    if not repo:
        raise HTTPException(
            status_code=503,
            detail="No GitHub repository is configured for this service.",
        )

    try:
        result = await github_client.open_remediation_pr(
            repo=repo,
            base_branch=settings.github_pr_base_branch,
            token=settings.github_write_token,
            report_id=report_id,
            pr_title=patch.pr_title,
            pr_body=patch.pr_body,
            patch_diff=patch.patch_diff,
            target_file=patch.target_file,
            requested_by_name=user.get("name", "") or user.get("email", ""),
            requested_by_email=user.get("email", ""),
        )
    except Exception as exc:
        logger.warning("open_remediation_pr_failed", report_id=report_id, repo=repo, error=str(exc))
        raise HTTPException(
            status_code=502, detail=f"Could not open the pull request: {exc}"
        ) from exc

    await firestore_client.update_ghost_report(
        report_id,
        {
            "remediation_pr": {
                "pr_url": result["pr_url"],
                "pr_number": result["pr_number"],
                "branch": result["branch"],
                "repo": repo,
            }
        },
    )
    logger.info(
        "remediation_pr_opened",
        report_id=report_id,
        repo=repo,
        pr_number=result["pr_number"],
        created=result["created"],
    )
    return OpenPrResponse(
        pr_url=result["pr_url"],
        pr_number=result["pr_number"],
        branch=result["branch"],
        repo=repo,
        created=result["created"],
    )


@router.post("/{report_id}/notebook", response_model=NotebookResponse)
async def create_ghost_notebook(
    report_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> NotebookResponse:
    """Create (or return a cached) Dynatrace Notebook for this ghost report.

    Powers the "Open in Dynatrace" button: the custom timeline-annotation event
    can't be linked into a standalone events app (not installed on all tenants),
    so we publish the investigation as a native Notebook whose cells are the
    ghost's evidence DQL — runnable against the user's own Grail data.

    Idempotent: the URL is cached on the report (dynatrace_notebook_url), so
    repeat clicks return the same notebook instead of creating duplicates.
    """
    doc = await firestore_client.get_ghost_report(report_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Ghost report not found")

    karma_service_id = doc.get("karma_service_id", "")
    if karma_service_id:
        svc = await firestore_client.get_service(karma_service_id)
        if svc is None or svc.get("user_id") != user["uid"]:
            raise HTTPException(status_code=404, detail="Ghost report not found")

    cached = doc.get("dynatrace_notebook_url")
    if cached:
        return NotebookResponse(notebook_url=cached, created=False)

    name, cells, description = _build_ghost_notebook(doc)
    url = await dt_notebook.create_notebook(name=name, content=cells, description=description)
    if not url:
        raise HTTPException(
            status_code=503,
            detail=(
                "Could not create a Dynatrace Notebook "
                "(Dynatrace not configured or gateway unavailable)."
            ),
        )

    try:
        await firestore_client.update_ghost_report(report_id, {"dynatrace_notebook_url": url})
    except Exception as exc:  # noqa: BLE001 — caching is best-effort
        logger.warning("ghost_notebook_cache_failed", report_id=report_id, error=str(exc))

    logger.info("ghost_notebook_created", report_id=report_id)
    return NotebookResponse(notebook_url=url, created=True)


def _build_ghost_notebook(doc: dict[str, Any]) -> tuple[str, list[dict[str, str]], str]:
    """Assemble a Dynatrace Notebook (name, cells, description) from a ghost report.

    Markdown intro (summary, root cause, impact, Davis insights) + an executable
    DQL cell for each evidence query + a remediation checklist.
    """
    contract = doc.get("contract") or {}
    category = contract.get("category", "ghost")
    subcategory = contract.get("subcategory", "")
    label = f"{category}/{subcategory}" if subcategory else category
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    name = f"[Karma] {label} — investigation — {today}"

    intro = f"# Ghost investigation — {label}\n\n"
    if doc.get("severity"):
        intro += f"**Severity:** {doc['severity']}  ·  "
    intro += "Every DQL cell runs against **your own Grail data** — no fabricated numbers.\n\n"
    if doc.get("summary"):
        intro += f"## Summary\n\n{doc['summary']}\n\n"
    if doc.get("root_cause"):
        intro += f"## Root cause\n\n{doc['root_cause']}\n\n"
    if doc.get("downstream_impact"):
        intro += f"## Downstream impact\n\n{doc['downstream_impact']}\n"
    cells: list[dict[str, str]] = [{"type": "markdown", "text": intro.rstrip()}]

    davis = doc.get("davis_ai_insights")
    if davis and davis != "not available":
        cells.append({"type": "markdown", "text": f"## Davis AI insights\n\n{davis}"})

    # Evidence DQL — the queries behind the findings, as executable cells.
    dql_cells = [d for link in (doc.get("evidence_links") or []) if (d := _extract_dql(link))]
    if dql_cells:
        cells.append({"type": "markdown", "text": "## Evidence queries"})
        for i, dql in enumerate(dql_cells, start=1):
            cells.append({"type": "markdown", "text": f"**Evidence #{i}**"})
            cells.append({"type": "dql", "text": dql})

    suggestions = doc.get("remediation_suggestions") or []
    if suggestions:
        body = "\n".join(f"- {s}" for s in suggestions)
        cells.append({"type": "markdown", "text": f"## Remediation\n\n{body}"})

    description = f"Karma ghost investigation notebook ({label})."
    return name, cells, description


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
        remediation_pr_url=(doc.get("remediation_pr") or {}).get("pr_url"),
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
