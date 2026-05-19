# Karma — System Architecture

## High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Next.js Dashboard (Cloud Run)                                       │
│  karma.<domain> — HTTPS only                                         │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ HTTPS REST + Server-Sent Events
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FastAPI Gateway (Cloud Run)                                         │
│  api.karma.<domain>                                                  │
│                                                                      │
│  Routes: /services  /contracts  /ghosts  /cutover  /stream (SSE)    │
└──────────────┬─────────────────────────┬────────────────────────────┘
               │                         │
               ▼                         ▼
┌──────────────────────┐   ┌─────────────────────────────────────────┐
│  Firestore            │   │  Karma Agent System (Agent Engine)       │
│  - services           │   │  Long-running AdkApp                     │
│  - contracts          │   │                                          │
│  - violations         │   │  ┌──────────────┐                        │
│  - ghost_reports      │   │  │  Coordinator  │  ← entry point        │
│  - users              │   │  └──────┬───┬───┘                        │
└──────────────────────┘   │         │   │   │                         │
                           │         ▼   ▼   ▼                         │
                           │  ┌──────┐ ┌────┐ ┌────────┐              │
                           │  │Lrnr  │ │Wtch│ │Forensic│              │
                           │  └──────┘ └────┘ └────────┘              │
                           │                                           │
                           │  Memory Bank (VertexAiMemoryBankService)  │
                           │  ┌───────────────────────────────────┐   │
                           │  │  Implicit contracts (per service)  │   │
                           │  └───────────────────────────────────┘   │
                           └──────────────────┬────────────────────────┘
                                              │ MCP (HTTPS + Bearer token)
                                              ▼
                           ┌──────────────────────────────────────────┐
                           │  Dynatrace MCP Server (hosted)            │
                           │  {tenant}.apps.dynatrace.com/...          │
                           └──────────────────┬───────────────────────┘
                                              │
                                              ▼
                           ┌──────────────────────────────────────────┐
                           │  Dynatrace Tenant                         │
                           │  - Grail data lake (logs, metrics, traces)│
                           │  - Smartscape topology                    │
                           │  - Davis AI analyzers                     │
                           └──────────────────┬───────────────────────┘
                                              │ OTel (OTLP/HTTP)
                                              ▼
                           ┌──────────────────────────────────────────┐
                           │  Synthetic Demo Environment (Cloud Run)   │
                           │  ┌─────────────────┐                     │
                           │  │ svc-payments-v2  │ ← deprecating       │
                           │  │ (hidden: Redis   │                     │
                           │  │  cache warming)  │                     │
                           │  └─────────────────┘                     │
                           │  ┌─────────────────┐                     │
                           │  │ svc-payments-v3  │ ← replacement       │
                           │  │ (no Redis write) │                     │
                           │  └─────────────────┘                     │
                           │  ┌─────────────────┐                     │
                           │  │ svc-reporting    │ ← downstream        │
                           │  │ (Redis reader)   │                     │
                           │  └─────────────────┘                     │
                           │  ┌─────────────────┐                     │
                           │  │ k6 load-gen      │ ← Cloud Scheduler  │
                           │  └─────────────────┘                     │
                           └──────────────────────────────────────────┘
