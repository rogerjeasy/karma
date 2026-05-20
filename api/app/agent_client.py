"""Agent Engine client — sends tasks to the Karma agent system.

Calls the Vertex AI Agent Engine REST API directly instead of using the
Python SDK's dynamic method discovery, which fails on ADK v1.0 apps that
register an 'async' operation mode the SDK does not support.
"""
from __future__ import annotations

from typing import Any

import httpx
import structlog

from app.config import settings

logger = structlog.get_logger(__name__)


async def trigger_learning(
    service_id: str,
    service_name: str,
    dynatrace_entity_id: str,
    learning_window_days: int = 14,
) -> dict[str, Any]:
    """Dispatch a begin_learning task to the Coordinator agent."""
    return await _invoke_agent(
        task="begin_learning",
        payload={
            "service_id": dynatrace_entity_id,
            "karma_service_id": service_id,
            "service_name": service_name,
            "learning_window_days": learning_window_days,
        },
    )


async def trigger_watcher(
    old_service_id: str,
    new_service_id: str,
    contracts: list[dict[str, Any]],
    karma_service_id: str,
) -> dict[str, Any]:
    """Dispatch a check_contracts task to the Coordinator agent."""
    return await _invoke_agent(
        task="check_contracts",
        payload={
            "service_id": old_service_id,
            "replacement_service_id": new_service_id,
            "karma_service_id": karma_service_id,
            "contracts": contracts,
        },
    )


async def trigger_forensic(
    violation_id: str,
    contract: dict[str, Any],
    new_service_id: str,
    violation_window: dict[str, Any],
    karma_service_id: str,
) -> dict[str, Any]:
    """Dispatch a run_forensic task to the Coordinator agent."""
    return await _invoke_agent(
        task="run_forensic",
        payload={
            "violation_id": violation_id,
            "contract": contract,
            "new_service_id": new_service_id,
            "violation_window": violation_window,
            "karma_service_id": karma_service_id,
        },
    )


async def _invoke_agent(task: str, payload: dict[str, Any]) -> dict[str, Any]:
    resource_name = settings.agent_engine_resource_name
    if not resource_name:
        logger.warning("agent_engine_not_configured", task=task)
        return {"status": "skipped", "reason": "AGENT_ENGINE_RESOURCE_NAME not set"}

    log = logger.bind(task=task, resource_name=resource_name)
    log.info("invoking_agent")

    try:
        token = _get_access_token()
        url = (
            f"https://{settings.gcp_location}-aiplatform.googleapis.com"
            f"/v1/{resource_name}:query"
        )
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        body: dict[str, Any] = {"input": {"task": task, **payload}}

        # Agent Engine calls are long-running (LLM inference) — generous timeout.
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(url, json=body, headers=headers)
            resp.raise_for_status()
            result = resp.json()

        log.info("agent_invoked", status="ok")
        return {"status": "ok", "result": result}

    except httpx.HTTPStatusError as exc:
        log.error(
            "agent_invocation_http_error",
            status_code=exc.response.status_code,
            detail=exc.response.text[:500],
        )
        return {
            "status": "error",
            "message": f"HTTP {exc.response.status_code}: {exc.response.text[:200]}",
        }
    except Exception as exc:
        log.error("agent_invocation_failed", error=str(exc))
        return {"status": "error", "message": str(exc)}


def _get_access_token() -> str:
    """Return a fresh ADC Bearer token for the Vertex AI API."""
    import google.auth
    import google.auth.transport.requests

    creds, _ = google.auth.default(
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    creds.refresh(google.auth.transport.requests.Request())  # type: ignore[no-untyped-call]
    return creds.token  # type: ignore[return-value]
