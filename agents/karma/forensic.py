"""Forensic agent — composes evidence-grounded ghost reports.

Triggered by the Watcher when a contract violation predicate has failed for
the configured tolerance window. Pulls deep Dynatrace context and produces a
structured GhostReport, then emits a BizEvent for self-observability.

The agent receives the full Dynatrace MCP toolset so it can use any
investigation capability the server provides. System prompt governs usage.
"""
from __future__ import annotations

from pathlib import Path

from google.adk.agents import Agent

from karma.config import settings
from karma.tools.dynatrace_events import emit_karma_event
from karma.tools.dynatrace_mcp import build_dynatrace_toolset
from karma.tools.firestore_tools import save_ghost_report_to_firestore

_SYSTEM_PROMPT_PATH = Path(__file__).parent / "prompts" / "forensic_system.md"


def create_forensic_agent() -> Agent:
    system_prompt = _SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")

    return Agent(
        name="karma-forensic",
        model=settings.model_pro,
        description=(
            "Deep-investigation agent. Triggered on contract violations; "
            "pulls trace + log context, assesses downstream impact, and "
            "produces structured ghost reports with linked Dynatrace evidence. "
            "Emits a BizEvent to Dynatrace after each report for auditability."
        ),
        instruction=system_prompt,
        tools=[
            build_dynatrace_toolset(),  # live, dynamic — full server toolset
            emit_karma_event,
            save_ghost_report_to_firestore,
        ],
    )
