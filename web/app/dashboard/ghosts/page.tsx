"use client";

import { useEffect, useState } from "react";
import { Ghost, Filter } from "lucide-react";
import { useSSE } from "@/lib/sse";
import { GhostCard } from "@/components/GhostCard";
import { ViolationPulse } from "@/components/ViolationPulse";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { GhostReport, ViolationSeverity } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEVERITIES: Array<ViolationSeverity | "all"> = ["all", "critical", "high", "medium", "low"];

export default function GhostsPage() {
  const [reports, setReports]       = useState<GhostReport[]>([]);
  const [latestReport, setLatest]   = useState<GhostReport | null>(null);
  const [severity, setSeverity]     = useState<ViolationSeverity | "all">("all");

  // Initial load
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/ghosts?limit=50`)
      .then((r) => r.json())
      .then((data: GhostReport[]) => {
        if (Array.isArray(data)) setReports(data);
      })
      .catch(() => {});
  }, []);

  // Live SSE stream
  useSSE(`${process.env.NEXT_PUBLIC_API_URL}/stream/ghosts`, {
    ghost_report: (data) => {
      const report = JSON.parse(data) as GhostReport;
      setLatest(report);
      setReports((prev) => [report, ...prev]);
      setTimeout(() => setLatest(null), 6000);
    },
  });

  const filtered = severity === "all"
    ? reports
    : reports.filter((r) => r.severity === severity);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ghosts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Implicit contract violations detected in replacement services.
          </p>
        </div>
        {reports.length > 0 && (
          <Badge variant="ghost" className="gap-1.5 self-start sm:self-auto">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary/60 animate-ping opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Live monitoring
          </Badge>
        )}
      </div>

      {/* ── Live alert ── */}
      {latestReport && <ViolationPulse report={latestReport} />}

      {/* ── Severity filter ── */}
      {reports.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {SEVERITIES.map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 border",
                severity === s
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {s === "all" ? `All (${reports.length})` : s}
            </button>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      {filtered.length === 0 ? (
        <EmptyState hasFilter={severity !== "all"} onClear={() => setSeverity("all")} />
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <GhostCard key={report.report_id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasFilter, onClear }: { hasFilter: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/30 px-6 py-16 text-center">
      <div className="relative mb-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-card">
          <Ghost className="h-7 w-7 text-muted-foreground/40" />
        </div>
        <div className="absolute -inset-2 rounded-2xl bg-primary/3 blur-xl" />
      </div>
      {hasFilter ? (
        <>
          <h3 className="text-base font-semibold">No ghosts at this severity</h3>
          <p className="mt-2 text-sm text-muted-foreground">Try a different filter.</p>
          <Button variant="outline" className="mt-5" onClick={onClear}>Clear filter</Button>
        </>
      ) : (
        <>
          <h3 className="text-base font-semibold">No ghosts detected yet</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs leading-relaxed">
            The haunting begins after cutover. Ghost reports appear here in real time as violations are detected.
          </p>
          <p className="mt-3 text-xs text-muted-foreground/60 font-mono">
            Listening for events on /stream/ghosts…
          </p>
        </>
      )}
    </div>
  );
}
