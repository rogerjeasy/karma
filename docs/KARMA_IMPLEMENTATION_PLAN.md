# Karma — The Reincarnation Agent for Deprecated Services
## Project Bible & 24-Day Implementation Plan

> **Hackathon:** Google Cloud Rapid Agent Hackathon — Dynatrace Track
> **Submission deadline:** Thursday, June 11, 2026, 2:00 PM PT
> **Plan date:** Monday, May 18, 2026 (24 days remaining)
> **Builder:** Roger Jeasy Bavibidila (`@rogerjeasy`)
> **Repo created:** `github.com/rogerjeasy/karma`

---

## Table of Contents

1. [Vision & Why This Wins](#1-vision--why-this-wins)
2. [Hackathon Rule Compliance Matrix](#2-hackathon-rule-compliance-matrix)
3. [Judging Criteria — Win Strategy](#3-judging-criteria--win-strategy)
4. [What an "Implicit Contract" Actually Is](#4-what-an-implicit-contract-actually-is)
5. [System Architecture](#5-system-architecture)
6. [Tech Stack & Rationale (with Disallowed Tools)](#6-tech-stack--rationale-with-disallowed-tools)
7. [The Demo Scenario — The Most Important Section](#7-the-demo-scenario--the-most-important-section)
8. [Repository Structure](#8-repository-structure)
9. [Day-0 Setup & Prerequisites](#9-day-0-setup--prerequisites)
10. [24-Day Build Plan](#10-24-day-build-plan)
11. [Risk Register & Cut Lines](#11-risk-register--cut-lines)
12. [Submission Package Checklist](#12-submission-package-checklist)
13. [Stretch Goals (Only If Ahead of Schedule)](#13-stretch-goals-only-if-ahead-of-schedule)
14. [References & Setup Links](#14-references--setup-links)
15. [Daily Discipline Notes](#15-daily-discipline-notes)

---

## 1. Vision & Why This Wins

### One-sentence pitch
*Karma is an autonomous agent that haunts deprecated services: during their final weeks it learns their undocumented behaviors, then watches the replacement and flags silent regressions that pass every test but quietly break downstream systems.*

### Why this is hard to beat in the Dynatrace track

Most Dynatrace-track entries will fall into one of three buckets:

1. **"Chat with your observability data"** — but Dynatrace Assist already does this natively.
2. **"Incident-triage agent that summarizes problems"** — useful but solved by Davis AI.
3. **"Natural-language DQL generator"** — already a built-in MCP tool.

Karma attacks an unsolved class of bug — **contract drift across service migrations** — that traditional observability misses *by design*. Tests check the contract you wrote down; Karma checks the contract you forgot you had. That makes the project distinctive on two judging criteria almost automatically:

- **Quality of the Idea** — the metaphor (*"service ghosts haunting their replacements"*) is memorable and the technical problem is real.
- **Potential Impact** — every team running a microservice migration, cloud lift-and-shift, or legacy modernization needs this. The TAM is huge.

The remaining two criteria — **Technological Implementation** and **Design** — separate "interesting demo" from "first place." That's where this plan focuses most of its effort.

### The line that gets quoted in the judges' meeting
*"The new service passes every test, CI is green, and downstream throughput dropped 8% because nobody knew the old service was warming a cache."* Keep this line visible in the README, the video voice-over, and the dashboard tagline.

---

## 2. Hackathon Rule Compliance Matrix

Every row maps an official rule to a concrete deliverable in this plan.

| Rule reference | Requirement | Karma's compliance |
|----------------|-------------|---------------------|
| §7.A — What to build | Functional agent powered by Gemini **and** Google Cloud Agent Builder, integrating a Partner MCP server | Multi-agent system on ADK v1.0 + Agent Engine; Dynatrace MCP integration; Gemini 2.5 Pro/Flash as the reasoning models |
| §7.A — Track | Pick one Partner track | Dynatrace |
| §7.B — Team | ≤ 4 individuals, all added on Devpost | Solo or recruit ≤ 3 trusted teammates; add them on Devpost early |
| §7.B — Functionality | Google Cloud + Partner products only; no competing services | All cloud + AI is Google Cloud + Dynatrace; no Azure, no AWS, no OpenAI/Anthropic models |
| §7.B — Platforms | Web / Android / iOS | Web dashboard (Next.js); one platform satisfies the rule |
| §7.B — New project | Created during contest period (May 5 – June 11) | Initialize fresh repo on May 18. **Do not reuse code from prior projects** (HSLU Exam Assistant, Let Us Connect, etc.) even if patterns are familiar. Cite all OSS deps. |
| §7.B — AI usage limit | Only Google Cloud AI tools + Partner's built-in AI (Davis CoPilot is OK) | Gemini family only; Davis CoPilot used through MCP. No OpenAI, no Anthropic, no HuggingFace inference. No LangChain agents (LangChain *utilities* like text splitters are fine) |
| §7.B — Third-party integrations | Must be authorized per their ToS | Dynatrace SaaS trial accepted; npx Dynatrace MCP package is MIT-licensed |
| §7.B — Hosted URL | Reachable by judges | Frontend on Cloud Run with custom domain (`karma.<your-domain>`); backend on Cloud Run; agents on Agent Engine |
| §7.B — Public OSS repo with license at top | License must be visible in GitHub "About" | `LICENSE` (MIT) at repo root; set on Repository Settings → License field |
| §7.B — Demo video | ≤ 3 min on YouTube/Vimeo, public, English | 2:45 video on YouTube; English voice-over + captions |
| §7.B — Text description | Features, technologies, data sources, learnings | See Devpost description template in §12 |
| §6 — GCP credits | Request via the linked form **by June 4, 2026** | **Submit credit request by May 23** to allow processing buffer |
| §5 — Deadline | All entries received by 2:00 PM PT June 11 | **Internal deadline: June 10, 18:00 CET (= June 10, 09:00 PT)** — submit a full day early |

---

## 3. Judging Criteria — Win Strategy

The four criteria are **equally weighted**. The score gap between #1 and #3 in each track is usually a handful of points, so squeezing every criterion matters.

### 3.1 Quality of the Idea
**Goal:** be the most-cited "remember the one about ghosts of dead services?" submission.

- Lead with the metaphor in every artifact (README, demo video, dashboard tagline, end card).
- Articulate the problem class in one crisp sentence: *"silent contract violations that pass tests but break downstream systems."*
- Show why existing observability misses it: tests and SLOs check what you wrote down; Karma checks what you *forgot*.

### 3.2 Technological Implementation
**Goal:** demonstrate that the agent is real engineering, not a wrapped LLM call.

Deliver all of these, in priority order:

1. **Multi-agent system with sub-agents.** Coordinator → Learner → Watcher → Forensic, using ADK's graph-based multi-agent pattern. Document the architecture in the README with a diagram.
2. **Genuine Dynatrace MCP usage** — at least 6 distinct MCP tools invoked: `generate_dql_from_natural_language`, `verify_dql`, `execute_dql`, `find_entity_by_name`, `list_problems`, `execute_davis_analyzer`, plus `send_event` for self-observability. Log every MCP call so a judge can see them in the live demo.
3. **Memory Bank for persistent contracts.** Use `VertexAiMemoryBankService` (the ADK wrapper around Memory Bank). Show in the demo that contracts survive an agent restart — this is the visible proof that Memory Bank is doing real work.
4. **Structured contract representation.** Pydantic schema with 8 contract categories (see §4). Not free-form text.
5. **Causal reasoning.** When a violation is detected, Karma must explain *why* and link evidence. Use Gemini with structured output (JSON schema) + tool use, not just chat.
6. **Self-observability.** Emit Dynatrace events for every Karma decision via `send_event`. The watcher is watched. This is poetic *and* technically impressive.
7. **Contract validation step.** Each candidate contract is re-run against the old service's *historical* telemetry; it must produce zero false positives before being accepted. This is the difference between "vibe contracts" and engineered contracts.

### 3.3 Design
**Goal:** beat the median hackathon submission, which has a generic Tailwind dashboard.

- **Visual metaphor.** An "afterlife" / "ghost" aesthetic — desaturated purples and dim greys for deprecated services; vivid red highlight only when a ghost speaks. No skulls or cartoon ghosts; keep it tasteful.
- **Signature view.** A split-screen "Before / After" timeline showing the old service's signature pattern next to the new service's pattern, with violations highlighted.
- **Memorable empty state.** Before any services are registered, the dashboard reads: *"No ghosts yet. Register a service slated for deprecation to begin learning."*
- **Use ShadCN/UI** (Roger's existing stack) + custom palette. Recolor and re-typeset to avoid the default ShadCN look.
- **One signature animation.** When Karma detects a regression, a soft "ghost pulse" animation surfaces the violated contract. One animation, done well — not five animations done badly.
- **Typography.** Pair `Inter` for UI with `JetBrains Mono` for code/DQL snippets. Larger line-height than default ShadCN (`leading-7`).

### 3.4 Potential Impact
**Goal:** make judges believe this is a real product, not a hackathon trick.

In the Devpost description, include:

- **Three concrete use cases.** Legacy modernization (mainframe → microservices), cloud migration (VM → cloud-native rewrite), major-version bumps of internal libraries/services.
- **Why it ships today.** "Karma could be deployed by any Dynatrace customer with zero code changes to their services — it consumes telemetry the platform already collects."
- **The roadmap to enterprise.** Notes on multi-tenancy, SSO, RBAC, what's needed beyond the hackathon scope. Sketched in two paragraphs, not promised as built.

---

## 4. What an "Implicit Contract" Actually Is

This section is the **conceptual contract** of the project. Refer back to it whenever you're tempted to scope-creep.

### 4.1 The two phases of Karma

```
┌────────────────────────────────────────────────────────────────────┐
│  PHASE 1: LEARNING (during the service's final weeks)              │
│                                                                     │
│  Old Service A ──telemetry──> Dynatrace ──MCP──> Karma Learner ──> │
│                                                       │             │
│                                                       ▼             │
│                                              Implicit Contracts     │
│                                              (Memory Bank, JSON)    │
└────────────────────────────────────────────────────────────────────┘
                                  │
                       ── cutover event ──
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│  PHASE 2: HAUNTING (after replacement goes live)                   │
│                                                                     │
│  New Service B ──telemetry──> Dynatrace ──MCP──> Karma Watcher ──> │
│                                                       │             │
│                                              compare against        │
│                                              learned contracts      │
│                                                       │             │
│                                                       ▼             │
│                                              Ghost reports          │
│                                              (Forensic) + dashboard │
└────────────────────────────────────────────────────────────────────┘
```

### 4.2 The eight categories of implicit contract

Document these prominently. They are what makes the project credible to engineering judges.

1. **Latency contract** — p50/p95/p99 response-time bands per endpoint, per hour-of-day. Detect violations of distribution *shape*, not just mean.
2. **Error-semantics contract** — which HTTP/gRPC status codes appear under which conditions; specific payload patterns of error responses that downstream clients silently parse.
3. **Throughput contract** — sustained QPS bands and burst-capacity envelope; backpressure behavior (do upstream callers get rate-limited or queued?).
4. **Side-effect contract** *(the killer category)* — observable effects beyond the response: cache writes, log records that downstream tools parse, pre-warmed DB connections, async work queued.
5. **Timing contract** — order of operations and the gap between an upstream call and its observable downstream effect.
6. **Dependency contract** — which downstream services are called, with what frequency, and what payload shapes.
7. **Resource contract** — connection-pool usage patterns, memory steady-state, file-descriptor counts. Downstream alerts may be keyed off these.
8. **Sequencing contract** — retry behavior, idempotency assumptions, ordering guarantees (e.g., "this service always processed events in arrival order, and downstream relied on that").

### 4.3 The contract JSON schema (source of truth)

A learned contract is a structured object, not a vibe:

```json
{
  "contract_id": "uuid",
  "service_id": "SERVICE-OLD-PAYMENTS-v2",
  "category": "side_effect",
  "subcategory": "cache_warming",
  "description": "Service writes a sliding-window summary to redis://prod-cache/recent_charges:summary every ~30s during normal operation. Downstream service svc-reporting reads these keys directly without calling the API.",
  "evidence": [
    {"type": "dql_query", "dql": "fetch logs | filter ...", "sample_count": 14000, "timespan": "14d"},
    {"type": "trace_pattern", "pattern": "service.write -> redis.SET", "frequency": "32 ± 4 per minute"}
  ],
  "downstream_dependents": ["SERVICE-REPORTING-API"],
  "confidence": 0.93,
  "detected_at": "2026-05-26T14:00:00Z",
  "learning_window": {"start": "...", "end": "..."},
  "violation_predicate": {
    "type": "absence",
    "test_dql": "fetch logs | filter ... | summarize count()",
    "threshold": "count >= 20 over any 5-minute window",
    "tolerance_window_seconds": 300
  }
}
```

The `violation_predicate` is what the Watcher checks. It is generated by Gemini from the evidence, then **validated** by Karma running it against the old service's historical telemetry (it must trigger zero false positives before being saved).

### 4.4 How violations are detected after cutover

The Watcher runs on a schedule (every 5–15 min). For each contract:

1. Evaluate `violation_predicate.test_dql` against the new service's recent telemetry, via `execute_dql` over MCP.
2. On predicate failure, enqueue a forensic job.
3. Forensic agent:
   - Pulls deeper trace + log context around the violation window.
   - Cross-references downstream services' metrics for the same window.
   - Asks Gemini to compose a *ghost report*: a structured natural-language explanation grounded in linked Dynatrace evidence.
   - Persists the report in Firestore.
   - Calls MCP `send_event` to emit a Dynatrace event so the violation is auditable inside Dynatrace itself.

---

## 5. System Architecture

### 5.1 High-level diagram

```
                            ┌─────────────────────────────┐
                            │   Next.js Dashboard          │
                            │   (Cloud Run / Vercel)       │
                            └───────────────┬─────────────┘
                                            │ HTTPS + SSE
                                            ▼
                            ┌─────────────────────────────┐
                            │   FastAPI Gateway            │
                            │   (Cloud Run)                │
                            └───────────────┬─────────────┘
                                            │
                                  ┌─────────┴──────────┐
                                  ▼                    ▼
                ┌─────────────────────────┐  ┌──────────────────────┐
                │  Firestore               │  │  Karma Agent System  │
                │  - Services registry     │  │  (Agent Engine —     │
                │  - Ghost reports         │  │   long-running)      │
                │  - Users                 │  │                      │
                └─────────────────────────┘  │  ┌────────────────┐   │
                                             │  │ Coordinator    │   │
                                             │  └────┬───┬───┬───┘   │
                                             │       │   │   │       │
                                             │       ▼   ▼   ▼       │
                                             │  ┌────┐┌────┐┌────┐   │
                                             │  │Lrn ││Wch ││Frns│   │
                                             │  └────┘└────┘└────┘   │
                                             │                      │
                                             │  Memory Bank          │
                                             │  ┌──────────────────┐ │
                                             │  │ Implicit         │ │
                                             │  │ contracts        │ │
                                             │  └──────────────────┘ │
                                             └────────────┬─────────┘
                                                          │ MCP (HTTPS,
                                                          │  Bearer token)
                                                          ▼
                                             ┌──────────────────────┐
                                             │ Dynatrace MCP Server │
                                             │ (hosted by Dynatrace,│
                                             │  per-tenant URL)     │
                                             └───────────┬──────────┘
                                                         │
                                                         ▼
                                             ┌──────────────────────┐
                                             │ Dynatrace Tenant     │
                                             │ - Grail data lake    │
                                             │ - Smartscape topology│
                                             │ - Davis AI analyzers │
                                             └───────────┬──────────┘
                                                         │ OTel
                                                         ▼
                                             ┌──────────────────────┐
                                             │ Synthetic demo env   │
                                             │  - svc-payments-v2   │
                                             │    (deprecating)     │
                                             │  - svc-payments-v3   │
                                             │    (replacement)     │
                                             │  - svc-reporting     │
                                             │    (downstream)      │
                                             │  - k6 load generator │
                                             │  (Cloud Run)         │
                                             └──────────────────────┘
```

### 5.2 The four agents (ADK sub-agents)

| Agent | When it runs | MCP tools used | Output |
|-------|-------------|------------------|---------|
| **Coordinator** | Always; entry point | All, via delegation | Routes work to sub-agents |
| **Learner** | Phase 1 (manual or scheduled) | `find_entity_by_name`, `get_entity_details`, `generate_dql_from_natural_language`, `verify_dql`, `execute_dql`, `list_davis_analyzers`, `execute_davis_analyzer` (forecast + anomaly), `get_kubernetes_events` | Validated contracts written to Memory Bank |
| **Watcher** | Phase 2, every 5–15 min | `verify_dql`, `execute_dql`, `list_problems` | Violation candidates → triggers Forensic |
| **Forensic** | On Watcher trigger | `execute_dql` (deep), `get_entity_details`, `list_problems`, `chat_with_davis_copilot`, `send_event` | Ghost reports stored in Firestore + Dynatrace event |

### 5.3 Why Agent Engine and not just Cloud Run for the agent

Agent Engine's `long-running` runtime gives you:

- Persistent agent state across multi-day learning windows.
- Direct integration with `VertexAiMemoryBankService` (no separate vector DB).
- Sub-second cold starts (per Cloud Next 2026 announcements).
- Per-session telemetry that you get for free.

Cloud Run is for the **FastAPI gateway** (HTTP + SSE for the dashboard), not for the agent itself.

### 5.4 End-to-end data flow for one contract (the demo path)

```
1. User registers svc-payments-v2 on the dashboard, marks deprecation date.
   → POST /services creates Firestore record, fires "begin_learning" task.

2. Coordinator picks up the task, invokes Learner with svc-payments-v2 entity ID.

3. Learner asks Gemini: "given service X over last 14d, what are the latency,
   error, throughput, and side-effect signatures?"
   Gemini calls Dynatrace MCP tools:
     - find_entity_by_name("svc-payments-v2") → ENTITY_ID
     - generate_dql_from_natural_language("p95 latency by endpoint per hour")
     - verify_dql → execute_dql
     - execute_davis_analyzer(forecast/anomaly) for periodic patterns
     - execute_dql for log-pattern queries that reveal Redis writes

4. Gemini proposes candidate contracts in the §4.3 schema.

5. Contract validator: re-runs each violation_predicate over historical svc-A
   data via execute_dql. Rejects any candidate with > 0 false positives.

6. Validated contracts persist to Memory Bank via VertexAiMemoryBankService.
   Each contract becomes a "memory" tagged with the service ID.

7. Cutover event fires (manual button in the demo; in production: a webhook).

8. Watcher schedule begins. Every 10 min:
   - Pull each contract from Memory Bank for svc-payments-v2.
   - Evaluate predicate against svc-payments-v3 recent data via execute_dql.
   - On any failure → enqueue Forensic job (Pub/Sub).

9. Forensic agent:
   - Pulls deep trace + log context.
   - Pulls downstream svc-reporting metrics for same window.
   - Composes structured ghost report via Gemini (JSON output mode).
   - Writes to Firestore.
   - SSE pushes to dashboard → red ghost-pulse appears.
   - Emits Dynatrace event via send_event for audit trail.
```

---

## 6. Tech Stack & Rationale (with Disallowed Tools)

### 6.1 What you will use

| Layer | Choice | Why |
|-------|--------|-----|
| Agent framework | **Google ADK v1.0 (Python)** | Hackathon-mandated path; stable; Roger writes Python; supports sub-agent graphs |
| Agent runtime | **Agent Engine (`AdkApp`, long-running)** | Mandated by hackathon ("Agent Builder"); managed; first-class Memory Bank |
| Models | **Gemini 2.5 Pro** for Learner + Forensic deep reasoning; **Gemini 2.5 Flash** for Watcher periodic checks (cost) | Mandatory Gemini usage. Pro for reasoning quality, Flash for high-frequency cheap calls. |
| Persistent memory | **Memory Bank via `VertexAiMemoryBankService`** | Mandated by project brief; managed; the ADK wrapper makes it 5 lines of setup |
| Partner integration | **Dynatrace MCP server (hosted, remote)** at `https://{tenant}.apps.dynatrace.com/platform-reserved/mcp-gateway/v0.1/servers/dynatrace-mcp/mcp` with Platform Token bearer auth | Mandatory Partner MCP; hosted variant means no infra to manage; Platform Token is simpler than OAuth |
| API gateway | **FastAPI** | Roger's strongest stack; OpenAPI docs for free |
| Application DB | **Firestore** | Roger's pattern; serverless; SSE-friendly via Firestore listeners |
| Frontend | **Next.js 15 + TypeScript + Tailwind + ShadCN/UI** | Roger's strongest stack |
| Auth | **Firebase Auth** with Google sign-in only | Frictionless for judges; no password forms |
| Frontend deployment | **Cloud Run** (preferred over Vercel) | Keeps the entire stack on Google Cloud — judges notice this |
| Synthetic services | **3× Python FastAPI on Cloud Run**, instrumented with **OpenTelemetry → Dynatrace** | Fastest path; OTel is the standard ingestion channel; no GKE complexity |
| Cache (for the side-effect demo) | **Redis on Memorystore** or **a single redis container on Cloud Run** | Needed for the killer cache-warming demo |
| Load generator | **k6** as a Cloud Run job triggered by Cloud Scheduler | Realistic traffic; easy to script idempotency-conflict scenarios |
| CI/CD | **GitHub Actions** → Cloud Run / Agent Engine on push | Standard; Roger knows it |
| Self-observability | **Dynatrace** (Karma emits its own events via `send_event`) | Reinforces partner story; auditable |
| License | **MIT** | Maximally permissive; OSI-approved per §12 of the rules |

### 6.2 What you will NOT use (and why — explicit guard against disqualification)

| Avoid | Why |
|---|---|
| ❌ OpenAI / Anthropic / HuggingFace inference | Competing AI services. §7.B prohibits non-Google AI tools (Davis CoPilot through MCP is OK because it's the Partner's built-in AI). |
| ❌ LangChain *agents* (LangGraph, etc.) | Competes with Agent Builder. **However**, LangChain *utilities* (e.g. `RecursiveCharacterTextSplitter`) are not agent runtimes and are fine. |
| ❌ Pinecone / Weaviate / external vector DBs | Memory Bank fills this role; using a third-party vector DB weakens the "Agent Builder" story |
| ❌ Azure / AWS services | Competing cloud platforms per §7.B |
| ❌ Reusing prior project code | §7.B "Projects must be newly created." Even if a pattern from HSLU Exam Assistant fits, rewrite from scratch. |
| ❌ Heroku / Render / other PaaS | Compete with Cloud Run; weakens the GCP story |
| ❌ Docker Hub for prod images | Use Artifact Registry; keeps everything inside GCP |

---

## 7. The Demo Scenario — The Most Important Section

The 3-minute video is the single highest-leverage artifact in the submission. Judges skim everything; they *watch* the video. Plan the demo before you write code, then build to it.

### 7.1 The synthetic environment (build this in Phase 2)

Four Cloud Run services, all instrumented with OpenTelemetry exporting to your Dynatrace tenant:

**`svc-payments-v2`** — the "old" service marked for deprecation
- Endpoint `POST /charge` returns `{status: "ok", txn_id: <uuid>}` in ~80ms (p50), ~140ms (p95).
- Idempotency: when called with a repeated `Idempotency-Key`, returns `409 Conflict` with body `{"error": "duplicate", "original_txn_id": "<uuid>"}`.
- **Hidden side effect:** an async background task writes `recent_charges:summary` to Redis every 30 seconds. Nobody documented this. Nobody told the team writing v3.

**`svc-payments-v3`** — the freshly built replacement
- Same `POST /charge` API. Same `409` on idempotency conflict — **but the body is `{"error": "duplicate"}` only**, missing `original_txn_id`.
- **Critically: does not write to Redis.** All API tests and contract tests pass.

**`svc-reporting`** — the downstream consumer
- Reads `recent_charges:summary` from Redis every 60 seconds for its dashboard widget.
- Falls back to calling the payments service directly if the cache is empty — which makes its p95 latency climb from 50ms to 600ms and its sustained throughput drop ~8% (because the synchronous fallback path serializes more).

**`load-generator`** (k6 in Cloud Run job, cron-triggered)
- Sustained 50 RPS to v2 for the learning window (so the Learner has 12–48h of data).
- After cutover, switches to v3.
- 3% of traffic uses repeated idempotency keys to exercise the error path.

**Why these specific bugs?** Two contracts will be violated:
1. **Side-effect contract** (cache warming) — the marquee finding.
2. **Error-semantics contract** (missing `original_txn_id` in the 409 body) — a second, subtler finding that demonstrates Karma's breadth.

Two independent findings are much more convincing than one.

### 7.2 The 2:45 video script

| Time | Visual | Voice-over |
|------|--------|--------------|
| **0:00 – 0:12** | Title card: *Karma — The Reincarnation Agent for Deprecated Services*. Subtitle: *Service ghosts haunting their replacements.* | "Every team has lived this. You retire a service. The replacement passes every test. Three weeks later something breaks downstream and nobody can trace it. Karma is built for those bugs." |
| **0:12 – 0:40** | Dashboard. Register `svc-payments-v2` for deprecation. Karma's Learner kicks off (sped-up timelapse). Contracts appear one by one. | "Karma watches a service during its final weeks. It learns more than its API — it learns the implicit contracts the service holds. Latency bands. Error semantics. Side effects nobody documented." |
| **0:40 – 1:05** | Highlight three discovered contracts. Zoom into one: *"Side effect: writes summary to Redis every 30s. Downstream dependency detected: svc-reporting."* | "Karma found something the team forgot about. Every thirty seconds, payments-v2 silently warms a Redis cache that the reporting service reads from. Nobody wrote that down. Karma did." |
| **1:05 – 1:25** | Click "Mark cutover." Dashboard transitions to "Haunting" mode. Switch to svc-payments-v3. Show v3's test suite passing on screen — CI green, contract tests green. | "Cutover. The new service is live. Every test passes. CI is green." |
| **1:25 – 2:00** | Dashboard pulses: *"Ghost detected."* Karma report: *"svc-payments-v3 violates contract #4 (side_effect/cache_warming) — Redis writes absent for 11 minutes. Downstream impact: svc-reporting p95 latency +540ms, throughput −7.8%."* Then a second pulse: *"Contract #2 (error_semantics) — 409 payload missing field `original_txn_id`."* | "But Karma sees what the tests can't. The new service doesn't warm the cache. The reporting service is now eight percent slower. No alert fired. No test failed. Karma calls it out. And it catches a second regression — a 409 response missing a field that downstream clients silently relied on." |
| **2:00 – 2:25** | Open the ghost report. Show the side-by-side: old service's signature pattern vs. new service's pattern. Show the trace from svc-reporting hitting the slow fallback path. | "Every ghost report links to live Dynatrace data — the Redis writes that aren't happening, the downstream traces that are now slow. No claim is unsubstantiated." |
| **2:25 – 2:45** | Architecture overview: Gemini + ADK + Agent Engine + Memory Bank + Dynatrace MCP. End card with GitHub URL and live demo URL. | "Built with Gemini on the Agent Platform. Contracts persisted in Memory Bank. Integrated with Dynatrace through the MCP server. Karma — because every service deserves a graceful afterlife." |

### 7.3 Production tips for the video

- **Record at 1440p**, export at 1080p. Judges watch on laptops.
- Use a screen recorder that supports zoom (CleanShot X, Screen Studio).
- **Pre-load Karma's state** the day before. The "learning" section is a sped-up timelapse, not real-time. Real-time learning would take hours.
- Record voice-over separately in one clean take. Use Descript or similar for cleanup.
- **Add English captions** (mandatory per rules and judges may watch muted).
- **No copyrighted music.** Use YouTube Audio Library or compose your own.
- Final 5 seconds: end card with GitHub URL, hosted demo URL, Devpost URL.

### 7.4 The "demo broke during recording" fallback

Have a *golden run snapshot*: a captured Firestore state + screenshot library from a successful end-to-end run. If the live demo misbehaves on recording day, restore from snapshot. The agent's reasoning is reproducible from saved state — you do not need a flawless live run to ship the video.

---

## 8. Repository Structure

```
karma/
├── README.md                  ← OSS license badge, hackathon badge, demo GIF, arch diagram
├── LICENSE                    ← MIT
├── CHANGELOG.md
├── .github/
│   ├── workflows/
│   │   ├── deploy-agents.yml
│   │   ├── deploy-api.yml
│   │   ├── deploy-web.yml
│   │   └── deploy-synthetic-env.yml
│   └── copilot-instructions.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CONTRACT_SCHEMA.md
│   ├── DEMO_RUNBOOK.md        ← judges can reproduce
│   ├── DYNATRACE_SETUP.md
│   └── images/
│       ├── architecture.png
│       └── dashboard-hero.png
├── agents/                    ← Karma agent system (deployed to Agent Engine)
│   ├── pyproject.toml
│   ├── karma/
│   │   ├── __init__.py
│   │   ├── app.py             ← AdkApp entry; wires Memory Bank
│   │   ├── coordinator.py     ← root agent
│   │   ├── learner.py
│   │   ├── watcher.py
│   │   ├── forensic.py
│   │   ├── tools/
│   │   │   ├── dynatrace_mcp.py   ← MCP client adapter
│   │   │   └── contract_validator.py
│   │   ├── prompts/
│   │   │   ├── learner_system.md
│   │   │   ├── forensic_system.md
│   │   │   └── contract_schema.json
│   │   └── schemas/
│   │       └── contract.py        ← pydantic models
│   └── tests/
├── api/                       ← FastAPI gateway (Cloud Run)
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py
│   │   ├── routes/
│   │   │   ├── services.py
│   │   │   ├── contracts.py
│   │   │   ├── ghosts.py
│   │   │   ├── cutover.py
│   │   │   └── stream.py     ← SSE
│   │   ├── firestore_client.py
│   │   └── agent_client.py   ← calls Agent Engine
│   └── tests/
├── web/                       ← Next.js dashboard
│   ├── package.json
│   ├── app/
│   │   ├── (auth)/
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   ├── services/
│   │   │   ├── ghosts/
│   │   │   └── timeline/
│   │   └── api/
│   ├── components/
│   │   ├── ui/                ← ShadCN
│   │   ├── GhostCard.tsx
│   │   ├── ContractTimeline.tsx
│   │   └── ViolationPulse.tsx
│   └── lib/
│       ├── firebase.ts
│       └── sse.ts
├── synthetic-env/             ← demo environment
│   ├── svc-payments-v2/
│   ├── svc-payments-v3/
│   ├── svc-reporting/
│   ├── load-generator/
│   ├── docker-compose.yml     ← local dev
│   └── deploy/
│       └── cloud-run/*.yaml
├── infrastructure/
│   ├── terraform/             ← optional but impressive
│   └── setup-dynatrace.sh     ← provisions platform token, OTel collector config
└── scripts/
    ├── seed-demo-data.sh
    ├── reset-demo.sh
    └── golden-run-snapshot.sh
```

---

## 9. Day-0 Setup & Prerequisites

Do all of these on **May 18–19**. Some have lead times — they need to be in motion before any code is written.

| # | Action | Lead time | Deadline |
|---|---|---|---|
| 1 | Create Devpost account; register for `rapid-agent.devpost.com` | Instant | May 18 |
| 2 | Create `karma` GitHub repo (private until submission), add MIT LICENSE | Instant | May 18 |
| 3 | Create Google Cloud project `karma-rapid-agent-2026`; enable billing | Instant | May 18 |
| 4 | Submit the **$100 GCP credit form** linked in §6 of hackathon rules | **1–5 business days approval** | **By May 23** |
| 5 | Enable APIs: Vertex AI, Agent Builder / Agent Platform, Cloud Run, Firestore, Pub/Sub, Cloud Scheduler, Artifact Registry, Secret Manager | Instant | May 18 |
| 6 | Sign up for **Dynatrace SaaS trial** at `dynatrace.com/trial` (15-day free tier) | < 1h | May 18 |
| 7 | Generate **Dynatrace Platform Token** with required scopes (see §9.1) | Instant | May 19 |
| 8 | Set up an OTel collector pattern and verify telemetry shows up | Half-day | May 19 |
| 9 | Initialize Firebase project, Firestore in `europe-west6` (Zurich); enable Auth | Instant | May 19 |
| 10 | Register a domain (`karma-agent.dev` or similar) for the live demo URL | 24h DNS propagation | By May 22 |
| 11 | Configure GitHub Actions OIDC → GCP Workload Identity Federation | 1h | May 19 |

### 9.1 Required Dynatrace Platform Token scopes

For Karma to call all MCP tools, the Platform Token needs (verified against the official Dynatrace MCP repo):

```
storage:logs:read
storage:metrics:read
storage:bizevents:read
storage:events:read
storage:spans:read
storage:files:read
storage:events:write            ← for send_event
storage:entities:read
davis-copilot:conversations:execute
davis-copilot:nl2dql:execute
davis-copilot:dql2nl:execute
davis:analyzers:read
davis:analyzers:execute
settings:objects:read
mcp-gateway:servers:invoke      ← REQUIRED for the hosted MCP gateway
mcp-gateway:servers:read        ← REQUIRED for the hosted MCP gateway
environment:roles:viewer
```

### 9.2 Critical reading before any coding

1. **Dynatrace MCP server docs** — `docs.dynatrace.com/docs/dynatrace-intelligence/dynatrace-intelligence-integrations/dynatrace-mcp`
2. **ADK quickstart with Memory Bank** — `cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/memory-bank/quickstart-adk`
3. **ADK multi-agent patterns** — `google.github.io/adk-docs/`
4. **Agent Engine deployment with AdkApp** — `cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/develop/adk`
5. **DQL primer** — you'll mostly generate DQL via the MCP tool, but you need to read what comes back

---

## 10. 24-Day Build Plan

### Calendar overview

```
        May 2026                          June 2026
Mo Tu We Th Fr Sa Su            Mo Tu We Th Fr Sa Su
18 19 20 21 22 23 24             1  2  3  4  5  6  7
25 26 27 28 29 30 31             8  9 10[11]

[11] = submission deadline 2:00 PM PT = 23:00 CET
```

Roger is a working student at Zurich Insurance. Realistic budget: **~3 hours per weekday + 8 hours per weekend day ≈ 75–80 hours total**.

---

### Phase 1 — Foundation (Days 1–5, May 18–22)

**Goal:** infrastructure is up; you can call Dynatrace MCP from a Python script via Gemini through ADK.

- **Day 1 (Mon May 18)** — All §9 account setups. Submit GCP credit request. Push README skeleton + MIT LICENSE. Stand up Dynatrace trial tenant.
- **Day 2 (Tue May 19)** — Install OTel collector pattern on one Cloud Run test service; verify telemetry in Dynatrace. Generate Platform Token with full scope set. Test the hosted MCP URL with `curl` to confirm bearer auth works.
- **Day 3 (Wed May 20)** — ADK "hello world": a single Python agent that uses Gemini 2.5 Flash and calls one Dynatrace MCP tool (e.g., `find_entity_by_name`). Work locally with `adk run` first.
- **Day 4 (Thu May 21)** — Wire the agent to Memory Bank via `VertexAiMemoryBankService`. Save and retrieve a dummy contract JSON. **This is the most fragile integration — nail it early.**
- **Day 5 (Fri May 22)** — Deploy the dummy agent to Agent Engine using `AdkApp`. Verify it runs as long-running. Stand up FastAPI gateway skeleton on Cloud Run. **End of week 1: you can talk to Dynatrace through a Gemini-powered ADK agent deployed on Agent Engine, with contracts persisting in Memory Bank.**

> 🛑 **Gate:** if you can't hit this gate by Friday night, the scope is too big — see §11 cut lines and reduce.

---

### Phase 2 — Synthetic Environment + Learner (Days 6–10, May 23–27)

**Goal:** the demo synthetic environment is deployed and being learned from. The Learner reliably discovers the cache-warming contract.

- **Day 6 (Sat May 23)** — Build the three Python services (`svc-payments-v2`, `svc-payments-v3`, `svc-reporting`) and Redis. Deploy to Cloud Run with OTel exporters. Verify they appear in Smartscape.
- **Day 7 (Sun May 24)** — Build the k6 load generator. Start sustained load against svc-payments-v2 for at least 24h so the Learner has real baseline data. Verify the Redis writes are visible in Dynatrace traces.
- **Day 8 (Mon May 25)** — Define the contract pydantic schema. Write the Learner prompt that takes DQL results + Davis analyzer output and proposes contracts in the schema (use Gemini 2.5 Pro with structured JSON output).
- **Day 9 (Tue May 26)** — Implement the contract validator: re-run each candidate `violation_predicate` against historical data; reject any that fire false positives.
- **Day 10 (Wed May 27)** — Run the Learner end-to-end on svc-payments-v2. **Verify that it discovers (a) the latency band, (b) the error-payload pattern, and (c) the cache-warming side effect.** If the cache-warming contract isn't being learned reliably, debug prompts until it is. **This is the killer demo finding — it must work.**

> 🛑 **Gate:** by end of Day 10, the cache-warming contract must be discovered cold from telemetry 4 runs out of 5.

---

### Phase 3 — Watcher, Forensic, and Dashboard (Days 11–17, May 28–Jun 3)

**Goal:** end-to-end story works. Cutover triggers haunting. Regression detected. Ghost report renders.

- **Day 11 (Thu May 28)** — Build the Watcher agent. Schedule via Cloud Scheduler → Pub/Sub → Agent Engine.
- **Day 12 (Fri May 29)** — Build the Forensic agent. Must produce structured ghost reports (JSON output mode), not free-form text.
- **Day 13 (Sat May 30)** — Frontend scaffold: Next.js 15, ShadCN setup, custom palette and typography. Build Services list, Contract Timeline.
- **Day 14 (Sun May 31)** — Build the Ghosts feed view. Implement SSE in FastAPI and consume it from the dashboard. **Make the ghost-pulse animation tasteful — practice it.**
- **Day 15 (Mon Jun 1)** — Wire frontend to FastAPI gateway. Firebase Auth with Google sign-in only.
- **Day 16 (Tue Jun 2)** — **First full end-to-end dry run.** Register a service, run Learner on prepared data, trigger cutover, observe regression detection. Fix everything that breaks.
- **Day 17 (Wed Jun 3)** — **Second full dry run as if you were the judge.** Time it. Polish the rough spots.

> 🛑 **Gate:** by end of Day 17, a judge can reproduce the demo end-to-end without you in the room.

---

### Phase 4 — Polish, Documentation, Submission (Days 18–24, Jun 4–10)

**Goal:** the submission package is excellent and submitted with time to spare.

- **Day 18 (Thu Jun 4)** — Write all documentation: README (with arch diagram, demo GIF, the metaphor front and center), ARCHITECTURE.md, CONTRACT_SCHEMA.md, DEMO_RUNBOOK.md.
- **Day 19 (Fri Jun 5)** — Write and rehearse the video script. Run through it 5 times before recording.
- **Day 20 (Sat Jun 6)** — Record the video. Edit. Add captions.
- **Day 21 (Sun Jun 7)** — Upload to YouTube as unlisted. Sleep on it. Rewatch fresh. Re-record any segments that don't land.
- **Day 22 (Mon Jun 8)** — Make the repo public. Verify LICENSE shows in GitHub "About" section. Add the topic `google-cloud-rapid-agent-hackathon`. Add screenshots to README.
- **Day 23 (Tue Jun 9)** — Final dry run with a friend or HSLU classmate as the judge. Have them try to reproduce from DEMO_RUNBOOK.md cold. Fix every blocker.
- **Day 24 (Wed Jun 10)** — **Submit on Devpost.** Make YouTube video public. Triple-check all fields. **Submit by 18:00 CET — 21 hours before deadline.**
- **Day 25 (Thu Jun 11)** — Buffer day. By 23:00 CET (= 14:00 PT) the contest is closed.

---

## 11. Risk Register & Cut Lines

Decide cut lines now — while you're calm — so future-you doesn't make bad calls at midnight.

| # | Risk | Probability | Impact | Cut line |
|---|---|---|---|---|
| 1 | Dynatrace MCP auth/scope issues eat a day | Medium | High | If blocked > 4h on Day 2, use the **local MCP package** (`npx @dynatrace-oss/dynatrace-mcp-server`) instead of the hosted gateway — same tools, OAuth client auth |
| 2 | Gemini can't reliably learn the cache-warming contract | Medium | **Critical** | Hard-code a "guidance hint" in the Learner system prompt: *"Pay specific attention to async writes to external stores (Redis, queues) that are not part of the HTTP response."* Less impressive but reliable. |
| 3 | Agent Engine `long-running` quotas/limits hit | Low | Medium | Fall back to a Cloud Run scheduled job that invokes ADK directly. Lose "managed runtime" angle, keep agent. |
| 4 | Memory Bank API limitations for structured contracts | Low | Medium | Store contracts in Firestore; use Memory Bank only for conversational session memory. Adjust pitch to "Memory Bank for agent session continuity, Firestore for structured contracts." |
| 5 | Synthetic env doesn't generate enough realistic data | Medium | High | Pre-generate 14 days of telemetry with a backfill script; the Learner reads "history" via DQL fine |
| 6 | Frontend animation work eats more time than budgeted | High | Medium | Drop the ghost-pulse animation; keep the contract-violation-row highlight. Acceptable UX. |
| 7 | Video editing eats Day 21 entirely | High | Medium | Pre-script a 90-second minimum-viable-demo version as fallback |
| 8 | A teammate flakes out | Medium | Variable | Plan for solo execution from Day 1; treat teammates as bonus capacity, not critical path |
| 9 | Hackathon clarifications change rules mid-build | Low | Variable | Check Devpost Updates + Discussions tabs every other day; subscribe to email notifications |
| 10 | You spend Day 23 polishing instead of finishing | High | High | **Hard rule:** stop adding features after Day 20. Days 21–24 are documentation, video, and bugfixes only. |
| 11 | Grail query budget exhausted during live demo | Low | Medium | Set `DT_GRAIL_QUERY_BUDGET_GB=1000`; cache Watcher queries; pre-bake demo path so it doesn't query unbounded ranges |

### What you will explicitly NOT build (locked decisions)

- ❌ Multi-tenancy or team workspaces. Single user.
- ❌ Production OAuth flow for Dynatrace tenant onboarding. Demo uses a hardcoded tenant.
- ❌ Service auto-discovery. User manually registers services in the dashboard.
- ❌ Notification integrations (Slack, email). Ghosts only appear in the dashboard.
- ❌ Configurable contract schemas. Hardcode the 8 categories.
- ❌ A mobile app. Web only.
- ❌ A marketing landing page. The dashboard *is* the entry point.
- ❌ A pricing tier or "free trial" gate. Demo is open.

---

## 12. Submission Package Checklist

### 12.1 Devpost submission form

- [ ] **Project name:** `Karma — The Reincarnation Agent for Deprecated Services`
- [ ] **Tagline (≤140 chars):** *"Karma learns what deprecated services secretly did, then watches replacements and flags silent regressions that pass every test."*
- [ ] **Track:** Dynatrace
- [ ] **Full description** (see template §12.2)
- [ ] **Built with** — Gemini, Vertex AI / Gemini Enterprise Agent Platform, Agent Development Kit (ADK), Agent Engine, Memory Bank, Dynatrace, Dynatrace MCP, Cloud Run, Firestore, FastAPI, Next.js, TypeScript, Tailwind, ShadCN, Firebase Auth, OpenTelemetry
- [ ] **Try-it-out link:** hosted demo URL (HTTPS)
- [ ] **Code repository:** GitHub URL (public, license visible)
- [ ] **Video URL:** YouTube (public, captions enabled)
- [ ] **All team members added on Devpost**
- [ ] **Image / logo** — clean wordmark with a faint ghost glyph

### 12.2 Full description template (paste into Devpost on submission day)

```markdown
## Inspiration

Every team that has run a microservice migration has lived this story:
the old service is retired, the replacement passes every test, CI is
green — and three weeks later something breaks downstream that nobody
can trace. Karma is built for that class of bug.

## What it does

Karma is an autonomous agent that haunts deprecated services. During a
service's final weeks before sunset, Karma observes it through Dynatrace
and learns its *implicit contracts*: undocumented latency bands, error
semantics, side effects (like a cache nobody knew was being warmed), and
downstream behaviors it accidentally enabled. After cutover, Karma
watches the replacement and flags silent regressions — changes that pass
every test but quietly break downstream systems.

In our demo, Karma discovers that the deprecated payments service
silently warmed a Redis cache that the reporting service depended on.
The replacement passes every test, but Karma detects that the cache
warm-up has stopped, traces the impact to a 7.8% throughput drop in the
reporting service, and produces a ghost report linked to live Dynatrace
data.

## How we built it

- **Multi-agent system** built on Google's Agent Development Kit v1.0,
  with four sub-agents: Coordinator, Learner, Watcher, Forensic.
- **Gemini 2.5 Pro** for deep reasoning (contract learning and ghost
  reports); **Gemini 2.5 Flash** for high-frequency Watcher checks.
- **Agent Engine in long-running mode**, with implicit contracts
  persisted in **Memory Bank** via VertexAiMemoryBankService.
- **Dynatrace integration** through the hosted Dynatrace MCP Server,
  using seven tools: generate_dql_from_natural_language, verify_dql,
  execute_dql, find_entity_by_name, list_problems, execute_davis_analyzer,
  send_event (for self-observability).
- **FastAPI gateway** on Cloud Run; **Next.js dashboard** on Cloud Run;
  **Firestore** for application state; **Firebase Auth** for sign-in.
- **A synthetic three-service environment** instrumented with
  OpenTelemetry exporting to Dynatrace, used as the demo target.

## Challenges we ran into

[Replace with 2–3 honest reflections from the actual build.]

## Accomplishments we're proud of

- Karma reliably discovers undocumented cache-warming side effects —
  the exact class of bug that current observability misses by design.
- Every claim in a ghost report is grounded in linked Dynatrace
  evidence; no hallucinated metrics.
- Karma observes itself: every agent decision is emitted as a
  Dynatrace event via send_event, making the watcher fully auditable
  inside the platform.
- Contracts are validated against the old service's historical
  telemetry before being saved — false-positive predicates are rejected
  automatically.

## What we learned

[Replace with real reflections.]

## What's next for Karma

- Auto-discovery of services slated for deprecation by reading
  deployment manifests and SLO tracker data.
- Cross-service contract inference: learn contracts that span A→B→C,
  not just one service.
- Active intervention: propose code patches for the replacement
  service to honor missing contracts.
```

### 12.3 Repository must-haves

- [ ] `LICENSE` (MIT) at root
- [ ] `README.md` with: title, hackathon badge, demo video embedded (or thumbnail), arch diagram, "Try it" buttons (hosted demo + Devpost), prerequisites, local setup, deployment, hackathon disclosure section
- [ ] License visible in GitHub "About" panel (Repository Settings → License)
- [ ] Topic tag `google-cloud-rapid-agent-hackathon`
- [ ] **No secrets committed.** Use `.env.example` files. Verify with `gitleaks` or `git secrets`.
- [ ] CI green on `main`
- [ ] Tagged release `v1.0.0-hackathon-submission`

### 12.4 Hosting

- [ ] `karma.<your-domain>` → dashboard, HTTPS only
- [ ] `api.karma.<your-domain>` → FastAPI gateway
- [ ] A "Reset demo" button on the dashboard so judges can return state to baseline
- [ ] An "About this demo" page that openly notes the synthetic environment exists by design (transparency wins points)

### 12.5 Video checklist

- [ ] **≤ 3 minutes** — verify with a stopwatch, not just metadata
- [ ] **Public on YouTube** on or before submission
- [ ] English audio + English captions
- [ ] No copyrighted music
- [ ] Title: `Karma — Reincarnation Agent for Deprecated Services | Google Cloud Rapid Agent Hackathon (Dynatrace Track)`
- [ ] Description: GitHub URL + live demo URL + Devpost URL

---

## 13. Stretch Goals (Only If Ahead of Schedule)

Touch these only if Day 17 dry runs are successful with time to spare. They are explicitly *not* in the critical path.

1. **A2A protocol exposure.** Make Karma callable by other agents via the production-grade A2A protocol launched at Cloud Next 2026. Adds an enterprise-grade "talk to my SRE bot" angle.
2. **Cross-service contract inference.** Detect contracts that span A→B→C, not just A.
3. **Contract diff view.** A literal git-diff-style UI of the old service's contracts vs. the new service's observed behavior.
4. **One-click suggested fix.** Karma proposes a code patch PR for the replacement service.
5. **Severity weighting.** Let users weight contracts by SLO criticality.
6. **Slack notification connector.** Through Dynatrace's MCP `send_slack_message` tool, push ghost reports to Slack.

---

## 14. References & Setup Links

### Hackathon
- Devpost contest page: `https://rapid-agent.devpost.com`
- Official rules (re-read on May 25 and Jun 1)
- $100 GCP credit form: linked in §6 of the rules — submit by **May 23** for safety

### Google Cloud / Gemini Enterprise Agent Platform
- Platform overview: `https://cloud.google.com/products/agent-builder`
- ADK GitHub (Python): `https://github.com/google/adk-python` (use v1.0+)
- ADK docs: `https://google.github.io/adk-docs/`
- Memory Bank quickstart (ADK): `https://cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/memory-bank/quickstart-adk`
- Agent Engine docs: `https://cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/develop/adk`
- $300 new-customer free credits if you're new to GCP

### Dynatrace
- MCP server docs: `https://docs.dynatrace.com/docs/dynatrace-intelligence/dynatrace-intelligence-integrations/dynatrace-mcp`
- Hosted MCP URL template: `https://{tenant}.apps.dynatrace.com/platform-reserved/mcp-gateway/v0.1/servers/dynatrace-mcp/mcp`
- Local fallback: `npx -y @dynatrace-oss/dynatrace-mcp-server`
- MCP GitHub: `https://github.com/dynatrace-oss/dynatrace-mcp`
- DQL reference: `https://docs.dynatrace.com/docs/discover-dynatrace/references/dynatrace-query-language`
- Free trial: `https://www.dynatrace.com/trial/`

### OpenTelemetry → Dynatrace
- OTel collector for Dynatrace: `https://docs.dynatrace.com/docs/extend-dynatrace/opentelemetry`
- Cloud Run + OTel: configure the OTel collector as a sidecar or use the OpenTelemetry SDK directly with the Dynatrace endpoint + API token

### Stack you already know (no time budget needed)
- Next.js 15, ShadCN, Tailwind, FastAPI, Firebase Auth, Firestore, Cloud Run, GitHub Actions

### New stack to learn (time budget)
| Topic | Estimated learning time |
|---|---|
| ADK v1.0 multi-agent patterns | ~6 hours (docs + hello-world) |
| Agent Engine deployment via `AdkApp` | ~3 hours |
| Memory Bank API + `VertexAiMemoryBankService` | ~3 hours |
| Dynatrace DQL fluency | ~4 hours |
| Dynatrace MCP setup + tool calling | ~3 hours |
| OTel collector → Dynatrace | ~3 hours |
| **Total new-learning budget** | **~22 hours** |

---

## 15. Daily Discipline Notes

Five non-negotiable habits during the 24 days:

1. **Commit and push every working day**, even if small. A continuous commit history is impressive to judges who skim the repo.
2. **Update `CHANGELOG.md` at end of day** with what shipped.
3. **Write tomorrow's three priorities before closing the laptop.** No empty mornings.
4. **Re-read §11 (Cut Lines) on Day 10 and Day 17.** Adjust scope if behind schedule.
5. **Never skip the daily check-in with §3 (Judging Criteria).** Ask: *does what I'm building right now improve Tech Implementation, Design, Impact, or Idea?* If no — stop.

---

## Final word

This document is your contract with yourself. When you're tired at midnight on Day 14 and tempted to add a feature called "Karma also predicts future regressions," come back to §13 — that's a stretch goal — and to §7 — that's not in the demo. **The demo is what wins.** Build for the demo.

When you submit, you should be able to look at every checkbox in §12 and tick it off cleanly. If even one is unchecked at the final hour, you spent the budget wrong.

Good luck, Roger. Build the ghost.

— Plan prepared May 18, 2026
