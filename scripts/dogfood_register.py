"""Register one of Karma's OWN deployed services for self-monitoring ("dogfood").

This is the believability proof: instead of only learning contracts on the
synthetic demo env, Karma learns them on a real, live service — its own API,
which emits real OpenTelemetry to the same Dynatrace tenant. A judge can then
see a contract discovered from production telemetry, not a scripted scenario.

What it does (idempotent):
  1. Resolves the real Dynatrace entity ID for the service by name (DQL),
     unless --entity-id is supplied.
  2. Registers it as a Karma *system service* in Firestore (is_system=True),
     flagged `showcase` so it surfaces on the public /proof/live page.
  3. Optionally triggers the Learner via the deployed API (needs --admin-token).

Auth: writes to Firestore via Application Default Credentials (ADC), exactly
like scripts/record_karma_deployment.py. Run `gcloud auth application-default
login` first if running locally.

Usage:
    python3 scripts/dogfood_register.py \
        --service-name "Karma API" \
        --entity-name  "karma-api" \
        --url          "https://karma-api-...run.app" \
        [--entity-id   "SERVICE-XXXXXXXXXXXXXXXX"] \
        [--api-url     "https://karma-api-...run.app" --admin-token "<firebase-id-token>"] \
        [--project     "skillbridge-76a4c"] [--database "(default)"]

Environment (read from the repo-root .env if present, else the process env):
    DT_ENV, DT_QUERY_TOKEN   — required for entity-ID resolution (skip if --entity-id given)
    GCP_PROJECT_ID, FIRESTORE_DATABASE — Firestore target (flags override)
"""
from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from google.cloud import firestore as _fs
from google.cloud.firestore_v1.base_query import FieldFilter

_DQL_POLL_INTERVAL = 1.0
_DQL_MAX_POLLS = 15


# Only these keys are pulled from .env. We deliberately do NOT load
# GOOGLE_APPLICATION_CREDENTIALS: this script writes to Firestore via Application
# Default Credentials (your gcloud user account). Importing the Firebase
# service-account path from .env would override ADC with a credential that lacks
# Firestore (datastore.user) permission → "403 Missing or insufficient permissions".
_ENV_KEYS = ("DT_ENV", "DT_QUERY_TOKEN", "GCP_PROJECT_ID", "FIRESTORE_DATABASE")


def _load_repo_env() -> None:
    """Best-effort load of select repo-root .env keys into os.environ (no extra deps)."""
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if key not in _ENV_KEYS:
            continue
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


async def _execute_dql(
    client: httpx.AsyncClient, base: str, headers: dict[str, str], now: datetime, dql: str
) -> list[dict[str, Any]]:
    """Run one DQL query (with async-poll fallback) and return its records."""
    body = {
        "query": dql,
        "defaultTimeframeStart": (now - dt.timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "defaultTimeframeEnd": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "requestTimeoutMilliseconds": 20_000,
    }
    resp = await client.post(f"{base}/query:execute", json=body, headers=headers)
    if resp.status_code not in (200, 202):
        print(f"[WARN] DQL execute failed ({resp.status_code}): {resp.text[:200]}", file=sys.stderr)
        return []
    data = resp.json()
    records = data.get("result", {}).get("records")
    if records is None and data.get("requestToken"):
        poll_url = f"{base}/query:poll?requestToken={data['requestToken']}"
        for _ in range(_DQL_MAX_POLLS):
            await asyncio.sleep(_DQL_POLL_INTERVAL)
            pr = await client.get(poll_url, headers=headers)
            if pr.status_code != 200:
                return []
            pd = pr.json()
            if pd.get("state") == "SUCCEEDED":
                records = pd.get("result", {}).get("records")
                break
    return records or []


async def _resolve_entity_id(entity_name: str) -> str | None:
    """Resolve a Dynatrace service entity ID from its name via a Grail DQL query.

    On `fetch dt.entity.service` the entity-ID column is `id` (NOT `entity.id`).
    Tries an exact name match first, then a `contains` fallback.
    """
    dt_env = os.environ.get("DT_ENV", "").strip()
    token = os.environ.get("DT_QUERY_TOKEN", "").strip()
    if not dt_env or not token:
        print("[WARN] DT_ENV / DT_QUERY_TOKEN not set — cannot auto-resolve entity ID.", file=sys.stderr)
        return None

    base = f"https://{dt_env}.apps.dynatrace.com/platform/storage/query/v1"
    headers = {"Authorization": f"Api-Token {token}", "Content-Type": "application/json"}
    now = datetime.now(timezone.utc)
    queries = [
        f'fetch dt.entity.service | filter entity.name == "{entity_name}" | fields id, entity.name | limit 5',
        f'fetch dt.entity.service | filter contains(entity.name, "{entity_name}") | fields id, entity.name | limit 10',
    ]
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            for dql in queries:
                for rec in await _execute_dql(client, base, headers, now, dql):
                    eid = rec.get("id") or rec.get("entity.id")
                    if eid:
                        print(f"  resolved {rec.get('entity.name', '')!r} -> {eid}")
                        return str(eid)
    except Exception as exc:
        print(f"[WARN] entity resolution error: {exc}", file=sys.stderr)
    return None


async def _find_system_service_by_name(db: _fs.AsyncClient, name: str) -> dict[str, Any] | None:
    q = (
        db.collection("services")
        .where(filter=FieldFilter("is_system", "==", True))
        .where(filter=FieldFilter("service_name", "==", name))
    )
    async for doc in q.stream():
        d = doc.to_dict()
        if d:
            return d
    return None


async def _trigger_learning(api_url: str, token: str, service_id: str) -> None:
    url = f"{api_url.rstrip('/')}/admin/system-services/{service_id}/learn"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers={"Authorization": f"Bearer {token}"})
        if resp.status_code in (200, 202):
            print(f"[OK] Learner triggered for system service {service_id}.")
        else:
            print(f"[WARN] learn trigger returned {resp.status_code}: {resp.text[:200]}", file=sys.stderr)
    except Exception as exc:
        print(f"[WARN] could not trigger learning: {exc}", file=sys.stderr)


