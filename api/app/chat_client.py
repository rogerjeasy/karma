"""Lightweight Gemini chat client for the constrained 'Ask Karma' feature.

This is intentionally NOT the Agent Engine multi-agent pipeline. It is a single
direct Gemini `generateContent` call over Vertex AI, grounded only in context the
caller already has (a persisted ghost report + its contract). No new DQL, no MCP,
no agent orchestration — cheap and fast, suitable for interactive Q&A.

Reuses the same httpx + ADC bearer-token transport as agent_client, so it adds no
new dependency and stays Gemini-only (the hackathon constraint).
"""
from __future__ import annotations

from typing import Any

import httpx
import structlog

from app.agent_client import _get_access_token
from app.config import settings

logger = structlog.get_logger(__name__)

_TIMEOUT = 30.0
_MAX_OUTPUT_TOKENS = 768


async def ask_gemini(
    system_instruction: str,
    question: str,
    history: list[dict[str, str]] | None = None,
) -> str:
    """Return a grounded answer from Gemini Flash for a single question.

    Args:
        system_instruction: The grounding/system prompt (context + guardrails).
        question: The user's latest question.
        history: Prior turns as [{"role": "user"|"model", "text": "..."}], oldest first.

    Returns:
        The model's answer text, or a short error string the UI can display.
    """
    project = settings.gcp_project_id
    location = settings.gcp_location
    if not project:
        return "Chat is unavailable — the server has no GCP project configured."

    contents: list[dict[str, Any]] = []
    for turn in history or []:
        role = "model" if turn.get("role") == "model" else "user"
        text = (turn.get("text") or "").strip()
        if text:
            contents.append({"role": role, "parts": [{"text": text}]})
    contents.append({"role": "user", "parts": [{"text": question}]})

    url = (
        f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}"
        f"/locations/{location}/publishers/google/models/{settings.chat_model}:generateContent"
    )
    body: dict[str, Any] = {
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "contents": contents,
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": _MAX_OUTPUT_TOKENS,
        },
    }

    try:
        token = _get_access_token()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(url, json=body, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "chat_http_error",
            status=exc.response.status_code,
            detail=exc.response.text[:300],
        )
        return "Sorry — I couldn't reach the model just now. Please try again."
    except Exception as exc:
        logger.warning("chat_failed", error=str(exc))
        return "Sorry — something went wrong answering that. Please try again."

    return _extract_text(data) or "I don't have enough information in this report to answer that."


def _extract_text(data: dict[str, Any]) -> str:
    """Pull the concatenated text out of a generateContent response."""
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    parts = (candidates[0].get("content") or {}).get("parts") or []
    return "".join(p.get("text", "") for p in parts).strip()
