"""Agent Engine entry point — exports the coordinator agent for deployment.

The deployment wrapper (vertexai.agent_engines.AdkApp) is constructed in the
CI deploy script so this module has no Vertex AI SDK imports at module level.
"""
from __future__ import annotations

from karma.coordinator import create_coordinator_agent

app = create_coordinator_agent()
