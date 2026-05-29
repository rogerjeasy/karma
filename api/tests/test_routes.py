"""Integration tests for API routes using FastAPI's TestClient."""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.auth import get_current_user

FUTURE_DATE = datetime(2026, 6, 1, tzinfo=timezone.utc).isoformat()
PAST_DATE = datetime(2026, 5, 1, tzinfo=timezone.utc).isoformat()

MOCK_USER = {"uid": "test-uid", "email": "test@example.com"}

MOCK_SERVICE = {
    "service_id": "test-id",
    "user_id": "test-uid",
    "service_name": "svc-payments-v2",
    "dynatrace_entity_id": "SERVICE-SVC-PAYMENTS-V2",
    "deprecation_date": FUTURE_DATE,
    "replacement_service_id": None,
    "phase": "learning",
    "created_at": PAST_DATE,
    "updated_at": PAST_DATE,
}

MOCK_CONTRACT = {
    "contract_id": "contract-1",
    "service_id": "test-id",
    "category": "side_effect",
    "subcategory": "cache_warming",
    "description": "Writes to Redis every 30s",
    "confidence": 0.95,
    "validated": True,
    "detected_at": PAST_DATE,
}

MOCK_GHOST = {
    "report_id": "ghost-1",
    "violation_id": "violation-1",
    "karma_service_id": "test-id",
    "contract": {"contract_id": "contract-1", "category": "side_effect"},
    "summary": "Redis writes stopped after cutover",
    "root_cause": "New service omits cache warming logic",
    "downstream_impact": "Reporting service sees stale data",
    "severity": "high",
    "evidence_links": ["https://dynatrace.example.com/ev/1"],
    "remediation_suggestions": ["Add cache warming to v3"],
    "created_at": PAST_DATE,
}

MOCK_GHOST_WITH_PATCH = {
    **MOCK_GHOST,
    "remediation_patch": {
        "pr_title": "fix(payments-v3): restore Redis cache-warming loop",
        "pr_body": "## What\nRestore the cache-warming loop.",
        "target_file": "synthetic-env/svc-payments-v3/main.py",
        "language": "python",
        "patch_diff": "--- a/main.py\n+++ b/main.py\n@@ -1 +1,2 @@\n+loop()\n",
    },
}


@pytest.fixture
async def client():
    # Override Firebase auth for all tests — returns MOCK_USER without network calls.
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


class TestHealth:
    async def test_health_returns_200(self, client: AsyncClient) -> None:
        with patch("app.main.stream.start_firestore_listener"):
            response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data

    async def test_health_degraded_when_firestore_unavailable(self, client: AsyncClient) -> None:
        with patch("app.main.stream.start_firestore_listener"):
            response = await client.get("/health")
        data = response.json()
        assert data["status"] in ("ok", "degraded")
        assert isinstance(data["firestore"], bool)
        assert isinstance(data["agent_engine"], bool)


