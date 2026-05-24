// Next.js server-side OpenTelemetry — sends traces to Dynatrace.
// Runs once on server startup (Node.js runtime only).
// See https://nextjs.org/docs/app/building-your-application/optimizing/open-telemetry
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const dtEnv = process.env.DT_ENV ?? "";
  const token =
    process.env.DT_OTEL_TOKEN ?? process.env.DT_API_TOKEN ?? "";

  if (!dtEnv || !token) return;

  const { trace } = await import("@opentelemetry/api");
  // Use protobuf exporter — Dynatrace's OTLP/HTTP endpoint requires protobuf format for traces.
  const { OTLPTraceExporter } = await import(
    "@opentelemetry/exporter-trace-otlp-proto"
  );
  const { resourceFromAttributes } = await import("@opentelemetry/resources");
  const { BasicTracerProvider, BatchSpanProcessor } = await import(
    "@opentelemetry/sdk-trace-base"
  );

  const endpoint = `https://${dtEnv}.live.dynatrace.com/api/v2/otlp`;

  const resource = resourceFromAttributes({
    "service.name": "karma-web",
    "service.version": "1.0.0",
    "service.namespace": "karma",
    "cloud.platform": "gcp_cloud_run",
  });

  const exporter = new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
    headers: { Authorization: `Api-Token ${token}` },
  });

  const provider = new BasicTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });

  trace.setGlobalTracerProvider(provider);
}
