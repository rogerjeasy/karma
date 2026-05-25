import {
  Activity,
  AlertTriangle,
  Clock,
  RefreshCw,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PHASE_COLORS, PHASE_BAR_COLORS } from "./constants";
import type { SessionActivity } from "@/lib/types";

export function SessionActivityCard({ sa }: { sa: SessionActivity }) {
  const hasViolations = sa.total_violations_found > 0;
  const totalServices = Object.values(sa.services_by_phase).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Runs */}
        <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
          <div className="pointer-events-none absolute -top-5 -right-5 h-20 w-20 rounded-full bg-primary/10 blur-2xl" />
          <div className="flex items-center gap-1.5 text-primary/70 mb-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">Total Runs</span>
          </div>
          <p className="text-3xl font-bold text-foreground tabular-nums">
            {sa.total_watcher_runs}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">all time</p>
        </div>

        {/* Last 24 h */}
        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">Last 24 h</span>
          </div>
          <p className="text-3xl font-bold text-foreground tabular-nums">{sa.runs_last_24h}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">runs today</p>
        </div>

        {/* Last 7 d */}
        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
            <Activity className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">Last 7 d</span>
          </div>
          <p className="text-3xl font-bold text-foreground tabular-nums">{sa.runs_last_7d}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">this week</p>
        </div>

        {/* Violations */}
        <div
          className={cn(
            "rounded-xl border px-4 py-3",
            hasViolations
              ? "border-red-500/25 bg-red-500/8"
              : "border-emerald-500/25 bg-emerald-500/8",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-1.5 mb-1.5",
              hasViolations ? "text-red-400/70" : "text-emerald-400/70",
            )}
          >
            {hasViolations ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            <span className="text-[11px] font-medium">Violations</span>
          </div>
          <p
            className={cn(
              "text-3xl font-bold tabular-nums",
              hasViolations ? "text-red-400" : "text-emerald-400",
            )}
          >
            {sa.total_violations_found}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {hasViolations ? "detected" : "system clean"}
          </p>
        </div>
      </div>

      {/* ── Platform health row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 border border-blue-500/20">
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Registered Users
            </p>
            <p className="text-xl font-bold text-foreground tabular-nums">{sa.total_users}</p>
          </div>
        </div>

        {sa.avg_duration_seconds != null ? (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/20">
              <Timer className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Avg Watcher Duration
              </p>
              <p className="text-xl font-bold text-foreground tabular-nums">
                {sa.avg_duration_seconds.toFixed(1)}
                <span className="text-sm font-medium text-muted-foreground ml-1">s</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">No duration data yet</p>
          </div>
        )}
      </div>

      {/* ── Phase distribution ───────────────────────────────────────── */}
      {totalServices > 0 && (
        <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Services by Phase
            </p>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {totalServices} service{totalServices !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Segmented bar */}
          <div className="flex h-2 rounded-full overflow-hidden gap-px bg-muted/30">
            {Object.entries(sa.services_by_phase).map(([phase, count]) => (
              <div
                key={phase}
                className={cn(
                  "rounded-full transition-all",
                  PHASE_BAR_COLORS[phase] ?? "bg-slate-500",
                )}
                style={{ width: `${(count / totalServices) * 100}%` }}
                title={`${phase}: ${count}`}
              />
            ))}
          </div>

          {/* Phase pills with dot + label + count */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(sa.services_by_phase).map(([phase, count]) => (
              <div
                key={phase}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium capitalize",
                  PHASE_COLORS[phase] ?? PHASE_COLORS.registered,
                )}
              >
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    PHASE_BAR_COLORS[phase] ?? "bg-slate-500",
                  )}
                />
                {phase}
                <span className="font-bold tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
