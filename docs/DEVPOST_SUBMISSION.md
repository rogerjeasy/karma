# Karma — Devpost Submission Content

Copy-paste source for the Google Cloud Rapid Agent Hackathon (Dynatrace track) submission form.

---

## Project name (limit 60)

```
Karma — The Reincarnation Agent for Deprecated Services
```

## Elevator pitch (limit 200)

```
Karma learns the undocumented contracts of a deprecated service and haunts its replacement, catching the silent regressions every test passes. Gemini · Vertex AI Agent Builder · Dynatrace MCP.
```

---

## About the project (Markdown)

## 💡 Inspiration

Every migration team has lived this story:

You retire the old payments service. The replacement passes every unit test, integration test, and smoke test. CI is green. Load tests pass. The cutover goes smoothly. **Three weeks later**, a downstream service starts degrading — p95 latency climbs +540ms, throughput falls −7.8%. No alert fired. No test failed. No one can trace it.

The culprit? The old service wrote a Redis summary key every 30 seconds. A downstream reporting service read that key directly. Nobody documented it. Nobody told the new team. **No test checked it.**

Tests check the contract you _wrote down_. We built Karma to check **the contract you forgot you had.**

## 👻 What it does

**Karma is an autonomous multi-agent system that "haunts" deprecated services.** It operates in two phases:

1. **Learning** — while the old service is still alive, Karma analyzes up to 14 days of Dynatrace Grail telemetry and discovers its *implicit behavioral contracts* across **8 categories** no test typically captures: latency bands, error semantics, throughput envelopes, **side effects** (the killer — cache writes, async tasks), timing, dependencies, resource usage, and sequencing. Every candidate contract is validated against the service's own history to reject false positives, then registered as an official **Dynatrace SLO**.

2. **Haunting** — after cutover, Karma watches the replacement every 10 minutes. The moment a contract is silently violated, it files a **ghost report**: the violated contract, the measured downstream impact, a Davis AI root-cause correlation, a Dynatrace investigation notebook, a Slack alert — and a one-click **draft remediation PR** on GitHub with the exact diff that restores the lost behavior.

### The marquee finding

```
Ghost detected — svc-payments-v3 [CRITICAL]

Contract #4 violated: side_effect / cache_warming
  Expected: redis.SET recent_charges:summary every 30s
  Observed: 0 writes for 11 consecutive minutes

Downstream impact: svc-reporting
  p95 latency: +540ms  ·  throughput: −7.8%
  Root cause:  cold cache forces synchronous DB fallback

Davis AI confirms: ACTIVE PROBLEM P-2847 correlated.
Avoided incident cost: $4,200
```

Every claim in that report is backed by **real Dynatrace telemetry** — the Redis write truly happens, the cache truly warms, and the downstream service truly degrades when it stops.

## 🛠️ How we built it

Karma runs on **Google Cloud's Vertex AI Agent Builder**: four agents authored with the **Agent Development Kit (ADK v1.0)** running on **Vertex AI Agent Engine**, powered **100% by Gemini 2.5** (Pro for deep reasoning, Flash for high-frequency monitoring).

| Agent | Role | Model |
|-------|------|-------|
| **Coordinator** | Routes tasks via `transfer_to_agent` | Gemini 2.5 Flash |
| **Learner** | Discovers contracts, creates SLOs | Gemini 2.5 Pro |
| **Watcher** | Evaluates violation predicates every 10 min | Gemini 2.5 Flash |
| **Forensic** | Root-cause, notebooks, ghost reports, PRs | Gemini 2.5 Pro |

The agents talk to Dynatrace **bidirectionally** through the **Dynatrace MCP Server**: they *read* via Grail DQL, Davis AI analyzers, Smartscape entity resolution, and changepoint detection — and *write back* CUSTOM_ANNOTATION events, BizEvents, SLOs, Notebooks, and Workflows.

- **Async pipeline:** Cloud Scheduler → Watcher → Cloud Pub/Sub → Forensic (so detection never blocks investigation).
- **Memory:** Vertex AI Memory Bank keeps contracts alive across Agent Engine restarts.
- **API:** FastAPI on Cloud Run, 30+ routes, streaming ghost reports to the browser via Server-Sent Events.
- **Frontend:** Next.js 15 + TypeScript + Tailwind + ShadCN, a landing page and 6-page dashboard, Firebase Auth.
- **Data/infra:** Firestore, Google Secret Manager, Terraform, GitHub Actions with Workload Identity Federation (no long-lived keys).
- **Self-observability:** every agent run emits OTel spans and BizEvents to Dynatrace — Karma watches itself.

## 🧗 Challenges we ran into

- **Silent agent failures.** ADK treats `{identifier}` in an instruction string as a session-state template variable — a stray `{service_id}` in a prompt raised a `KeyError` that killed the Gemini 2.5 Pro sub-agents *before their first call*, so they silently transferred without ever running their tools. We traced it through the OTel spans (only `transfer_to_agent` was firing) and fixed it by converting every agent instruction to an ADK `InstructionProvider` callable that bypasses state injection.
- **Token-scope landmines.** BizEvents and SLO creation 403'd silently because the deployed Dynatrace token was missing the `bizevents.ingest` and `slo.write` scopes — diagnosed only by probing the ingest endpoint directly, then rotating the token across Secret Manager, GitHub Actions, Agent Engine, and five Cloud Run services.
- **DQL is strict.** `timeseries` only accepts entity fields, `count()` needs a metric key, and you must alias before you sort — we iterated the Learner's query patterns against the live tenant until every category returned clean data.
- **No fabricated data.** We refused to mock the demo. We built a real three-service synthetic environment (v2 with the hidden Redis write, v3 without, and a Redis-dependent reporting service) with a k6 load generator, so every ghost report is grounded in genuine telemetry.

## 🏆 Accomplishments we're proud of

- **It dogfoods itself** — Karma learned real behavioral contracts from its *own* production API and raised a custom Dynatrace problem on its own watcher's latency breach.
- **Detection → reviewable fix in one loop** — from a silent regression to a draft GitHub PR with the exact patch.
- A genuinely **bidirectional** Dynatrace integration, not just dashboards: SLOs, notebooks, workflows, and timeline annotations all written by the agents.

## 📚 What we learned

Observability data is a far richer training signal than we expected — a service's traces encode contracts its authors never wrote down. We also learned how to make a multi-agent system *trustworthy*: validate every discovered contract against history, never fabricate telemetry, and make the agents observable enough to debug through their own spans.

## 🚀 What's next

- Auto-discovery of migration candidates from Smartscape topology.
- Contract diffing across more than two service versions.
- Packaging the Learner as a reusable pre-cutover CI gate.


## Built with (tags)

```
gemini, gemini-2.5-pro, gemini-2.5-flash, vertex-ai, vertex-ai-agent-builder, google-adk, vertex-ai-agent-engine, vertex-ai-memory-bank, dynatrace, dynatrace-mcp, davis-ai, grail, model-context-protocol, opentelemetry, python, fastapi, typescript, next.js, react, tailwindcss, shadcn-ui, firestore, firebase-auth, cloud-run, cloud-pub-sub, cloud-scheduler, google-secret-manager, terraform, github-actions, redis, k6, server-sent-events, docker
```

## "Try it out" links

| Label | URL |
|-------|-----|
| Live Dashboard | https://karma-web-ucvx5uwt5q-uc.a.run.app |
| GitHub Repo | https://github.com/rogerjeasy/karma |
| API Docs (Swagger) | https://karma-api-ucvx5uwt5q-uc.a.run.app/docs |

---