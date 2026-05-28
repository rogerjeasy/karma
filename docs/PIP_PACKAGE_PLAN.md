# Karma — Python Package Transformation Plan

> **Verdict: Yes, it is possible.** Complexity is **medium-to-high** depending on which packaging tier you target. This document outlines the feasibility assessment, three packaging options, and a phased implementation roadmap.

---

## 1. Feasibility Assessment

### What the package would expose to a user

```bash
pip install karma-agent

karma init                                    # scaffold config & credentials
karma learn --old payments-v2 --new payments-v3
karma watch --service payments-v3
karma ghosts list
karma report --ghost abc123
karma serve                                   # launch local API + dashboard
```

### What makes this tractable

| Factor | Current state | Packagable? |
|--------|---------------|-------------|
| Python backend (FastAPI + agents) | Already Python 3.11 | ✅ Yes, straightforward |
| CLI entry points | None yet | ✅ Easy to add via `pyproject.toml` |
| Multi-agent orchestration (Google ADK) | `agents/karma/` package | ✅ Importable as a sub-package |
| LLM calls | Vertex AI / Gemini | ✅ With credentials; optionally swappable |
| Persistence | Firestore | ⚠️ Cloud-only; local mode needs a shim |
| Messaging | Pub/Sub | ⚠️ Cloud-only; local mode needs a shim |
| Frontend (Next.js dashboard) | Separate service | ⚠️ Needs pre-built static export |
| Auth | Firebase | ⚠️ Optional in local/dev mode |

### What makes it complex

1. **Cloud dependencies** — Firestore, Pub/Sub, Vertex AI, and Firebase are baked into the core. A local mode requires either credential delegation (users bring their own GCP) or lightweight shims (SQLite, asyncio queues, direct Gemini API).
2. **Frontend packaging** — Next.js cannot be shipped as Python source. It must be pre-compiled to static files and bundled as package data.
3. **Credentials bootstrapping** — On first run, the user needs GCP credentials, Dynatrace tokens, and optionally Firebase service account JSON. The UX for this must be guided.
4. **Multi-process runtime** — The current deployment runs three separate processes (API, ADK agent server, Next.js). A single `karma serve` command must orchestrate all of them.

---

## 2. Packaging Options

Three tiers of ambition, from simplest to most powerful:

---

### Option A — SDK + CLI (Cloud-Delegation Mode)

> The package is a thin client. Users must have a Karma API deployed somewhere (Cloud Run or self-hosted). The CLI calls that API.

**User experience:**
```bash
pip install karma-agent
karma configure --api-url https://karma-api-xxx.a.run.app --token <firebase-token>
karma learn --old svc-payments-v2 --new svc-payments-v3
karma ghosts list
```

**What ships in the package:**
- Python HTTP client wrapping the existing REST API (`/contracts`, `/ghosts`, `/services`)
- CLI layer (Typer or Click)
- No bundled server, no agent code at runtime

**Complexity: Low**
Estimated effort: ~1–2 weeks

**Best for:** Teams with a centrally deployed Karma instance who want a terminal workflow.

---

### Option B — Self-contained Package (Local Mode)

> The package embeds the full agent system. Users supply only an LLM API key. No GCP required by default.

**User experience:**
```bash
pip install karma-agent[local]
karma init               # creates ~/.karma/config.yaml, SQLite DB
karma learn --old http://old-svc --new http://new-svc
karma serve              # starts API + opens dashboard at localhost:8080
```

**What ships in the package:**
- FastAPI app (`api/`)
- ADK agent orchestration (`agents/`)
- SQLite adapter replacing Firestore
- asyncio in-process queue replacing Pub/Sub
- Pre-compiled Next.js static files served via FastAPI `StaticFiles`
- Gemini API key support (no Vertex AI / service account required)

**Complexity: High**
Estimated effort: ~4–6 weeks

**Best for:** Individual developers, open-source contributors, local evaluation before cloud deployment.

---

### Option C — Hybrid Package (Recommended)

> Defaults to local mode; can be pointed at a full GCP stack via config. One package, two personalities.

