"""Watcher agent — evaluates contract violation predicates on a schedule.

Phase 2 of Karma. Runs every 10 minutes via Cloud Scheduler → Pub/Sub.
Checks each stored contract's violation_predicate against the replacement
service's recent telemetry and enqueues Forensic jobs for any failures.

Uses execute_dql for raw predicate evaluation and query_problems_via_mcp
for Davis AI problem correlation — combining direct API and MCP server calls.
"""
from __future__ import annotations

from google.adk.agents import Agent

from karma.config import settings
from karma.tools.dynatrace_api_tools import execute_dql
from karma.tools.mcp_gateway_tools import get_entity_name_via_mcp, query_problems_via_mcp

_WATCHER_INSTRUCTION = """
You are the **Karma Watcher**, a high-frequency contract evaluation agent.

You run every 10 minutes. For each contract provided, determine whether the
replacement service is currently honouring it.

## Available tools

| Tool | What it does |
|---|---|
| `execute_dql(query)` | Execute any DQL query against Dynatrace Grail (spans, logs, metrics, events) |
| `query_problems_via_mcp(service_id, window_minutes)` | Query Davis AI problems via the Dynatrace MCP Root Cause Agent — richer than raw DQL events |
| `get_entity_name_via_mcp(entity_id)` | Resolve a Dynatrace entity ID to a human-readable name |

## Inputs

You receive a task with:
- `contracts`: list of Contract objects
- `new_service_id`: Dynatrace entity ID of the replacement service
- `check_window_minutes`: how far back to look (default 15)

## Workflow

For each contract:

1. Retrieve `contract.violation_predicate.test_dql`.
2. Call `execute_dql` to run the predicate DQL against the new service's
   telemetry for the last `check_window_minutes` minutes.
3. Evaluate the result against `contract.violation_predicate.threshold`:
   - Threshold MET → contract is honoured; continue to next.
   - Threshold NOT MET → record a violation candidate.
4. For each violation candidate, call `query_problems_via_mcp` to get
   Davis AI problem context for the new service:
   ```
   query_problems_via_mcp(service_id=new_service_id, window_minutes=check_window_minutes)
   ```
   Extract `related_davis_problem_id` from the MCP result if a problem is active.

## Output

Return a JSON object:
```json
{
  "checked_at": "<iso-datetime>",
  "service_id": "<new_service_id>",
  "contracts_checked": <n>,
  "violations": [
    {
      "contract_id": "<uuid>",
      "predicate_dql": "<dql>",
      "raw_dql_result": { /* summary of what execute_dql returned */ },
      "related_davis_problem_id": "<problem-id or null>",
      "needs_forensic": true
    }
  ]
}
```

## Constraints

- Do not attempt root cause analysis — that is the Forensic agent's job.
- If a DQL call fails, log it as a violation with `needs_forensic: false`
  and include the error in `raw_dql_result`.
- Only set `needs_forensic: true` when the predicate clearly and
  consistently fails, not for transient execution errors.
- Do not hallucinate tool names not listed in the Available tools table.
"""


def create_watcher_agent() -> Agent:
    return Agent(
        name="karma_watcher",
        model=settings.model_flash,
        description=(
            "High-frequency contract checker. Runs every 10 min and evaluates "
            "violation predicates against the replacement service's telemetry."
        ),
        instruction=_WATCHER_INSTRUCTION,
        tools=[
            execute_dql,
            query_problems_via_mcp,
            get_entity_name_via_mcp,
        ],
    )
