"""Forensic agent — composes evidence-grounded ghost reports.

Triggered by the Watcher when a contract violation predicate has failed for
the configured tolerance window. Pulls deep Dynatrace context and produces a
structured GhostReport, then emits a BizEvent for self-observability.

Uses execute_dql for raw telemetry queries and MCP gateway tools for
AI-powered Davis problem analysis, changepoint detection, entity resolution,
and documentation lookup — the combination that distinguishes engineered
forensics from basic log scanning.

New in this version:
- ask_dynatrace_docs_via_mcp / find_troubleshooting_guides_via_mcp: Davis AI
  documentation lookup for remediation guidance.
- get_session_cost_estimate: records the operational cost of this investigation
  in the ghost report (token count + USD estimate).
- push_ghost_report_to_dynatrace: creates a bidirectional link by posting a
  CUSTOM_ANNOTATION event to the Dynatrace service timeline.
"""
from __future__ import annotations

from pathlib import Path

from google.adk.agents import Agent

from karma.config import settings
from karma.otel_callbacks import make_telemetry_callbacks
from karma.tools.dynatrace_api_tools import execute_dql
from karma.tools.dynatrace_events import emit_karma_event
from karma.tools.dynatrace_problems import (
    get_session_cost_estimate,
    push_ghost_report_to_dynatrace,
)
from karma.tools.firestore_tools import save_ghost_report_to_firestore
from karma.tools.mcp_gateway_tools import (
    ask_dynatrace_docs_via_mcp,
    create_dynatrace_notebook_via_mcp,
    create_workflow_for_notification_via_mcp,
    detect_changepoints_via_mcp,
    find_troubleshooting_guides_via_mcp,
    get_entity_name_via_mcp,
    get_problem_details_via_mcp,
    list_problems_via_mcp,
    query_problems_via_mcp,
    send_email_via_mcp,
    send_event_via_mcp,
    send_slack_message_via_mcp,
)

_SYSTEM_PROMPT_PATH = Path(__file__).parent / "prompts" / "forensic_system.md"


def create_forensic_agent() -> Agent:
    system_prompt = _SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")

    return Agent(
        name="karma_forensic",
        model=settings.model_pro,
        description=(
            "Deep-investigation agent. Triggered on contract violations; "
            "pulls trace + log context, runs Davis AI root-cause analysis, "
            "assesses downstream impact, estimates investigation cost and avoided-incident savings, "
            "produces structured ghost reports, creates Dynatrace Notebooks and Workflows, "
            "sends Slack/email notifications for HIGH+CRITICAL reports, "
            "and pushes annotations back to the Dynatrace service timeline."
        ),
        instruction=system_prompt,
        tools=[
            # Direct Dynatrace API — raw Grail queries
            execute_dql,
            # Dynatrace MCP gateway — Davis AI analysis, changepoints, entity resolution
            query_problems_via_mcp,
            list_problems_via_mcp,
            get_problem_details_via_mcp,
            get_entity_name_via_mcp,
            detect_changepoints_via_mcp,
            # Dynatrace MCP gateway — Davis AI documentation + remediation guidance
            ask_dynatrace_docs_via_mcp,
            find_troubleshooting_guides_via_mcp,
            # Dynatrace MCP gateway — timeline events, notebooks, workflows, notifications
            send_event_via_mcp,
            create_dynatrace_notebook_via_mcp,
            create_workflow_for_notification_via_mcp,
            send_slack_message_via_mcp,
            send_email_via_mcp,
            # Session telemetry — operational cost of this investigation
            get_session_cost_estimate,
            # Persistence and self-observability
            emit_karma_event,
            save_ghost_report_to_firestore,
            # Bidirectional Dynatrace integration — push annotation to service timeline
            push_ghost_report_to_dynatrace,
        ],
        **make_telemetry_callbacks("karma_forensic", settings.model_pro),
    )
