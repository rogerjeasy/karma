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
│          /admin  /stats  /users  /demo  /pubsub  /readiness          │
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
│  - watcher_runs       │   │         │   │   │                         │
│  - deployment_metrics │   │         ▼   ▼   ▼                         │
└──────────────────────┘   │  ┌──────┐ ┌────┐ ┌────────┐              │
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
                           │  - Notebooks, Workflows, SLOs             │
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
- **Role:** Queries Dynatrace telemetry for a given service over a configurable window (default 14 days); proposes contract candidates in the contract schema; validates each predicate against historical data; persists validated contracts to Firestore and Memory Bank; creates Dynatrace SLOs for qualifying contracts
- **Tools used:**
  - `execute_dql` — raw Grail queries for spans, logs, metrics, events
  - `get_entity_id_via_mcp` — resolve service name → entity ID (MCP Smartscape Agent)
  - `get_entity_name_via_mcp` — resolve entity ID → human-readable name
  - `detect_changepoints_via_mcp` — detect behavioral shifts (MCP Changepoint Agent)
  - `adaptive_anomaly_detection_via_mcp` — detect anomalies with learned thresholds (MCP Autoadaptive Threshold Agent)
  - `validate_contract_predicate` — runs each predicate against old service history; rejects false positives
  - `create_slo_from_contract` — registers validated contracts as official Dynatrace SLOs
  - `emit_karma_event` — BizEvents self-observability (`karma.learning.*`, `karma.contract.*`)
  - `save_contracts_to_firestore` — persist to dashboard
  - `save_contracts_to_memory_bank` — persist across agent sessions

### Watcher

- **Model:** Gemini 2.5 Flash (fast, frequent)
- **Role:** Runs every 10 minutes via Cloud Scheduler → Pub/Sub trigger; evaluates each contract's `violation_predicate.test_dql` against the replacement service's recent telemetry; performs bidirectional Davis AI problem correlation; publishes confirmed violations to Pub/Sub for async Forensic processing
- **Tools used:**
  - `load_contracts_from_memory_bank` — retrieve contracts when payload is empty
  - `execute_dql` — evaluate violation predicates against recent telemetry
  - `query_problems_via_mcp` — AI-enriched root cause from Davis Root Cause Agent
  - `list_problems_via_mcp` — cross-correlate violations with active Davis problems
  - `get_entity_name_via_mcp` — resolve entity IDs to service names
  - `publish_violation_to_pubsub` — publish confirmed violations to `karma-violations` topic
- **Auto-completion:** After `watcher_clean_runs_to_complete` consecutive violation-free cycles (default 3), a user service transitions automatically from `haunting` → `completed`. System services never auto-complete.

### Forensic

- **Model:** Gemini 2.5 Pro (structured JSON output)
- **Role:** Triggered by Pub/Sub violation messages; pulls deep telemetry context; performs Davis AI root-cause analysis; estimates investigation cost and avoided-incident savings; produces structured ghost reports; creates Dynatrace Notebooks and Workflows for HIGH/CRITICAL reports; sends Slack/email notifications; writes annotation events back to the Dynatrace service timeline
- **Tools used:**
  - `execute_dql` — deep trace + log pulls
  - `query_problems_via_mcp` — AI-enriched Davis root-cause analysis
  - `list_problems_via_mcp` — list active Davis problems
  - `get_problem_details_via_mcp` — full details of specific Davis problems
  - `get_entity_name_via_mcp` — resolve downstream entity IDs
  - `detect_changepoints_via_mcp` — pinpoint exact moment of behavioral shift
  - `ask_dynatrace_docs_via_mcp` — Davis AI documentation for remediation guidance
  - `find_troubleshooting_guides_via_mcp` — Dynatrace knowledge base search
  - `send_event_via_mcp` — annotate Dynatrace service timeline (CUSTOM_ANNOTATION)
  - `create_dynatrace_notebook_via_mcp` — collaborative investigation notebook (HIGH+CRITICAL)
  - `create_workflow_for_notification_via_mcp` — recurring-problem workflow (CRITICAL)
  - `send_slack_message_via_mcp` — Slack notification for HIGH+CRITICAL reports
  - `send_email_via_mcp` — email notification for CRITICAL reports
  - `get_session_cost_estimate` — token count + USD estimate for this investigation
  - `emit_karma_event` — BizEvents self-observability (`karma.ghost_report.created`)
  - `save_ghost_report_to_firestore` — persist ghost report
  - `push_ghost_report_to_dynatrace` — CUSTOM_ANNOTATION event on service timeline

