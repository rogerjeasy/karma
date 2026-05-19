"""Agent Engine client — sends tasks to the Karma agent system.

Uses the Vertex AI SDK to invoke the deployed AdkApp on Agent Engine.
"""
from __future__ import annotations

from typing import Any

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
            "karma_service_id": service_id,   # UUID for Firestore dashboard queries
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
        import vertexai
        from vertexai.preview import reasoning_engines

        vertexai.init(project=settings.gcp_project_id, location=settings.gcp_location)
        engine = reasoning_engines.ReasoningEngine(resource_name)
        result = engine.query(input={"task": task, **payload})  # type: ignore[attr-defined]
        log.info("agent_invoked", status="ok")
        return {"status": "ok", "result": result}
    except Exception as exc:
        log.error("agent_invocation_failed", error=str(exc))
        return {"status": "error", "message": str(exc)}
