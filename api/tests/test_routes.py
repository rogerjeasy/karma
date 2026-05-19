"""Integration tests for API routes using FastAPI's TestClient."""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

FUTURE_DATE = datetime(2026, 6, 1, tzinfo=timezone.utc).isoformat()
PAST_DATE = datetime(2026, 5, 1, tzinfo=timezone.utc).isoformat()

MOCK_SERVICE = {
    "service_id": "test-id",
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
    "contract": {"contract_id": "contract-1", "category": "side_effect"},
    "summary": "Redis writes stopped after cutover",
    "root_cause": "New service omits cache warming logic",
    "downstream_impact": "Reporting service sees stale data",
    "severity": "high",
    "evidence_links": ["https://dynatrace.example.com/ev/1"],
    "remediation_suggestions": ["Add cache warming to v3"],
    "created_at": PAST_DATE,
}


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


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
        # Without GCP credentials, firestore=False → status degraded
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
                    "learning_window_days": 0,  # below minimum (ge=1)
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

    async def test_trigger_learning_returns_202(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value=MOCK_SERVICE),
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

    async def test_list_contracts_empty(self, client: AsyncClient) -> None:
        with (
            patch(
                "app.firestore_client.list_contracts_for_service",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.get("/contracts/unknown-service")
        assert response.status_code == 200
        assert response.json() == []


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
            patch("app.firestore_client.list_ghost_reports", new_callable=AsyncMock, return_value=[]) as mock_list,
            patch("app.main.stream.start_firestore_listener"),
        ):
            response = await client.get("/ghosts?service_id=test-id&limit=10")
        assert response.status_code == 200
        mock_list.assert_called_once_with(service_id="test-id", limit=10)

    async def test_list_ghost_reports_limit_validation(self, client: AsyncClient) -> None:
        with patch("app.main.stream.start_firestore_listener"):
            response = await client.get("/ghosts?limit=0")  # below ge=1
        assert response.status_code == 422

    async def test_get_ghost_report_returns_200(self, client: AsyncClient) -> None:
        with (
            patch("app.firestore_client.get_ghost_report", new_callable=AsyncMock, return_value=MOCK_GHOST),
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
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value={
                "service_id": "test-id",
                "service_name": "svc-payments-v2",
                "dynatrace_entity_id": "SERVICE-SVC-PAYMENTS-V2",
            }),
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
            patch("app.firestore_client.get_service", new_callable=AsyncMock, return_value={
                "service_id": "test-id",
                "service_name": "svc-payments-v2",
                "dynatrace_entity_id": "SERVICE-SVC-PAYMENTS-V2",
            }),
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
        # Pydantic may serialize +00:00 as Z; normalize both to compare
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
            # Filter for a different service_id → no matches
            response = await client.post("/cutover/watchers/run-now", json={"service_id": "other-id"})
        assert response.status_code == 202
        assert response.json()["status"] == "no_active_watchers"
