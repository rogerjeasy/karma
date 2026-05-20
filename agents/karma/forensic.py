"""Forensic agent — composes evidence-grounded ghost reports.

Triggered by the Watcher when a contract violation predicate has failed for
the configured tolerance window. Pulls deep Dynatrace context and produces a
structured GhostReport, then emits a BizEvent for self-observability.

Uses execute_dql for raw telemetry queries and MCP gateway tools for
AI-powered Davis problem analysis, changepoint detection, and entity
resolution — the combination that distinguishes engineered forensics from
basic log scanning.
"""
from __future__ import annotations

from pathlib import Path

from google.adk.agents import Agent

from karma.config import settings
from karma.tools.dynatrace_api_tools import execute_dql
from karma.tools.dynatrace_events import emit_karma_event
from karma.tools.firestore_tools import save_ghost_report_to_firestore
from karma.tools.mcp_gateway_tools import (
    detect_changepoints_via_mcp,
    get_entity_name_via_mcp,
    get_problem_details_via_mcp,
    query_problems_via_mcp,
)

_SYSTEM_PROMPT_PATH = Path(__file__).parent / "prompts" / "forensic_system.md"


def create_forensic_agent() -> Agent:
    system_prompt = _SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")

    return Agent(
        name="karma_forensic",
        model=settings.model_pro,
        description=(
            "Deep-investigation agent. Triggered on contract violations; "
            "pulls trace + log context, assesses downstream impact, and "
            "produces structured ghost reports with linked Dynatrace evidence. "
            "Emits a BizEvent to Dynatrace after each report for auditability."
        ),
        instruction=system_prompt,
        tools=[
            # Direct Dynatrace API — raw Grail queries
            execute_dql,
            # Dynatrace MCP gateway — Davis AI and advanced analysis
            query_problems_via_mcp,
            get_problem_details_via_mcp,
            get_entity_name_via_mcp,
            detect_changepoints_via_mcp,
            # Persistence and self-observability
            emit_karma_event,
            save_ghost_report_to_firestore,
        ],
    )
