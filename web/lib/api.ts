"use client";

import { getIdToken } from "./firebase";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Authenticated fetch wrapper for all backend API calls.
 *
 * Automatically:
 *  - Prepends NEXT_PUBLIC_API_URL to the path
 *  - Attaches the Firebase ID token as Authorization: Bearer <token>
 *  - Sets Content-Type: application/json when a body is provided
 *  - Throws on non-2xx responses (message = response body text)
 */
export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getIdToken();

  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (init?.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.text();
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const json = JSON.parse(body) as { detail?: string };
        if (json.detail) detail = String(json.detail);
      } else if (body && !body.startsWith("<!")) {
        detail = body;
      }
    } catch {
      // ignore parse errors — keep the HTTP status message
    }
    throw new Error(detail);
  }

  return res.json() as Promise<T>;
}