```

---

## The Four Agents

### Coordinator

- **Model:** Gemini 2.5 Flash
- **Role:** Entry point; receives tasks from the FastAPI gateway via Agent Engine API; routes to the appropriate sub-agent
- **Inputs:** `{task: "begin_learning" | "check_contracts" | "run_forensic", payload: {...}}`
- **Sub-agents:** Learner, Watcher, Forensic

### Learner

- **Model:** Gemini 2.5 Pro (structured output mode)
- **Role:** Queries Dynatrace telemetry for a given service over a 14-day window; proposes contract candidates in the §4.3 schema; runs contract validation; persists validated contracts to Memory Bank
- **MCP tools used (by display name — confirm exact method names via `tools/list`):**
  - **Smartscape Agent** — resolve service name → entity ID
  - **Grail Query Agent** — generate DQL from natural language (does not execute)
  - **Data Analysis Agent** — execute DQL against Grail, returns raw results
  - **Forecasting Agent** — detect periodic patterns (e.g. "writes every 30s")
  - **Changepoint Agent** — detect anomalies and behavioral shifts
  - **Kubernetes Agent** — K8s events if service runs on K8s

### Watcher

- **Model:** Gemini 2.5 Flash (fast, frequent)
- **Role:** Runs every 10 minutes via Cloud Scheduler → Pub/Sub trigger; evaluates each contract's `violation_predicate.test_dql` against the replacement service's recent telemetry
- **MCP tools used:**
  - **Data Analysis Agent** — execute violation predicate DQL
  - **Root Cause Agent** — check if Davis detected related problems
- **Output:** Violation candidates → Pub/Sub → Forensic agent

### Forensic

- **Model:** Gemini 2.5 Pro (structured JSON output)
- **Role:** Triggered on violation; pulls deep context; composes evidence-grounded ghost report; writes to Firestore
- **MCP tools used:**
  - **Data Analysis Agent** — deep trace + log pulls
  - **Root Cause Agent** — list problems in violation window
  - **Root Cause Details Agent** — details of specific Davis problems
  - **Smartscape Agent** — confirm entity IDs of downstream dependents
  - **Help Agent** — root-cause analysis assistance
  - **Changepoint Agent** — pinpoint exact moment of behavioral shift

> **Self-observability implementation:** `send_event` does not exist in the Dynatrace MCP
> toolset. Karma uses the **Platform BizEvents Ingest API** directly
> (`settings.dt_events_endpoint`, requires `storage:bizevents:write` scope) via the
> `emit_karma_event` native tool in `agents/karma/tools/dynatrace_events.py`.
> Events are stored in Grail and queryable via:
> `fetch bizevents | filter event.type startsWith "karma."`

---

## Memory Bank Design

Contracts are stored as Memory Bank *memories* tagged with `service_id`:

```python
memory_service.add_memory(
    content=contract.model_dump_json(),
    metadata={"service_id": contract.service_id, "category": contract.category},
)
```

The Watcher retrieves contracts for a service via:

```python
memories = memory_service.search_memories(
    query=f"service_id:{service_id}",
    top_k=50,
)
```

*Fallback (Risk #4):* If Memory Bank structured search proves limiting, contracts are also mirrored to Firestore with Memory Bank used for agent session continuity only.

---

## Data Flow — One Contract (Full Trace)

```
1. User registers svc-payments-v2 on dashboard
   → POST /services  → Firestore record created
   → Agent Engine task: {task: "begin_learning", service_id: "svc-payments-v2"}

2. Coordinator → delegates to Learner

3. Learner (14-day window):
   get-entity-id("svc-payments-v2") → ENTITY_ID
   create-dql("p95 latency per endpoint per hour") → DQL
   execute-dql(DQL) → latency bands
   create-dql("error status codes + payloads") → DQL
   execute-dql(DQL) → error semantics
   timeseries-novelty-detection / adaptive-anomaly-detector → burst patterns
   execute-dql(log filter: redis.SET) → cache warming pattern found
   emit_karma_event("karma.contract.discovered", ...) → BizEvent in Grail
   → 8 candidate contracts proposed in JSON schema

4. Contract validator (for each candidate):
   execute-dql(violation_predicate.test_dql on OLD service history)
   → reject if any false positives

5. Validated contracts → Memory Bank (tagged service_id=svc-payments-v2)
   emit_karma_event("karma.learning.complete", ...) → BizEvent in Grail

6. User clicks "Mark cutover" on dashboard
   → POST /cutover → Watcher schedule activated

7. Watcher (every 10 min against svc-payments-v3):
   execute-dql(violation_predicate.test_dql)
   → contract #4 predicate fails (Redis writes absent)
   query-problems() → Davis AI problem check
   → Pub/Sub: {violation: contract_id_4, ...}

8. Forensic agent:
   execute-dql (deep log pull, 15-min window)
   execute-dql (svc-reporting metrics, same window)
   ask-dynatrace-docs (root-cause analysis guidance)
   timeseries-novelty-detection (pinpoint exact moment of shift)
   → ghost report: {summary, root_cause, downstream_impact, evidence_links}
   → Firestore: ghost_reports/{report_id}
   emit_karma_event("karma.ghost_report.created", ...) → BizEvent in Grail

9. FastAPI SSE pushes new report to dashboard
   → "ghost pulse" animation fires
```

---

## Security Considerations

- All secrets via **Secret Manager** — never in environment variables or code
- Dynatrace Platform Token stored as Secret Manager secret `dt-api-token`
- Firebase Auth enforces authentication on the dashboard; API validates Firebase ID tokens
- Cloud Run services are internal-only where possible (API only exposes what the dashboard needs)
- No user data stored in Memory Bank — only service telemetry patterns
