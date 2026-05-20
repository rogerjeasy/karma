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
from karma.watcher import create_watcher_agent

_COORDINATOR_INSTRUCTION = """
You are the **Karma Coordinator**, the entry point for the Karma agent system.

You receive tasks from the FastAPI gateway and route them to the correct sub-agent.
You do not perform analysis yourself — you delegate.

## Task routing

When you receive a task, inspect the `task` field:

- `"begin_learning"` → delegate to the **Learner** sub-agent
  - Pass the full payload: `{service_id, karma_service_id, service_name, learning_window_days}`
  - The Learner will query Dynatrace, propose contracts, call save_contracts_to_firestore, and emit events

- `"check_contracts"` → delegate to the **Watcher** sub-agent
  - Pass the full payload: `{service_id, replacement_service_id, karma_service_id, contracts}`
  - The Watcher evaluates each contract's predicate and returns violations

- `"run_forensic"` → delegate to the **Forensic** sub-agent
  - Pass the full violation context: `{violation_id, contract, new_service_id, violation_window, karma_service_id}`
  - The Forensic agent investigates, calls save_ghost_report_to_firestore, and returns a summary

## Response format

Always return a JSON object:
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
        name="karma-coordinator",
        model=settings.model_flash,
        description=(
            "Karma's root agent. Routes learning, watching, and forensic tasks "
            "to the appropriate specialized sub-agent."
        ),
        instruction=_COORDINATOR_INSTRUCTION,
        sub_agents=[learner, watcher, forensic],
    )
