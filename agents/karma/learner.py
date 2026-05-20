"""Learner agent — discovers implicit contracts from service telemetry.

Phase 1 of Karma. Runs during the deprecation window and learns the
undocumented behaviors of the old service.

Uses both direct Dynatrace API calls (execute_dql) and the Dynatrace MCP
gateway tools (mcp_gateway_tools) to cover the full analysis surface:
- execute_dql: raw Grail queries for spans, logs, metrics, events
- MCP tools: Davis AI problems, changepoint detection, anomaly detection,
  entity resolution — capabilities unique to the Dynatrace MCP server
"""
from __future__ import annotations

from pathlib import Path

from google.adk.agents import Agent

from karma.config import settings
from karma.tools.contract_validator_tool import validate_contract_predicate
from karma.tools.dynatrace_api_tools import execute_dql
from karma.tools.dynatrace_events import emit_karma_event
from karma.tools.firestore_tools import save_contracts_to_firestore
from karma.tools.mcp_gateway_tools import (
    adaptive_anomaly_detection_via_mcp,
    detect_changepoints_via_mcp,
    get_entity_id_via_mcp,
    get_entity_name_via_mcp,
)

_SYSTEM_PROMPT_PATH = Path(__file__).parent / "prompts" / "learner_system.md"


def create_learner_agent() -> Agent:
    system_prompt = _SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")

    return Agent(
        name="karma_learner",
        model=settings.model_pro,
        description=(
            "Discovers implicit behavioral contracts from a service's Dynatrace "
            "telemetry. Covers latency, error semantics, throughput, side effects, "
            "timing, dependency, resource, and sequencing contracts."
        ),
        instruction=system_prompt,
        tools=[
            # Direct Dynatrace API — raw Grail queries
            execute_dql,
            # Dynatrace MCP gateway — AI-powered analysis agents
            get_entity_id_via_mcp,
            get_entity_name_via_mcp,
            detect_changepoints_via_mcp,
            adaptive_anomaly_detection_via_mcp,
            # Contract quality gate — runs predicate against historical data
            validate_contract_predicate,
            # Persistence and self-observability
            emit_karma_event,
            save_contracts_to_firestore,
        ],
    )
