import type { Context } from "@opentelemetry/api";
import { context as otelContext, propagation } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPExporterBase } from "@opentelemetry/otlp-exporter-base";
import { createLegacyOtlpBrowserExportDelegate } from "@opentelemetry/otlp-exporter-base/browser-http";
import { ProtobufTraceSerializer } from "@opentelemetry/otlp-transformer";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { resourceFromAttributes } from "@opentelemetry/resources";
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";
import type { ReadableSpan, Span, SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";

// One UUID per browser tab — serves as session.id on all spans.
const SESSION_ID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

// Mutable user context — updated by setOtelUser() when Firebase auth state changes.
let _userAttrs: Record<string, string> = {
  "session.id": SESSION_ID,
  "user.id": "anonymous",
  "user.email": "unknown",
  "organization.id": "karma",
};

// Stamps every span with the current user context so Dynatrace can slice by user/session.
class UserContextProcessor implements SpanProcessor {
  private readonly _batch: BatchSpanProcessor;

  constructor(exporter: SpanExporter) {
    this._batch = new BatchSpanProcessor(exporter, {
      scheduledDelayMillis: 5_000,
      maxExportBatchSize: 64,
    });
  }

  onStart(span: Span, parentContext: Context): void {
    span.setAttributes(_userAttrs);
    this._batch.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpan): void {
    this._batch.onEnd(span);
  }

  shutdown(): Promise<void> {
    return this._batch.shutdown();
  }

  forceFlush(): Promise<void> {
    return this._batch.forceFlush();
  }
}

let _initialized = false;

export function initOtel(): void {
  if (_initialized || typeof window === "undefined") return;
  _initialized = true;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

  // OTel 2.x requires absolute URLs for the exporter.
  // The proxy route at /api/otel/traces adds the DT auth header server-side.
  const exportUrl = `${window.location.origin}/api/otel/traces`;

  // Send protobuf — Dynatrace OTLP endpoint requires application/x-protobuf (rejects JSON).
  const exporter = new OTLPExporterBase(
    createLegacyOtlpBrowserExportDelegate(
      { url: exportUrl },
      ProtobufTraceSerializer,
      "v1/traces",
      { "Content-Type": "application/x-protobuf" },
    ),
  );

  const resource = resourceFromAttributes({
    "service.name": "karma-web",
    "service.version": "1.0.0",
    "service.namespace": "karma",
    "cloud.platform": "gcp_cloud_run",
  });

  const provider = new WebTracerProvider({
    resource,
    spanProcessors: [new UserContextProcessor(exporter)],
  });

  provider.register({ propagator: new W3CTraceContextPropagator() });

  const corsUrls = apiUrl
    ? [new RegExp(apiUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))]
    : [/.*/];

  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new FetchInstrumentation({
        // Only inject traceparent into calls to our own backend API.
        propagateTraceHeaderCorsUrls: corsUrls,
        // Avoid instrumenting the OTel proxy itself to prevent infinite loops.
        ignoreUrls: [/\/api\/otel\//],
        clearTimingResources: true,
      }),
      new DocumentLoadInstrumentation(),
    ],
  });
}

// Call this whenever Firebase auth state changes.
export function setOtelUser(uid: string, email: string): void {
  _userAttrs = {
    "session.id": SESSION_ID,
    "user.id": uid,
    "user.email": email,
    "organization.id": "karma",
  };
}

// Returns W3C trace headers for the currently active span.
// Used in apiFetch to propagate traces from browser → backend for distributed tracing.
export function getTraceHeaders(): Record<string, string> {
  const carrier: Record<string, string> = {};
  try {
    propagation.inject(otelContext.active(), carrier);
  } catch {
    // OTel not yet initialized — safe to skip
  }
  return carrier;
}
