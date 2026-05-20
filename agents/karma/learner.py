"""Learner agent — discovers implicit contracts from service telemetry.

Phase 1 of Karma. Runs during the deprecation window and learns the
undocumented behaviors of the old service.

The agent receives the full Dynatrace MCP toolset (all tools the server
exposes) so it can use any analysis capability the server provides.
System prompt guides which tools are used and in what order.
"""
from __future__ import annotations

from pathlib import Path

from google.adk.agents import Agent

from karma.config import settings
from karma.tools.dynatrace_events import emit_karma_event
from karma.tools.dynatrace_mcp import build_dynatrace_toolset
from karma.tools.firestore_tools import save_contracts_to_firestore

_SYSTEM_PROMPT_PATH = Path(__file__).parent / "prompts" / "learner_system.md"


def create_learner_agent() -> Agent:
    system_prompt = _SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")

    return Agent(
        name="karma-learner",
        model=settings.model_pro,
        description=(
            "Discovers implicit behavioral contracts from a service's Dynatrace "
            "telemetry. Covers latency, error semantics, throughput, side effects, "
            "timing, dependency, resource, and sequencing contracts."
        ),
        instruction=system_prompt,
        tools=[
            build_dynatrace_toolset(),  # live, dynamic — full server toolset
            emit_karma_event,
            save_contracts_to_firestore,
        ],
    )
