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
  // Silently accept and discard when Dynatrace isn't configured.
  // This avoids breaking the frontend in environments without OTel.
  if (!DT_ENDPOINT || !DT_TOKEN) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const body = await req.arrayBuffer();
  const contentType =
    req.headers.get("content-type") ?? "application/json";

  try {
    const dtUrl = `${DT_ENDPOINT.replace(/\/$/, "")}/v1/traces`;
    const resp = await fetch(dtUrl, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        Authorization: `Api-Token ${DT_TOKEN}`,
      },
      body,
    });

    return new NextResponse(null, { status: resp.ok ? 200 : resp.status });
  } catch {
    // Don't surface Dynatrace connectivity errors to the client.
    return new NextResponse(null, { status: 200 });
  }
}
