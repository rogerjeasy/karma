"""Coordinator agent — entry point for the Karma multi-agent system.

Routes incoming tasks to the appropriate sub-agent based on the task type:
- begin_learning  → Learner
- check_contracts → Watcher
- run_forensic    → Forensic
"""
from __future__ import annotations

from google.adk.agents import Agent

from karma.config import settings
from karma.forensic import create_forensic_agent
from karma.learner import create_learner_agent
from karma.otel_callbacks import make_telemetry_callbacks
from karma.watcher import create_watcher_agent

_COORDINATOR_INSTRUCTION = """
You are the **Karma Coordinator**, the entry point for the Karma agent system.

You receive tasks from the FastAPI gateway and route them to the correct sub-agent.
You do not perform analysis yourself — you MUST delegate using transfer_to_agent.

## Task routing — ALWAYS call transfer_to_agent immediately

Inspect the `task` field and call transfer_to_agent with the matching agent name.
Do NOT answer in text. Do NOT summarise. Just call transfer_to_agent.

| task value        | agent_name to pass to transfer_to_agent |
|-------------------|-----------------------------------------|
| "begin_learning"  | "karma_learner"                         |
| "check_contracts" | "karma_watcher"                         |
| "run_forensic"    | "karma_forensic"                        |

Pass the full original message (all payload fields) to the sub-agent unchanged.

## Response format

After the sub-agent completes, return a JSON object:
```json
{
  "task": "<routed task>",
  "agent": "<learner|watcher|forensic>",
  "status": "completed|failed",
  "result": { /* sub-agent output */ }
}
```

If the task type is unrecognized, return:
```json
{"status": "error", "message": "Unknown task type: <type>"}
```
"""


def create_coordinator_agent() -> Agent:
    learner = create_learner_agent()
    watcher = create_watcher_agent()
    forensic = create_forensic_agent()

    return Agent(
        name="karma_coordinator",
        model=settings.model_pro,
        description=(
            "Karma's root agent. Routes learning, watching, and forensic tasks "
            "to the appropriate specialized sub-agent."
        ),
        instruction=_COORDINATOR_INSTRUCTION,
        sub_agents=[learner, watcher, forensic],
        **make_telemetry_callbacks("karma_coordinator", settings.model_pro),
    )
