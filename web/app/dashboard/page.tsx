"use client";

import { useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Server, Ghost, FileCode2, Activity,
  ArrowRight, Plus, Zap, TrendingUp, Radio, Clock,
  Coins, Cpu, Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSSEContext, useSSEEvent } from "@/lib/sse-context";
import { useDashboardData } from "@/lib/dashboard-context";
import type { GhostReport, ViolationSeverity } from "@/lib/types";

interface Stats {
  totalServices: number;
  activeGhosts: number;
  contractsLearned: number;
  hauntingPhase: number;
}

export default function DashboardPage() {
  const { services, ghosts, contracts, loading } = useDashboardData();
  const [liveGhostBump, setLiveGhostBump] = useState(false);

  // ── Derive stats from shared context data ─────────────────────────────────
  const contractsLearned = Object.values(contracts).reduce((sum, c) => sum + c.length, 0);
  const stats: Stats | null = loading ? null : {
    totalServices:    services.length,
    activeGhosts:     ghosts.length,
    contractsLearned,
    hauntingPhase:    services.filter((s) => s.phase === "haunting").length,
  };

  // ── AI cost totals derived from ghost reports ─────────────────────────────
  const totalCostUsd   = ghosts.reduce((sum, g) => sum + (g.cost_estimate_usd ?? 0), 0);
  const totalTokens    = ghosts.reduce((sum, g) => sum + (g.investigation_input_tokens ?? 0) + (g.investigation_output_tokens ?? 0), 0);
  const davisEnriched  = ghosts.filter((g) => g.davis_ai_insights && g.davis_ai_insights !== "not available").length;
  const hasCostData    = !loading && ghosts.some((g) => g.cost_estimate_usd != null);

  // ── Bump animation only — data already handled by context ─────────────────
  const { connectionState: sseState } = useSSEContext();
  useSSEEvent("ghost_report", () => {
    setLiveGhostBump(true);
    setTimeout(() => setLiveGhostBump(false), 1200);
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
          <p className="mt-1 text-sm text-muted-foreground">
            Services under observation, ghost activity, and discovered contracts.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* SSE connection indicator */}
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

          <Link href="/dashboard/services">
            <Button size="sm" className="gap-2 shrink-0">
              <Plus className="h-3.5 w-3.5" />
              Register service
            </Button>
          </Link>
        </div>
      </div>

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
            {/* Background gradient */}
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                card.accent
              )}
            />

            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className={cn("rounded-lg p-2 border", card.iconClass)}>
                  <card.icon className="h-4 w-4" />
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground/70" />
              </div>
              <div>
                {stats === null ? (
                  <div className="h-8 w-12 rounded bg-muted animate-pulse mb-1" />
                ) : (
                  <p className="text-3xl font-bold tracking-tight tabular-nums">{card.value}</p>
                )}
                <p className="text-xs font-medium text-muted-foreground mt-0.5">{card.label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── AI investigation cost strip ── */}
      {hasCostData && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-card px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-500/25 bg-violet-500/10">
              <Brain className="h-3.5 w-3.5 text-violet-400" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground">AI Investigations</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Coins className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="font-mono font-semibold text-foreground">${totalCostUsd.toFixed(4)}</span>
            <span className="text-muted-foreground/60">total spend</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Cpu className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span className="font-mono font-semibold text-foreground">{totalTokens.toLocaleString()}</span>
            <span className="text-muted-foreground/60">tokens</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Brain className="h-3.5 w-3.5 text-violet-400 shrink-0" />
            <span className="font-mono font-semibold text-foreground">{davisEnriched}</span>
            <span className="text-muted-foreground/60">Davis AI enriched</span>
          </div>
          <span className="ml-auto text-[10px] text-muted-foreground/35 hidden sm:block">
            Vertex AI · Gemini 2.5 Pro
          </span>
        </div>
      )}

      {/* ── Platform overview ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Ghost activity feed / empty state */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden min-h-[260px]">
          {ghosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-10 text-center min-h-[260px]">
              <div className="relative mb-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-card">
                  <Ghost className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <div className="absolute -inset-1.5 rounded-2xl border border-primary/10 animate-pulse" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No ghosts yet</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-xs leading-relaxed">
                Register a deprecated service to start the learning phase and automatically discover implicit contracts.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
                <Link href="/dashboard/services">
                  <Button className="gap-2">
                    <Zap className="h-4 w-4" />
                    Register a service
                  </Button>
                </Link>
                <Link href="/dashboard/timeline">
                  <Button variant="outline" className="gap-2">
                    <TrendingUp className="h-4 w-4" />
                    View contracts
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
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
              {/* List */}
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
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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
      <p className="flex-1 text-xs text-muted-foreground leading-snug line-clamp-2 min-w-0">
        {ghost.summary}
      </p>
      <div className="flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground/40">
        <Clock className="h-3 w-3" />
        {formatDistanceToNow(new Date(ghost.created_at), { addSuffix: true })}
      </div>
    </div>
  );
}

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
