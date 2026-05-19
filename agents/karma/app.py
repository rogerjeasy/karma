"""AdkApp entry point — wires Memory Bank and exposes the Karma agent system.

This module is the deployment unit for Agent Engine. It instantiates the
coordinator agent with Memory Bank attached and exports the `app` object
that Agent Engine's long-running runtime expects.
"""
from __future__ import annotations

import vertexai
from google.adk.app import AdkApp
from google.adk.memory import VertexAiMemoryBankService

from karma.config import settings
from karma.coordinator import create_coordinator_agent

vertexai.init(project=settings.gcp_project_id, location=settings.gcp_location)

_memory_service = VertexAiMemoryBankService(
    project=settings.gcp_project_id,
    location=settings.gcp_location,
    agent_engine_id=settings.memory_bank_id or None,
)

_coordinator = create_coordinator_agent()

app = AdkApp(
    agent=_coordinator,
    memory_service=_memory_service,
    enable_tracing=True,
)
