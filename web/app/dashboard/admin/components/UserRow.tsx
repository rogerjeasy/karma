"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Ghost,
  Sparkles,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SeverityBar } from "./SeverityBar";
import { formatTokens, formatCost, userInitials } from "./utils";
import type { UserInvestigationStats } from "@/lib/types";

export function UserRow({
  user,
  expanded,
  onToggle,
}: {
  user: UserInvestigationStats;
  expanded: boolean;
  onToggle: () => void;
}) {
  const total      = user.total_reports;
  const enrichPct  = total > 0 ? Math.round((user.davis_enriched_count / total) * 100) : 0;
  const initials   = userInitials(user.display_name || user.email || user.user_id);
  const totalTokens = user.total_input_tokens + user.total_output_tokens;

  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors text-left"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/20 text-[11px] font-bold text-cyan-300">
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{user.display_name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{user.email || user.user_id}</p>
        </div>

        <div className="hidden sm:flex shrink-0 items-center gap-1.5 min-w-[60px] justify-end">
          <Ghost className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm font-semibold tabular-nums text-foreground">{total}</span>
        </div>

        <div className="hidden md:block shrink-0 min-w-[80px] text-right">
          <p className="text-xs text-muted-foreground">Cost</p>
          <p className="text-sm font-semibold tabular-nums text-emerald-400">
            {formatCost(user.total_cost_usd)}
          </p>
        </div>

        <div className="hidden lg:block shrink-0 min-w-[70px] text-right">
          <p className="text-xs text-muted-foreground">Tokens</p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {formatTokens(totalTokens)}
          </p>
        </div>

        <div className="hidden lg:flex shrink-0 flex-col items-end min-w-[60px] gap-0.5">
          <p className="text-xs text-muted-foreground">Davis AI</p>
          <div className="flex items-center gap-1">
            {enrichPct === 100 ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            ) : enrichPct === 0 ? (
              <XCircle className="h-3 w-3 text-muted-foreground" />
            ) : (
              <div className="h-3 w-3 rounded-full border-2 border-amber-400" />
            )}
            <span
              className={cn(
                "text-xs font-semibold tabular-nums",
                enrichPct === 100
                  ? "text-emerald-400"
                  : enrichPct > 0
                    ? "text-amber-400"
                    : "text-muted-foreground",
              )}
            >
              {enrichPct}%
            </span>
          </div>
        </div>

        <div className="hidden xl:block shrink-0 w-28">
          <SeverityBar breakdown={user.severity_breakdown} total={total} compact />
        </div>

        <div className="hidden sm:flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground min-w-[80px] justify-end">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {user.last_report_at
              ? formatDistanceToNow(new Date(user.last_report_at), { addSuffix: true })
              : "—"}
          </span>
        </div>

        <div className="shrink-0 text-muted-foreground ml-1">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 bg-muted/10 border-t border-border/30">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-4">
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ghost Reports</p>
              <p className="text-lg font-bold text-foreground">{total}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Spend</p>
              <p className="text-lg font-bold text-emerald-400">{formatCost(user.total_cost_usd)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Input Tokens</p>
              <p className="text-lg font-bold text-foreground">{formatTokens(user.total_input_tokens)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Output Tokens</p>
              <p className="text-lg font-bold text-foreground">{formatTokens(user.total_output_tokens)}</p>
            </div>
          </div>

          {total > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Severity Distribution
              </p>
              <SeverityBar breakdown={user.severity_breakdown} total={total} />
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <div>
                <p className="text-[10px] text-muted-foreground">Davis AI Enriched</p>
                <p className="text-sm font-semibold text-emerald-400">
                  {user.davis_enriched_count} / {total}
                  {total > 0 && <span className="ml-1 text-xs opacity-70">({enrichPct}%)</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/8 px-3 py-2">
              <Bot className="h-3.5 w-3.5 text-cyan-400" />
              <div>
                <p className="text-[10px] text-muted-foreground">Model</p>
                <p className="text-sm font-semibold text-cyan-400">Gemini 2.5 Pro</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
