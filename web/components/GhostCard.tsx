"use client";

import { useState } from "react";
import { ExternalLink, ArrowRight, Clock, Copy, Check, Brain, Coins, Cpu } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { GhostReport, ViolationSeverity } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface GhostCardProps {
  report: GhostReport;
}

const SEVERITY_CONFIG: Record<
  ViolationSeverity,
  { variant: "ghost" | "warning" | "destructive" | "critical"; bar: string; glow: string }
> = {
  low:      { variant: "ghost",       bar: "bg-zinc-500",    glow: "" },
  medium:   { variant: "warning",     bar: "bg-amber-400",   glow: "" },
  high:     { variant: "destructive", bar: "bg-red-400",     glow: "" },
  critical: { variant: "critical",    bar: "bg-red-500",     glow: "shadow-[0_0_18px_-4px_hsl(0_72%_51%/0.45)]" },
};

const DT_ENV = process.env.NEXT_PUBLIC_DT_ENV ?? "";

function extractDql(raw: string): string {
  // Strip optional "DQL#N (label): " prefix written by the forensic agent.
  const withoutPrefix = raw.replace(/^DQL#?\d*\s*[^:]*:\s*/i, "");
  // Strip trailing " -- RESULT: ..." annotation.
  return withoutPrefix.replace(/\s*--\s*RESULT:[\s\S]*$/i, "").trim();
}

function buildDtLink(dql: string): string | null {
  if (!DT_ENV) return null;
  return (
    `https://${DT_ENV}.apps.dynatrace.com/ui/apps/dynatrace.notebooks/` +
    `?query=${encodeURIComponent(dql)}`
  );
}

function EvidenceLink({ raw, index }: { raw: string; index: number }) {
  const [copied, setCopied] = useState(false);
  const isUrl = /^https?:\/\//i.test(raw);
  const dql = isUrl ? "" : extractDql(raw);
  const href = isUrl ? raw : buildDtLink(dql);

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-mono transition-colors"
      >
        <ExternalLink className="h-3 w-3" />
        evidence [{index}]
      </a>
    );
  }

  // DT_ENV not configured — copy the DQL query to clipboard instead.
  function copyDql() {
    navigator.clipboard.writeText(dql || raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copyDql}
      title={dql || raw}
      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-mono transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      evidence [{index}]
    </button>
  );
}

export function GhostCard({ report }: GhostCardProps) {
  const cfg = SEVERITY_CONFIG[report.severity] ?? SEVERITY_CONFIG.medium;

  return (
    <article
      className={cn(
        "group relative rounded-xl border border-border bg-card overflow-hidden",
        "transition-all duration-200 hover:border-border/70 hover:shadow-card-hover hover:-translate-y-px",
        cfg.glow
      )}
    >
      {/* ── Severity accent bar ── */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", cfg.bar)} />

      <div className="pl-5 pr-5 pt-4 pb-4 space-y-3">
        {/* ── Top row ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Badge variant={cfg.variant} className="shrink-0 uppercase text-[10px] tracking-wider">
              {report.severity}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">{report.category}</span>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <span className="text-[11px] text-muted-foreground/70 font-mono">
              #{report.contract_id?.slice(0, 8) ?? '—'}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground/60">
            <Clock className="h-3 w-3" />
            <time>{formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}</time>
          </div>
        </div>

        {/* ── Summary ── */}
        <p className="text-sm font-semibold text-foreground leading-snug">{report.summary}</p>

        {/* ── Impact ── */}
        {report.downstream_impact && (
          <p className="text-sm text-muted-foreground leading-relaxed">{report.downstream_impact}</p>
        )}

        {/* ── Davis AI insights ── */}
        {report.davis_ai_insights && report.davis_ai_insights !== "not available" && (
          <div className="space-y-1.5 rounded-lg bg-violet-500/5 border border-violet-500/20 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Brain className="h-3.5 w-3.5 text-violet-400 shrink-0" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400/80">
                Davis AI Insights
              </p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
              {report.davis_ai_insights}
            </p>
          </div>
        )}

        {/* ── Remediation suggestions ── */}
        {report.remediation_suggestions.length > 0 && (
          <div className="space-y-1.5 rounded-lg bg-muted/40 border border-border/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
              Remediation
            </p>
            {report.remediation_suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/70" />
                <span className="text-muted-foreground leading-relaxed">{s}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Evidence links + Dynatrace event links ── */}
        {(report.evidence_links.length > 0 || report.dynatrace_event_id || DT_ENV) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {report.evidence_links.map((link, i) => (
              <EvidenceLink key={i} raw={link} index={i + 1} />
            ))}
            {report.dynatrace_event_id && DT_ENV && (
              <a
                href={`https://${DT_ENV}.apps.dynatrace.com/ui/apps/dynatrace.events/events?filter=${encodeURIComponent(report.dynatrace_event_id)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 font-mono transition-colors"
                title={`Dynatrace service annotation: ${report.dynatrace_event_id}`}
              >
                <ExternalLink className="h-3 w-3" />
                dt event
              </a>
            )}
            {DT_ENV && (
              <a
                href={
                  `https://${DT_ENV}.apps.dynatrace.com/ui/apps/dynatrace.notebooks/` +
                  `?query=${encodeURIComponent(
                    `fetch bizevents\n| filter event.type == "karma.ghost_report.created"\n| filter event.data.report_id == "${report.report_id}"`
                  )}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 font-mono transition-colors"
                title="Open BizEvent in Dynatrace Notebooks"
              >
                <ExternalLink className="h-3 w-3" />
                bizevent
              </a>
            )}
          </div>
        )}

        {/* ── Investigation cost ── */}
        {report.cost_estimate_usd != null && (
          <div className="flex items-center gap-4 pt-0.5 border-t border-border/40">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
              <Coins className="h-3 w-3" />
              <span>${report.cost_estimate_usd.toFixed(4)}</span>
            </div>
            {(report.investigation_input_tokens != null || report.investigation_output_tokens != null) && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                <Cpu className="h-3 w-3" />
                <span>
                  {((report.investigation_input_tokens ?? 0) + (report.investigation_output_tokens ?? 0)).toLocaleString()} tokens
                </span>
              </div>
            )}
            <span className="text-[10px] text-muted-foreground/30 ml-auto">investigation cost</span>
          </div>
        )}
      </div>
    </article>
  );
}
