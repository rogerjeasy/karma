"""Global 'Ask Karma' console — natural-language Q&A over live Dynatrace telemetry.

Unlike the per-ghost ``/ghosts/{id}/ask`` (which reasons over one stored report),
this routes a free-form question through Davis CoPilot to generate real DQL, runs it
on Grail, and lets Gemini explain the result. It degrades to a contracts-grounded
answer when Davis CoPilot is not configured — so it always answers, and never
fabricates telemetry.

Flow:
    question
      → Davis CoPilot (MCP gateway)  → DQL          [dql_source="davis_copilot"]
      → Grail (dt_client.query_grail) → rows
      → Gemini (chat_client.ask_gemini) → grounded answer
    or, if Davis CoPilot unavailable:
      → Gemini grounded in the user's stored contracts + recent ghost reports
                                                       [dql_source="contracts"]
"""
from __future__ import annotations

import json
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException

from app import dt_copilot, firestore_client
from app.auth import get_current_user
from app.chat_client import ask_gemini
from app.config import settings
from app.dt_client import query_grail
from app.models import ConsoleAskRequest, ConsoleAskResponse

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/console", tags=["console"])

_MAX_ROWS_TO_MODEL = 40
_GRAIL_DAYS_BACK = 14

_TELEMETRY_PROMPT = """You are Karma, an SRE assistant. A user asked a question about service \
migrations and behavioral contracts. Davis CoPilot (Dynatrace's AI) translated it into the DQL \
query below, which was run against real Dynatrace Grail telemetry. The query result rows are \
provided as JSON.

Rules:
- Answer ONLY from the QUERY RESULT below. Use its real numbers verbatim.
- If the result is empty, say the telemetry returned no rows for that question and suggest a \
narrower or different question.
- Be concise and concrete (1-5 sentences). Do not invent data not present in the rows.
- You may reference the discovered contracts for context, but the live telemetry is authoritative.

DQL EXECUTED:
{dql}

QUERY RESULT (JSON rows):
{rows}

KNOWN CONTRACTS FOR CONTEXT (JSON, may be empty):
{contracts}
"""

_CONTRACTS_PROMPT = """You are Karma, an SRE assistant answering a question about service \
migrations. Live telemetry querying is not available right now, so answer from Karma's stored \
knowledge below: the behavioral contracts it has learned and the ghost reports (detected \
regressions) it has filed.

Rules:
- Answer ONLY from the CONTRACTS and GHOST REPORTS below. Use their real numbers verbatim.
- If the answer isn't in this data, say so plainly and suggest what to check in Dynatrace.
- Be concise and concrete (1-5 sentences). Never fabricate telemetry, services, or root causes.

CONTRACTS (JSON, may be empty):
{contracts}

RECENT GHOST REPORTS (JSON, may be empty):
{ghosts}
"""


def _slim_contracts(contracts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "category": c.get("category"),
            "subcategory": c.get("subcategory"),
            "description": c.get("description"),
            "confidence": c.get("confidence"),
            "validated": c.get("validated"),
        }
        for c in contracts[:20]
    ]


def _slim_ghosts(ghosts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "severity": g.get("severity"),
            "summary": g.get("summary"),
            "root_cause": g.get("root_cause"),
            "downstream_impact": g.get("downstream_impact"),
            "category": (g.get("contract") or {}).get("category"),
        }
        for g in ghosts[:10]
    ]


@router.post("/ask", response_model=ConsoleAskResponse)
async def ask_console(
    body: ConsoleAskRequest,
    user: dict[str, Any] = Depends(get_current_user),
) -> ConsoleAskResponse:
    """Answer a free-form question, preferring live Davis CoPilot → DQL → Grail."""
    contracts: list[dict[str, Any]] = []
    if body.service_id:
        svc = await firestore_client.get_service(body.service_id)
        if svc is None or svc.get("user_id") != user["uid"]:
            raise HTTPException(status_code=404, detail="Service not found")
        try:
            contracts = await firestore_client.list_contracts_for_service(body.service_id)
        except Exception as exc:  # noqa: BLE001 — context is optional
            logger.warning("console_contracts_failed", service_id=body.service_id, error=str(exc))

    history = [t.model_dump() for t in body.history]

    # ── Primary path: Davis CoPilot writes DQL, we run it live on Grail ──────────
    dql = await dt_copilot.nl_to_dql(body.question)
    if dql and dt_copilot.is_safe_read_dql(dql):
        rows = await query_grail(dql, days_back=_GRAIL_DAYS_BACK)
        system = _TELEMETRY_PROMPT.format(
            dql=dql,
            rows=json.dumps(rows[:_MAX_ROWS_TO_MODEL], default=str, indent=2),
            contracts=json.dumps(_slim_contracts(contracts), default=str),
        )
        answer = await ask_gemini(
            system_instruction=system, question=body.question, history=history
        )
        logger.info("console_answered", source="davis_copilot", rows=len(rows))
        return ConsoleAskResponse(
            answer=answer,
            dql=dql,
            dql_source="davis_copilot",
            row_count=len(rows),
            davis_available=True,
        )

    # ── Fallback: ground Gemini in stored contracts + recent ghost reports ───────
    try:
        ghosts = await firestore_client.list_ghost_reports(
            user_id=user["uid"], service_id=body.service_id, limit=10
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("console_ghosts_failed", error=str(exc))
        ghosts = []

    system = _CONTRACTS_PROMPT.format(
        contracts=json.dumps(_slim_contracts(contracts), default=str),
        ghosts=json.dumps(_slim_ghosts(ghosts), default=str),
    )
    answer = await ask_gemini(system_instruction=system, question=body.question, history=history)
    logger.info("console_answered", source="contracts", ghosts=len(ghosts))
    return ConsoleAskResponse(
        answer=answer,
        dql=None,
        dql_source="contracts",
        row_count=0,
        davis_available=settings.davis_copilot_enabled,
    )
