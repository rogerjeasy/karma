"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Bot,
  Brain,
  Copy,
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
import type {
  AgentObservabilityData,
  KarmaAgentsStats,
  PerAgentStats,
  RecentInvocation,
} from "@/lib/types";

// ── Formatters ────────────────────────────────────────────────────────────────

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

// ── Agent label / color maps ─────────────────────────────────────────────────

const AGENT_LABEL: Record<string, string> = {
  karma_learner:     "Learner",
  karma_forensic:    "Forensic",
  karma_watcher:     "Watcher",
  karma_coordinator: "Coordinator",
};

const AGENT_BAR_COLOR: Record<string, string> = {
  karma_learner:     "bg-cyan-500/70",
  karma_forensic:    "bg-rose-500/70",
  karma_watcher:     "bg-violet-500/70",
  karma_coordinator: "bg-amber-500/70",
};

const AGENT_TEXT_COLOR: Record<string, string> = {
  karma_learner:     "text-cyan-400",
  karma_forensic:    "text-rose-400",
  karma_watcher:     "text-violet-400",
  karma_coordinator: "text-amber-400",
};

const AGENT_BORDER_COLOR: Record<string, string> = {
  karma_learner:     "border-cyan-500/40",
  karma_forensic:    "border-rose-500/40",
  karma_watcher:     "border-violet-500/40",
  karma_coordinator: "border-amber-500/40",
};

const AGENT_BG_COLOR: Record<string, string> = {
  karma_learner:     "bg-cyan-500/10",
  karma_forensic:    "bg-rose-500/10",
  karma_watcher:     "bg-violet-500/10",
  karma_coordinator: "bg-amber-500/10",
};

// ── Karma ADK — per-agent breakdown ──────────────────────────────────────────

function PerAgentBar({ row, maxTokens }: { row: PerAgentStats; maxTokens: number }) {
  const label = AGENT_LABEL[row.agent] ?? row.agent;
  const pct   = maxTokens > 0 ? (row.total_tokens / maxTokens) * 100 : 0;
  const bar   = AGENT_BAR_COLOR[row.agent]   ?? "bg-muted/60";
  const text  = AGENT_TEXT_COLOR[row.agent]  ?? "text-muted-foreground";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className={cn("font-semibold w-24 shrink-0", text)}>{label}</span>
        <div className="flex-1 mx-3 h-1.5 rounded-full bg-muted/20 overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-muted-foreground tabular-nums w-16 text-right">{formatTokens(row.total_tokens)}</span>
        <span className="text-muted-foreground/60 tabular-nums w-14 text-right">{formatCost(row.cost_usd)}</span>
      </div>
    </div>
  );
}

// ── Karma ADK — recent invocations ───────────────────────────────────────────

function InvocationRow({ inv }: { inv: RecentInvocation }) {
  const label  = AGENT_LABEL[inv.agent] ?? inv.agent;
  const text   = AGENT_TEXT_COLOR[inv.agent]   ?? "text-muted-foreground";
  const border = AGENT_BORDER_COLOR[inv.agent] ?? "border-border";
  const bg     = AGENT_BG_COLOR[inv.agent]     ?? "bg-muted/10";
  const traceHandle = inv.trace_id ? inv.trace_id.slice(0, 8) : "--------";

  return (
    <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/10 transition-colors group">
      <div className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0", text, border, bg)}>
        {label[0]}
      </div>
      <span className={cn("text-[11px] font-semibold w-20 shrink-0", text)}>{label}</span>
      <span className="text-[11px] text-muted-foreground flex-1 truncate font-mono">{traceHandle}</span>
      {inv.model_turns > 0 && (
        <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">
          {inv.model_turns} turn{inv.model_turns !== 1 ? "s" : ""}
        </span>
      )}
      {inv.dt_trace_url ? (
        <a
          href={inv.dt_trace_url}
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          title="Open trace in Dynatrace"
        >
          <ExternalLink className="h-3 w-3 text-cyan-400 hover:text-cyan-300" />
        </a>
      ) : (
        <div className="w-3 shrink-0" />
      )}
    </div>
  );
}

// ── Karma ADK panel ───────────────────────────────────────────────────────────