class TestServices:
    async def test_register_service_returns_201(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.create_service", new_callable=AsyncMock),
            patch("app.firestore_client.update_service_phase", new_callable=AsyncMock),
            patch("app.agent_client.trigger_learning", new_callable=AsyncMock, return_value={"status": "ok"}),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.post(
                "/services",
                json={
                    "service_name": "svc-payments-v2",
                    "dynatrace_entity_id": "SERVICE-SVC-PAYMENTS-V2",
                    "deprecation_date": FUTURE_DATE,
                    "learning_window_days": 14,
                },
            )
        assert response.status_code == 201
        data = response.json()
        assert data["service_name"] == "svc-payments-v2"
        assert data["phase"] == "learning"
        assert "service_id" in data

    async def test_register_service_validates_required_fields(self, client: AsyncClient) -> None:
        with patch("app.main.stream.start_firestore_listener"):
            response = await client.post("/services", json={})
        assert response.status_code == 422

    async def test_register_service_learning_window_bounds(self, client: AsyncClient) -> None:
        with patch("app.main.stream.start_firestore_listener"):
            response = await client.post(
                "/services",
                json={
                    "service_name": "svc-x",
                    "dynatrace_entity_id": "SERVICE-X",
                    "deprecation_date": FUTURE_DATE,
                    "learning_window_days": 0,
                },
            )
        assert response.status_code == 422

    async def test_list_services_returns_200(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.list_services", new_callable=AsyncMock, return_value=[MOCK_SERVICE]),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.get("/services")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert data[0]["service_id"] == "test-id"

    async def test_list_services_empty(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.list_services", new_callable=AsyncMock, return_value=[]),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.get("/services")
        assert response.status_code == 200
        assert response.json() == []

    async def test_get_service_returns_200(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value=MOCK_SERVICE),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.get("/services/test-id")
        assert response.status_code == 200
        data = response.json()
        assert data["service_id"] == "test-id"
        assert data["phase"] == "learning"

    async def test_get_service_404_for_unknown(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value=None),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.get("/services/nonexistent")
        assert response.status_code == 404

    async def test_get_service_404_for_other_user(self, client: AsyncClient) -> None:
        other_user_service = {**MOCK_SERVICE, "user_id": "other-uid"}
        with (
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value=other_user_service),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.get("/services/test-id")
        assert response.status_code == 404

    async def test_trigger_learning_returns_202(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value=MOCK_SERVICE),
            patch("app.firestore_client.update_service_phase", new_callable=AsyncMock),
            patch("app.agent_client.trigger_learning", new_callable=AsyncMock, return_value={"status": "ok"}),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.post("/services/test-id/learn")
        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "accepted"
        assert data["service_id"] == "test-id"

    async def test_trigger_learning_404_for_unknown(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value=None),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.post("/services/nonexistent/learn")
        assert response.status_code == 404


class TestContracts:
    async def test_list_contracts_for_service(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value=MOCK_SERVICE),
            patch(
                "app.firestore_client.list_contracts_for_service",
                new_callable=AsyncMock,
                return_value=[MOCK_CONTRACT],
            ),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.get("/contracts/test-id")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert data[0]["contract_id"] == "contract-1"
        assert data[0]["service_id"] == "test-id"

    async def test_list_contracts_404_for_unknown_service(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value=None),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.get("/contracts/unknown-service")
        assert response.status_code == 404

    async def test_list_contracts_404_for_other_user_service(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.get_service", new_callable=AsyncMock,
                  return_value={**MOCK_SERVICE, "user_id": "other-uid"}),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.get("/contracts/test-id")
        assert response.status_code == 404


class TestGhosts:
    async def test_list_ghost_reports_returns_200(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.list_ghost_reports", new_callable=AsyncMock, return_value=[MOCK_GHOST]),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.get("/ghosts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert data[0]["report_id"] == "ghost-1"
        assert data[0]["severity"] == "high"

    async def test_list_ghost_reports_with_service_filter(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value=MOCK_SERVICE),
            patch("app.firestore_client.list_ghost_reports", new_callable=AsyncMock, return_value=[]) as mock_list,
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.get("/ghosts?service_id=test-id&limit=10")
        assert response.status_code == 200
        mock_list.assert_called_once_with(user_id="test-uid", service_id="test-id", limit=10)

    async def test_list_ghost_reports_limit_validation(self, client: AsyncClient) -> None:
        with patch("app.main.stream.start_firestore_listener"):
            response = await client.get("/ghosts?limit=0")
        assert response.status_code == 422

    async def test_get_ghost_report_returns_200(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.get_ghost_report", new_callable=AsyncMock, return_value=MOCK_GHOST),
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value=MOCK_SERVICE),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.get("/ghosts/ghost-1")
        assert response.status_code == 200
        data = response.json()
        assert data["report_id"] == "ghost-1"
        assert data["summary"] == "Redis writes stopped after cutover"

    async def test_get_ghost_report_404_for_unknown(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.get_ghost_report", new_callable=AsyncMock, return_value=None),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.get("/ghosts/nonexistent")
        assert response.status_code == 404

    async def test_open_pr_creates_draft_pr(self, client: AsyncClient) -> None:
        from app.config import settings
        pr_result = {
            "pr_url": "https://github.com/rogerjeasy/karma/pull/42",
            "pr_number": 42,
            "branch": "karma/remediation-ghost-1",
            "created": True,
        }
        with (
            patch("app.firestore_client.get_ghost_report", new_callable=AsyncMock, return_value=MOCK_GHOST_WITH_PATCH),
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value=MOCK_SERVICE),
            patch("app.firestore_client.update_ghost_report", new_callable=AsyncMock) as mock_update,
            patch("app.github_client.open_remediation_pr", new_callable=AsyncMock, return_value=pr_result) as mock_open,
            patch.object(settings, "github_write_token", "ghp_test"),
            patch.object(settings, "github_repo", "rogerjeasy/karma"),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.post("/ghosts/ghost-1/open-pr")
        assert response.status_code == 200
        data = response.json()
        assert data["pr_url"] == "https://github.com/rogerjeasy/karma/pull/42"
        assert data["pr_number"] == 42
        assert data["created"] is True
        mock_open.assert_called_once()
        mock_update.assert_called_once()

    async def test_open_pr_400_when_no_patch(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.get_ghost_report", new_callable=AsyncMock, return_value=MOCK_GHOST),
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value=MOCK_SERVICE),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.post("/ghosts/ghost-1/open-pr")
        assert response.status_code == 400

    async def test_open_pr_503_when_not_configured(self, client: AsyncClient) -> None:
        from app.config import settings
        with (
            patch("app.firestore_client.get_ghost_report", new_callable=AsyncMock, return_value=MOCK_GHOST_WITH_PATCH),
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value=MOCK_SERVICE),
            patch.object(settings, "github_write_token", ""),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.post("/ghosts/ghost-1/open-pr")
        assert response.status_code == 503

    async def test_open_pr_returns_existing_without_calling_github(self, client: AsyncClient) -> None:
        ghost = {
            **MOCK_GHOST_WITH_PATCH,
            "remediation_pr": {
                "pr_url": "https://github.com/rogerjeasy/karma/pull/7",
                "pr_number": 7,
                "branch": "karma/remediation-ghost-1",
                "repo": "rogerjeasy/karma",
            },
        }
        with (
            patch("app.firestore_client.get_ghost_report", new_callable=AsyncMock, return_value=ghost),
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value=MOCK_SERVICE),
            patch("app.github_client.open_remediation_pr", new_callable=AsyncMock) as mock_open,
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.post("/ghosts/ghost-1/open-pr")
        assert response.status_code == 200
        data = response.json()
        assert data["pr_number"] == 7
        assert data["created"] is False
        mock_open.assert_not_called()


class TestCutover:
    async def test_cutover_404_for_unknown_service(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value=None),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.post(
                "/cutover/nonexistent-id",
                json={"replacement_service_id": "SERVICE-SVC-PAYMENTS-V3"},
            )
        assert response.status_code == 404

    async def test_cutover_activates_watcher(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value=MOCK_SERVICE),
            patch("app.firestore_client.update_service_phase", new_callable=AsyncMock),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.post(
                "/cutover/test-id",
                json={"replacement_service_id": "SERVICE-SVC-PAYMENTS-V3"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["watcher_activated"] is True
        assert data["service_id"] == "test-id"
        assert data["replacement_service_id"] == "SERVICE-SVC-PAYMENTS-V3"

    async def test_cutover_uses_explicit_time(self, client: AsyncClient) -> None:
        cutover_time = "2026-06-01T12:00:00+00:00"
        with (
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value=MOCK_SERVICE),
            patch("app.firestore_client.update_service_phase", new_callable=AsyncMock),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.post(
                "/cutover/test-id",
                json={
                    "replacement_service_id": "SERVICE-SVC-PAYMENTS-V3",
                    "cutover_time": cutover_time,
                },
            )
        assert response.status_code == 200
        returned = response.json()["cutover_time"].replace("Z", "+00:00")
        assert returned == cutover_time

    async def test_run_watcher_no_active_services(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.list_services", new_callable=AsyncMock, return_value=[]),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.post("/cutover/watchers/run-now", json={})
        assert response.status_code == 202
        assert response.json()["status"] == "no_active_watchers"

    async def test_run_watcher_triggers_haunting_services(self, client: AsyncClient) -> None:
        haunting_service = {**MOCK_SERVICE, "phase": "haunting", "replacement_service_id": "SERVICE-V3"}
        with (
            patch("app.firestore_client.list_services", new_callable=AsyncMock, return_value=[haunting_service]),
            patch("app.firestore_client.list_contracts_for_service", new_callable=AsyncMock, return_value=[MOCK_CONTRACT]),
            patch("app.agent_client.trigger_watcher", new_callable=AsyncMock, return_value={"status": "ok"}),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.post("/cutover/watchers/run-now", json={})
        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "accepted"
        assert len(data["triggered"]) == 1

    async def test_run_watcher_filters_by_service_id(self, client: AsyncClient) -> None:
        haunting_service = {**MOCK_SERVICE, "phase": "haunting", "replacement_service_id": "SERVICE-V3"}
        with (
            patch("app.firestore_client.list_services", new_callable=AsyncMock, return_value=[haunting_service]),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.post("/cutover/watchers/run-now", json={"service_id": "other-id"})
        assert response.status_code == 202
        assert response.json()["status"] == "no_active_watchers"


class TestLiveProof:
    SYS_SVC = {
        "service_id": "sys-1",
        "service_name": "Karma API",
        "dynatrace_entity_id": "SERVICE-REAL-API",
        "is_system": True,
        "showcase": True,
    }
    REAL_CONTRACT = {
        "contract_id": "rc-1",
        "category": "latency",
        "subcategory": "p95_latency",
        "description": "p95 ≤ 180ms on /ghosts",
        "confidence": 0.9,
        "validated": True,
        "evidence": [{"type": "dql_query", "dql": "fetch spans | filter ..."}],
        "detected_at": PAST_DATE,
    }

    async def test_live_proof_available(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.list_system_services", new_callable=AsyncMock, return_value=[self.SYS_SVC]),
            patch("app.firestore_client.list_contracts_for_service", new_callable=AsyncMock, return_value=[self.REAL_CONTRACT]),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.get("/proof/live")
        assert response.status_code == 200
        data = response.json()
        assert data["available"] is True
        assert data["service_name"] == "Karma API"
        assert data["contract_count"] == 1
        assert data["contracts"][0]["evidence_dql"].startswith("fetch spans")

    async def test_live_proof_unavailable_when_no_system_services(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.list_system_services", new_callable=AsyncMock, return_value=[]),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.get("/proof/live")
        assert response.status_code == 200
        assert response.json()["available"] is False

    async def test_live_proof_unavailable_when_no_contracts(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.list_system_services", new_callable=AsyncMock, return_value=[self.SYS_SVC]),
            patch("app.firestore_client.list_contracts_for_service", new_callable=AsyncMock, return_value=[]),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.get("/proof/live")
        assert response.status_code == 200
        assert response.json()["available"] is False


class TestUsers:
    async def test_sync_user_returns_200(self, client: AsyncClient) -> None:
        mock_profile = {
            "uid": "test-uid",
            "email": "test@example.com",
            "display_name": "Test User",
            "photo_url": "",
            "roles": ["user"],
        }
        with (
            patch("app.firestore_client.upsert_user", new_callable=AsyncMock),
            patch(
                "app.firestore_client.get_user",
                new_callable=AsyncMock,
                return_value=mock_profile,
            ),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.post("/users/sync")
        assert response.status_code == 200
        data = response.json()
        assert data["uid"] == "test-uid"
        assert data["email"] == "test@example.com"
        assert data["roles"] == ["user"]


class TestConsole:
    """The global 'Ask Karma' console: Davis CoPilot → DQL → Grail, with fallback."""

    async def test_davis_copilot_path_executes_dql(self, client: AsyncClient) -> None:
        dql = "fetch spans | filter span.name == \"POST /charge\" | summarize p95 = percentile(duration, 95)"
        with (
            patch("app.routes.console.dt_copilot.nl_to_dql", new_callable=AsyncMock, return_value=dql),
            patch("app.routes.console.query_grail", new_callable=AsyncMock, return_value=[{"p95": 120}]),
            patch("app.routes.console.ask_gemini", new_callable=AsyncMock, return_value="p95 is 120ms."),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.post("/console/ask", json={"question": "what's the p95?"})
        assert response.status_code == 200
        data = response.json()
        assert data["dql_source"] == "davis_copilot"
        assert data["davis_available"] is True
        assert data["dql"] == dql
        assert data["row_count"] == 1
        assert data["answer"] == "p95 is 120ms."

    async def test_falls_back_to_contracts_when_copilot_unavailable(self, client: AsyncClient) -> None:
        with (
            patch("app.routes.console.dt_copilot.nl_to_dql", new_callable=AsyncMock, return_value=None),
            patch("app.firestore_client.list_ghost_reports", new_callable=AsyncMock, return_value=[MOCK_GHOST]),
            patch("app.routes.console.ask_gemini", new_callable=AsyncMock, return_value="From contracts: cache warming stopped."),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.post("/console/ask", json={"question": "what broke?"})
        assert response.status_code == 200
        data = response.json()
        assert data["dql_source"] == "contracts"
        assert data["dql"] is None
        assert data["row_count"] == 0

    async def test_unsafe_dql_is_not_executed(self, client: AsyncClient) -> None:
        # A non-read DQL must not reach Grail — the console falls back instead.
        grail = AsyncMock()
        with (
            patch("app.routes.console.dt_copilot.nl_to_dql", new_callable=AsyncMock, return_value="delete data foo"),
            patch("app.routes.console.query_grail", grail),
            patch("app.firestore_client.list_ghost_reports", new_callable=AsyncMock, return_value=[]),
            patch("app.routes.console.ask_gemini", new_callable=AsyncMock, return_value="ok"),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.post("/console/ask", json={"question": "drop everything"})
        assert response.status_code == 200
        assert response.json()["dql_source"] == "contracts"
        grail.assert_not_called()

    async def test_scoped_service_must_be_owned(self, client: AsyncClient) -> None:
        other = {**MOCK_SERVICE, "user_id": "someone-else"}
        with (
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value=other),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.post(
                "/console/ask", json={"question": "hi", "service_id": "test-id"}
            )
        assert response.status_code == 404
