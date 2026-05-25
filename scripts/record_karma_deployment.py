"""Cloud Build step: record a Karma system-service deployment in Firestore.

Called as the final step of each Karma service's Cloud Build pipeline after a
successful `gcloud run deploy`.  Writes directly to Firestore using the Cloud
Build service account's ADC — no HTTP call to the API is required.

Idempotent: if a record for this commit SHA already exists, the script exits 0
without creating a duplicate.

Usage:
    python3 scripts/record_karma_deployment.py \
        --service-name  "Karma API System" \
        --commit-sha    "$SHORT_SHA" \
        --github-repo   "rogerjeasy/karma" \
        [--github-token "$_GITHUB_TOKEN"] \
        [--project      "$PROJECT_ID"] \
        [--database     "(default)"]

Cloud Build substitutions that map to these flags:
    $SHORT_SHA           — 7-char commit SHA provided automatically by Cloud Build
    $_GITHUB_TOKEN       — user-defined substitution holding the GitHub PAT
    $PROJECT_ID          — GCP project ID, set automatically by Cloud Build
"""
from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import sys
from datetime import datetime, timezone
from typing import Any

import httpx
from google.cloud import firestore as _fs

_GH_API     = "https://api.github.com"
_GH_TIMEOUT = 15.0


async def _find_service_by_name(
    db: _fs.AsyncClient, service_name: str
) -> dict[str, Any] | None:
    """Look up a system service by name — avoids hardcoding UUIDs in YAML."""
    from google.cloud.firestore_v1.base_query import FieldFilter
    q = (
        db.collection("services")
        .where(filter=FieldFilter("is_system", "==", True))
        .where(filter=FieldFilter("service_name", "==", service_name))
    )
    async for doc in q.stream():
        d = doc.to_dict()
        if d:
            return d
    return None


async def _record_exists(db: _fs.AsyncClient, doc_id: str) -> bool:
    snap = await db.collection("deployment_metrics").document(doc_id).get()
    return snap.exists


async def _gh_fetch(
    repo: str, since: datetime, token: str
) -> dict[str, int]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    async with httpx.AsyncClient(timeout=_GH_TIMEOUT) as client:
        # Commits
        commits, oldest_sha, newest_sha = 0, "", ""
        try:
            r = await client.get(
                f"{_GH_API}/repos/{repo}/commits",
                headers=headers,
                params={"since": since.isoformat(), "per_page": 100},
            )
            r.raise_for_status()
            data: list[Any] = r.json()
            if data:
                commits, oldest_sha, newest_sha = len(data), data[-1]["sha"], data[0]["sha"]
        except Exception as exc:
            print(f"  [WARN] commits fetch: {exc}", file=sys.stderr)

        # PRs
        prs = 0
        try:
            r = await client.get(
                f"{_GH_API}/repos/{repo}/pulls",
                headers=headers,
                params={"state": "closed", "sort": "updated", "direction": "desc", "per_page": 100},
            )
            r.raise_for_status()
            since_str = since.isoformat()
            prs = sum(1 for p in r.json() if p.get("merged_at") and p["merged_at"] >= since_str)
        except Exception as exc:
            print(f"  [WARN] PRs fetch: {exc}", file=sys.stderr)

        # Line stats
        added, removed = 0, 0
        if oldest_sha and newest_sha and oldest_sha != newest_sha:
            for base in [f"{oldest_sha}~1", oldest_sha]:
                try:
                    r = await client.get(
                        f"{_GH_API}/repos/{repo}/compare/{base}...{newest_sha}",
                        headers=headers,
                    )
                    if r.status_code == 404:
                        continue
                    r.raise_for_status()
                    data = r.json()
                    added   = sum(f.get("additions", 0) for f in data.get("files", []))
                    removed = sum(f.get("deletions",  0) for f in data.get("files", []))
                    break
                except Exception as exc:
                    print(f"  [WARN] line stats (base={base}): {exc}", file=sys.stderr)

    return {"commits": commits, "pull_requests": prs, "lines_added": added, "lines_removed": removed}


async def main(args: argparse.Namespace) -> int:
    project  = args.project
    database = args.database
    now      = datetime.now(timezone.utc)

    db = _fs.AsyncClient(project=project, database=database)

    svc = await _find_service_by_name(db, args.service_name)
    if svc is None:
        print(
            f"[WARN] System service {args.service_name!r} not found in Firestore — "
            "deploy recorded in Karma UI first.",
            file=sys.stderr,
        )
        return 0

    service_id = svc["service_id"]

    # Deterministic doc ID — commit SHA guarantees uniqueness across retried builds.
    doc_id = f"deploy-{service_id[:8]}-{args.commit_sha[:12]}"

    if await _record_exists(db, doc_id):
        print(f"[OK] record {doc_id!r} already exists — no duplicate written.")
        return 0

    repo   = args.github_repo or svc.get("github_repo", "")
    token  = args.github_token

    # Window: from the service's last recorded deployment (or creation) to now.
    raw_since = svc.get("last_deployment_at") or svc.get("created_at")
    since: datetime
    if raw_since:
        since = raw_since if isinstance(raw_since, datetime) else datetime.fromisoformat(str(raw_since))
        if since.tzinfo is None:
            since = since.replace(tzinfo=timezone.utc)
    else:
        since = now - dt.timedelta(days=30)

    metrics: dict[str, int]
    if repo and token:
        print(f"Fetching GitHub metrics for {repo!r} since {since.date()}…")
        metrics = await _gh_fetch(repo=repo, since=since, token=token)
    else:
        print("[WARN] No GITHUB_TOKEN or repo — recording zero metrics.")
        metrics = {"commits": 0, "pull_requests": 0, "lines_added": 0, "lines_removed": 0}

    record: dict[str, Any] = {
        "service_id":    service_id,
        "service_name":  svc.get("service_name", args.service_name),
        "deployed_at":   now.isoformat(),
        "commits":       metrics["commits"],
        "pull_requests": metrics["pull_requests"],
        "lines_added":   metrics["lines_added"],
        "lines_removed": metrics["lines_removed"],
        "github_repo":   repo,
        "commit_sha":    args.commit_sha,
    }

    await db.collection("deployment_metrics").document(doc_id).set(record)

    # Stamp last_deployment_at so the next build measures the right window.
    await db.collection("services").document(service_id).update({
        "last_deployment_at": now.isoformat(),
        "updated_at": now,
    })

    print(
        f"[OK] deployment_metrics/{doc_id} written — "
        f"commits={metrics['commits']}  PRs={metrics['pull_requests']}  "
        f"+{metrics['lines_added']}/-{metrics['lines_removed']}"
    )
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--service-name",  required=True, help="Exact service_name in Firestore")
    parser.add_argument("--commit-sha",    required=True, help="Git commit SHA ($SHORT_SHA in Cloud Build)")
    parser.add_argument("--github-repo",   default="",    help="owner/repo (overrides Firestore field)")
    parser.add_argument("--github-token",  default="",    help="GitHub PAT ($_GITHUB_TOKEN)")
    parser.add_argument("--project",       default="skillbridge-76a4c", help="GCP project ID")
    parser.add_argument("--database",      default="(default)",         help="Firestore database")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args)))
