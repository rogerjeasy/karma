"use client";

import { useState, useEffect } from "react";
import type { Route } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Server, Ghost, FileCode2, Activity,
  ArrowRight, Plus, Zap, TrendingUp, Radio, Clock,
  Coins, Cpu, Brain, Eye, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, Timer, BarChart3, FlaskConical, Loader2,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSSEContext, useSSEEvent } from "@/lib/sse-context";
import { useDashboardData } from "@/lib/dashboard-context";
import { apiFetch } from "@/lib/api";
import type { ContractCategory, ContractResponse, GhostReport, PlatformStats, ViolationSeverity, WatcherRun, AiCostUpdateEvent } from "@/lib/types";
import { WatcherLiveLog } from "@/components/WatcherLiveLog";
import { DemoRunPanel } from "@/components/DemoRunPanel";
import AskKarmaConsole from "@/components/AskKarmaConsole";


interface Stats {
  totalServices: number;
  activeGhosts: number;
  contractsLearned: number;
  hauntingPhase: number;
}

export default function DashboardPage() {
  const { services, ghosts, contracts, loading } = useDashboardData();
  const [liveGhostBump, setLiveGhostBump]     = useState(false);
  const [aiCostFlash, setAiCostFlash]         = useState(false);
  const [lastCostUpdate, setLastCostUpdate]   = useState<AiCostUpdateEvent | null>(null);
  const [platformStats, setPlatformStats]     = useState<PlatformStats | null>(null);
  const [watcherRuns, setWatcherRuns]         = useState<WatcherRun[]>([]);
  const [showDemoPanel, setShowDemoPanel] = useState(false);

  // ── Derive stats from shared context data ─────────────────────────────────
  const contractsLearned = Object.values(contracts).reduce((sum, c) => sum + c.length, 0);
  const stats: Stats | null = loading ? null : {
    totalServices:    services.length,
    activeGhosts:     ghosts.length,
    contractsLearned,
    hauntingPhase:    services.filter((s) => s.phase === "haunting").length,
  };

  // ── AI cost totals derived from ghost reports ─────────────────────────────
  const totalCostUsd  = ghosts.reduce((sum, g) => sum + (g.cost_estimate_usd ?? 0), 0);
  const totalTokens   = ghosts.reduce((sum, g) => sum + (g.investigation_input_tokens ?? 0) + (g.investigation_output_tokens ?? 0), 0);
  const davisEnriched = ghosts.filter((g) => g.davis_ai_insights && g.davis_ai_insights !== "not available").length;
  const hasCostData   = !loading && ghosts.some((g) => g.cost_estimate_usd != null);

  // ── ROI: incident cost avoided by early detection vs. what the AI spent ───
  const totalAvoidedUsd  = ghosts.reduce((sum, g) => sum + (g.avoided_incident_cost_usd ?? 0), 0);
  const incidentsCaught  = ghosts.filter((g) => (g.avoided_incident_cost_usd ?? 0) > 0).length;
  const roiMultiple      = totalCostUsd > 0 ? totalAvoidedUsd / totalCostUsd : 0;
  const hasRoi           = !loading && totalAvoidedUsd > 0;

  // ── Fetch /stats with auth so the backend returns user-scoped data ──────
  useEffect(() => {
    apiFetch<PlatformStats>('/stats')
      .then((d) => setPlatformStats(d))
      .catch(() => {});
  }, [services.length, ghosts.length]);

  // ── Fetch recent watcher runs across all services ─────────────────────────
  useEffect(() => {
    if (services.length === 0) return;
    const haunting = services.filter((s) => s.phase === "haunting" || s.phase === "completed");
    if (haunting.length === 0) return;

    Promise.all(
      haunting.slice(0, 5).map((s) =>
        apiFetch<WatcherRun[]>(`/services/${s.service_id}/watcher-runs?limit=5`)
          .catch(() => [] as WatcherRun[])
      )
    ).then((arrays) => {
      const all = arrays.flat().sort(
        (a, b) => new Date(b.run_at).getTime() - new Date(a.run_at).getTime()
      );
      setWatcherRuns(all.slice(0, 10));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services.length]);

  // ── Live ghost bump + AI cost flash ──────────────────────────────────────
  const { connectionState: sseState } = useSSEContext();
  useSSEEvent("ghost_report", () => {
    setLiveGhostBump(true);
    setTimeout(() => setLiveGhostBump(false), 1200);
  });
  useSSEEvent("ai_cost_update", (raw) => {
    try {
      const update = JSON.parse(raw) as AiCostUpdateEvent;
      setLastCostUpdate(update);
      setAiCostFlash(true);
      setTimeout(() => setAiCostFlash(false), 2000);
    } catch { /* ignore */ }
  });

  const cards = [
    {
      label: "Total Services",
      value: stats?.totalServices ?? null,
      icon: Server,
      href: "/dashboard/services",
      accent: "from-blue-500/20 to-blue-600/5 border-blue-500/20",
      iconClass: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      glow: "group-hover:shadow-[0_0_20px_-4px_rgba(59,130,246,0.3)]",
      bump: false,
    },
    {
      label: "Active Ghosts",
      value: stats?.activeGhosts ?? null,
      icon: Ghost,
      href: "/dashboard/ghosts",
      accent: "from-red-500/20 to-red-600/5 border-red-500/20",
      iconClass: "text-red-400 bg-red-500/10 border-red-500/20",
      glow: "group-hover:shadow-[0_0_20px_-4px_rgba(239,68,68,0.3)]",
      bump: liveGhostBump,
    },
    {
      label: "Contracts Learned",
      value: stats?.contractsLearned ?? null,
      icon: FileCode2,
      href: "/dashboard/timeline",
      accent: "from-teal-500/20 to-teal-600/5 border-teal-500/20",
      iconClass: "text-teal-400 bg-teal-500/10 border-teal-500/20",
      glow: "group-hover:shadow-[0_0_20px_-4px_rgba(0,212,168,0.3)]",
      bump: false,
    },
    {
      label: "Haunting Phase",
      value: stats?.hauntingPhase ?? null,
      icon: Activity,
      href: "/dashboard/services",
      accent: "from-amber-500/20 to-amber-600/5 border-amber-500/20",
      iconClass: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      glow: "group-hover:shadow-[0_0_20px_-4px_rgba(245,158,11,0.3)]",
      bump: false,
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* ── Page header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-slate-300">
            Services under observation, ghost activity, and discovered contracts.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span
            title={`Stream ${sseState}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              sseState === "open"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : sseState === "connecting"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
            )}
          >
            <Radio className="h-3 w-3" />
            {sseState === "open" ? "Live" : sseState === "connecting" ? "Connecting…" : "Offline"}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 shrink-0"
            onClick={() => setShowDemoPanel((v) => !v)}
            title="Run the full demo scenario"
          >
            <FlaskConical className="h-3.5 w-3.5" />
            {showDemoPanel ? "Hide demo" : "Try demo"}
          </Button>
          <Link href="/dashboard/services">
            <Button size="sm" className="gap-2 shrink-0">
              <Plus className="h-3.5 w-3.5" />
              Register service
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Demo panel (collapsible) ── */}
      {showDemoPanel && (
        <DemoRunPanel redirectAfterRun={null} />
      )}

      {/* ── Stats grid ── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href as Route}
            className={cn(
              "group relative overflow-hidden rounded-xl border border-border bg-card p-5",
              "transition-all duration-250 hover:-translate-y-0.5 hover:border-border/70",
              "hover:shadow-card-hover",
              card.glow,
              card.bump && "animate-ghost-pulse"
            )}
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300", card.accent)} />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className={cn("rounded-lg p-2 border", card.iconClass)}>
                  <card.icon className="h-4 w-4" />
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground/70" />
              </div>
              <div>
                {stats === null ? (
                  <div className="h-8 w-12 rounded bg-muted animate-pulse mb-1" />
                ) : (
                  <p className="text-3xl font-bold tracking-tight tabular-nums">{card.value}</p>
                )}
                <p className="text-xs font-medium text-slate-300 mt-0.5">{card.label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Ask Karma console — NL → Davis CoPilot → DQL → live telemetry ── */}
      <AskKarmaConsole />

      {/* ── ROI rollup — headline avoided-cost stat ── */}
      {hasRoi && (
        <RoiRollup
          totalAvoidedUsd={totalAvoidedUsd}
          incidentsCaught={incidentsCaught}
          totalCostUsd={totalCostUsd}
          roiMultiple={roiMultiple}
        />
      )}

      {/* ── Your Impact card ── */}
      {platformStats && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Card header */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/60">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10">
              <BarChart3 className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Your Impact</h3>
              <p className="text-[11px] text-slate-400 leading-none mt-0.5">Detection metrics for your registered services</p>
            </div>
          </div>
          {/* Metric tiles — gap-px + bg-border/40 creates divider lines */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border/40">
            <div className="bg-card px-5 py-5 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-teal-500/25 bg-teal-500/10">
                  <FileCode2 className="h-3.5 w-3.5 text-teal-400" />
                </div>
                <span className="text-[11px] font-medium text-slate-300 uppercase tracking-wide">Contracts</span>
              </div>
              <p className="text-3xl font-bold tabular-nums text-foreground">{platformStats.total_contracts}</p>
              <p className="text-xs text-slate-400 mt-1">discovered</p>
            </div>

            <div className="bg-card px-5 py-5 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-red-500/25 bg-red-500/10">
                  <Ghost className="h-3.5 w-3.5 text-red-400" />
                </div>
                <span className="text-[11px] font-medium text-slate-300 uppercase tracking-wide">Ghost Reports</span>
              </div>
              <p className="text-3xl font-bold tabular-nums text-foreground">{platformStats.total_ghost_reports}</p>
              <p className="text-xs text-slate-400 mt-1">generated</p>
            </div>

            <div className="bg-card px-5 py-5 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-500/25 bg-amber-500/10">
                  <Timer className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <span className="text-[11px] font-medium text-slate-300 uppercase tracking-wide">Avg Alert</span>
              </div>
              <p className="text-3xl font-bold tabular-nums text-foreground">
                {platformStats.avg_minutes_to_first_alert != null
                  ? platformStats.avg_minutes_to_first_alert.toFixed(1)
                  : "—"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {platformStats.avg_minutes_to_first_alert != null ? "min to first alert" : "no data yet"}
              </p>
            </div>

            <div className="bg-card px-5 py-5 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-orange-500/25 bg-orange-500/10">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                </div>
                <span className="text-[11px] font-medium text-slate-300 uppercase tracking-wide">Violations</span>
              </div>
              <p className="text-3xl font-bold tabular-nums text-foreground">
                {platformStats.pct_services_with_violations != null
                  ? `${platformStats.pct_services_with_violations}%`
                  : "—"}
              </p>
              <p className="text-xs text-slate-400 mt-1">services with violations caught</p>
            </div>
          </div>
        </div>
      )}

      {/* ── AI investigation engine panel ── */}
      {hasCostData && (
        <AIInvestigationsPanel
          totalCostUsd={totalCostUsd}
          totalTokens={totalTokens}
          davisEnriched={davisEnriched}
          investigationCount={ghosts.length}
          flashActive={aiCostFlash}
          lastUpdate={lastCostUpdate}
        />
      )}

      {/* ── Platform overview ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Ghost activity feed */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden min-h-[260px]">
          {ghosts.length === 0 ? (
            <div className="p-6 space-y-5 min-h-[260px]">
              <div className="flex flex-col items-center text-center pt-4">
                <div className="relative mb-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-card">
                    <Ghost className="h-6 w-6 text-slate-400" />
                  </div>
                  <div className="absolute -inset-1.5 rounded-2xl border border-primary/10 animate-pulse" />
                </div>
                <h3 className="text-base font-semibold text-foreground">No ghosts yet</h3>
                <p className="mt-1 text-sm text-slate-300 max-w-xs leading-relaxed">
                  Run the demo below to see the full violation-detection flow in under 90 seconds.
                </p>
              </div>
              <DemoRunPanel redirectAfterRun={null} />
              <div className="flex items-center justify-center gap-4 pt-1">
                <Link href="/dashboard/services">
                  <Button size="sm" variant="outline" className="gap-2">
                    <Zap className="h-3.5 w-3.5" />
                    Register a service
                  </Button>
                </Link>
                <Link href="/dashboard/timeline">
                  <Button size="sm" variant="outline" className="gap-2">
                    <TrendingUp className="h-3.5 w-3.5" />
                    View contracts
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Ghost className="h-4 w-4 text-red-400" />
                  <h3 className="text-sm font-semibold text-foreground">Recent Ghost Activity</h3>
                </div>
                <Link
                  href="/dashboard/ghosts"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="divide-y divide-border/50">
                {ghosts.slice(0, 6).map((g) => (
                  <GhostRow key={g.report_id} ghost={g} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Phase legend */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Service Phases</h3>
          <div className="space-y-3">
            {PHASES.map((p) => (
              <div key={p.label} className="flex items-start gap-3">
                <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", p.icon)} />
                <div>
                  <p className="text-[13px] font-medium text-foreground leading-none">{p.label}</p>
                  <p className="text-xs text-slate-300 mt-0.5 leading-snug">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contract intelligence ── */}
      <ContractCategoryWidget contracts={Object.values(contracts).flat()} loading={loading} />

      {/* ── Watcher run history ── */}
      {watcherRuns.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-foreground">Recent Watcher Runs</h3>
              <span className="text-xs text-slate-300">— live contract monitoring</span>
            </div>
          </div>
          <div className="divide-y divide-border/50">
            {watcherRuns.map((run) => (
              <WatcherRunRow key={run.run_id} run={run} />
            ))}
          </div>
        </div>
      )}

      {/* ── Watcher live log (terminal-style streaming output) ── */}
      <WatcherLiveLog />
    </div>
  );
}

// ── Ghost row ─────────────────────────────────────────────────────────────────

const SEVERITY_CFG: Record<ViolationSeverity, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-red-500/20 text-red-400 border-red-500/40" },
  high:     { label: "High",     cls: "bg-orange-500/20 text-orange-400 border-orange-500/40" },
  medium:   { label: "Medium",   cls: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
  low:      { label: "Low",      cls: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
};

function GhostRow({ ghost }: { ghost: GhostReport }) {
  const sev = SEVERITY_CFG[ghost.severity] ?? SEVERITY_CFG.medium;
  return (
    <div className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors">
      <span className={cn(
        "mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        sev.cls
      )}>
        {sev.label}
      </span>
      <p className="flex-1 text-xs text-slate-300 leading-snug line-clamp-2 min-w-0">
        {ghost.summary}
      </p>
      <div className="flex items-center gap-1 shrink-0 text-[10px] text-slate-400">
        <Clock className="h-3 w-3" />
        {formatDistanceToNow(new Date(ghost.created_at), { addSuffix: true })}
      </div>
    </div>
  );
}

// ── Watcher run row ────────────────────────────────────────────────────────────

function WatcherRunRow({ run }: { run: WatcherRun }) {
  const hasViolations = run.violations_found > 0;
  const isSkipped = run.skipped;

  return (
    <div className="flex items-center gap-4 px-5 py-3 hover:bg-muted/20 transition-colors">
      {/* Status icon */}
      <div className="shrink-0">
        {isSkipped ? (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-500/10 border border-zinc-500/20">
            <Clock className="h-3 w-3 text-zinc-400" />
          </div>
        ) : hasViolations ? (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10 border border-red-500/25">
            <XCircle className="h-3.5 w-3.5 text-red-400" />
          </div>
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/25">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          </div>
        )}
      </div>

      {/* Service name */}
      <p className="text-xs font-medium text-foreground min-w-0 truncate w-36">
        {run.service_name ?? run.service_id.slice(0, 12) + "…"}
      </p>

      {/* Contracts checked */}
      <div className="flex items-center gap-1 text-xs text-slate-300">
        <ShieldCheck className="h-3 w-3 shrink-0" />
        <span className="tabular-nums">{run.contracts_checked}</span>
        <span className="text-slate-400">checked</span>
      </div>

      {/* Violations */}
      <div className={cn(
        "flex items-center gap-1 text-xs",
        hasViolations ? "text-red-400" : "text-emerald-400/70"
      )}>
        <Ghost className="h-3 w-3 shrink-0" />
        <span className="tabular-nums font-medium">{run.violations_found}</span>
        <span className="opacity-70">violation{run.violations_found !== 1 ? "s" : ""}</span>
      </div>

      {/* Duration */}
      {run.duration_seconds != null && (
        <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400">
          <Timer className="h-3 w-3" />
          <span className="tabular-nums">{run.duration_seconds.toFixed(1)}s</span>
        </div>
      )}

      {/* Timestamp */}
      <div className="ml-auto flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
        <Clock className="h-3 w-3" />
        {formatDistanceToNow(new Date(run.run_at), { addSuffix: true })}
      </div>
    </div>
  );
}

// ── ROI rollup — avoided incident cost vs. AI spend ──────────────────────────

function formatMoney(n: number): string {
  if (n >= 1000) return `$${Math.round(n).toLocaleString()}`;
  return `$${n.toFixed(2)}`;
}

function RoiRollup({
  totalAvoidedUsd,
  incidentsCaught,
  totalCostUsd,
  roiMultiple,
}: {
  totalAvoidedUsd: number;
  incidentsCaught: number;
  totalCostUsd: number;
  roiMultiple: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] via-card to-card">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/[0.10] blur-3xl" />
      <div className="relative flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Headline number */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-400/80">
              Incident cost avoided
            </p>
            <p className="text-[2.5rem] sm:text-[3rem] font-bold tracking-tight font-mono text-foreground leading-none tabular-nums">
              {formatMoney(totalAvoidedUsd)}
            </p>
            <p className="mt-1.5 text-xs text-slate-300">
              across <span className="font-semibold text-foreground">{incidentsCaught}</span> silent
              regression{incidentsCaught !== 1 ? "s" : ""} caught before users felt them
            </p>
          </div>
        </div>

        {/* Supporting metrics */}
        <div className="flex shrink-0 items-stretch gap-px overflow-hidden rounded-xl border border-border/60 bg-border/40">
          <div className="bg-card px-5 py-3 text-center">
            <p className="text-lg font-bold font-mono tabular-nums text-foreground">
              ${totalCostUsd < 1 ? totalCostUsd.toFixed(2) : totalCostUsd.toFixed(0)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">AI spend</p>
          </div>
          <div className="bg-card px-5 py-3 text-center">
            <p className="text-lg font-bold font-mono tabular-nums text-emerald-400">
              {roiMultiple >= 1000
                ? `${Math.round(roiMultiple / 1000)}k×`
                : `${Math.round(roiMultiple).toLocaleString()}×`}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">return on spend</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AI Investigation Engine panel ────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function AIInvestigationsPanel({
  totalCostUsd,
  totalTokens,
  davisEnriched,
  investigationCount,
  flashActive = false,
  lastUpdate = null,
}: {
  totalCostUsd: number;
  totalTokens: number;
  davisEnriched: number;
  investigationCount: number;
  flashActive?: boolean;
  lastUpdate?: AiCostUpdateEvent | null;
}) {
  const avgCost = investigationCount > 0 ? totalCostUsd / investigationCount : 0;
  const avgTokens = investigationCount > 0 ? Math.round(totalTokens / investigationCount) : 0;
  const enrichPct = investigationCount > 0 ? Math.round((davisEnriched / investigationCount) * 100) : 0;
  const costPerKToken = totalTokens > 0 ? (totalCostUsd / (totalTokens / 1000)) : 0;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border bg-card transition-all duration-500",
      flashActive
        ? "border-violet-400/50 shadow-[0_0_28px_-6px_rgba(167,139,250,0.4)]"
        : "border-violet-500/20"
    )}>
      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-violet-500/[0.07] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-indigo-500/[0.06] blur-3xl" />
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

      {/* ── Header ── */}
      <div className="relative flex flex-col gap-3 px-5 py-4 border-b border-violet-500/10 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          {/* Icon with animated ring */}
          <div className="relative shrink-0 flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10">
            <Brain className="h-5 w-5 text-violet-400" />
            <span className="absolute inset-0 rounded-xl border border-violet-500/25 animate-ping opacity-20" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground tracking-tight truncate">AI Investigation Engine</p>
            <p className="text-[11px] text-slate-400 mt-px truncate">Autonomous forensic analysis across every ghost report</p>
          </div>
        </div>
        {/* Pills row */}
        <div className="self-start sm:self-auto shrink-0 flex items-center gap-2 flex-wrap">
          {/* "Just updated" flash badge */}
          {flashActive && lastUpdate && (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 animate-fade-in-up">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-semibold text-emerald-300 whitespace-nowrap">
                +${lastUpdate.cost_estimate_usd?.toFixed(4) ?? "—"}
              </span>
            </div>
          )}
          {/* Vertex AI pill */}
          <div className="flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/[0.08] px-3 py-1.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-violet-400 animate-ping opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400" />
            </span>
            <span className="text-[11px] font-semibold text-violet-300 tracking-wide whitespace-nowrap">Vertex AI · Gemini 2.5 Pro</span>
          </div>
        </div>
      </div>

      {/* ── Three metric columns ── */}
      <div className="relative grid grid-cols-1 sm:grid-cols-3 divide-y divide-violet-500/10 sm:divide-y-0 sm:divide-x">

        {/* ── 1. Total Spend ── */}
        <div className="group relative px-5 py-5 sm:px-6 sm:py-6 hover:bg-violet-500/[0.03] transition-colors duration-200">
          <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/8 shrink-0">
              <Coins className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">Total Spend</span>
          </div>
          <p className="text-[2rem] sm:text-[2.25rem] font-bold tracking-tight font-mono text-foreground leading-none tabular-nums">
            ${totalCostUsd < 1 ? totalCostUsd.toFixed(4) : totalCostUsd.toFixed(2)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400 whitespace-nowrap">
              ${avgCost.toFixed(4)} / case
            </span>
            <span className="text-[10px] text-slate-400 whitespace-nowrap">${costPerKToken.toFixed(4)} / 1K tok</span>
          </div>
        </div>

        {/* ── 2. Tokens Consumed ── */}
        <div className="group relative px-5 py-5 sm:px-6 sm:py-6 hover:bg-blue-500/[0.02] transition-colors duration-200">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/8 shrink-0">
              <Cpu className="h-3.5 w-3.5 text-blue-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">Tokens Consumed</span>
          </div>
          <div className="flex flex-wrap items-end gap-2 leading-none">
            <p className="text-[2rem] sm:text-[2.25rem] font-bold tracking-tight font-mono text-foreground tabular-nums">
              {formatTokens(totalTokens)}
            </p>
            {totalTokens >= 1_000 && (
              <p className="text-sm text-slate-500 font-mono mb-1 tabular-nums">
                ({totalTokens.toLocaleString()})
              </p>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-400 whitespace-nowrap">
              {formatTokens(avgTokens)} avg / case
            </span>
          </div>
        </div>

        {/* ── 3. Davis AI Enrichment ── */}
        <div className="group relative px-5 py-5 sm:px-6 sm:py-6 hover:bg-emerald-500/[0.02] transition-colors duration-200">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/8 shrink-0">
              <Brain className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">Davis AI Enriched</span>
          </div>
          <div className="flex items-end gap-2 leading-none">
            <p className="text-[2rem] sm:text-[2.25rem] font-bold tracking-tight font-mono text-foreground tabular-nums">{davisEnriched}</p>
            <p className="text-lg text-slate-500 font-mono mb-1">/ {investigationCount}</p>
          </div>
          {/* Enrichment progress bar */}
          <div className="mt-3 space-y-2">
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000",
                  enrichPct >= 80 ? "bg-emerald-400" : enrichPct >= 50 ? "bg-amber-400" : "bg-red-400"
                )}
                style={{ width: `${enrichPct}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border whitespace-nowrap",
                enrichPct >= 80
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : enrichPct >= 50
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              )}>
                {enrichPct}% enrichment rate
              </span>
              <span className="text-[10px] text-slate-500 whitespace-nowrap">Davis AI · MCP</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="relative flex flex-col gap-1.5 border-t border-violet-500/10 bg-violet-500/[0.02] px-5 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-6">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/50 shrink-0" />
          <p className="text-[10px] text-slate-500 truncate">
            Cost estimates from Vertex AI pricing — actual billing may differ
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 sm:ml-auto">
          <span className="whitespace-nowrap">Gemini 2.5 Pro · Flash</span>
          <span aria-hidden>·</span>
          <span className="whitespace-nowrap">Root Cause Analysis</span>
          <span aria-hidden>·</span>
          <span className="whitespace-nowrap">Changepoint Detection</span>
        </div>
      </div>
    </div>
  );
}

// ── Contract category breakdown widget ───────────────────────────────────────

const CATEGORY_META: Record<ContractCategory, { label: string; color: string; bar: string; killer?: boolean }> = {
  side_effect:     { label: "Side Effects",     color: "text-red-400",    bar: "bg-red-400",    killer: true },
  latency:         { label: "Latency",           color: "text-blue-400",   bar: "bg-blue-400" },
  error_semantics: { label: "Error Semantics",   color: "text-orange-400", bar: "bg-orange-400" },
  throughput:      { label: "Throughput",         color: "text-teal-400",   bar: "bg-teal-400" },
  dependency:      { label: "Dependency",         color: "text-violet-400", bar: "bg-violet-400" },
  timing:          { label: "Timing",             color: "text-amber-400",  bar: "bg-amber-400" },
  sequencing:      { label: "Sequencing",         color: "text-cyan-400",   bar: "bg-cyan-400" },
  resource:        { label: "Resource",           color: "text-pink-400",   bar: "bg-pink-400" },
};

const ALL_CATEGORIES: ContractCategory[] = [
  "side_effect", "latency", "error_semantics", "throughput",
  "dependency", "timing", "sequencing", "resource",
];

interface CategoryStat {
  category: ContractCategory;
  count: number;
  avgConfidence: number;
}

function ContractCategoryWidget({ contracts, loading }: { contracts: ContractResponse[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 h-32 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (contracts.length === 0) return null;

  const statsMap = contracts.reduce<Record<string, { count: number; totalConf: number }>>((acc, c) => {
    if (!acc[c.category]) acc[c.category] = { count: 0, totalConf: 0 };
    acc[c.category].count++;
    acc[c.category].totalConf += c.confidence;
    return acc;
  }, {});

  const stats: CategoryStat[] = ALL_CATEGORIES
    .filter((cat) => statsMap[cat])
    .map((cat) => ({
      category: cat,
      count: statsMap[cat].count,
      avgConfidence: statsMap[cat].totalConf / statsMap[cat].count,
    }))
    .sort((a, b) => b.count - a.count);

  if (stats.length === 0) return null;

  const maxCount = Math.max(...stats.map((s) => s.count));

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-teal-500/25 bg-teal-500/10">
          <Layers className="h-3.5 w-3.5 text-teal-400" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Contract Intelligence</h3>
        <span className="text-xs text-slate-300">— coverage across all 8 implicit contract categories</span>
        <span className="ml-auto rounded-full border border-teal-500/25 bg-teal-500/10 px-2 py-0.5 text-[11px] font-semibold text-teal-400 tabular-nums">
          {contracts.length} total
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border/40 p-0">
        <div className="p-5 space-y-3">
          {stats.map((s) => {
            const meta = CATEGORY_META[s.category];
            const pct = Math.round((s.count / maxCount) * 100);
            return (
              <div key={s.category} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-[11px] font-semibold", meta.color)}>{meta.label}</span>
                    {meta.killer && (
                      <span className="rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-red-400">
                        killer
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-mono font-semibold text-foreground tabular-nums">{s.count}</span>
                    <span className="text-slate-400">·</span>
                    <span className={cn("font-mono tabular-nums", s.avgConfidence >= 0.9 ? "text-emerald-400" : s.avgConfidence >= 0.8 ? "text-amber-400" : "text-muted-foreground")}>
                      {(s.avgConfidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", meta.bar)}
                    style={{ width: `${pct}%`, opacity: 0.75 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-5 flex flex-col justify-center gap-3">
          <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide">Coverage Summary</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">Categories discovered</span>
              <span className="font-mono font-semibold text-foreground">{stats.length} / 8</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">Avg confidence</span>
              <span className={cn("font-mono font-semibold tabular-nums",
                contracts.length > 0 && contracts.reduce((s, c) => s + c.confidence, 0) / contracts.length >= 0.85
                  ? "text-emerald-400" : "text-amber-400"
              )}>
                {contracts.length > 0
                  ? `${(contracts.reduce((s, c) => s + c.confidence, 0) / contracts.length * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">Validated</span>
              <span className="font-mono font-semibold text-foreground">
                {contracts.filter((c) => c.validated).length} / {contracts.length}
              </span>
            </div>
          </div>
          <div className="mt-1 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
            <p className="text-[10px] text-red-400/80 font-medium leading-snug">
              Side effects are the <span className="text-red-400 font-bold">killer category</span> — cache warming, async writes, and pre-warmed connections that no test checks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Phase legend data ──────────────────────────────────────────────────────────

const PHASES = [
  {
    label: "Registered",
    desc: "Service is queued for deprecation tracking.",
    icon: "bg-zinc-500/15 border-zinc-500/40 text-zinc-400",
  },
  {
    label: "Learning",
    desc: "Agent is observing traffic and extracting implicit contracts.",
    icon: "bg-amber-500/15 border-amber-500/40 text-amber-400",
  },
  {
    label: "Haunting",
    desc: "Replacement service is live; agent is comparing behaviour.",
    icon: "bg-red-500/15 border-red-500/40 text-red-400",
  },
  {
    label: "Completed",
    desc: "Migration validated. No further action required.",
    icon: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400",
  },
];