function KarmaAgentPlatformPanel({ stats }: { stats: KarmaAgentsStats }) {
  const hasPerAgent = stats.per_agent && stats.per_agent.length > 0;
  const maxTokens   = hasPerAgent ? Math.max(...stats.per_agent.map((r) => r.total_tokens)) : 0;
  const hasRecent   = stats.recent_invocations && stats.recent_invocations.length > 0;

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-cyan-500/15 bg-cyan-950/20">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 border border-cyan-500/25">
          <Bot className="h-3.5 w-3.5 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground leading-tight">Karma Agents <span className="text-cyan-400/80 font-medium">· product runtime</span></p>
          <p className="text-[10px] text-muted-foreground">Vertex AI Agent Builder · Agent Engine · Gemini 2.5</p>
        </div>
        {stats.from_grail && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Grail live
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Totals row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-background/30 border border-cyan-500/15 px-3 py-2 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-1">
              <Zap className="h-2.5 w-2.5" /> Tokens
            </p>
            <p className="text-sm font-bold text-cyan-300 tabular-nums">{formatTokens(stats.total_tokens)}</p>
          </div>
          <div className="rounded-lg bg-background/30 border border-cyan-500/15 px-3 py-2 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-1">
              <DollarSign className="h-2.5 w-2.5" /> Cost
            </p>
            <p className="text-sm font-bold text-cyan-300 tabular-nums">{formatCost(stats.cost_usd)}</p>
          </div>
          <div className="rounded-lg bg-background/30 border border-cyan-500/15 px-3 py-2 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-1">
              <Activity className="h-2.5 w-2.5" /> Spans
            </p>
            <p className="text-sm font-bold text-cyan-300 tabular-nums">{stats.span_count.toLocaleString()}</p>
          </div>
        </div>

        {/* Per-agent token breakdown */}
        {hasPerAgent ? (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Token split by agent
            </p>
            <div className="space-y-2.5">
              {stats.per_agent.map((row) => (
                <PerAgentBar key={row.agent} row={row} maxTokens={maxTokens} />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-muted/10 border border-border/30 px-3 py-2.5 text-center">
            <p className="text-[11px] text-muted-foreground/60">
              Per-agent breakdown available once agent_run spans appear in Grail.
            </p>
          </div>
        )}

        {/* Recent invocations */}
        {hasRecent && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1.5">
              <Activity className="h-3 w-3" /> Recent invocations
            </p>
            <div className="rounded-lg border border-border/30 overflow-hidden">
              <div className="max-h-[220px] overflow-y-auto divide-y divide-border/20 [scrollbar-width:thin] [scrollbar-color:hsl(var(--border)/0.4)_transparent]">
                {stats.recent_invocations.map((inv, i) => (
                  <InvocationRow key={inv.trace_id || i} inv={inv} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DQL copy button ───────────────────────────────────────────────────────────

function DqlCopyButton({ label, dql }: { label: string; dql: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(dql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors">
      {copied ? "Copied!" : label}
      <Copy className="h-2.5 w-2.5" />
    </button>
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

  const { karma_agents: ka } = data;

  return (
    <div className="space-y-5">

      {/* ── Header card ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 via-card to-cyan-950/10 p-5">
        <div className="pointer-events-none absolute -top-8 -right-8 h-36 w-36 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-36 w-36 rounded-full bg-cyan-500/5 blur-3xl" />

        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/25">
              <Sparkles className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">AI Agent Observability</h2>
              <p className="text-xs text-muted-foreground">
                Karma&#39;s product runtime is <span className="text-cyan-400 font-medium">100% Gemini on Vertex AI Agent Builder</span>. Every agent invocation emits <span className="font-mono text-cyan-400">gen_ai.*</span> OTel spans to Dynatrace, queried live from Grail.
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

        {ka.total_tokens > 0 && (
          <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-background/40 backdrop-blur-sm px-4 py-3">
              <p className="text-[11px] text-muted-foreground mb-1">Agent spend (30d)</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{formatCost(ka.cost_usd)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 backdrop-blur-sm px-4 py-3">
              <p className="text-[11px] text-muted-foreground mb-1">Total tokens</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{formatTokens(ka.total_tokens)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 backdrop-blur-sm px-4 py-3">
              <p className="text-[11px] text-muted-foreground mb-1">Spans</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{ka.span_count.toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Karma agent panel ──────────────────────────────────────────── */}
      <KarmaAgentPlatformPanel stats={ka} />

      {/* ── Narrative callout ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.04] p-4">
        <div className="flex items-start gap-3">
          <Brain className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Karma watches itself</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every Karma agent invocation emits its own{" "}
              <span className="font-mono text-cyan-400">gen_ai.chat</span> spans with per-agent
              token attribution, flowing to the same Dynatrace tenant where Karma writes its
              contracts, SLOs, and ghost reports. This panel queries that telemetry live from Grail —
              the system&#39;s production runtime is 100% Gemini 2.5 on Vertex AI Agent Builder, with no
              non-Google model in any agent reasoning.
            </p>
            {data.grail_configured && (
              <div className="flex flex-wrap gap-3 pt-1">
                <DqlCopyButton
                  label="Copy Karma ADK DQL"
                  dql={
                    'fetch spans, from:now()-30d\n' +
                    '| filter service.name == "karma-agent-system"\n' +
                    '| filter span.name == "gen_ai.chat"\n' +
                    '| filter isNotNull(karma.agent)\n' +
                    '| summarize input_tokens = sum(toLong(gen_ai.usage.input_tokens)), output_tokens = sum(toLong(gen_ai.usage.output_tokens)), span_count = count(), by: {agent = karma.agent}'
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
