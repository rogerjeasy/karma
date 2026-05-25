"""Backfill engineering-metrics deployment records for Karma system services.

Fetches real commit / PR / line-change data from the GitHub API and writes one
deployment record per system service into the Firestore `deployment_metrics`
collection.  The script is fully idempotent: running it a second time produces
no new documents — duplicate detection uses a deterministic document ID derived
from the service ID and the measurement window dates.

Usage (from the api/ directory):
    python -m scripts.backfill_karma_deployments [--dry-run] [--since YYYY-MM-DD]

Environment variables (or .env at repo root):
    GCP_PROJECT_ID          — Firestore project
    GITHUB_TOKEN            — fine-grained PAT with Contents:read + Pull requests:read
    GITHUB_REPO             — default repo, e.g. rogerjeasy/karma
    FIRESTORE_DATABASE      — optional, defaults to (default)

Prerequisites:
    gcloud auth application-default login   (or GOOGLE_APPLICATION_CREDENTIALS)
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

# Allow running as `python -m scripts.backfill_karma_deployments` from api/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Load .env if present at repo root or api/ root
try:
    from dotenv import load_dotenv
    for candidate in [
        Path(__file__).resolve().parents[2] / ".env",
        Path(__file__).resolve().parents[1] / ".env",
    ]:
        if candidate.exists():
            load_dotenv(candidate)
            break
except ImportError:
    pass  # python-dotenv not installed — rely on environment variables

import httpx
from google.cloud import firestore as _fs


# ── GitHub helpers (inline to avoid importing the full app) ───────────────────

_GH_API = "https://api.github.com"
_GH_TIMEOUT = 15.0


async def _gh_fetch_metrics(
    repo: str, since: datetime, token: str
) -> dict[str, int]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    async with httpx.AsyncClient(timeout=_GH_TIMEOUT) as client:
        commits, oldest_sha, newest_sha = await _gh_commits(client, headers, repo, since)
        prs = await _gh_prs(client, headers, repo, since)
        added, removed = await _gh_lines(client, headers, repo, oldest_sha, newest_sha)
    return {
        "commits": commits,
        "pull_requests": prs,
        "lines_added": added,
        "lines_removed": removed,
    }


async def _gh_commits(
    client: httpx.AsyncClient, headers: dict[str, str], repo: str, since: datetime
) -> tuple[int, str, str]:
    try:
        r = await client.get(
            f"{_GH_API}/repos/{repo}/commits",
            headers=headers,
            params={"since": since.isoformat(), "per_page": 100},
        )
        r.raise_for_status()
        data: list[Any] = r.json()
        if not data:
            return 0, "", ""
        return len(data), data[-1]["sha"], data[0]["sha"]
    except Exception as exc:
        print(f"  [WARN] commits fetch failed: {exc}")
        return 0, "", ""


async def _gh_prs(
    client: httpx.AsyncClient, headers: dict[str, str], repo: str, since: datetime
) -> int:
    try:
        r = await client.get(
            f"{_GH_API}/repos/{repo}/pulls",
            headers=headers,
            params={"state": "closed", "sort": "updated", "direction": "desc", "per_page": 100},
        )
        r.raise_for_status()
        prs: list[Any] = r.json()
        since_str = since.isoformat()
        return sum(1 for p in prs if p.get("merged_at") and p["merged_at"] >= since_str)
    except Exception as exc:
        print(f"  [WARN] PR fetch failed: {exc}")
        return 0


async def _gh_lines(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    repo: str,
    oldest: str,
    newest: str,
) -> tuple[int, int]:
    if not oldest or not newest or oldest == newest:
        return 0, 0
    for base in [f"{oldest}~1", oldest]:
        try:
            r = await client.get(
                f"{_GH_API}/repos/{repo}/compare/{base}...{newest}",
                headers=headers,
            )
            if r.status_code == 404:
                continue
            r.raise_for_status()
            data = r.json()
            added   = sum(f.get("additions", 0) for f in data.get("files", []))
            removed = sum(f.get("deletions",  0) for f in data.get("files", []))
            return added, removed
        except Exception as exc:
            print(f"  [WARN] line-stats fetch failed (base={base}): {exc}")
    return 0, 0


# ── Firestore helpers ─────────────────────────────────────────────────────────

def _get_db(project: str, database: str) -> _fs.AsyncClient:
    return _fs.AsyncClient(project=project, database=database)


async def _list_system_services(db: _fs.AsyncClient) -> list[dict[str, Any]]:
    from google.cloud.firestore_v1.base_query import FieldFilter
    q = db.collection("services").where(filter=FieldFilter("is_system", "==", True))
    return [d async for doc in q.stream() if (d := doc.to_dict()) is not None]


async def _record_exists(db: _fs.AsyncClient, doc_id: str) -> bool:
    snap = await db.collection("deployment_metrics").document(doc_id).get()
    return snap.exists


async def _write_record(
    db: _fs.AsyncClient, doc_id: str, data: dict[str, Any], dry_run: bool
) -> None:
    if dry_run:
        return
    await db.collection("deployment_metrics").document(doc_id).set(data)


# ── Main ──────────────────────────────────────────────────────────────────────

async def main(dry_run: bool, since_override: datetime | None) -> None:
    project  = os.environ.get("GCP_PROJECT_ID", "")
    database = os.environ.get("FIRESTORE_DATABASE", "(default)")
    gh_token = os.environ.get("GITHUB_TOKEN", "")
    gh_repo  = os.environ.get("GITHUB_REPO", "rogerjeasy/karma")

    if not project:
        sys.exit("ERROR: GCP_PROJECT_ID is not set")
    if not gh_token:
        sys.exit("ERROR: GITHUB_TOKEN is not set — real metrics cannot be fetched")

    db = _get_db(project, database)
    now = datetime.now(timezone.utc)

    print(f"Connecting to Firestore project={project!r} database={database!r}")
    services = await _list_system_services(db)
    print(f"Found {len(services)} system service(s)\n")

    if not services:
        print("Nothing to backfill.")
        return

    for svc in services:
        service_id   = svc.get("service_id", "")
        service_name = svc.get("service_name", service_id)
        repo         = svc.get("github_repo") or gh_repo

        print(f"-- {service_name} ({service_id[:8]}...)")

        if not repo:
            print("  [SKIP] no github_repo configured\n")
            continue

        # Measurement window: from service creation (or --since) to now.
        raw_created = svc.get("created_at") or svc.get("updated_at")
        if since_override:
            since = since_override
        elif raw_created:
            since = (
                raw_created if isinstance(raw_created, datetime)
                else datetime.fromisoformat(str(raw_created))
            )
            if since.tzinfo is None:
                since = since.replace(tzinfo=timezone.utc)
        else:
            since = now - dt.timedelta(days=90)

        since_date = since.strftime("%Y%m%d")
        until_date = now.strftime("%Y%m%d")
        doc_id = f"backfill-{service_id[:8]}-{since_date}-{until_date}"

        # Dedup check — skip if the record already exists.
        if await _record_exists(db, doc_id):
            print(f"  [SKIP] record {doc_id!r} already exists\n")
            continue

        print(f"  repo   : {repo}")
        print(f"  window : {since.date()} -> {now.date()}")
        print(f"  doc_id : {doc_id}")

        if dry_run:
            print("  [DRY RUN] would fetch GitHub metrics and write record\n")
            continue

        print("  fetching GitHub metrics…")
        metrics = await _gh_fetch_metrics(repo=repo, since=since, token=gh_token)
        print(
            f"  commits={metrics['commits']}  PRs={metrics['pull_requests']}"
            f"  +{metrics['lines_added']}/-{metrics['lines_removed']}"
        )

        record: dict[str, Any] = {
            "service_id":    service_id,
            "service_name":  service_name,
            "deployed_at":   now.isoformat(),
            "commits":       metrics["commits"],
            "pull_requests": metrics["pull_requests"],
            "lines_added":   metrics["lines_added"],
            "lines_removed": metrics["lines_removed"],
            "github_repo":   repo,
            "backfill":      True,
            "window_since":  since.isoformat(),
            "window_until":  now.isoformat(),
        }

        await _write_record(db, doc_id, record, dry_run)
        print(f"  [OK] written -> deployment_metrics/{doc_id}\n")

    print("Done." if not dry_run else "Dry run complete - no writes performed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="Print what would happen without writing")
    parser.add_argument(
        "--since",
        metavar="YYYY-MM-DD",
        help="Override the start of the measurement window for all services",
    )
    args = parser.parse_args()

    since_dt: datetime | None = None
    if args.since:
        since_dt = datetime.strptime(args.since, "%Y-%m-%d").replace(tzinfo=timezone.utc)

    asyncio.run(main(dry_run=args.dry_run, since_override=since_dt))
