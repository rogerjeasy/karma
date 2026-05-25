import { type NextRequest, NextResponse } from "next/server";

// Server-side OTLP proxy — keeps the Dynatrace token out of the browser bundle.
// The browser SDK sends to /api/otel/traces; this route forwards to Dynatrace.
// Mirrors the API's _endpoint_from_env() fallback: derive URL from DT_ENV when
// OTEL_EXPORTER_OTLP_ENDPOINT is not set directly.

function resolveEndpoint(): string {
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  }
  const dtEnv = process.env.DT_ENV;
  if (dtEnv) {
    return `https://${dtEnv}.live.dynatrace.com/api/v2/otlp`;
  }
  return "";
}

const DT_ENDPOINT = resolveEndpoint();
const DT_TOKEN =
  process.env.DT_OTEL_TOKEN || process.env.DT_API_TOKEN || "";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!DT_ENDPOINT || !DT_TOKEN) {
    console.log("[otel-proxy] DT not configured — traces dropped");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const body = await req.arrayBuffer();
  const contentType =
    req.headers.get("content-type") ?? "application/x-protobuf";
  const dtUrl = `${DT_ENDPOINT.replace(/\/$/, "")}/v1/traces`;

  try {
    const resp = await fetch(dtUrl, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        Authorization: `Api-Token ${DT_TOKEN}`,
      },
      body,
    });

    if (!resp.ok) {
      console.error(
        `[otel-proxy] Dynatrace rejected traces: HTTP ${resp.status} ` +
        `content-type=${contentType} bytes=${body.byteLength}`
      );
    } else {
      console.log(
        `[otel-proxy] traces forwarded OK: bytes=${body.byteLength} content-type=${contentType}`
      );
    }
  } catch (err) {
    console.error(`[otel-proxy] fetch error: ${err}`);
  }

  // Always return 200 — telemetry errors must never surface to the client.
  return new NextResponse(null, { status: 200 });
}