**User experience:**
```bash
pip install karma-agent

# --- Local mode (no GCP) ---
karma init --local
karma serve

# --- Cloud mode (existing deployment) ---
karma init --gcp --project my-gcp-project
karma serve --cloud
```

**What ships in the package:**
- Everything from Option B
- A backend abstraction layer (storage interface, queue interface) so Firestore/SQLite are interchangeable at runtime
- A `karma.yaml` config schema that switches modes

**Complexity: High (but only ~20% more than Option B)**
Estimated effort: ~5–7 weeks

**Best for:** All use cases — local dev, CI pipelines, enterprise cloud deployment.

> **Recommendation: Build Option A first (1–2 weeks), then graduate to Option C.** This delivers value immediately and de-risks the larger refactor.

---

## 3. Proposed Package Structure

The source repository would be reorganized into a single installable Python package:

```
karma/                          ← root of git repo
│
├── src/
│   └── karma_agent/            ← installable package (import karma_agent)
│       ├── __init__.py
│       ├── cli/
│       │   ├── __init__.py
│       │   ├── main.py         ← Typer app, all CLI commands
│       │   ├── commands/
│       │   │   ├── init.py     ← karma init
│       │   │   ├── learn.py    ← karma learn
│       │   │   ├── watch.py    ← karma watch
│       │   │   ├── ghosts.py   ← karma ghosts list/show
│       │   │   ├── serve.py    ← karma serve (launches API + dashboard)
│       │   │   └── configure.py
│       ├── api/                ← (moved from api/app/)
│       │   ├── main.py
│       │   ├── routes/
│       │   ├── models.py
│       │   └── ...
│       ├── agents/             ← (moved from agents/karma/)
│       │   ├── coordinator.py
│       │   ├── learner.py
│       │   ├── watcher.py
│       │   ├── forensic.py
│       │   └── ...
│       ├── storage/
│       │   ├── base.py         ← abstract interface (ContractStore, GhostStore)
│       │   ├── firestore.py    ← GCP implementation
│       │   └── sqlite.py       ← local implementation
│       ├── queue/
│       │   ├── base.py         ← abstract interface
│       │   ├── pubsub.py       ← GCP implementation
│       │   └── memory.py       ← in-process asyncio implementation
│       ├── static/             ← pre-compiled Next.js export (package data)
│       │   └── ...             ← built by `npm run export` in web/
│       └── config.py           ← unified config (reads karma.yaml / env vars)
│
├── pyproject.toml              ← single root pyproject.toml
├── web/                        ← Next.js source (unchanged)
├── scripts/
│   └── build_frontend.sh       ← builds web/ → src/karma_agent/static/
└── tests/
```

---

## 4. Phased Implementation Roadmap

### Phase 0 — Decision & Spike (1–2 days)

- [ ] Decide which option to build (A, B, or C)
- [ ] Verify that `agents/karma/` can be imported outside of its current folder structure
- [ ] Verify that the Next.js app can be built with `next export` to static files
- [ ] Choose CLI framework: **Typer** (recommended — built on Click, type-safe, auto-generates `--help`)

---

### Phase 1 — Package Skeleton (3–5 days)

**Goal:** `pip install -e .` works; `karma --help` prints a usage message.

- [ ] Add a root `pyproject.toml` with:
  - Package name: `karma-agent`
  - Entry point: `karma = karma_agent.cli.main:app`
  - Optional dependency groups: `[local]`, `[gcp]`, `[full]`
- [ ] Move `api/app/` → `src/karma_agent/api/`
- [ ] Move `agents/karma/` → `src/karma_agent/agents/`
- [ ] Create `src/karma_agent/cli/main.py` with stubbed commands
- [ ] Confirm `karma --version` and `karma --help` work

