"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Bot,
  Brain,
  Code2,
  Copy,
  Cpu,
  DollarSign,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  AgentObservabilityData,
  ClaudeCodeStats,
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
  const userId = inv.user_id && inv.user_id !== "unknown" ? inv.user_id : "system";

  return (
    <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/10 transition-colors group">
      <div className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0", text, border, bg)}>
        {label[0]}
      </div>
      <span className={cn("text-[11px] font-semibold w-20 shrink-0", text)}>{label}</span>
      <span className="text-[11px] text-muted-foreground flex-1 truncate font-mono">{userId.slice(0, 8)}</span>
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
          <p className="text-xs font-bold text-foreground leading-tight">Karma ADK</p>
          <p className="text-[10px] text-muted-foreground">Agent Platform · Vertex AI · Gemini 2.5</p>
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

// ── Claude Code setup guide ───────────────────────────────────────────────────

function ClaudeCodeSetupGuide({ dtEnv }: { dtEnv: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const endpoint = dtEnv
    ? `https://${dtEnv}.live.dynatrace.com/api/v2/otlp`
    : "https://<env>.live.dynatrace.com/api/v2/otlp";
  const headers  = "Authorization=Api-Token <dt-otel-token>";

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2.5">
        <Info className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold text-amber-300">Telemetry not flowing</p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Set these environment variables before starting Claude Code to stream OTel
            spans to this Dynatrace tenant.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {[
          { key: "OTEL_EXPORTER_OTLP_ENDPOINT", value: endpoint },
          { key: "OTEL_EXPORTER_OTLP_HEADERS",  value: headers  },
        ].map(({ key, value }) => (
          <div key={key} className="rounded-lg border border-border/40 overflow-hidden">
            <div className="flex items-center justify-between px-2.5 py-1 bg-muted/20 border-b border-border/30">
              <span className="text-[10px] font-mono text-muted-foreground">{key}</span>
              <button
                onClick={() => copy(value, key)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Copy className="h-2.5 w-2.5" />
                {copied === key ? "copied" : "copy"}
              </button>
            </div>
            <div className="px-2.5 py-1.5 bg-background/30">
              <code className="text-[10px] font-mono text-violet-300 break-all">{value}</code>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
        Token: requires{" "}
        <span className="font-mono text-muted-foreground">openTelemetryTrace.ingest</span> scope.
        Once connected, this panel shows session activity, token spend, tool call events,
        and engineering metrics — queryable live via Grail DQL.
      </p>

      <a
        href="https://docs.dynatrace.com/docs/analyze-explore-automate/ai-observability/ai-coding-agent-monitoring"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
      >
        <Terminal className="h-3 w-3" />
        Dynatrace Coding Agent Monitoring docs
        <ExternalLink className="h-2.5 w-2.5" />
      </a>
    </div>
  );
}

// ── Claude Code panel ─────────────────────────────────────────────────────────

function ClaudeCodePanel({ stats, dtEnv }: { stats: ClaudeCodeStats; dtEnv: string }) {
  const hasData = stats.from_grail && stats.total_tokens > 0;
  const [dqlCopied, setDqlCopied] = useState(false);

  const dql30d =
    'fetch spans, from:now()-30d\n' +
    '| filter gen_ai.system == "anthropic"\n' +
    '| filter isNotNull(gen_ai.usage.input_tokens)\n' +
    '| summarize input_tokens = sum(toLong(gen_ai.usage.input_tokens)), output_tokens = sum(toLong(gen_ai.usage.output_tokens)), span_count = count()';

  function copyDql() {
    navigator.clipboard.writeText(dql30d).then(() => {
      setDqlCopied(true);
      setTimeout(() => setDqlCopied(false), 1500);
    });
  }

  const weekTokens = stats.week_input_tokens + stats.week_output_tokens;
  const weekPct    = stats.total_tokens > 0 ? (weekTokens / stats.total_tokens) * 100 : 0;

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-950/10 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-violet-500/15 bg-violet-950/20">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 border border-violet-500/25">
          <Code2 className="h-3.5 w-3.5 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground leading-tight">Claude Code</p>
          <p className="text-[10px] text-muted-foreground">AI Coding Agent · Anthropic · built Karma</p>
        </div>
        {stats.from_grail ? (
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Grail live
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5 shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Setup needed
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {hasData ? (
          <>
            {/* 30-day totals */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-background/30 border border-violet-500/15 px-3 py-2 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-1">
                  <Zap className="h-2.5 w-2.5" /> 30d tokens
                </p>
                <p className="text-sm font-bold text-violet-300 tabular-nums">{formatTokens(stats.total_tokens)}</p>
              </div>
              <div className="rounded-lg bg-background/30 border border-violet-500/15 px-3 py-2 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-1">
                  <DollarSign className="h-2.5 w-2.5" /> Cost
                </p>
                <p className="text-sm font-bold text-violet-300 tabular-nums">{formatCost(stats.cost_usd)}</p>
              </div>
              <div className="rounded-lg bg-background/30 border border-violet-500/15 px-3 py-2 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-1">
                  <Activity className="h-2.5 w-2.5" /> Spans
                </p>
                <p className="text-sm font-bold text-violet-300 tabular-nums">{stats.span_count.toLocaleString()}</p>
              </div>
            </div>

            {/* Input / output split bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>↑ {formatTokens(stats.input_tokens)} prompt</span>
                <span>↓ {formatTokens(stats.output_tokens)} completion</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-500/70"
                  style={{
                    width: stats.total_tokens > 0
                      ? `${(stats.input_tokens / stats.total_tokens) * 100}%`
                      : "50%",
                  }}
                />
              </div>
            </div>

            {/* 7-day vs 30-day comparison */}
            {weekTokens > 0 && (
              <div className="rounded-lg border border-violet-500/15 bg-background/20 px-3 py-2.5 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last 7 days</p>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-violet-300 tabular-nums">{formatTokens(weekTokens)}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {weekPct.toFixed(0)}% of 30d total · {stats.week_span_count.toLocaleString()} spans
                  </span>
                </div>
                <div className="h-1 rounded-full bg-muted/20 overflow-hidden">
                  <div className="h-full rounded-full bg-violet-400/50" style={{ width: `${weekPct}%` }} />
                </div>
              </div>
            )}

            {/* Copy DQL button */}
            <button
              onClick={copyDql}
              className="inline-flex items-center gap-1.5 text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
            >
              <Terminal className="h-3 w-3" />
              {dqlCopied ? "DQL copied!" : "Copy DQL query"}
              <Copy className="h-2.5 w-2.5" />
            </button>
          </>
        ) : (
          <ClaudeCodeSetupGuide dtEnv={dtEnv} />
        )}
      </div>
    </div>
  );
}

// ── Grand-total header ────────────────────────────────────────────────────────

function TotalBar({
  tokensA, tokensB,
}: {
  tokensA: number;
  tokensB: number;
}) {
  const total = tokensA + tokensB;
  const pctA  = total > 0 ? (tokensA / total) * 100 : 50;
  return (
    <div className="space-y-1.5">
      <div className="flex h-2.5 overflow-hidden rounded-full gap-0.5">
        <div className="transition-all rounded-l-full bg-cyan-500/70"   style={{ width: `${pctA}%` }}     title={`Karma ADK: ${pctA.toFixed(1)}%`} />
        <div className="transition-all rounded-r-full bg-violet-500/70" style={{ width: `${100 - pctA}%` }} title={`Claude Code: ${(100 - pctA).toFixed(1)}%`} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span><span className="font-semibold text-cyan-400">{pctA.toFixed(0)}%</span> Karma ADK</span>
        <span>Claude Code <span className="font-semibold text-violet-400">{(100 - pctA).toFixed(0)}%</span></span>
      </div>
    </div>
  );
}

// ── DQL copy button ───────────────────────────────────────────────────────────

function DqlCopyButton({ label, dql, color = "cyan" }: { label: string; dql: string; color?: "cyan" | "violet" }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(dql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  const textClass = color === "violet" ? "text-violet-400 hover:text-violet-300" : "text-cyan-400 hover:text-cyan-300";
  return (
    <button onClick={copy} className={cn("inline-flex items-center gap-1 text-[11px] transition-colors", textClass)}>
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

  const dtEnv = process.env.NEXT_PUBLIC_DT_ENV ?? "";

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

      {/* ── Grand-total header card ────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 via-card to-violet-950/20 p-5">
        <div className="pointer-events-none absolute -top-8 -right-8 h-36 w-36 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-36 w-36 rounded-full bg-violet-500/5 blur-3xl" />

        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/25">
              <Sparkles className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">AI Agent Observability</h2>
              <p className="text-xs text-muted-foreground">
                Dynatrace monitors both the system that built this and the system it built
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

        {totalTokens > 0 && (
          <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-background/40 backdrop-blur-sm px-4 py-3">
              <p className="text-[11px] text-muted-foreground mb-1">Combined AI spend</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{formatCost(totalCost)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 backdrop-blur-sm px-4 py-3">
              <p className="text-[11px] text-muted-foreground mb-1">Combined tokens</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{formatTokens(totalTokens)}</p>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-lg border border-border/60 bg-background/40 backdrop-blur-sm px-4 py-3">
              <p className="text-[11px] text-muted-foreground mb-2">Token split</p>
              <TotalBar tokensA={ka.total_tokens} tokensB={cc.total_tokens} />
            </div>
          </div>
        )}
      </div>

      {/* ── Two-column agent panels ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <KarmaAgentPlatformPanel stats={ka} />
        <ClaudeCodePanel stats={cc} dtEnv={dtEnv} />
      </div>

      {/* ── Narrative callout ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.04] p-4">
        <div className="flex items-start gap-3">
          <Brain className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">The recursive loop</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Karma was built with Claude Code, a Dynatrace-monitored AI coding agent. Every
              Claude Code session emits{" "}
              <span className="font-mono text-violet-400">gen_ai.*</span> OTel spans via native
              OpenTelemetry support — token spend, tool calls, session activity — flowing to the
              same Dynatrace tenant that Karma&#39;s ADK agents write to. Meanwhile, every
              Karma agent invocation emits its own{" "}
              <span className="font-mono text-cyan-400">karma.agent_run</span> spans with
              per-agent token attribution. Dynatrace watches both. This panel queries both
              live from Grail.
            </p>
            {data.grail_configured && (
              <div className="flex flex-wrap gap-3 pt-1">
                <DqlCopyButton
                  label="Copy Karma ADK DQL"
                  color="cyan"
                  dql={
                    'fetch spans, from:now()-30d\n' +
                    '| filter service.name == "karma-agent-system"\n' +
                    '| filter span.name == "gen_ai.chat"\n' +
                    '| filter isNotNull(karma.agent)\n' +
                    '| summarize input_tokens = sum(toLong(gen_ai.usage.input_tokens)), output_tokens = sum(toLong(gen_ai.usage.output_tokens)), span_count = count(), by: {agent = karma.agent}'
                  }
                />
                <DqlCopyButton
                  label="Copy Claude Code DQL"
                  color="violet"
                  dql={
                    'fetch spans, from:now()-30d\n' +
                    '| filter gen_ai.system == "anthropic"\n' +
                    '| filter isNotNull(gen_ai.usage.input_tokens)\n' +
                    '| summarize input_tokens = sum(toLong(gen_ai.usage.input_tokens)), output_tokens = sum(toLong(gen_ai.usage.output_tokens)), span_count = count()'
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
