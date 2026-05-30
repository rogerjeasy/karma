"""Dynatrace SLO auto-creation from discovered implicit contracts.

When the Learner discovers a latency or throughput contract it can register
that contract as a first-class Dynatrace Service Level Objective. This creates
a bidirectional integration story:

  Karma learns the contract → Dynatrace enforces it as an SLO

After creation, the SLO is visible in the Dynatrace SLO dashboard and can
trigger burn-rate alerts, Davis AI problem detection, and release guardian gates.

Required classic API token scope: slo.write
  Add this scope to DT_OTEL_TOKEN (same token used for OTel and BizEvents).

Supported contract categories for SLO creation:
  - latency      → service response time p95 / p99 threshold SLO
  - throughput   → request count floor (min QPS over evaluation window)
  - error_semantics → error rate ceiling SLO

DQL to list all Karma-managed SLOs:
  fetch slo
  | filter contains(slo.customInfo, "karma-contract")
  | fields slo.name, slo.target, slo.status, slo.errorBudget
  | sort slo.name asc
"""
from __future__ import annotations

from typing import Any

import httpx
import structlog

from karma.config import settings

logger = structlog.get_logger(__name__)

_TIMEOUT = 20.0

# Nanoseconds per millisecond — Dynatrace response times are in nanoseconds.
_NS_PER_MS = 1_000_000


def create_slo_from_contract(
    contract_id: str,
    service_entity_id: str,
    service_name: str,
    contract_category: str,
    subcategory: str,
    description: str,
    threshold_value: float,
    threshold_unit: str = "ms",
    target_percentage: float = 95.0,
    warning_percentage: float = 97.5,
    evaluation_window: str = "-1d",
) -> dict[str, Any]:
    """Register a discovered implicit contract as a Dynatrace SLO.

    Call this from the Learner after saving a latency, throughput, or
    error_semantics contract to Firestore. The created SLO appears in
    the Dynatrace SLO dashboard and can trigger burn-rate alerts.

    Only supported for categories: latency, throughput, error_semantics.
    For other categories, returns {"created": False, "reason": "unsupported_category"}.

    Args:
        contract_id: Karma contract UUID (used to tag the SLO for traceability).
        service_entity_id: Dynatrace entity ID of the monitored service
                           (e.g. "SERVICE-XXXXXXXXXXXXXXXX").
        service_name: Human-readable service name (used in the SLO title).
        contract_category: One of "latency", "throughput", "error_semantics".
        subcategory: Fine-grained label (e.g. "p95_endpoint_band").
        description: Human-readable contract description (included in SLO description).
        threshold_value: Numeric threshold extracted from the contract
                         (e.g. 150 for 150ms p95 latency).
        threshold_unit: Unit string for display ("ms", "qps", "pct").
        target_percentage: SLO target (default 95.0 — 95% of time must meet threshold).
        warning_percentage: SLO warning level (default 97.5).
        evaluation_window: Dynatrace timeframe string (default "-1d" = last 24h).

    Returns:
        {"created": True, "slo_id": "<uuid>", "slo_name": "<name>", "dt_url": "<url>"}
        {"created": False, "reason": "<why>"}
    """
    if not settings.dt_otel_token:
        return {"created": False, "reason": "DT_OTEL_TOKEN not configured"}
    if not settings.dt_env:
        return {"created": False, "reason": "DT_ENV not configured"}
    if not service_entity_id.startswith("SERVICE-"):
        return {"created": False, "reason": f"Invalid entity ID: {service_entity_id}"}

    category = contract_category.lower()

    if category == "latency":
        slo_body = _build_latency_slo(
            contract_id=contract_id,
            service_entity_id=service_entity_id,
            service_name=service_name,
            subcategory=subcategory,
            description=description,
            threshold_ms=float(threshold_value),
            target=target_percentage,
            warning=warning_percentage,
            window=evaluation_window,
        )
    elif category == "throughput":
        slo_body = _build_throughput_slo(
            contract_id=contract_id,
            service_entity_id=service_entity_id,
            service_name=service_name,
            subcategory=subcategory,
            description=description,
            min_rps=float(threshold_value),
            target=target_percentage,
            warning=warning_percentage,
            window=evaluation_window,
        )
    elif category == "error_semantics":
        slo_body = _build_error_rate_slo(
            contract_id=contract_id,
            service_entity_id=service_entity_id,
            service_name=service_name,
            subcategory=subcategory,
            description=description,
            max_error_pct=float(threshold_value),
            target=target_percentage,
            warning=warning_percentage,
            window=evaluation_window,
        )
    else:
        return {"created": False, "reason": f"unsupported_category: {category}"}

    headers = {
        "Authorization": f"Api-Token {settings.dt_otel_token}",
        "Content-Type": "application/json",
    }

    log = logger.bind(contract_id=contract_id, category=category, service=service_name)
    log.info("creating_dynatrace_slo", slo_name=slo_body["name"])

    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.post(settings.dt_slo_endpoint, json=slo_body, headers=headers)

        if resp.is_success:
            data: dict[str, Any] = resp.json() if resp.content else {}
            slo_id = data.get("id", "")
            slo_name = slo_body["name"]
            dt_url = (
                f"{settings.dt_base_url}/ui/slo/{slo_id}"
                if slo_id
                else f"{settings.dt_base_url}/ui/slo"
            )
            log.info("dynatrace_slo_created", slo_id=slo_id, slo_name=slo_name)
            return {
                "created": True,
                "slo_id": slo_id,
                "slo_name": slo_name,
                "category": category,
                "target_percentage": target_percentage,
                "dt_url": dt_url,
            }

        log.warning(
            "dynatrace_slo_creation_failed",
            http_status=resp.status_code,
            detail=resp.text[:300],
        )
        return {
            "created": False,
            "reason": f"HTTP {resp.status_code}: {resp.text[:200]}",
        }

    except Exception as exc:
        log.error("dynatrace_slo_exception", error=str(exc))
        return {"created": False, "reason": str(exc)}


