"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Ghost,
  Loader2,
  Play,
  RefreshCw,
  Trash2,
  Zap,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type Step =
  | { id: "seed";    label: string }
  | { id: "watcher"; label: string }
  | { id: "done";    label: string };

const STEPS: Step[] = [
  { id: "seed",    label: "Seed demo contracts" },
  { id: "watcher", label: "Trigger Watcher run" },
  { id: "done",    label: "Stream ghost events" },
];

type RunState = "idle" | "running" | "done" | "error";

/**
 * @param redirectAfterRun - Route to push after successful run. Pass null to
 *   stay on the current page (e.g. when already on /dashboard).
 */
export function DemoRunPanel({
  redirectAfterRun = "/dashboard",
}: {
  redirectAfterRun?: string | null;
}) {
  const router = useRouter();

  const [runState,     setRunState]     = useState<RunState>("idle");
  const [activeStep,   setActiveStep]   = useState<number>(-1);
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  const [resetBusy,    setResetBusy]    = useState(false);
  const [resetMsg,     setResetMsg]     = useState<string | null>(null);
  const [serviceId,    setServiceId]    = useState<string | null>(null);

  async function runFullDemo() {
    setRunState("running");
    setActiveStep(0);
    setErrorMsg(null);
    setResetMsg(null);

    try {
      // Step 1 — seed
      const seedResult = await apiFetch<{
        already_seeded: boolean;
        service_id: string;
        contracts: number;
      }>("/demo/seed", { method: "POST" });
      setServiceId(seedResult.service_id);
      setActiveStep(1);

      // Step 2 — run watcher
      await apiFetch("/cutover/watchers/run-now", {
        method: "POST",
        body: JSON.stringify({ service_id: seedResult.service_id }),
      });
      setActiveStep(2);

      // Brief pause so the SSE stream can start flowing before we redirect
      await new Promise((r) => setTimeout(r, 800));

      setRunState("done");

      // Step 3 — navigate if a redirect target was specified
      if (redirectAfterRun) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(redirectAfterRun as any);
      }

    } catch (e: unknown) {
      setErrorMsg((e as Error).message ?? "Demo run failed");
      setRunState("error");
    }
  }

  async function resetDemo() {
    setResetBusy(true);
    setResetMsg(null);
    try {
      const r = await apiFetch<{ deleted_services: number }>("/demo/reset", { method: "DELETE" });
      setResetMsg(
        r.deleted_services > 0
          ? `Removed ${r.deleted_services} demo service${r.deleted_services !== 1 ? "s" : ""}.`
          : "No demo data found — already clean."
      );
      setRunState("idle");
      setActiveStep(-1);
      setServiceId(null);
    } catch (e: unknown) {
      setResetMsg((e as Error).message ?? "Reset failed");
    } finally {
      setResetBusy(false);
    }
  }

  const isRunning = runState === "running";

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-violet-950/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 border border-primary/25">
          <Zap className="h-4.5 w-4.5 text-primary" style={{ width: 18, height: 18 }} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Full Demo Mode</h3>
          <p className="text-xs text-muted-foreground">
            One click — seed → watcher → ghost feed in under 90 s
          </p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Step indicators */}
        <ol className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const done    = activeStep > i || runState === "done";
            const active  = activeStep === i && isRunning;
            const pending = activeStep < i && runState !== "done";
            return (
              <li key={step.id} className="flex items-center flex-1">
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-all",
                    done   && "border-emerald-500/60 bg-emerald-500/15 text-emerald-400",
                    active && "border-primary/60 bg-primary/10 text-primary animate-pulse",
                    pending && !isRunning && "border-border bg-muted/20 text-muted-foreground",
                    pending &&  isRunning && "border-border/40 bg-muted/10 text-muted-foreground/40",
                  )}>
                    {done
                      ? <CheckCircle2 className="h-3.5 w-3.5" />
                      : active
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : i + 1
                    }
                  </div>
                  <span className={cn(
                    "text-[11px] whitespace-nowrap",
                    done   && "text-emerald-400",
                    active && "text-primary font-medium",
                    pending && "text-muted-foreground",
                  )}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    "flex-1 h-px mx-2",
                    done ? "bg-emerald-500/30" : "bg-border/40"
                  )} />
                )}
              </li>
            );
          })}
        </ol>

        {/* Main action button */}
        <button
          onClick={runFullDemo}
          disabled={isRunning || runState === "done"}
          className={cn(
            "w-full flex items-center justify-center gap-2.5 rounded-xl py-3 text-sm font-bold transition-all duration-200",
            runState === "idle" && "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md",
            isRunning           && "bg-primary/30 text-primary cursor-not-allowed",
            runState === "done" && "bg-emerald-500/20 text-emerald-400 cursor-default border border-emerald-500/30",
            runState === "error" && "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20",
          )}
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running demo…
            </>
          ) : runState === "done" ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              {redirectAfterRun ? "Demo complete — redirecting…" : "Watcher running — watch the feed below"}
            </>
          ) : runState === "error" ? (
            <>
              <RefreshCw className="h-4 w-4" />
              Retry demo
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-current" />
              Run Full Demo
            </>
          )}
        </button>

        {/* Error message */}
        {errorMsg && (
          <p className="text-xs text-red-400 text-center">{errorMsg}</p>
        )}

        {/* Service info after seed */}
        {serviceId && !errorMsg && (
          <div className="flex items-center gap-2 justify-center text-[11px] text-muted-foreground">
            <Ghost className="h-3 w-3 text-primary" />
            <span>Demo service <span className="font-mono text-foreground">{serviceId.slice(0, 8)}…</span> active</span>
          </div>
        )}

        {/* Reset section */}
        <div className="flex items-center justify-between pt-1 border-t border-border/40">
          <p className="text-[11px] text-muted-foreground">
            {resetMsg
              ? <span className="text-emerald-400">{resetMsg}</span>
              : "Remove all demo data to start fresh."}
          </p>
          <button
            onClick={resetDemo}
            disabled={resetBusy}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-red-400 transition-colors"
          >
            {resetBusy
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Trash2 className="h-3 w-3" />}
            Reset demo
          </button>
        </div>
      </div>
    </div>
  );
}