> **Self-observability:** Karma's primary self-observability mechanism is the
> **BizEvents Ingest API** (`settings.dt_bizevents_endpoint`, requires `bizevents.ingest`
> classic scope) via `emit_karma_event` in `agents/karma/tools/dynatrace_events.py`.
> Events are queryable via: `fetch bizevents | filter event.type startsWith "karma."`
>
> Additionally, the Forensic agent uses `send_event_via_mcp` to write
> `CUSTOM_ANNOTATION` events directly to the Dynatrace service problem timeline,
> creating a bidirectional link from ghost reports into Dynatrace.

---

## Violation Pipeline — Pub/Sub Architecture

The Watcher and Forensic agents communicate asynchronously via Pub/Sub, not direct invocation:

```
Cloud Scheduler (every 10 min)
  → POST /pubsub/watcher-tick (FastAPI)
    → Watcher agent (Agent Engine)
      → on violation: publish to karma-violations (Pub/Sub topic)
        → POST /pubsub/violation (FastAPI)
          → Forensic agent (Agent Engine)
            → ghost report saved to Firestore
              → SSE pushes to dashboard
```

The `/pubsub/watcher-tick` endpoint also triggers Forensic directly as a fallback if Pub/Sub delivery fails.

---

## Memory Bank Design

Contracts are stored as Memory Bank *memories* tagged with `karma_service_id`:

```python
memory_service.add_memory(
    content=contract.model_dump_json(),
    metadata={"karma_service_id": service_id, "category": contract.category},
)
```

The Watcher retrieves contracts for a service via:

```python
memories = memory_service.search_memories(
    query=f"karma_service_id:{karma_service_id}",
    top_k=50,
)
```

*Fallback:* If Memory Bank structured search proves limiting, contracts are also mirrored to Firestore with Memory Bank used for agent session continuity only.

---

## API Gateway — Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `GET /health` | GET | None | Liveness check (Firestore + Agent Engine) |
| `GET /readiness` | GET | None | Readiness probe |
| `GET /stats` | GET | Optional | Platform / user-scoped stats |
| `POST /services` | POST | User | Register a service + trigger learning |
| `GET /services` | GET | User | List user's services |
| `GET /services/{id}` | GET | User | Get service details |
| `POST /services/{id}/learn` | POST | User | Re-trigger Learner |
| `POST /services/{id}/complete` | POST | User | Mark migration completed |
| `DELETE /services/{id}` | DELETE | User | Delete service + cascade |
| `GET /services/{id}/watcher-runs` | GET | User | Watcher run history |
| `GET /contracts` | GET | User | List contracts (scoped) |
| `GET /contracts/{id}` | GET | User | Contract detail with DQL + evidence |
| `GET /services/{id}/migration-readiness` | GET | User | Weighted compliance score |
| `GET /ghosts` | GET | User | Ghost reports feed |
| `GET /ghosts/{id}` | GET | User | Ghost report detail |
| `POST /cutover` | POST | User | Transition service to haunting |
| `GET /stream` | GET | User | SSE event stream |
| `POST /pubsub/watcher-tick` | POST | Internal | Cloud Scheduler → Watcher |
| `POST /pubsub/violation` | POST | Internal | Pub/Sub → Forensic |
| `POST /demo/seed` | POST | User | Seed demo scenario (idempotent) |
| `DELETE /demo/reset` | DELETE | User | Delete demo data |
| `GET /users/me` | GET | User | Current user profile |
| `POST /users/sync` | POST | User | Upsert user on first login |
| `GET /admin/observability` | GET | Admin | Platform observability summary |
| `GET /admin/stats` | GET | Admin | Platform-wide admin stats |
| `GET /admin/agent-observability` | GET | Admin | ADK + Claude Code token spend |
| `GET /admin/investigation-engine` | GET | Admin | Per-user forensics + AI spend |
| `GET /admin/system-services` | GET | Admin | Karma self-monitoring services |
| `POST /admin/system-services` | POST | Admin | Register system service |
| `POST /admin/system-services/{id}/learn` | POST | Admin | Trigger Learner for system service |
| `POST /admin/system-services/{id}/cutover` | POST | Admin | Cutover system service |
| `POST /admin/system-services/{id}/haunt` | POST | Admin | Resume haunting |
| `POST /admin/system-services/{id}/record-deployment` | POST | Admin | Record deployment metrics (GitHub API) |
| `DELETE /admin/system-services/{id}` | DELETE | Admin | Delete system service cascade |

