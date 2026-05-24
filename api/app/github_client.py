"""GitHub API client for fetching real engineering metrics at deployment time.

Called by the cutover route to attach commit count, PR count, and line-change
stats to the karma.deployment OTel span. All data is real — no simulation.

Requires:
  GITHUB_TOKEN   — a GitHub fine-grained PAT with `Contents: read` and
                   `Pull requests: read` permissions on the target repo.
  github_repo    — "owner/repo" string, either per-service or from GITHUB_REPO
                   config setting.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_GH_API = "https://api.github.com"
_TIMEOUT = 10.0  # seconds — deployment span should not block on slow GitHub


async def fetch_deployment_metrics(
    repo: str,
    since: datetime,
    token: str,
) -> dict[str, int]:
    """Return real engineering metrics for the window [since, now] on `repo`.

    Args:
        repo:  "owner/repo" string, e.g. "rogerjeasy/karma"
        since: start of the measurement window (typically the previous cutover time
               or the service registration date if this is the first cutover)
        token: GitHub fine-grained PAT

    Returns:
        {
            "commits":        <int>,   # commits pushed since `since`
            "pull_requests":  <int>,   # PRs merged since `since`
            "lines_added":    <int>,   # aggregate lines added across those commits
            "lines_removed":  <int>,   # aggregate lines removed across those commits
        }
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        commits, oldest_sha, newest_sha = await _fetch_commits(
            client, headers, repo, since
        )
        pull_requests = await _fetch_merged_prs(client, headers, repo, since)
        lines_added, lines_removed = await _fetch_line_stats(
            client, headers, repo, oldest_sha, newest_sha
        )

    return {
        "commits": commits,
        "pull_requests": pull_requests,
        "lines_added": lines_added,
        "lines_removed": lines_removed,
    }


async def _fetch_commits(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    repo: str,
    since: datetime,
) -> tuple[int, str, str]:
    """Return (commit_count, oldest_sha, newest_sha) since `since`."""
    try:
        resp = await client.get(
            f"{_GH_API}/repos/{repo}/commits",
            headers=headers,
            params={"since": since.isoformat(), "per_page": 100},
        )
        resp.raise_for_status()
        data: list[dict[str, Any]] = resp.json()
        if not data:
            return 0, "", ""
        # GitHub returns newest-first
        return len(data), data[-1]["sha"], data[0]["sha"]
    except Exception as exc:
        logger.warning("github_commits_fetch_failed repo=%s: %s", repo, exc)
        return 0, "", ""


async def _fetch_merged_prs(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    repo: str,
    since: datetime,
) -> int:
    """Return count of PRs merged into the default branch since `since`."""
    try:
        resp = await client.get(
            f"{_GH_API}/repos/{repo}/pulls",
            headers=headers,
            params={
                "state": "closed",
                "sort": "updated",
                "direction": "desc",
                "per_page": 100,
            },
        )
        resp.raise_for_status()
        prs: list[dict[str, Any]] = resp.json()
        since_str = since.isoformat()
        return sum(
            1 for pr in prs
            if pr.get("merged_at") and pr["merged_at"] >= since_str
        )
    except Exception as exc:
        logger.warning("github_prs_fetch_failed repo=%s: %s", repo, exc)
        return 0


async def _fetch_line_stats(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    repo: str,
    oldest_sha: str,
    newest_sha: str,
) -> tuple[int, int]:
    """Return (lines_added, lines_removed) between oldest_sha and newest_sha.

    Uses the GitHub compare API which returns aggregate file stats in one call,
    avoiding the N+1 problem of fetching stats per commit.

    The base is oldest_sha~1 (the commit just before our window) so the diff
    includes the oldest commit itself.
    """
    if not oldest_sha or not newest_sha or oldest_sha == newest_sha:
        return 0, 0

    try:
        resp = await client.get(
            f"{_GH_API}/repos/{repo}/compare/{oldest_sha}~1...{newest_sha}",
            headers=headers,
        )
        if resp.status_code == 404:
            # oldest_sha~1 doesn't exist (first commit in the repo) — fall back
            # to comparing directly without the ~1 parent reference.
            resp = await client.get(
                f"{_GH_API}/repos/{repo}/compare/{oldest_sha}...{newest_sha}",
                headers=headers,
            )
        resp.raise_for_status()
        data = resp.json()
        added = sum(f.get("additions", 0) for f in data.get("files", []))
        removed = sum(f.get("deletions", 0) for f in data.get("files", []))
        return added, removed
    except Exception as exc:
        logger.warning("github_compare_fetch_failed repo=%s: %s", repo, exc)
        return 0, 0
