"""GitHub API client.

Two responsibilities:
  1. Read engineering metrics (commits, PRs, lines changed) at deployment time —
     attached to the karma.deployment OTel span. Uses GITHUB_TOKEN (read-only).
  2. Open a draft remediation pull request from a Forensic-agent patch — closes
     the detect → diagnose → fix loop. Uses GITHUB_WRITE_TOKEN (write-scoped).

All metrics are real — no simulation.

Requires:
  GITHUB_TOKEN        — fine-grained PAT with `Contents: read` + `Pull requests: read`.
  GITHUB_WRITE_TOKEN  — fine-grained PAT with `Contents: write` + `Pull requests: write`
                        (only needed for open_remediation_pr).
  github_repo         — "owner/repo" string, per-service or from GITHUB_REPO config.
"""
from __future__ import annotations

import base64
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


# ── Remediation PR (write) ──────────────────────────────────────────────────────


async def open_remediation_pr(
    *,
    repo: str,
    base_branch: str,
    token: str,
    report_id: str,
    pr_title: str,
    pr_body: str,
    patch_diff: str,
    target_file: str,
    requested_by_name: str = "",
    requested_by_email: str = "",
) -> dict[str, Any]:
    """Open a DRAFT pull request carrying the Forensic agent's remediation patch.

    Creates a deterministically-named branch off ``base_branch``, commits the unified
    diff as ``karma-remediations/<report>.diff``, and opens a draft PR with the agent's
    title and body. The committed file never touches real code paths, so the action is
    safe to run repeatedly and against the live demo.

    Idempotent per report: if the branch / PR already exist, the existing PR is returned
    instead of erroring.

    Returns ``{"pr_url", "pr_number", "branch", "created"}``.
    Raises ``RuntimeError`` (with a human-readable message) on any GitHub API failure.
    """
    owner = repo.split("/")[0]
    short = report_id[:8] or "report"
    branch = f"karma/remediation-{short}"
    path = f"karma-remediations/{short}.diff"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    body = _build_pr_body(
        pr_body, report_id, path, target_file, requested_by_name, requested_by_email
    )

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        # 1. Resolve the base branch SHA.
        ref = await client.get(
            f"{_GH_API}/repos/{repo}/git/ref/heads/{base_branch}", headers=headers
        )
        if ref.status_code == 404:
            raise RuntimeError(f"Base branch '{base_branch}' not found in {repo}.")
        if ref.status_code != 200:
            raise RuntimeError(_gh_err("read base branch", ref))
        base_sha = ref.json()["object"]["sha"]

        # 2. Create the remediation branch (idempotent).
        create_ref = await client.post(
            f"{_GH_API}/repos/{repo}/git/refs",
            headers=headers,
            json={"ref": f"refs/heads/{branch}", "sha": base_sha},
        )
        if create_ref.status_code in (200, 201):
            await _put_patch_file(
                client, headers, repo, path, branch, pr_title, patch_diff,
                requested_by_name, requested_by_email,
            )
        elif create_ref.status_code == 422:
            # Branch already exists — a PR may already be open for it.
            existing = await _find_pr_for_branch(client, headers, repo, owner, branch)
            if existing:
                return existing
        else:
            raise RuntimeError(_gh_err("create branch", create_ref))

        # 3. Open the draft PR.
        return await _create_pull(client, headers, repo, owner, branch, base_branch, pr_title, body)


async def _put_patch_file(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    repo: str,
    path: str,
    branch: str,
    pr_title: str,
    patch_diff: str,
    author_name: str = "",
    author_email: str = "",
) -> None:
    """Commit the unified diff as a file on the remediation branch.

    When the Karma requester's name + email are supplied, the commit is authored
    in their name so the PR's commit history attributes the change to them rather
    than to the shared write-token (bot) identity. GitHub still records the token
    owner as the PR *creator* — that cannot be overridden via the API.
    """
    content_b64 = base64.b64encode(patch_diff.encode("utf-8")).decode("ascii")
    message = pr_title if len(pr_title) <= 72 else pr_title[:69] + "..."
    payload: dict[str, Any] = {"message": message, "content": content_b64, "branch": branch}
    if author_name and author_email:
        identity = {"name": author_name, "email": author_email}
        payload["author"] = identity
        payload["committer"] = identity
    resp = await client.put(
        f"{_GH_API}/repos/{repo}/contents/{path}",
        headers=headers,
        json=payload,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(_gh_err("commit patch file", resp))


async def _create_pull(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    repo: str,
    owner: str,
    branch: str,
    base_branch: str,
    title: str,
    body: str,
) -> dict[str, Any]:
    """Open a draft PR; fall back to non-draft if the repo disallows drafts."""
    payload: dict[str, Any] = {
        "title": title,
        "head": branch,
        "base": base_branch,
        "body": body,
        "draft": True,
    }
    resp = await client.post(f"{_GH_API}/repos/{repo}/pulls", headers=headers, json=payload)

    if resp.status_code == 422 and "draft" in resp.text.lower():
        payload["draft"] = False
        resp = await client.post(f"{_GH_API}/repos/{repo}/pulls", headers=headers, json=payload)

    if resp.status_code == 422:
        # Most likely a PR already exists for this head branch.
        existing = await _find_pr_for_branch(client, headers, repo, owner, branch)
        if existing:
            return existing
        raise RuntimeError(_gh_err("create pull request", resp))

    if resp.status_code not in (200, 201):
        raise RuntimeError(_gh_err("create pull request", resp))

    pr = resp.json()
    return {
        "pr_url": pr["html_url"],
        "pr_number": pr["number"],
        "branch": branch,
        "created": True,
    }


async def _find_pr_for_branch(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    repo: str,
    owner: str,
    branch: str,
) -> dict[str, Any] | None:
    """Return the most recent PR whose head is ``branch``, or None."""
    resp = await client.get(
        f"{_GH_API}/repos/{repo}/pulls",
        headers=headers,
        params={"head": f"{owner}:{branch}", "state": "all", "per_page": 1},
    )
    if resp.status_code != 200:
        return None
    items = resp.json()
    if not items:
        return None
    pr = items[0]
    return {
        "pr_url": pr["html_url"],
        "pr_number": pr["number"],
        "branch": branch,
        "created": False,
    }


def _build_pr_body(
    agent_body: str,
    report_id: str,
    path: str,
    target_file: str,
    requested_by_name: str = "",
    requested_by_email: str = "",
) -> str:
    """Append Karma provenance + apply instructions to the agent's PR body."""
    requester = ""
    if requested_by_name or requested_by_email:
        who = requested_by_name or requested_by_email
        email_part = f" <{requested_by_email}>" if requested_by_email else ""
        requester = f"\n**Requested by {who}{email_part}** via Karma.\n"
    footer = (
        "\n\n---\n"
        f"*Opened automatically by Karma's Forensic agent from ghost report "
        f"`{report_id}`. This is a **draft** — review before merging.*\n"
        f"{requester}\n"
        f"The proposed change targets `{target_file}`. The unified diff is committed "
        f"at `{path}`; apply it locally with:\n\n"
        f"```bash\ngit apply {path}\n```\n"
    )
    return (agent_body or "").strip() + footer


def _gh_err(action: str, resp: httpx.Response) -> str:
    """Build a concise, human-readable error message from a failed GitHub response."""
    try:
        message = resp.json().get("message", "") or resp.text[:200]
    except Exception:
        message = resp.text[:200]
    return f"GitHub API error while trying to {action} (HTTP {resp.status_code}): {message}"