**Sample `pyproject.toml` structure:**
```toml
[project]
name = "karma-agent"
version = "0.1.0"
description = "Autonomous ghost regression detection for service migrations"
requires-python = ">=3.11"
dependencies = [
    "typer>=0.12",
    "httpx>=0.27",
    "pydantic>=2.7",
    "rich>=13",           # terminal output formatting
    "pyyaml>=6",
]

[project.optional-dependencies]
local = [
    "fastapi>=0.111",
    "uvicorn>=0.30",
    "aiosqlite>=0.20",
    "google-generativeai>=0.7",   # Gemini direct API (no Vertex)
    "google-adk>=1.5",
]
gcp = [
    "google-cloud-firestore>=2.16",
    "google-cloud-pubsub>=2.21",
    "google-cloud-aiplatform>=1.56",
    "firebase-admin>=6.5",
]
full = ["karma-agent[local,gcp]"]

[project.scripts]
karma = "karma_agent.cli.main:app"
```

---

### Phase 2 — Storage & Queue Abstraction (4–6 days)

**Goal:** The agent and API code can run with either Firestore or SQLite, switched by config.

- [ ] Define `StorageBackend` abstract base class:
  - `save_contract()`, `get_contract()`, `list_contracts()`
  - `save_ghost()`, `get_ghost()`, `list_ghosts()`
  - `save_service()`, `get_service()`, `list_services()`
- [ ] Implement `FirestoreBackend` (wraps existing `firestore_client.py`)
- [ ] Implement `SQLiteBackend` (new, uses `aiosqlite`)
- [ ] Define `QueueBackend` abstract base class:
  - `publish()`, `subscribe()`
- [ ] Implement `PubSubBackend` (wraps existing Pub/Sub calls)
- [ ] Implement `MemoryQueueBackend` (asyncio `Queue`)
- [ ] Wire backends into API and agents via dependency injection (FastAPI `Depends`)

---

### Phase 3 — CLI Commands (5–7 days)

**Goal:** All core workflows are accessible from the terminal.

| Command | Description |
|---------|-------------|
| `karma init` | Guided setup wizard — creates `~/.karma/config.yaml`, tests credentials |
| `karma configure` | Edit config (API URL, GCP project, LLM key, Dynatrace endpoint) |
| `karma services list` | List registered service pairs |
| `karma services add` | Register old + new service endpoints |
| `karma learn` | Trigger contract learning for a service pair |
| `karma watch` | Start/stop continuous monitoring for a service |
| `karma ghosts list` | List detected ghost regressions |
| `karma ghosts show <id>` | Show full ghost report (rich terminal output) |
| `karma report <id>` | Export ghost report as Markdown or JSON |
| `karma serve` | Launch local API + dashboard (Option B/C only) |
| `karma status` | System health — agents running, DB connectivity, LLM reachability |

**Sample interaction:**
```
$ karma ghosts list

  ID        Service              Severity  Detected       Status
 ─────────────────────────────────────────────────────────────────
  g-001     payments-v3          HIGH      2026-05-27     open
  g-002     auth-service-v2      MEDIUM    2026-05-25     resolved

$ karma ghosts show g-001

  Ghost Regression: g-001
  ──────────────────────────────────────────────────────────────
  Service:     payments-v3 (replaced payments-v2)
  Severity:    HIGH
  Detected:    2026-05-27 14:32 UTC

  Violated Contract:
    payments-v2 wrote Redis key summary:<account_id> every 30s.
    payments-v3 does not write this key.

  Impact:
    svc-reporting: +540ms latency, -7.8% throughput

  Root Cause:
    Redis cache write removed during v3 rewrite (commit a3f9b12).
    No test covered this side-effect.
```

---

### Phase 4 — Frontend Bundling (3–4 days)

**Goal:** `karma serve` opens a browser dashboard with no Node.js required after installation.

- [ ] Add `next export` (or `next build` + static output) to `web/package.json`
- [ ] Create `scripts/build_frontend.sh`:
  ```bash
  cd web && npm run build && npm run export
  cp -r web/out/* src/karma_agent/static/
  ```
- [ ] Add `src/karma_agent/static/` as `package_data` in `pyproject.toml`
- [ ] Mount static files in FastAPI:
  ```python
  app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
  ```
- [ ] Add `karma serve` command that:
  1. Starts `uvicorn` on port 8080
  2. Opens browser to `http://localhost:8080`
  3. Gracefully handles Ctrl+C

