# GitHub Copilot Instructions for Karma

## What this project is

Karma is a multi-agent observability system built for the Google Cloud Rapid Agent Hackathon (Dynatrace track). It discovers *implicit contracts* of deprecated services and flags regressions in their replacements.

## Strict constraints (hackathon rules — do not violate)

- **No OpenAI, Anthropic, HuggingFace, or any non-Google AI services.** Use Gemini family only.
- **No LangChain agents** (LangGraph, etc.). LangChain *utilities* (text splitters) are fine.
- **No Azure or AWS services.** Everything on Google Cloud.
- **No Pinecone, Weaviate, or external vector DBs.** Use Vertex AI Memory Bank.
- **No code reuse from prior projects.** All code is written fresh for this hackathon.

## Architecture at a glance

```
web (Next.js/Cloud Run) → api (FastAPI/Cloud Run) → agents (ADK/Agent Engine)
                                                           ↕ MCP
                                                    Dynatrace MCP Server
                                                           ↕ OTel
                                                    synthetic-env (demo services)
```

## Agents layout (`agents/karma/`)

| File | Role |
|------|------|
| `app.py` | `AdkApp` entry point; wires `VertexAiMemoryBankService` |
| `coordinator.py` | Root agent; routes to sub-agents |
| `learner.py` | Learns implicit contracts from telemetry |
| `watcher.py` | Evaluates violation predicates every 10 min |
| `forensic.py` | Composes evidence-grounded ghost reports |
| `tools/dynatrace_mcp.py` | `MCPToolset` wrapper for the Dynatrace MCP server |
| `tools/contract_validator.py` | Validates predicates against historical data |
| `schemas/contract.py` | Pydantic models for contracts and violations |

## Contract categories (hardcoded — do not change schema)

1. `latency` 2. `error_semantics` 3. `throughput` 4. `side_effect`
5. `timing` 6. `dependency` 7. `resource` 8. `sequencing`

## Style conventions

- **Python:** `ruff` for linting, `mypy` for types, `pytest` for tests, `pyproject.toml` per package
- **TypeScript:** strict mode, `eslint` + `prettier`, no `any`
- **Commits:** conventional commits (`feat:`, `fix:`, `chore:`, etc.) — update CHANGELOG.md each day
- **No secrets in code.** All credentials via Secret Manager → env vars

## Key environment variables

See `.env.example` at repo root. Never hardcode `DT_API_TOKEN` or GCP credentials.

## Demo scenario

The marquee finding is the **cache-warming side effect**: `svc-payments-v2` writes to Redis every 30s, `svc-payments-v3` doesn't, and `svc-reporting` silently degrades. The `synthetic-env/` directory implements this exactly.
