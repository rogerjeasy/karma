"""Agent Engine client — sends tasks to the Karma agent system.

ADK v1.0 AdkApp exposes stream_query, not query. Calling :query returns
"Default method query not found". We use the :streamQuery endpoint (v1beta1)
via httpx streaming, consuming the full event stream so the agent runs to
completion and writes results (contracts, ghost reports) to Firestore.
"""
from __future__ import annotations

import contextlib
import json
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
    user_context: dict[str, Any] | None = None,
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
        user_context=user_context,
    )


async def trigger_watcher(
    old_service_id: str,
    new_service_id: str,
    contracts: list[dict[str, Any]],
    karma_service_id: str,
    user_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Dispatch a check_contracts task to the Coordinator agent."""
    return await _invoke_agent(
        task="check_contracts",
        payload={
            "service_id": old_service_id,
            "new_service_id": new_service_id,
            "karma_service_id": karma_service_id,
            "contracts": contracts,
            "check_window_minutes": 15,
        },
        user_context=user_context,
    )


async def trigger_forensic(
    violation_id: str,
    contract: dict[str, Any],
    new_service_id: str,
    violation_window: dict[str, Any],
    karma_service_id: str,
    user_context: dict[str, Any] | None = None,
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
        user_context=user_context,
    )


async def _invoke_agent(
    task: str,
    payload: dict[str, Any],
    user_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    resource_name = settings.agent_engine_resource_name
    if not resource_name:
        logger.warning("agent_engine_not_configured", task=task)
        return {"status": "skipped", "reason": "AGENT_ENGINE_RESOURCE_NAME not set"}

    log = logger.bind(task=task, resource_name=resource_name)
    log.info("invoking_agent")

    try:
        token = _get_access_token()
        # ADK v1.0 AdkApp exposes stream_query (not query).
        # :streamQuery (v1beta1) maps to stream_query() and returns SSE events.
        url = (
            f"https://{settings.gcp_location}-aiplatform.googleapis.com"
            f"/v1beta1/{resource_name}:streamQuery"
        )
        headers: dict[str, str] = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        # Propagate the active OTel trace context so Dynatrace links the API span
        # to the agent spans as one end-to-end distributed trace.
        try:
            from opentelemetry.propagate import inject as _inject
            _inject(headers)
        except Exception:
            pass
        # stream_query signature: user_id, message [, session_id]
        # session_id is optional — ADK creates an ephemeral one automatically.
        # The coordinator LLM is instructed to inspect the "task" field.
        # _karma_user_ctx is read by otel_callbacks._before_agent to set
        # session.id / user.id / user.email / organization.id on spans.
        uctx = user_context or {}
        adk_user_id = uctx.get("user_id") or "karma-api"
        message_body = {
            "task": task,
            **payload,
            "_karma_user_ctx": {
                "user_id": uctx.get("user_id", ""),
                "user_email": uctx.get("user_email", ""),
                "organization_id": uctx.get("organization_id", "karma"),
            },
        }
        body: dict[str, Any] = {
            "input": {
                "user_id": adk_user_id,
                "message": json.dumps(message_body),
            }
        }

        events: list[dict[str, Any]] = []
        async with httpx.AsyncClient(timeout=300.0) as client, client.stream(
            "POST", url, json=body, headers=headers
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                line = line.strip()
                if not line:
                    continue
                # Vertex AI SSE lines are prefixed with "data: "
                if line.startswith("data: "):
                    line = line[6:]
                with contextlib.suppress(json.JSONDecodeError):
                    events.append(json.loads(line))

        result = _extract_result(events)
        log.info("agent_invoked", status="ok", event_count=len(events))
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


def _extract_result(events: list[dict[str, Any]]) -> dict[str, Any]:
    """Parse the coordinator's final JSON response out of the ADK event stream.

    ADK events look like:
      {"author": "karma_coordinator", "content": {"parts": [{"text": "..."}]}, "partial": false}

    We scan in reverse for the last complete (partial=False) event from the
    coordinator that contains parseable JSON.
    """
    for event in reversed(events):
        if event.get("partial") is not False:
            continue
        content = event.get("content") or {}
        for part in content.get("parts") or []:
            text = (part.get("text") or "").strip()
            if not text:
                continue
            # Strip markdown code fences (```json ... ```)
            if text.startswith("```"):
                lines = text.splitlines()
                inner = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
                text = "\n".join(inner).strip()
            try:
                parsed = json.loads(text)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass
    return {}


def _get_access_token() -> str:
    """Return a fresh ADC Bearer token for the Vertex AI API."""
    import google.auth
    import google.auth.transport.requests

    creds, _ = google.auth.default(
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    creds.refresh(google.auth.transport.requests.Request())  # type: ignore[no-untyped-call]
    return creds.token  # type: ignore[return-value]
