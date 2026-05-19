"use client";

import { useEffect, useState } from "react";
import { X, AlertOctagon } from "lucide-react";
import type { GhostReport } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ViolationPulseProps {
  report: GhostReport;
}

const SEVERITY_STYLES = {
  low:      "border-zinc-500/40  bg-zinc-500/10  text-zinc-300",
  medium:   "border-amber-500/40 bg-amber-500/10 text-amber-300",
  high:     "border-red-500/40   bg-red-500/10   text-red-300",
  critical: "border-red-500/60   bg-red-500/15   text-red-200 shadow-[0_0_28px_-4px_hsl(0_72%_51%/0.45)]",
};

export function ViolationPulse({ report }: ViolationPulseProps) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const DURATION = 6000;
    const start = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.max(0, 100 - (elapsed / DURATION) * 100));
    }, 50);

    const timer = setTimeout(() => {
      setVisible(false);
      clearInterval(interval);
    }, DURATION);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [report.report_id]);

  if (!visible) return null;

  const styles = SEVERITY_STYLES[report.severity] ?? SEVERITY_STYLES.high;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "ghost-pulse-overlay relative overflow-hidden rounded-xl border p-4",
        "animate-fade-in-up",
        styles
      )}
    >
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-current opacity-20">
        <div
          className="h-full bg-current opacity-60 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="shrink-0 mt-0.5">
          <span className="relative flex h-5 w-5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-30 animate-ping" />
            <span className="relative inline-flex h-5 w-5 items-center justify-center">
              <AlertOctagon className="h-4 w-4" />
            </span>
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold uppercase tracking-wider">
              Ghost detected
            </p>
            <span className="text-[10px] font-medium uppercase tracking-widest opacity-70">
              {report.severity}
            </span>
          </div>
          <p className="text-sm leading-snug opacity-90">{report.summary}</p>
          {report.downstream_impact && (
            <p className="text-xs opacity-65 leading-relaxed">{report.downstream_impact}</p>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={() => setVisible(false)}
          className="shrink-0 rounded-md p-1 opacity-60 hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