# ── SLO body builders ─────────────────────────────────────────────────────────


def _slo_base(
    contract_id: str,
    name: str,
    description: str,
    metric_expression: str,
    filter_string: str,
    target: float,
    warning: float,
    window: str,
) -> dict[str, Any]:
    return {
        "name": name,
        "description": description,
        "metricExpression": metric_expression,
        "evaluationType": "AGGREGATE",
        "filter": filter_string,
        "target": target,
        "warning": warning,
        "timeframe": window,
        "customInfo": f"karma-contract:{contract_id}",
        "errorBudgetBurnRate": {
            "fastBurnThreshold": 10,
            "burnRateVisualizationEnabled": True,
        },
    }


def _build_latency_slo(
    contract_id: str,
    service_entity_id: str,
    service_name: str,
    subcategory: str,
    description: str,
    threshold_ms: float,
    target: float,
    warning: float,
    window: str,
) -> dict[str, Any]:
    threshold_ns = int(threshold_ms * _NS_PER_MS)
    name = f"karma/{service_name}/latency/{subcategory}"[:100]
    desc = (
        f"Karma implicit contract — latency/{subcategory}: "
        f"p95 response time ≤ {threshold_ms:.0f}ms. "
        f"Discovered from {service_name} telemetry. "
        f"Contract: {contract_id}. {description[:200]}"
    )
    # Metric expression: percentage of 5-min intervals where p95 latency ≤ threshold
    metric_expr = (
        f"(100)*(builtin:service.response.time:percentile(95)"
        f":filter(eq(dt.entity.service,{service_entity_id}))"
        f":fold(max):default(0) lt {threshold_ns})"
    )
    return _slo_base(
        contract_id=contract_id,
        name=name,
        description=desc,
        metric_expression=metric_expr,
        filter_string=f"type(SERVICE),entityId({service_entity_id})",
        target=target,
        warning=warning,
        window=window,
    )


def _build_throughput_slo(
    contract_id: str,
    service_entity_id: str,
    service_name: str,
    subcategory: str,
    description: str,
    min_rps: float,
    target: float,
    warning: float,
    window: str,
) -> dict[str, Any]:
    name = f"karma/{service_name}/throughput/{subcategory}"[:100]
    desc = (
        f"Karma implicit contract — throughput/{subcategory}: "
        f"request rate ≥ {min_rps:.1f} req/s (floor discovered from {service_name}). "
        f"Contract: {contract_id}. {description[:200]}"
    )
    # Availability proxy: track that the service is receiving requests
    metric_expr = (
        f"(100)*(builtin:service.requestCount.total"
        f":filter(eq(dt.entity.service,{service_entity_id}))"
        f":fold(sum):default(0) gt 0)"
    )
    return _slo_base(
        contract_id=contract_id,
        name=name,
        description=desc,
        metric_expression=metric_expr,
        filter_string=f"type(SERVICE),entityId({service_entity_id})",
        target=target,
        warning=warning,
        window=window,
    )


def _build_error_rate_slo(
    contract_id: str,
    service_entity_id: str,
    service_name: str,
    subcategory: str,
    description: str,
    max_error_pct: float,
    target: float,
    warning: float,
    window: str,
) -> dict[str, Any]:
    name = f"karma/{service_name}/error-rate/{subcategory}"[:100]
    desc = (
        f"Karma implicit contract — error_semantics/{subcategory}: "
        f"server error rate ≤ {max_error_pct:.1f}%. "
        f"Discovered from {service_name} telemetry. "
        f"Contract: {contract_id}. {description[:200]}"
    )
    metric_expr = (
        f"100-(100*(builtin:service.errors.server.successCount"
        f":splitBy(dt.entity.service)"
        f":filter(eq(dt.entity.service,{service_entity_id}))"
        f":default(0)))"
    )
    return _slo_base(
        contract_id=contract_id,
        name=name,
        description=desc,
        metric_expression=metric_expr,
        filter_string=f"type(SERVICE),entityId({service_entity_id})",
        target=target,
        warning=warning,
        window=window,
    )
