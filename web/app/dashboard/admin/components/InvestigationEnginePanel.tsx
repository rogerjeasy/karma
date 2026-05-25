"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Clock,
  DollarSign,
  Ghost,
  Loader2,
  Search,
  Sparkles,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SEV_BAR_COLORS, SEV_TEXT_COLORS } from "./constants";
import { formatTokens, formatCost } from "./utils";
import { SeverityBar } from "./SeverityBar";
import { UserRow } from "./UserRow";
import type { InvestigationEngineData, ViolationSeverity } from "@/lib/types";

export function InvestigationEnginePanel() {
  const [data, setData]       = useState<InvestigationEngineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState("");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await apiFetch<InvestigationEngineData>("/admin/investigation-engine");
        if (!cancelled) setData(result);
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error).message ?? "Failed to load investigation data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.users;
    return data.users.filter(
      (u) =>
        u.display_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.user_id.toLowerCase().includes(q),
    );
  }, [data, search]);

  function toggleUser(uid: string) {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
            <Bot className="absolute inset-0 m-auto h-3.5 w-3.5 text-cyan-300" />
          </div>
          <p className="text-sm text-muted-foreground">Loading investigation data…</p>
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

  const { aggregate: agg } = data;
  const enrichPct   = agg.total_reports > 0
    ? Math.round((agg.davis_enriched_count / agg.total_reports) * 100)
    : 0;
  const totalTokens = agg.total_input_tokens + agg.total_output_tokens;
  const SEV_ORDER: ViolationSeverity[] = ["critical", "high", "medium", "low"];

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="relative overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 via-card to-violet-950/30 p-5">
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-violet-500/5 blur-3xl" />

        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/25">
              <Bot className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">AI Investigation Engine</h2>
              <p className="text-xs text-muted-foreground">
                Autonomous forensic analysis · Vertex AI · Gemini 2.5 Pro
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-medium text-emerald-400">Active</span>
          </div>
        </div>

        {/* KPI cards */}
        <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border/60 bg-background/40 backdrop-blur-sm px-4 py-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Ghost className="h-3.5 w-3.5" />
              <span className="text-[11px]">Ghost Reports</span>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{agg.total_reports}</p>
          </div>

          <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 backdrop-blur-sm px-4 py-3">
            <div className="flex items-center gap-1.5 text-emerald-400/70 mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="text-[11px]">Total Spend</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400 tabular-nums">
              {formatCost(agg.total_cost_usd)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Gemini 2.5 Pro</p>
          </div>

          <div className="rounded-lg border border-cyan-500/25 bg-cyan-950/20 backdrop-blur-sm px-4 py-3">
            <div className="flex items-center gap-1.5 text-cyan-400/70 mb-1">
              <Zap className="h-3.5 w-3.5" />
              <span className="text-[11px]">Tokens Consumed</span>
            </div>
            <p className="text-2xl font-bold text-cyan-400 tabular-nums">
              {formatTokens(totalTokens)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              ↑ {formatTokens(agg.total_input_tokens)} · ↓ {formatTokens(agg.total_output_tokens)}
            </p>
          </div>

          <div className="rounded-lg border border-violet-500/25 bg-violet-950/20 backdrop-blur-sm px-4 py-3">
            <div className="flex items-center gap-1.5 text-violet-400/70 mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-[11px]">Davis AI Enriched</span>
            </div>
            <p className="text-2xl font-bold text-violet-400 tabular-nums">{enrichPct}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {agg.davis_enriched_count} / {agg.total_reports} reports
            </p>
          </div>
        </div>

        {/* Aggregate severity bar */}
        {agg.total_reports > 0 && (
          <div className="relative mt-4 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Platform Severity Distribution
            </p>
            <div className="flex h-2 overflow-hidden rounded-full gap-px bg-muted/20">
              {SEV_ORDER.map((s) => {
                const pct = (agg.severity_breakdown[s] / agg.total_reports) * 100;
                return pct > 0 ? (
                  <div
                    key={s}
                    className={cn("transition-all", SEV_BAR_COLORS[s])}
                    style={{ width: `${pct}%` }}
                    title={`${s}: ${agg.severity_breakdown[s]}`}
                  />
                ) : null;
              })}
            </div>
            <div className="flex flex-wrap gap-3">
              {SEV_ORDER.map((s) =>
                agg.severity_breakdown[s] > 0 ? (
                  <div key={s} className="flex items-center gap-1">
                    <div className={cn("h-2 w-2 rounded-full", SEV_BAR_COLORS[s])} />
                    <span className={cn("text-[11px] font-medium capitalize", SEV_TEXT_COLORS[s])}>
                      {s}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {agg.severity_breakdown[s]}
                    </span>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        )}
      </div>

      {/* Per-user breakdown */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/10">
          <div className="flex items-center gap-2 flex-1">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold text-foreground">Per-User Forensics</span>
            <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
              {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-52 rounded-md border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
            />
          </div>
        </div>

        {filteredUsers.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-2 bg-muted/5 border-b border-border/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <div className="w-8 shrink-0" />
            <div className="flex-1">User</div>
            <div className="hidden sm:block shrink-0 min-w-[60px] text-right">Reports</div>
            <div className="hidden md:block shrink-0 min-w-[80px] text-right">Cost</div>
            <div className="hidden lg:block shrink-0 min-w-[70px] text-right">Tokens</div>
            <div className="hidden lg:block shrink-0 min-w-[60px] text-right">Davis AI</div>
            <div className="hidden xl:block shrink-0 w-28">Severity</div>
            <div className="hidden sm:block shrink-0 min-w-[80px] text-right">Last Report</div>
            <div className="w-4 shrink-0" />
          </div>
        )}

        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
            {search ? (
              <>
                <Search className="h-6 w-6 opacity-30" />
                <p className="text-sm">No users match &ldquo;{search}&rdquo;</p>
              </>
            ) : (
              <>
                <Bot className="h-6 w-6 opacity-30" />
                <p className="text-sm">No forensic investigations have run yet.</p>
                <p className="text-xs">Ghost reports appear here after the Watcher detects violations.</p>
              </>
            )}
          </div>
        ) : (
          <div>
            {filteredUsers.map((user) => (
              <UserRow
                key={user.user_id}
                user={user}
                expanded={expandedUsers.has(user.user_id)}
                onToggle={() => toggleUser(user.user_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