> **Note:** This step locks in the frontend for the package release version. The development workflow (live Next.js dev server) remains unchanged.

---

### Phase 5 — Configuration & `karma init` Wizard (2–3 days)

**Goal:** A new user can be productive in under 5 minutes.

- [ ] Define `~/.karma/config.yaml` schema:
  ```yaml
  mode: local          # local | gcp
  llm:
    provider: gemini   # gemini | vertex
    api_key: ...       # for direct Gemini API
  gcp:
    project: ...
    region: us-central1
  dynatrace:
    endpoint: ...
    token: ...
  api:
    url: http://localhost:8080   # or remote URL in delegation mode
  ```
- [ ] Implement `karma init` interactive wizard using Typer prompts:
  - Ask: local mode or GCP mode?
  - Ask: Gemini API key (local) or GCP project (cloud)?
  - Ask: Dynatrace endpoint + token (optional)
  - Test connectivity; print summary
  - Write `~/.karma/config.yaml`

---

### Phase 6 — Testing & Polish (3–5 days)

- [ ] Unit tests for storage backends (SQLite + mocked Firestore)
- [ ] Integration tests for CLI commands using `typer.testing.CliRunner`
- [ ] `karma doctor` command — checks all dependencies and credentials
- [ ] `karma --version` shows version + build info
- [ ] Rich terminal output (colors, tables, spinners) using `rich`
- [ ] `--output json` flag on all list/show commands for scripting

---

### Phase 7 — PyPI Publishing (1–2 days)

- [ ] Register `karma-agent` on PyPI (check name availability — `karmaagent` as fallback)
- [ ] Add `build` and `twine` to dev dependencies
- [ ] Create `.github/workflows/publish.yml`:
  ```yaml
  on:
    push:
      tags: ['v*']
  jobs:
    publish:
      steps:
        - run: python -m build
        - run: twine upload dist/*
  ```
- [ ] Write `CHANGELOG.md` entry for v0.1.0
- [ ] Tag and publish

---

## 5. Complexity & Effort Summary

| Phase | Task | Effort | Complexity |
|-------|------|--------|------------|
| 0 | Decision & spike | 1–2 days | Low |
| 1 | Package skeleton + pyproject.toml | 3–5 days | Low |
| 2 | Storage & queue abstraction | 4–6 days | **High** |
| 3 | CLI commands | 5–7 days | Medium |
| 4 | Frontend bundling | 3–4 days | Medium |
| 5 | Config & `karma init` wizard | 2–3 days | Low |
| 6 | Testing & polish | 3–5 days | Medium |
| 7 | PyPI publishing | 1–2 days | Low |
| **Total** | | **~3–5 weeks** | **Medium-High** |

> If you build **Option A only** (CLI delegating to an already-deployed API), Phases 2 and 4 are eliminated, and total effort drops to **~1–2 weeks**.

---

## 6. Key Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Google ADK is not designed to run in-process without `adk api_server` | High | Test importing `agents/karma/` directly; may need to wrap in subprocess |
| Next.js static export may not support all dynamic routes | Medium | Audit routes in `web/app/`; add `output: 'export'` to `next.config.js` and test |
| Firestore ↔ SQLite schema mismatch | High | Design storage abstraction layer before porting any data access code |
| PyPI name conflict (`karma` is taken) | Low | Use `karma-agent` or `karmaagent`; verify with `pip search` |
| Package size bloat (bundled frontend static files) | Low | Use `.gitignore` to exclude from source; include in sdist via `MANIFEST.in` |

---

## 7. Recommended Starting Point

**Start with Option A (2 weeks) to prove the concept and get user feedback:**

1. Create root `pyproject.toml` with the CLI entry point
2. Build a thin HTTP client around the existing REST API
3. Implement `karma configure`, `karma ghosts list`, `karma ghosts show`, `karma learn`, `karma watch`
4. Publish to PyPI as `karma-agent 0.1.0-alpha`

Then decide whether to invest in Option C (local mode + bundled frontend) based on real user demand.