---

## Service Lifecycle

```
registered → learning → ready → haunting → completed
                               ↑           (auto after N clean Watcher runs)
                               error
```

- **registered** — created in Firestore, awaiting Learner
- **learning** — Learner agent running
- **ready** — contracts discovered, awaiting cutover
- **haunting** — Watcher active; Forensic triggered on violations
- **completed** — migration validated (user-triggered or auto after N clean runs)
- **error** — Learner or agent invocation failed; `error_message` field set

---

## Data Flow — One Contract (Full Trace)

```
1. User registers svc-payments-v2 on dashboard
   → POST /services  → Firestore record created
   → Agent Engine task: {task: "begin_learning", service_id: "svc-payments-v2"}

2. Coordinator → delegates to Learner

3. Learner (14-day window):
   get_entity_id_via_mcp("svc-payments-v2") → ENTITY_ID
   execute_dql("p95 latency per endpoint per hour") → latency bands
   execute_dql("error status codes + payloads") → error semantics
   adaptive_anomaly_detection_via_mcp / detect_changepoints_via_mcp → burst patterns
   execute_dql(log filter: redis.SET) → cache warming pattern found
   emit_karma_event("karma.contract.discovered", ...) → BizEvent in Grail
   create_slo_from_contract(...) → Dynatrace SLO registered
   → 4–8 candidate contracts proposed in JSON schema

4. For each candidate: validate_contract_predicate (runs test_dql on OLD service history)
   → reject if any false positives

5. Validated contracts → Firestore (dashboard) + Memory Bank (tagged karma_service_id)
   emit_karma_event("karma.learning.complete", ...)

6. User clicks "Mark cutover" on dashboard
   → POST /cutover → Watcher schedule activated (phase = haunting)

7. Watcher (every 10 min against svc-payments-v3):
   load_contracts_from_memory_bank(karma_service_id) → contracts
   execute_dql(rewritten violation_predicate.test_dql)
   → contract #4 predicate fails (Redis writes absent)
   list_problems_via_mcp(svc-payments-v3) → Davis AI problem check
   publish_violation_to_pubsub(...) → karma-violations Pub/Sub topic

8. Forensic agent (triggered via Pub/Sub):
   execute_dql (deep log pull, 15-min window)
   execute_dql (svc-reporting metrics, same window)
   detect_changepoints_via_mcp (pinpoint exact moment of shift)
   ask_dynatrace_docs_via_mcp (remediation guidance)
   get_session_cost_estimate() → token count + USD
   create_dynatrace_notebook_via_mcp(...) → investigation notebook (CRITICAL)
   create_workflow_for_notification_via_mcp(...) → recurring alert workflow
   send_slack_message_via_mcp("#migrations", ...) → team notification
   save_ghost_report_to_firestore(...)
   emit_karma_event("karma.ghost_report.created", ...)
   push_ghost_report_to_dynatrace(...) → CUSTOM_ANNOTATION on service timeline

9. FastAPI SSE pushes new report to dashboard
   → "ghost pulse" animation fires
```

---

