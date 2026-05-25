"""Admin-only routes — require the 'admin' role in users/{uid}.roles.

All endpoints return 403 for authenticated non-admin users.
"""
from __future__ import annotations

import asyncio
import datetime as dt
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from google.cloud.firestore_v1.base_query import FieldFilter

from app import agent_client, firestore_client
from app.auth import require_admin
from app.config import settings
from app.models import (
    ContractResponse,
    CutoverRequest,
    CutoverResponse,
    GhostReportResponse,
    RecordDeploymentRequest,
    RecordDeploymentResponse,
    SystemServiceCreate,
    SystemServiceResponse,
    WatcherRunResponse,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/observability")
async def get_observability(
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    """Platform observability summary: session activity, engineering metrics, OTel status."""
    return await firestore_client.get_platform_observability(
        dt_configured=bool(settings.dt_otel_token),
        dt_env=settings.dt_env,
    )


@router.get("/system-services", response_model=list[SystemServiceResponse])
async def list_system_services(
    _: dict[str, Any] = Depends(require_admin),
) -> list[SystemServiceResponse]:
    """List all Karma infrastructure services being self-monitored."""
    svcs = await firestore_client.list_system_services()
    return [_to_system_response(s) for s in svcs]


@router.post(
    "/system-services",
    response_model=SystemServiceResponse,
    status_code=201,
)
async def create_system_service(
    body: SystemServiceCreate,
    _: dict[str, Any] = Depends(require_admin),
) -> SystemServiceResponse:
    """Register a Karma infrastructure service for self-monitoring."""
    service_id = str(uuid.uuid4())
    now = datetime.now(dt.UTC)
    data: dict[str, Any] = {
        "service_id": service_id,
        "service_name": body.service_name,
        "dynatrace_entity_id": body.dynatrace_entity_id,
        "replacement_service_id": body.replacement_service_id,
        "description": body.description,
        "url": body.url,
        "phase": "registered",
        "is_system": True,
        "user_id": "system",
        "error_message": None,
        "created_at": now,
        "updated_at": now,
    }
    await firestore_client.save_service_doc(service_id, data)
    return _to_system_response(data)


@router.get("/stats")
async def get_admin_stats(
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    """Platform-wide admin stats: total users, system services, ghost reports."""
    db = firestore_client.get_db()

    user_count = len([d async for d in db.collection("users").stream()])

    system_svcs = await firestore_client.list_system_services()
    # Completed system services are still watched continuously (our watcher tick
    # picks them up), so count them alongside explicitly-haunting ones.
    haunting = [s for s in system_svcs if s.get("phase") in ("haunting", "completed")]

    ghost_count = 0
    for svc in system_svcs:
        sid = svc.get("service_id", "")
        if not sid:
            continue
        q = (
            db.collection("ghost_reports")
            .where(filter=FieldFilter("karma_service_id", "==", sid))
            .limit(1000)
        )
        ghost_count += len([d async for d in q.stream()])

    return {
        "total_users": user_count,
        "total_system_services": len(system_svcs),
        "system_services_haunting": len(haunting),
        "system_ghost_reports": ghost_count,
    }


@router.get("/system-services/{service_id}", response_model=SystemServiceResponse)
async def get_system_service(
    service_id: str,
    _: dict[str, Any] = Depends(require_admin),
) -> SystemServiceResponse:
    """Return a single Karma infrastructure service by ID."""
    svc = await firestore_client.get_service(service_id)
    if svc is None or not svc.get("is_system"):
        raise HTTPException(status_code=404, detail="System service not found")
    return _to_system_response(svc)


@router.get(
    "/system-services/{service_id}/contracts",
    response_model=list[ContractResponse],
)
async def get_system_service_contracts(
    service_id: str,
    _: dict[str, Any] = Depends(require_admin),
) -> list[ContractResponse]:
    """Return all contracts discovered for a system service."""
    svc = await firestore_client.get_service(service_id)
    if svc is None or not svc.get("is_system"):
        raise HTTPException(status_code=404, detail="System service not found")
    docs = await firestore_client.list_contracts_for_service(service_id)
    return [_to_contract_response(d) for d in docs]


@router.get(
    "/system-services/{service_id}/ghosts",
    response_model=list[GhostReportResponse],
)
async def get_system_service_ghosts(
    service_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    _: dict[str, Any] = Depends(require_admin),
) -> list[GhostReportResponse]:
    """Return ghost reports for a system service."""
    svc = await firestore_client.get_service(service_id)
    if svc is None or not svc.get("is_system"):
        raise HTTPException(status_code=404, detail="System service not found")
    docs = await firestore_client.list_ghost_reports(
        user_id="system", service_id=service_id, limit=limit
    )
    return [_to_ghost_response(d) for d in docs]


@router.get(
    "/system-services/{service_id}/watcher-runs",
    response_model=list[WatcherRunResponse],
)
async def get_system_service_watcher_runs(
    service_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    _: dict[str, Any] = Depends(require_admin),
) -> list[WatcherRunResponse]:
    """Return watcher run history for a system service."""
    svc = await firestore_client.get_service(service_id)
    if svc is None or not svc.get("is_system"):
        raise HTTPException(status_code=404, detail="System service not found")
    docs = await firestore_client.list_watcher_runs(service_id, limit)
    return [_to_watcher_run_response(d) for d in docs]


@router.post(
    "/system-services/{service_id}/haunt",
    status_code=200,
)
async def resume_haunting(
    service_id: str,
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    """Reset a completed system service back to haunting phase.

    Clears the clean-run counter so the watcher picks it up on the next
    scheduler tick and runs indefinitely (no auto-completion for system services).
    """
    svc = await firestore_client.get_service(service_id)
    if svc is None or not svc.get("is_system"):
        raise HTTPException(status_code=404, detail="System service not found")
    if svc.get("phase") not in ("completed", "ready", "error"):
        raise HTTPException(
            status_code=409,
            detail=f"Service is in phase '{svc.get('phase')}', nothing to resume.",
        )
    await firestore_client.update_service_phase(
        service_id, "haunting", extra={"clean_watcher_runs": 0}
    )
    return {"service_id": service_id, "phase": "haunting"}


@router.post(
    "/system-services/{service_id}/learn",
    status_code=202,
)
async def trigger_system_service_learning(
    service_id: str,
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    """Kick off the Learner agent for a system service."""
    svc = await firestore_client.get_service(service_id)
    if svc is None or not svc.get("is_system"):
        raise HTTPException(status_code=404, detail="System service not found")

    await firestore_client.update_service_phase(
        service_id, "learning", extra={"error_message": None}
    )
    asyncio.create_task(
        _run_system_learning(
            service_id=service_id,
            service_name=svc["service_name"],
            dynatrace_entity_id=svc["dynatrace_entity_id"],
        )
    )
    return {"status": "accepted", "service_id": service_id}


@router.post(
    "/system-services/{service_id}/cutover",
    response_model=CutoverResponse,
)
async def cutover_system_service(
    service_id: str,
    payload: CutoverRequest,
    _: dict[str, Any] = Depends(require_admin),
) -> CutoverResponse:
    """Transition a system service to haunting phase and activate the Watcher."""
    svc = await firestore_client.get_service(service_id)
    if svc is None or not svc.get("is_system"):
        raise HTTPException(status_code=404, detail="System service not found")

    cutover_time = payload.cutover_time or datetime.now(dt.UTC)
    await firestore_client.update_service_phase(
        service_id,
        phase="haunting",
        extra={
            "replacement_service_id": payload.replacement_service_id,
            "cutover_time": cutover_time.isoformat(),
        },
    )
    return CutoverResponse(
        service_id=service_id,
        replacement_service_id=payload.replacement_service_id,
        cutover_time=cutover_time,
        watcher_activated=True,
    )


@router.post(
    "/system-services/{service_id}/record-deployment",
    response_model=RecordDeploymentResponse,
    status_code=200,
)
async def record_system_service_deployment(
    service_id: str,
    payload: RecordDeploymentRequest,
    _: dict[str, Any] = Depends(require_admin),
) -> RecordDeploymentResponse:
    """Record a deployment event for a system service.

    Idempotent: if a record with the same commit SHA (or same calendar date when
    no SHA is given) already exists, the existing record is returned unchanged.

    If GITHUB_TOKEN and a repo are configured and no manual metric values are
    provided, real commit/PR/line-change data is fetched from the GitHub API.
    """
    svc = await firestore_client.get_service(service_id)
    if svc is None or not svc.get("is_system"):
        raise HTTPException(status_code=404, detail="System service not found")

    deployed_at = payload.deployed_at or datetime.now(dt.UTC)

    # Deterministic document ID prevents duplicates on repeated calls.
    if payload.commit_sha:
        doc_id = f"deploy-{service_id[:8]}-{payload.commit_sha[:12]}"
    else:
        doc_id = f"deploy-{service_id[:8]}-{deployed_at.strftime('%Y%m%d')}"

    db = firestore_client.get_db()

    # Return early if the record already exists.
    existing_snap = await db.collection("deployment_metrics").document(doc_id).get()
    if existing_snap.exists:
        d = existing_snap.to_dict() or {}
        return RecordDeploymentResponse(
            deployment_id=doc_id,
            service_id=service_id,
            service_name=d.get("service_name", svc.get("service_name", service_id)),
            deployed_at=_parse_admin_dt(d.get("deployed_at", deployed_at.isoformat())),
            commits=d.get("commits", 0),
            pull_requests=d.get("pull_requests", 0),
            lines_added=d.get("lines_added", 0),
            lines_removed=d.get("lines_removed", 0),
            github_repo=d.get("github_repo", ""),
            already_existed=True,
        )

    # Resolve the GitHub repo to use.
    from app.config import settings as _settings
    repo = payload.github_repo or svc.get("github_repo") or _settings.github_repo

    # Fetch live metrics from GitHub when token + repo are available and the
    # caller hasn't supplied manual overrides.
    commits = payload.commits
    pull_requests = payload.pull_requests
    lines_added = payload.lines_added
    lines_removed = payload.lines_removed

    if repo and _settings.github_token and any(
        v is None for v in [commits, pull_requests, lines_added, lines_removed]
    ):
        from app.github_client import fetch_deployment_metrics as _fetch_gh
        _since = _parse_admin_dt(
            svc.get("last_deployment_at") or svc.get("created_at") or deployed_at.isoformat()
        )
        try:
            _metrics = await _fetch_gh(
                repo=repo, since=_since, token=_settings.github_token
            )
            commits       = commits       if commits       is not None else _metrics["commits"]
            pull_requests = (
                pull_requests if pull_requests is not None else _metrics["pull_requests"]
            )
            lines_added   = lines_added   if lines_added   is not None else _metrics["lines_added"]
            lines_removed = (
                lines_removed if lines_removed is not None else _metrics["lines_removed"]
            )
        except Exception:
            commits       = commits       or 0
            pull_requests = pull_requests or 0
            lines_added   = lines_added   or 0
            lines_removed = lines_removed or 0
    else:
        commits       = commits       or 0
        pull_requests = pull_requests or 0
        lines_added   = lines_added   or 0
        lines_removed = lines_removed or 0

    record: dict[str, Any] = {
        "service_id":      service_id,
        "service_name":    svc.get("service_name", service_id),
        "deployed_at":     deployed_at.isoformat(),
        "commits":         commits,
        "pull_requests":   pull_requests,
        "lines_added":     lines_added,
        "lines_removed":   lines_removed,
        "github_repo":     repo or "",
        "commit_sha":      payload.commit_sha or "",
    }
    await firestore_client.save_deployment_metrics(doc_id, record)

    # Stamp last_deployment_at so the next call measures the right window.
    await firestore_client.update_service_phase(
        service_id,
        svc.get("phase", "haunting"),
        extra={"last_deployment_at": deployed_at.isoformat()},
    )

    return RecordDeploymentResponse(
        deployment_id=doc_id,
        service_id=service_id,
        service_name=record["service_name"],
        deployed_at=deployed_at,
        commits=commits,
        pull_requests=pull_requests,
        lines_added=lines_added,
        lines_removed=lines_removed,
        github_repo=repo or "",
        already_existed=False,
    )


@router.delete(
    "/system-services/{service_id}",
    status_code=200,
)
async def delete_system_service(
    service_id: str,
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    """Delete a system service and all associated data (contracts, ghost reports, watcher runs)."""
    svc = await firestore_client.get_service(service_id)
    if svc is None or not svc.get("is_system"):
        raise HTTPException(status_code=404, detail="System service not found")
    result = await firestore_client.delete_service_cascade(service_id)
    return {"service_id": service_id, **result}


@router.get("/agent-observability")
async def get_agent_observability(
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    """Return token spend and cost data for both the karma ADK agents and Claude Code sessions.

    Queries Dynatrace Grail for real OTel gen_ai span data when DT_QUERY_TOKEN is set.
    Falls back to Firestore-aggregated investigation costs otherwise.
    """
    from app.config import settings as _settings
    from app.dt_client import query_grail

    grail_ok = bool(_settings.dt_env and _settings.dt_query_token)

    # ── ADK agents (karma-agent-system) ──────────────────────────────────────
    karma_input = karma_output = karma_spans = 0
    karma_from_grail = False

    if grail_ok:
        dql_karma = (
            "fetch spans, from:now()-30d\n"
            '| filter service.name == "karma-agent-system"\n'
            "| filter isNotNull(gen_ai.usage.input_tokens)\n"
            "| summarize\n"
            "    input_tokens  = sum(toLong(gen_ai.usage.input_tokens)),\n"
            "    output_tokens = sum(toLong(gen_ai.usage.output_tokens)),\n"
            "    span_count    = count()"
        )
        rows = await query_grail(dql_karma, time_from="now()-30d")
        if rows:
            r = rows[0]
            karma_input   = int(r.get("input_tokens")  or 0)
            karma_output  = int(r.get("output_tokens") or 0)
            karma_spans   = int(r.get("span_count")    or 0)
            karma_from_grail = True

    # Fall back to Firestore investigation-engine totals when Grail is unavailable
    if not karma_from_grail:
        inv_stats = await firestore_client.get_investigation_engine_stats()
        agg = inv_stats.get("aggregate", {})
        karma_input  = agg.get("total_input_tokens", 0) or 0
        karma_output = agg.get("total_output_tokens", 0) or 0
        karma_spans  = agg.get("total_reports", 0) or 0

    # ── Claude Code dev sessions (claude-code-dev) ───────────────────────────
    cc_input = cc_output = cc_sessions = 0
    cc_from_grail = False

    if grail_ok:
        dql_cc = (
            "fetch spans, from:now()-30d\n"
            '| filter service.name == "claude-code-dev"\n'
            "| filter isNotNull(gen_ai.usage.input_tokens)\n"
            "| summarize\n"
            "    input_tokens  = sum(toLong(gen_ai.usage.input_tokens)),\n"
            "    output_tokens = sum(toLong(gen_ai.usage.output_tokens)),\n"
            "    span_count    = count()"
        )
        cc_rows = await query_grail(dql_cc, time_from="now()-30d")
        if cc_rows:
            cr = cc_rows[0]
            cc_input    = int(cr.get("input_tokens")  or 0)
            cc_output   = int(cr.get("output_tokens") or 0)
            cc_sessions = int(cr.get("span_count")    or 0)
            cc_from_grail = True

    # Cost estimates (Gemini 2.5 Pro: ~$2.50/1M in, $10/1M out;
    #                 Claude Sonnet 4.6: ~$3/1M in, $15/1M out)
    karma_cost = (karma_input / 1_000_000 * 2.50) + (karma_output / 1_000_000 * 10.0)
    cc_cost    = (cc_input    / 1_000_000 * 3.00) + (cc_output    / 1_000_000 * 15.0)

    return {
        "grail_configured": grail_ok,
        "karma_agents": {
            "service_name":   "karma-agent-system",
            "description":    "ADK multi-agent system (Coordinator · Learner · Watcher · Forensic)",
            "model":          "Gemini 2.5 Pro (Vertex AI)",
            "span_count":     karma_spans,
            "input_tokens":   karma_input,
            "output_tokens":  karma_output,
            "total_tokens":   karma_input + karma_output,
            "cost_usd":       round(karma_cost, 4),
            "from_grail":     karma_from_grail,
        },
        "claude_code": {
            "service_name":   "claude-code-dev",
            "description":    "Claude Code sessions that built this monitoring system",
            "model":          "Claude Sonnet 4.6 (Anthropic)",
            "span_count":     cc_sessions,
            "input_tokens":   cc_input,
            "output_tokens":  cc_output,
            "total_tokens":   cc_input + cc_output,
            "cost_usd":       round(cc_cost, 4),
            "from_grail":     cc_from_grail,
            "note":           (
                None if cc_from_grail
                else "Claude Code telemetry not yet emitting gen_ai spans to this DT environment"
            ),
        },
    }


@router.get("/investigation-engine")
async def get_investigation_engine(
    user_id: str | None = Query(default=None, description="Filter by a specific Firebase UID"),
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    """AI Investigation Engine: per-user ghost report forensics and AI spend summary."""
    return await firestore_client.get_investigation_engine_stats(user_id_filter=user_id)


async def _run_system_learning(
    service_id: str,
    service_name: str,
    dynatrace_entity_id: str,
) -> None:
    try:
        result = await agent_client.trigger_learning(
            service_id=service_id,
            service_name=service_name,
            dynatrace_entity_id=dynatrace_entity_id,
            learning_window_days=14,
        )
        if result.get("status") == "error":
            msg = result.get("message", "Agent invocation failed")
            await firestore_client.update_service_phase(
                service_id, "error", extra={"error_message": msg}
            )
        else:
            await firestore_client.update_service_phase(service_id, "ready")
    except Exception as exc:
        await firestore_client.update_service_phase(
            service_id, "error", extra={"error_message": str(exc)}
        )


def _parse_admin_dt(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value))


def _to_system_response(data: dict[str, Any]) -> SystemServiceResponse:
    return SystemServiceResponse(
        service_id=data["service_id"],
        service_name=data["service_name"],
        dynatrace_entity_id=data["dynatrace_entity_id"],
        replacement_service_id=data.get("replacement_service_id"),
        phase=data.get("phase", "registered"),
        error_message=data.get("error_message"),
        description=data.get("description"),
        url=data.get("url"),
        is_system=data.get("is_system", True),
        created_at=data["created_at"],
        updated_at=data["updated_at"],
    )


def _to_contract_response(doc: dict[str, Any]) -> ContractResponse:
    ts_raw = doc.get("saved_at") or doc.get("detected_at") or datetime.utcnow().isoformat()
    return ContractResponse(
        contract_id=doc["contract_id"],
        service_id=doc.get("service_id") or doc.get("karma_service_id", ""),
        category=doc["category"],
        subcategory=doc["subcategory"],
        description=doc["description"],
        confidence=doc["confidence"],
        validated=doc.get("validated", False),
        detected_at=datetime.fromisoformat(str(ts_raw)),
    )


def _to_ghost_response(doc: dict[str, Any]) -> GhostReportResponse:
    return GhostReportResponse(
        report_id=doc["report_id"],
        violation_id=doc["violation_id"],
        contract_id=doc.get("contract", {}).get("contract_id", ""),
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
        created_at=datetime.fromisoformat(
            str(doc.get("created_at") or doc["saved_at"])
        ),
    )


def _to_watcher_run_response(doc: dict[str, Any]) -> WatcherRunResponse:
    return WatcherRunResponse(
        run_id=doc["run_id"],
        service_id=doc["service_id"],
        service_name=doc.get("service_name"),
        run_at=datetime.fromisoformat(str(doc["run_at"])),
        contracts_checked=doc.get("contracts_checked", 0),
        violations_found=doc.get("violations_found", 0),
        duration_seconds=doc.get("duration_seconds"),
    )
