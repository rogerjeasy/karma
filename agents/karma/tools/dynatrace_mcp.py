"""Dynatrace MCP toolset factory.

HOW TOOL DISCOVERY WORKS
─────────────────────────
ADK's McpToolset connects to the Dynatrace hosted MCP gateway and calls
tools/list at initialisation time, fetching the live tool catalogue from the
server. The agent then sees exactly what the server exposes — no hardcoded
tool list, no client-side filtering. If Dynatrace adds or renames a tool,
agents pick it up automatically on the next deployment.

The TOOL_* constants and *_TOOLS frozensets below are *reference artefacts*
only — used by docs/DYNATRACE_SETUP.md, the verify-tools script, and system
prompts, never passed as a runtime filter to McpToolset.

TRANSPORT
─────────
Default: hosted gateway (StreamableHTTP + Platform Token Bearer auth).
Override: set DT_MCP_URL=stdio://localhost in .env to use the local
  npx @dynatrace-oss/dynatrace-mcp-server fallback instead.

URL DERIVATION
──────────────
All URLs come from settings (derived from DT_ENV) — nothing is hardcoded.
"""
from __future__ import annotations

import os

from google.adk.tools.mcp_tool.mcp_session_manager import (
    StreamableHTTPConnectionParams,
)
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset
from mcp import StdioServerParameters

from karma.config import settings

# ── Reference catalogue (from docs/dynatrace-mcp-info.md tools/list) ─────────
# These names document what the server exposes. They are NOT passed as
# runtime filters — agents see the live server toolset unconditionally.

TOOL_GRAIL_QUERY        = "create-dql"                         # Grail Query Agent
TOOL_DATA_ANALYSIS      = "execute-dql"                        # Data Analysis Agent
TOOL_DQL_EXPLAIN        = "explain-dql"                        # DQL Explanation Agent
TOOL_HELP               = "ask-dynatrace-docs"                 # Help Agent
TOOL_ROOT_CAUSE         = "query-problems"                     # Root Cause Agent
TOOL_ROOT_CAUSE_DETAILS = "get-problem-by-id"                  # Root Cause Details Agent
TOOL_VULNERABILITY      = "get-vulnerabilities"                # Vulnerability Agent
TOOL_KUBERNETES         = "get-events-for-kubernetes-cluster"  # Kubernetes Agent
TOOL_FORECAST           = "timeseries-forecast"                # Forecasting Agent
TOOL_CHANGEPOINT        = "timeseries-novelty-detection"       # Changepoint Agent
TOOL_ANOMALY_ADAPTIVE   = "adaptive-anomaly-detector"          # Autoadaptive Threshold Agent
TOOL_ANOMALY_SEASONAL   = "seasonal-baseline-anomaly-detector" # Seasonal Baseline Agent
TOOL_ANOMALY_STATIC     = "static-threshold-analyzer"         # Static Threshold Agent
TOOL_DOCUMENT           = "find-documents"                     # Document Agent
TOOL_TROUBLESHOOTING    = "find-troubleshooting-guides"        # Troubleshooting Agent
TOOL_SMARTSCAPE_ID      = "get-entity-id"                      # Smartscape Agent (name → ID)
TOOL_SMARTSCAPE_NAME    = "get-entity-name"                    # Smartscape Agent (ID → name)

# All known tools — used by the verify-tools script only
ALL_KNOWN_TOOLS: frozenset[str] = frozenset({
    TOOL_GRAIL_QUERY,
    TOOL_DATA_ANALYSIS,
    TOOL_DQL_EXPLAIN,
    TOOL_HELP,
    TOOL_ROOT_CAUSE,
    TOOL_ROOT_CAUSE_DETAILS,
    TOOL_VULNERABILITY,
    TOOL_KUBERNETES,
    TOOL_FORECAST,
    TOOL_CHANGEPOINT,
    TOOL_ANOMALY_ADAPTIVE,
    TOOL_ANOMALY_SEASONAL,
    TOOL_ANOMALY_STATIC,
    TOOL_DOCUMENT,
    TOOL_TROUBLESHOOTING,
    TOOL_SMARTSCAPE_ID,
    TOOL_SMARTSCAPE_NAME,
})

# Per-agent subsets — documentation only, describe intended usage, not filters
LEARNER_TOOLS: frozenset[str] = frozenset({
    TOOL_GRAIL_QUERY, TOOL_DATA_ANALYSIS, TOOL_SMARTSCAPE_ID,
    TOOL_SMARTSCAPE_NAME, TOOL_FORECAST, TOOL_CHANGEPOINT,
    TOOL_ANOMALY_ADAPTIVE, TOOL_ANOMALY_SEASONAL, TOOL_ANOMALY_STATIC,
    TOOL_KUBERNETES, TOOL_HELP,
})
WATCHER_TOOLS: frozenset[str] = frozenset({
    TOOL_DATA_ANALYSIS, TOOL_ROOT_CAUSE,
})
FORENSIC_TOOLS: frozenset[str] = frozenset({
    TOOL_DATA_ANALYSIS, TOOL_ROOT_CAUSE, TOOL_ROOT_CAUSE_DETAILS,
    TOOL_SMARTSCAPE_ID, TOOL_SMARTSCAPE_NAME, TOOL_VULNERABILITY,
    TOOL_HELP, TOOL_TROUBLESHOOTING, TOOL_DOCUMENT, TOOL_CHANGEPOINT,
})

# Alias kept for the verify-tools script
REQUIRED_TOOLS = ALL_KNOWN_TOOLS


def build_dynatrace_toolset() -> McpToolset:
    """Return an McpToolset connected to the live Dynatrace MCP server.

    The toolset performs tools/list against the server at initialisation and
    exposes the complete, up-to-date tool catalogue to the agent. No client-
    side filter is applied — the server is the single source of truth for
    what tools exist.

    System prompts on each agent guide which tools are used; the MCP
    connection ensures agents always have access to the full live toolset.
    """
    # Avoid calling dt_mcp_endpoint (which asserts DT_ENV) if dt_env is not set.
    # This lets Agent Engine register the app during deploy without live DT creds;
    # tool calls will fail at query time if DT_ENV is still missing at runtime.
    if settings.dt_mcp_url:
        endpoint = settings.dt_mcp_url
    elif settings.dt_env:
        endpoint = settings.dt_mcp_endpoint
    else:
        endpoint = ""

    if endpoint.startswith("stdio://"):
        return _build_stdio_toolset()

    return _build_http_toolset(
        endpoint or "https://unconfigured.apps.dynatrace.invalid/mcp"
    )


def _build_http_toolset(endpoint: str) -> McpToolset:
    params = StreamableHTTPConnectionParams(
        url=endpoint,
        headers={"Authorization": f"Bearer {settings.dt_api_token}"},
        timeout=30,
    )
    return McpToolset(connection_params=params)


def _build_stdio_toolset() -> McpToolset:
    """Local dev fallback via npx @dynatrace-oss/dynatrace-mcp-server."""
    params = StdioServerParameters(
        command="npx",
        args=["-y", "@dynatrace-oss/dynatrace-mcp-server"],
        env={
            **os.environ,
            "DYNATRACE_URL": settings.dt_base_url,
            "DYNATRACE_TOKEN": settings.dt_api_token,
        },
    )
    return McpToolset(connection_params=params)
