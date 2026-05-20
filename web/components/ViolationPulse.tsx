"use client";

import { useEffect, useRef, useState } from "react";
import { X, AlertOctagon, AlertTriangle, Info, Zap } from "lucide-react";
import type { GhostReport, ViolationSeverity } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ViolationPulseProps {
  report: GhostReport;
  /** Auto-dismiss delay in ms. Defaults to 7000. Pass 0 to disable auto-dismiss. */
  autoDismissMs?: number;
  onDismiss?: () => void;
}

// Dismiss duration matches animation: 350ms entry + 2×2400ms ghost-pulse = ~5.15s visible
const DEFAULT_DISMISS_MS = 7000;

const SEVERITY_CONFIG: Record<
  ViolationSeverity,
  {
    border: string;
    bg: string;
    text: string;
    bar: string;
    icon: typeof AlertOctagon;
    iconClass: string;
    label: string;
  }
> = {
  low: {
    border: "border-zinc-500/40",
    bg: "bg-zinc-500/8",
    text: "text-zinc-300",
    bar: "bg-zinc-500",
    icon: Info,
    iconClass: "text-zinc-400",
    label: "LOW",
  },
  medium: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/8",
    text: "text-amber-300",
    bar: "bg-amber-400",
    icon: AlertTriangle,
    iconClass: "text-amber-400",
    label: "MEDIUM",
  },
  high: {
    border: "border-red-500/40",
    bg: "bg-red-500/8",
    text: "text-red-300",
    bar: "bg-red-400",
    icon: AlertOctagon,
    iconClass: "text-red-400",
    label: "HIGH",
  },
  critical: {
    border: "border-red-500/60",
    bg: "bg-red-500/12",
    text: "text-red-200",
    bar: "bg-red-500",
    icon: Zap,
    iconClass: "text-red-300",
    label: "CRITICAL",
  },
};

export function ViolationPulse({
  report,
  autoDismissMs = DEFAULT_DISMISS_MS,
  onDismiss,
}: ViolationPulseProps) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());
  const cfg = SEVERITY_CONFIG[report.severity] ?? SEVERITY_CONFIG.high;

  function dismiss() {
    setVisible(false);
    onDismiss?.();
  }

  // Progress bar + auto-dismiss
  useEffect(() => {
    if (autoDismissMs === 0) return;

    startRef.current = Date.now();
    const DURATION = autoDismissMs;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / DURATION) * 100);
      setProgress(pct);
      if (pct === 0) clearInterval(interval);
    }, 50);

    const timer = setTimeout(dismiss, DURATION);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.report_id, autoDismissMs]);

  if (!visible) return null;

  const isCritical = report.severity === "critical";

  return (
    <div
      role="alert"
      aria-live={isCritical ? "assertive" : "polite"}
      aria-atomic="true"
      className={cn(
        // ghost-pulse-overlay provides combined entry + pulse animation — do NOT add animate-fade-in-up here
        "ghost-pulse-overlay relative overflow-hidden rounded-xl border",
        cfg.border,
        cfg.bg,
        cfg.text,
        // Critical severity gets an extra ambient glow ring
        isCritical && "shadow-[0_0_32px_-6px_hsl(0_72%_51%/0.50)]"
      )}
    >
      {/* ── Severity accent bar (left edge) ── */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", cfg.bar)} />

      {/* ── Auto-dismiss progress bar (bottom edge) ── */}
      {autoDismissMs > 0 && (
        <div className="absolute bottom-0 left-1 right-0 h-[2px] bg-current/10">
          <div
            className={cn("h-full transition-[width] duration-100 ease-linear", cfg.bar, "opacity-50")}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="pl-5 pr-4 pt-3.5 pb-4 space-y-2">
        {/* ── Header row ── */}
        <div className="flex items-start gap-3">
          {/* Pulsing icon */}
          <div className="shrink-0 mt-0.5">
            <span className="relative flex h-5 w-5">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full rounded-full bg-current opacity-20",
                  isCritical ? "animate-ping" : "animate-pulse-ring"
                )}
              />
              <span className="relative inline-flex h-5 w-5 items-center justify-center">
                <cfg.icon
                  className={cn(
                    "h-4 w-4",
                    cfg.iconClass,
                    isCritical && "animate-ghost-alarm"
                  )}
                />
              </span>
            </span>
          </div>

          {/* Title + severity badge */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[11px] font-bold uppercase tracking-widest opacity-90">
                Ghost detected
              </p>
              <span
                className={cn(
                  "rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest border",
                  cfg.border,
                  "bg-current/5"
                )}
              >
                {cfg.label}
              </span>
              {report.category && (
                <span className="text-[10px] font-mono opacity-55">{report.category}</span>
              )}
            </div>
          </div>

          {/* Dismiss button */}
          <button
            onClick={dismiss}
            className="shrink-0 rounded-md p-1 opacity-50 hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
            aria-label="Dismiss alert"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ── Summary ── */}
        <p className="text-sm font-semibold leading-snug pl-8">{report.summary}</p>

        {/* ── Downstream impact ── */}
        {report.downstream_impact && (
          <p className="text-xs opacity-70 leading-relaxed pl-8">{report.downstream_impact}</p>
        )}
      </div>
    </div>
  );
}
