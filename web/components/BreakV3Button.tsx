"use client";

import { useCallback, useEffect, useState } from "react";
import { Zap, HeartPulse, Loader2, Radio, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { V3Control } from "@/lib/types";

/**
 * Live-demo control: flips the synthetic svc-payments-v3 service between its
 * healthy and regressed states at runtime, so a judge can watch Karma detect the
 * regression end to end. Renders nothing unless the API reports the control path
 * is configured (SVC_PAYMENTS_V3_URL set), so it stays invisible in environments
 * where the synthetic env isn't wired up.
 */
export default function BreakV3Button() {
  const [status, setStatus] = useState<V3Control | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const s = await apiFetch<V3Control>("/control/v3-status");
      setStatus(s);
    } catch {
      setStatus({ configured: false });
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function toggle(action: "break-v3" | "heal-v3") {
    setActing(true);
    setError(null);
    setNote(null);
    try {
      const res = await apiFetch<V3Control>(`/control/${action}`, { method: "POST" });
      setStatus(res);
      const parts: string[] = [];
      if (res.message) parts.push(res.message);
      if (action === "break-v3" && res.watcher_triggered)
        parts.push(`Watcher kicked on ${res.watcher_triggered} service(s).`);
      setNote(parts.join(" "));
    } catch (e) {
      const err = e as { message?: string };
      setError(err.message ?? "Control call failed");
    } finally {
      setActing(false);
    }
  }

  // Hidden until we know the control path exists — no empty placeholder.
  if (!loaded) return null;
  if (!status || !status.configured) return null;

  const healthy = status.healthy !== false;
  const unreachable = status.reachable === false;

  return (
    <div className="rounded-xl border border-border bg-card/60 p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2">
          <Radio
            className={cn(
              "h-4 w-4 shrink-0",
              unreachable ? "text-muted-foreground" : healthy ? "text-emerald-400" : "text-red-400",
            )}
          />
          <span className="text-sm font-bold text-foreground">Live demo control · svc-payments-v3</span>
        </div>

        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            unreachable
              ? "border-border bg-muted/40 text-muted-foreground"
              : healthy
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/40 bg-red-500/10 text-red-300",
          )}
        >
          {unreachable ? "unreachable" : healthy ? "healthy" : "regressed"}
        </span>

        <button
          onClick={() => toggle(healthy ? "break-v3" : "heal-v3")}
          disabled={acting || unreachable}
          className={cn(
            "ml-auto inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-50",
            healthy
              ? "bg-red-500/90 text-white hover:bg-red-500"
              : "bg-emerald-500/90 text-white hover:bg-emerald-500",
          )}
        >
          {acting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : healthy ? (
            <Zap className="h-4 w-4" />
          ) : (
            <HeartPulse className="h-4 w-4" />
          )}
          {acting ? "Working…" : healthy ? "Break v3 live" : "Heal v3"}
        </button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {healthy
          ? "v3 is honoring every learned contract. Click to drop the hidden Redis cache-warming side effect (and the 409 original_txn_id field) at runtime — then watch Karma file a ghost report from real Dynatrace telemetry."
          : "v3 has dropped its cache-warming contract. svc-reporting is degrading on every request. Heal it to restore healthy behavior once the ghost report lands."}
      </p>

      {note && <p className="mt-2 text-xs font-medium text-teal-300">{note}</p>}
      {error && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-400">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      )}
    </div>
  );
}