## Admin Panel

The dashboard includes an admin-only panel at `/dashboard/admin` with four tabs:

| Tab | Content |
|---|---|
| **Infrastructure** | Karma self-monitoring system services; register, learn, cutover, haunt; Demo quick-start panel (`DemoRunPanel`) |
| **Platform Observability** | Session activity, engineering metrics (commits/PRs/lines), OTel status, BizEvent counts |
| **AI Investigation** | Per-user ghost report forensics; AI spend summary; investigation cost tracking |
| **Coding Agents** | Side-by-side token/cost view: Karma ADK agents (Gemini 2.5 Pro) vs Claude Code dev sessions (Claude Sonnet); powered by live DQL against `fetch spans` in Grail |

### Agent Observability

The **Coding Agents** tab (`/admin/agent-observability`) queries Dynatrace Grail for:

```dql
-- Karma ADK agents
fetch spans, from:now()-30d
| filter service.name == "karma-agent-system"
| filter isNotNull(gen_ai.usage.input_tokens)
| summarize input_tokens = sum(...), output_tokens = sum(...), span_count = count()

-- Claude Code dev sessions
fetch spans, from:now()-30d
| filter service.name == "claude-code-dev"
| filter isNotNull(gen_ai.usage.input_tokens)
| summarize ...
```

Falls back to Firestore-aggregated investigation costs when `DT_QUERY_TOKEN` is not configured.

---

## Frontend Components

| Component | Purpose |
|---|---|
| `BeforeAfterTimeline` | Side-by-side old vs new service behavior comparison |
| `ContractRadarChart` | Category compliance radar visualization |
| `ContractSparkline` | Per-contract mini trend chart |
| `ContractTimeline` | Chronological contract discovery view |
| `DemoRunPanel` | Admin quick-start: seed / reset demo with one click |
| `GhostCard` | Ghost report card with severity, evidence links |
| `MigrationReadinessScore` | Weighted compliance score (0–100) by contract category |
| `ViolationPulse` | Ghost pulse animation on new violation |
| `WatcherLiveLog` | Real-time Watcher run log via SSE |
| `OtelProvider` | Next.js OTel instrumentation (traces to Dynatrace) |

---

## Security Considerations

- All secrets via **Secret Manager** — never in environment variables or code
- Dynatrace Platform Token stored as Secret Manager secret `dt-api-token`
- Firebase Auth enforces authentication on the dashboard; API validates Firebase ID tokens
- Admin routes require `admin` role in `users/{uid}.roles` (checked server-side)
- Cloud Run services are internal-only where possible (API only exposes what the dashboard needs)
- `DT_QUERY_TOKEN` (classic API, `storage:spans:read` scope) kept separate from `DT_API_TOKEN` (Platform Token, MCP gateway)
- No user data stored in Memory Bank — only service telemetry patterns
- GitHub token is a fine-grained PAT with `contents:read` + `pull-requests:read` only

---

## Environment Configuration Summary

| Variable | Service | Purpose |
|---|---|---|
| `GCP_PROJECT_ID` | agents, api | Google Cloud project |
| `DT_ENV` | agents, api | Dynatrace environment name (derived URLs) |
| `DT_API_TOKEN` | agents | Platform Token for MCP gateway (Bearer auth) |
| `DT_OTEL_TOKEN` | agents, api | Classic API token for OTel + BizEvents + SLOs + Events ingest |
| `DT_QUERY_TOKEN` | api | Classic API token with Grail read scope (agent observability) |
| `MEMORY_BANK_ID` | agents | Vertex AI Memory Bank resource ID |
| `AGENT_ENGINE_RESOURCE_NAME` | api | Full Agent Engine resource name |
| `FIRESTORE_DATABASE` | agents, api | Firestore database name (default: `(default)`) |
| `GITHUB_TOKEN` | api | Fine-grained PAT for deployment metrics |
| `GITHUB_REPO` | api | Default `owner/repo` for deployment metrics |
| `WEBHOOK_URL` | api | Optional webhook on ghost report creation |
