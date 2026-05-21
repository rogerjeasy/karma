"""Pub/Sub tools for the Watcher agent.

The Watcher publishes violation candidates to the karma-violations topic so
the Forensic agent can be triggered asynchronously and independently of the
Watcher's run window.

Architecture:
  Watcher agent (every 10 min)
    → publish_violation_to_pubsub(violation)
      → Pub/Sub topic: karma-violations
        → Cloud Run push subscription: POST /internal/violation-received
          → triggers Forensic agent

The topic is created by Terraform (infrastructure/terraform/main.tf).
"""
from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any

import structlog

from karma.config import settings

logger = structlog.get_logger(__name__)

_VIOLATIONS_TOPIC = "karma-violations"


def publish_violation_to_pubsub(
    contract_id: str,
    karma_service_id: str,
    new_service_id: str,
    contract: dict[str, Any],
    predicate_dql: str,
    raw_dql_result: dict[str, Any],
    related_davis_problem_id: str | None = None,
) -> dict[str, Any]:
    """Publish a contract violation to the karma-violations Pub/Sub topic.

    Call this for each violation where needs_forensic=True. The API subscriber
    at POST /internal/violation-received will pick it up and trigger the
    Forensic agent asynchronously.

    Args:
        contract_id: UUID of the violated contract.
        karma_service_id: Karma service UUID (not the Dynatrace entity ID).
        new_service_id: Dynatrace entity ID of the replacement service.
        contract: Full contract object from Memory Bank or task payload.
        predicate_dql: The DQL that was evaluated and failed.
        raw_dql_result: The raw result from execute_dql for the predicate.
        related_davis_problem_id: Davis problem ID if query_problems_via_mcp
            returned a related active problem.

    Returns:
        {"published": True, "message_id": "<id>", "violation_id": "<uuid>"}
        {"published": False, "error": "<reason>"}
    """
    if not settings.gcp_project_id:
        return {"published": False, "error": "GCP_PROJECT_ID not configured"}

    violation_id = str(uuid.uuid4())
    message: dict[str, Any] = {
        "violation_id": violation_id,
        "contract_id": contract_id,
        "karma_service_id": karma_service_id,
        "new_service_id": new_service_id,
        "contract": contract,
        "predicate_dql": predicate_dql,
        "raw_dql_result": raw_dql_result,
        "related_davis_problem_id": related_davis_problem_id,
        "published_at": datetime.now(UTC).isoformat(),
    }

    try:
        from google.cloud import pubsub_v1  # type: ignore[attr-defined]

        publisher = pubsub_v1.PublisherClient()
        topic_path = publisher.topic_path(settings.gcp_project_id, _VIOLATIONS_TOPIC)

        future = publisher.publish(
            topic_path,
            data=json.dumps(message).encode("utf-8"),
            karma_service_id=karma_service_id,
            contract_id=contract_id,
            violation_id=violation_id,
        )
        message_id = future.result(timeout=10.0)
        logger.info(
            "violation_published",
            message_id=message_id,
            violation_id=violation_id,
            contract_id=contract_id,
        )
        return {"published": True, "message_id": message_id, "violation_id": violation_id}

    except Exception as exc:
        logger.warning("violation_publish_failed", contract_id=contract_id, error=str(exc))
        return {"published": False, "error": str(exc), "violation_id": violation_id}