async def main(args: argparse.Namespace) -> int:
    _load_repo_env()
    project = args.project or os.environ.get("GCP_PROJECT_ID", "skillbridge-76a4c")
    database = args.database or os.environ.get("FIRESTORE_DATABASE", "(default)")
    now = datetime.now(timezone.utc)

    entity_id = args.entity_id
    if not entity_id:
        print(f"Resolving Dynatrace entity ID for {args.entity_name!r}…")
        entity_id = await _resolve_entity_id(args.entity_name)
    if not entity_id:
        print(
            "[ERROR] No entity ID. Pass --entity-id explicitly (find it in the Dynatrace "
            "Services screen — it's the SERVICE-... value in the URL).",
            file=sys.stderr,
        )
        return 1

    db = _fs.AsyncClient(project=project, database=database)

    existing = await _find_system_service_by_name(db, args.service_name)
    if existing:
        service_id = existing["service_id"]
        await db.collection("services").document(service_id).update(
            {
                "dynatrace_entity_id": entity_id,
                "url": args.url or existing.get("url"),
                "description": args.description or existing.get("description"),
                "showcase": True,
                "updated_at": now,
            }
        )
        print(f"[OK] Updated existing system service {args.service_name!r} ({service_id}).")
    else:
        import uuid

        service_id = str(uuid.uuid4())
        await db.collection("services").document(service_id).set(
            {
                "service_id": service_id,
                "service_name": args.service_name,
                "dynatrace_entity_id": entity_id,
                "replacement_service_id": None,
                "description": args.description or f"Karma's own {args.service_name} — real production telemetry",
                "url": args.url,
                "phase": "registered",
                "is_system": True,
                "showcase": True,
                "user_id": "system",
                "error_message": None,
                "created_at": now,
                "updated_at": now,
            }
        )
        print(f"[OK] Registered system service {args.service_name!r} ({service_id}) → {entity_id}.")

    if args.api_url and args.admin_token:
        await _trigger_learning(args.api_url, args.admin_token, service_id)
    else:
        print(
            "\nNext step — trigger the Learner on this real service:\n"
            "  • Admin dashboard → Infrastructure → "
            f"{args.service_name} → 'Learn', OR\n"
            f"  • curl -X POST <API_URL>/admin/system-services/{service_id}/learn "
            "-H 'Authorization: Bearer <firebase-id-token>'\n"
            "Once contracts are saved, they appear on the public /proof/live page."
        )
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--service-name", default="Karma API", help="Display name in Karma")
    parser.add_argument("--entity-name", default="karma-api", help="Dynatrace entity name to resolve")
    parser.add_argument("--entity-id", default="", help="Dynatrace SERVICE-... ID (skips resolution)")
    parser.add_argument("--url", default="", help="Cloud Run service URL")
    parser.add_argument("--description", default="", help="Service description")
    parser.add_argument("--api-url", default="", help="Deployed API base URL (to auto-trigger learning)")
    parser.add_argument("--admin-token", default="", help="Firebase ID token of an admin user")
    parser.add_argument("--project", default="", help="GCP project ID (env GCP_PROJECT_ID)")
    parser.add_argument("--database", default="", help="Firestore database (env FIRESTORE_DATABASE)")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args)))
