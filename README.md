# Karma — The Reincarnation Agent for Deprecated Services

> "The new service passes every test, CI is green, and downstream throughput dropped 8% because nobody knew the old service was warming a cache."

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Google Cloud Rapid Agent Hackathon](https://img.shields.io/badge/Google%20Cloud-Rapid%20Agent%20Hackathon-4285F4?logo=google-cloud)](https://rapid-agent.devpost.com)
[![Track: Dynatrace](https://img.shields.io/badge/Track-Dynatrace-1284CC)](https://rapid-agent.devpost.com)
[![Built with ADK](https://img.shields.io/badge/Built%20with-Google%20ADK%20v1.0-34A853)](https://github.com/google/adk-python)

Karma is an autonomous agent that **haunts deprecated services**. During a service's final weeks it learns the *implicit contracts* — undocumented latency bands, error semantics, side effects like Redis cache warming, and downstream dependencies nobody documented. After cutover, Karma watches the replacement and files *ghost reports* for every silent regression that passes every test but quietly breaks downstream systems.

---

## The Problem

Tests check the contract you wrote down. **Karma checks the contract you forgot you had.**

Every migration team has lived this story: the old service is retired, the replacement passes every test, CI is green — and three weeks later something breaks downstream that nobody can trace. No alert fired. No test failed.

Karma catches it.

---

## Live Deployment

| Service | URL |
|---------|-----|
| **Web dashboard** | https://karma-web-957527396263.us-central1.run.app |
| **API (REST)** | https://karma-api-957527396263.us-central1.run.app |
| **API docs (Swagger)** | https://karma-api-957527396263.us-central1.run.app/docs |
| **Dynatrace tenant** | https://slm61962.apps.dynatrace.com |
| **Demo: svc-payments-v2** | https://karma-svc-payments-v2-957527396263.us-central1.run.app |
| **Demo: svc-payments-v3** | https://karma-svc-payments-v3-957527396263.us-central1.run.app |
| **Demo: svc-reporting** | https://karma-svc-reporting-957527396263.us-central1.run.app |

---

## Demo

[**Watch the 2:45 demo video**](#) · [**Try the live demo**](https://karma-web-957527396263.us-central1.run.app) · [**Devpost submission**](https://rapid-agent.devpost.com)

### The marquee finding

```
Ghost detected — svc-payments-v3

Contract #4 violated: side_effect / cache_warming
Redis writes absent for 11 minutes.
Downstream impact: svc-reporting p95 latency +540ms, throughput −7.8%

Contract #2 violated: error_semantics / idempotency_response
409 response body missing field `original_txn_id`
Downstream: clients parsing the field receive null silently
```

---

## How It Works

### Phase 1 — Learning (service's final weeks)

```
Old Service ──telemetry──▶ Dynatrace ──MCP──▶ Karma Learner ──▶ Implicit Contracts
                                                                  (Memory Bank, JSON)
```

### Phase 2 — Haunting (after cutover)

```
New Service ──telemetry──▶ Dynatrace ──MCP──▶ Karma Watcher ──▶ compare contracts
                                                                         │
                                                               Ghost Reports (Forensic)
                                                               Dashboard · Dynatrace Events
```

---

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system diagram.

### Four-agent system (Google ADK v1.0)

| Agent | When | Gemini model | Key MCP tools |
|-------|------|-------------|---------------|
| **Coordinator** | Always — entry point | 2.5 Flash | All, via delegation |
| **Learner** | Phase 1 (manual / scheduled) | 2.5 Pro | `generate_dql_from_natural_language`, `execute_dql`, `execute_davis_analyzer`, `find_entity_by_name` |
| **Watcher** | Phase 2, every 10 min | 2.5 Flash | `verify_dql`, `execute_dql`, `list_problems` |
| **Forensic** | On violation trigger | 2.5 Pro | `execute_dql`, `chat_with_davis_copilot`, `send_event` |

---

## The Eight Implicit Contract Categories

| # | Category | What Karma checks |
|---|----------|-------------------|
| 1 | **Latency** | p50/p95/p99 bands per endpoint, per hour-of-day |
| 2 | **Error semantics** | Status codes and payload shapes under specific conditions |
| 3 | **Throughput** | QPS bands and burst-capacity envelope |
| 4 | **Side effects** *(the killer category)* | Cache writes, log records, async work, pre-warmed connections |
| 5 | **Timing** | Order of operations; gap between call and downstream effect |
| 6 | **Dependency** | Which downstream services are called, at what frequency |
| 7 | **Resource** | Connection-pool usage, memory steady-state, file descriptors |
| 8 | **Sequencing** | Retry behavior, idempotency assumptions, ordering guarantees |

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Agent framework | Google ADK v1.0 (Python) |
| Agent runtime | Agent Engine — long-running (`AdkApp`) |
| Models | Gemini 2.5 Pro (Learner, Forensic) · Gemini 2.5 Flash (Coordinator, Watcher) |
| Memory | Vertex AI Memory Bank (`VertexAiMemoryBankService`) |
| Partner integration | Dynatrace MCP Server (hosted, Bearer token) |
| API gateway | FastAPI on Cloud Run |
| Database | Firestore |
| Frontend | Next.js + TypeScript + Tailwind + ShadCN/UI on Cloud Run |
| Auth | Firebase Auth (Google sign-in only) |
| Instrumentation | OpenTelemetry → Dynatrace |
| CI/CD | GitHub Actions → Cloud Run / Agent Engine |

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- Google Cloud project with Vertex AI, Cloud Run, Firestore enabled
- Dynatrace SaaS tenant with Platform Token (see [docs/DYNATRACE_SETUP.md](docs/DYNATRACE_SETUP.md))

### 1. Clone and configure

```bash
git clone https://github.com/rogerjeasy/karma.git
cd karma
cp .env.example .env
# Edit .env — fill in GCP project, Dynatrace tenant, and token
```

### 2. Agents (local dev)

```bash
cd agents
pip install -e ".[dev]"
adk run karma.app
```

### 3. API gateway

```bash
cd api
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8001
```

### 4. Web dashboard

```bash
cd web
cp .env.local.example .env.local
# Fill in Firebase config and API URL
npm install
npm run dev
```

### 5. Synthetic demo environment

```bash
cd synthetic-env
docker compose up
# svc-payments-v2 on :8010, svc-payments-v3 on :8011,
# svc-reporting on :8012, redis on :6379
```

See [docs/DEMO_RUNBOOK.md](docs/DEMO_RUNBOOK.md) for the complete end-to-end reproduction guide.

---

## Deployment

All deployment is via GitHub Actions (OIDC → Workload Identity Federation):

```bash
# On push to main, all four workflows run:
# .github/workflows/deploy-agents.yml   → Agent Engine
# .github/workflows/deploy-api.yml      → Cloud Run (api)
# .github/workflows/deploy-web.yml      → Cloud Run (web)
# .github/workflows/deploy-synthetic-env.yml → Cloud Run (demo services)
```

---

## Hackathon Disclosure

Built for the [Google Cloud Rapid Agent Hackathon — Dynatrace Track](https://rapid-agent.devpost.com) (submission deadline June 11, 2026). The `synthetic-env/` directory is a purpose-built three-service demo environment — it is not production traffic. Every claim in a ghost report is backed by real Dynatrace telemetry from that environment.

**No OpenAI, Anthropic, or non-Google AI services are used.** Gemini family only, per hackathon rules.

---

## License

[MIT](LICENSE) © 2026 Roger Jeasy Bavibidila (`@rogerjeasy`)
