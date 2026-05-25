"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Brain,
  Code2,
  Cpu,
  DollarSign,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AgentObservabilityData, AgentSystemStats } from "@/lib/types";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(5)}`;
  return `$${n.toFixed(4)}`;
}

// ── Token comparison bar ─────────────────────────────────────────────────────

function TokenBar({
  labelA, tokensA, colorA,
  labelB, tokensB, colorB,
}: {
  labelA: string; tokensA: number; colorA: string;
  labelB: string; tokensB: number; colorB: string;
}) {
  const total = tokensA + tokensB;
  const pctA = total > 0 ? (tokensA / total) * 100 : 50;
  const pctB = 100 - pctA;
  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full gap-0.5">
        <div
          className={cn("transition-all rounded-l-full", colorA)}
          style={{ width: `${pctA}%` }}
          title={`${labelA}: ${formatTokens(tokensA)} tokens (${pctA.toFixed(1)}%)`}
        />
        <div
          className={cn("transition-all rounded-r-full", colorB)}
          style={{ width: `${pctB}%` }}
          title={`${labelB}: ${formatTokens(tokensB)} tokens (${pctB.toFixed(1)}%)`}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>
          <span className={cn("font-semibold", colorA.replace("bg-", "text-"))}>{pctA.toFixed(0)}%</span>
          {" "}{labelA}
        </span>
        <span>
          {labelB}{" "}
          <span className={cn("font-semibold", colorB.replace("bg-", "text-"))}>{pctB.toFixed(0)}%</span>
        </span>
      </div>
    </div>
  );
}

// ── Single agent card ─────────────────────────────────────────────────────────

function AgentCard({
  stats,
  color,
  icon: Icon,
}: {
  stats: AgentSystemStats;
  color: "cyan" | "violet";
  icon: React.ElementType;
}) {
  const border  = color === "cyan"   ? "border-cyan-500/25"   : "border-violet-500/25";
  const bg      = color === "cyan"   ? "bg-cyan-950/20"        : "bg-violet-950/20";
  const iconBg  = color === "cyan"   ? "bg-cyan-500/15 border-cyan-500/25"   : "bg-violet-500/15 border-violet-500/25";
  const iconClr = color === "cyan"   ? "text-cyan-400"          : "text-violet-400";
  const valClr  = color === "cyan"   ? "text-cyan-300"          : "text-violet-300";
  const barFill = color === "cyan"   ? "bg-cyan-500/70"         : "bg-violet-500/70";

  const pctOut = stats.total_tokens > 0
    ? (stats.output_tokens / stats.total_tokens) * 100
    : 0;

  return (
    <div className={cn("rounded-xl border p-4 space-y-4 backdrop-blur-sm", border, bg)}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", iconBg)}>
          <Icon className={cn("h-4.5 w-4.5", iconClr)} style={{ width: 18, height: 18 }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground leading-tight">{stats.service_name}</p>
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{stats.description}</p>
          <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">{stats.model}</p>
        </div>
        {stats.from_grail && (
          <div className="flex items-center gap-1 shrink-0 text-[10px] text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Grail
          </div>
        )}
      </div>

      {/* KPIs */}
      {stats.total_tokens > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-background/30 border border-border/40 px-3 py-2">
              <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                <Zap className="h-3 w-3" />
                <span className="text-[10px]">Total tokens</span>
              </div>
              <p className={cn("text-lg font-bold tabular-nums", valClr)}>
                {formatTokens(stats.total_tokens)}
              </p>
            </div>
            <div className="rounded-lg bg-background/30 border border-border/40 px-3 py-2">
              <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                <DollarSign className="h-3 w-3" />
                <span className="text-[10px]">Est. cost</span>
              </div>
              <p className={cn("text-lg font-bold tabular-nums", valClr)}>
                {formatCost(stats.cost_usd)}
              </p>
            </div>
          </div>

          {/* Input / output breakdown */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>↑ {formatTokens(stats.input_tokens)} in</span>
              <span>↓ {formatTokens(stats.output_tokens)} out</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden">
              <div className={cn("h-full rounded-full", barFill)} style={{ width: `${100 - pctOut}%` }} />
            </div>
          </div>

          {stats.span_count > 0 && (
            <p className="text-[10px] text-muted-foreground/60 text-right tabular-nums">
              {stats.span_count.toLocaleString()} span{stats.span_count !== 1 ? "s" : ""} observed
            </p>
          )}
        </>
      ) : (
        <div className="rounded-lg bg-muted/10 border border-border/30 px-3 py-3 text-center">
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
            {stats.note ?? "No gen_ai spans found in this DT environment."}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function AgentObservabilityPanel() {
  const [data, setData]       = useState<AgentObservabilityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<AgentObservabilityData>("/admin/agent-observability");
      setData(result);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Failed to load agent observability data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-card">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
            <Cpu className="absolute inset-0 m-auto h-3.5 w-3.5 text-cyan-300" />
          </div>
          <p className="text-sm text-muted-foreground">Querying Dynatrace Grail…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-red-500/20 bg-card">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { karma_agents: ka, claude_code: cc } = data;
  const totalTokens = ka.total_tokens + cc.total_tokens;
  const totalCost   = ka.cost_usd + cc.cost_usd;

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="relative overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 via-card to-violet-950/20 p-5">
        <div className="pointer-events-none absolute -top-8 -right-8 h-36 w-36 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-36 w-36 rounded-full bg-violet-500/5 blur-3xl" />

        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/25">
              <Sparkles className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Coding Agent Observability</h2>
              <p className="text-xs text-muted-foreground">
                Dynatrace monitors the agents that built this monitoring system
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data.grail_configured ? (
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-medium text-emerald-400">Grail live</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">
                <span className="text-[11px] font-medium text-amber-400">Firestore fallback</span>
              </div>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        {/* Grand totals */}
        {totalTokens > 0 && (
          <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-background/40 backdrop-blur-sm px-4 py-3">
              <p className="text-[11px] text-muted-foreground mb-1">Total AI spend (both systems)</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{formatCost(totalCost)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 backdrop-blur-sm px-4 py-3">
              <p className="text-[11px] text-muted-foreground mb-1">Combined token consumption</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{formatTokens(totalTokens)}</p>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-lg border border-border/60 bg-background/40 backdrop-blur-sm px-4 py-3">
              <p className="text-[11px] text-muted-foreground mb-2">Token split (Karma agents vs Claude Code)</p>
              <TokenBar
                labelA="Karma ADK" tokensA={ka.total_tokens} colorA="bg-cyan-500/70"
                labelB="Claude Code" tokensB={cc.total_tokens} colorB="bg-violet-500/70"
              />
            </div>
          </div>
        )}
      </div>

      {/* Side-by-side cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AgentCard stats={ka} color="cyan"   icon={Bot} />
        <AgentCard stats={cc} color="violet" icon={Code2} />
      </div>

      {/* Narrative callout */}
      <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.04] p-4">
        <div className="flex items-start gap-3">
          <Brain className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">The recursive loop</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The Karma multi-agent system was built with Claude Code and monitored end-to-end
              by Dynatrace. Every ADK agent invocation emits{" "}
              <span className="font-mono text-cyan-400">gen_ai.*</span> OTel spans that land in
              Grail — so judges can see exactly how much Gemini 2.5 Pro was consumed to analyse
              the hackathon services. This panel is itself powered by a live DQL query against
              those same spans.{" "}
              {data.grail_configured && (
                <a
                  href={`https://${process.env.NEXT_PUBLIC_DT_ENV}.apps.dynatrace.com/ui/apps/dynatrace.notebooks/?query=${encodeURIComponent(
                    'fetch spans, from:now()-30d\n| filter service.name == "karma-agent-system"\n| filter isNotNull(gen_ai.usage.input_tokens)\n| summarize input_tokens = sum(toLong(gen_ai.usage.input_tokens)), output_tokens = sum(toLong(gen_ai.usage.output_tokens)), span_count = count()'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300 transition-colors"
                >
                  Run the DQL yourself
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
