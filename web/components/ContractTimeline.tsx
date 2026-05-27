"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2, Clock, AlertCircle, ExternalLink,
  ChevronDown, ChevronRight, Database, BarChart2, Terminal,
} from "lucide-react";
import type { ContractResponse, ContractCategory, ContractDetail, GhostReport } from "@/lib/types";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { ContractSparkline } from "@/components/ContractSparkline";

interface ContractTimelineProps {
  contracts: ContractResponse[];
  ghosts?: GhostReport[];
}

const CATEGORY_LABEL: Record<ContractCategory, string> = {
  latency:        "Latency",
  error_semantics:"Error semantics",
  throughput:     "Throughput",
  side_effect:    "Side effect",
  timing:         "Timing",
  dependency:     "Dependency",
  resource:       "Resource",
  sequencing:     "Sequencing",
};

const CATEGORY_PRIORITY: ContractCategory[] = [
  "side_effect", "error_semantics", "latency",
  "throughput", "timing", "dependency", "resource", "sequencing",
];

const CATEGORY_COLORS: Partial<Record<ContractCategory, string>> = {
  side_effect:    "bg-violet-500/15 text-violet-400 border-violet-500/30",
  error_semantics:"bg-red-500/15    text-red-400    border-red-500/30",
  latency:        "bg-amber-500/15  text-amber-400  border-amber-500/30",
  throughput:     "bg-blue-500/15   text-blue-400   border-blue-500/30",
};

const DT_ENV = process.env.NEXT_PUBLIC_DT_ENV ?? "";

// dynatrace.notebooks ignores ?query= — callers fall back to copy-to-clipboard
function buildNotebookUrl(_dql: string): string | null {
  return null;
}

function buildSloUrl(sloId: string): string | null {
  if (!DT_ENV || !sloId) return null;
  return `https://${DT_ENV}.apps.dynatrace.com/ui/observe/slo/${encodeURIComponent(sloId)}`;
}

export function ContractTimeline({ contracts, ghosts = [] }: ContractTimelineProps) {
  if (contracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/30 px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-card mb-5">
          <AlertCircle className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <h3 className="text-base font-semibold">No contracts learned yet</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs leading-relaxed">
          The Learner will populate this timeline once the observation window is complete.
        </p>
      </div>
    );
  }

  const sorted = [...contracts].sort((a, b) => {
    const pa = CATEGORY_PRIORITY.indexOf(a.category);
    const pb = CATEGORY_PRIORITY.indexOf(b.category);
    if (pa !== pb) return pa - pb;
    return b.confidence - a.confidence;
  });

  return (
    <div className="relative space-y-0">
      <div className="absolute left-[19px] top-5 bottom-5 w-px bg-border/60" />
      {sorted.map((contract, index) => (
        <ContractRow
          key={contract.contract_id}
          contract={contract}
          index={index + 1}
          isLast={index === sorted.length - 1}
          ghosts={ghosts}
        />
      ))}
    </div>
  );
}

function ContractRow({
  contract,
  index,
  isLast,
  ghosts,
}: {
  contract: ContractResponse;
  index: number;
  isLast: boolean;
  ghosts: GhostReport[];
}) {
  const [expanded, setExpanded]     = useState(false);
  const [detail, setDetail]         = useState<ContractDetail | null>(null);
  const [loadingDetail, setLoading] = useState(false);

  const isSideEffect  = contract.category === "side_effect";
  const categoryClass = CATEGORY_COLORS[contract.category] ?? "bg-muted text-muted-foreground border-border";

  async function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && detail === null && !loadingDetail) {
      setLoading(true);
      try {
        const d = await apiFetch<ContractDetail>(`/contracts/detail/${contract.contract_id}`);
        setDetail(d);
      } catch {
        // silently ignore — DQL button just won't appear
      } finally {
        setLoading(false);
      }
    }
  }

  const notebookUrl = detail?.predicate_test_dql
    ? buildNotebookUrl(detail.predicate_test_dql)
    : null;
  const sloUrl = detail?.slo_id ? buildSloUrl(detail.slo_id) : null;

  return (
    <div className={cn("relative flex gap-4 pb-4", isLast && "pb-0")}>
      {/* Timeline dot */}
      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center">
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full border-2 bg-card",
            contract.validated
              ? "border-success text-success"
              : "border-border text-muted-foreground"
          )}
        >
          {contract.validated ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <span className="text-[9px] font-bold tabular-nums">{index}</span>
          )}
        </div>
      </div>

      {/* Card */}
      <div
        className={cn(
          "flex-1 min-w-0 rounded-xl border p-4 mb-1 transition-all duration-200",
          "hover:shadow-card-hover",
          isSideEffect
            ? "border-violet-500/25 bg-violet-500/5"
            : "border-border bg-card"
        )}
      >
        {/* Header row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border",
                categoryClass
              )}
            >
              {CATEGORY_LABEL[contract.category]}
            </span>
            {contract.subcategory && (
              <span className="text-xs text-muted-foreground font-mono">{contract.subcategory}</span>
            )}
            {!contract.validated && (
              <span className="text-[10px] text-muted-foreground/60 italic">pending validation</span>
            )}
          </div>

          {/* Right: sparkline + confidence + time + expand toggle */}
          <div className="flex items-center gap-3 shrink-0">
            {/* 7-day violation sparkline */}
            <ContractSparkline contractId={contract.contract_id} ghosts={ghosts} />
            <ConfidenceBar confidence={contract.confidence} />
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(contract.detected_at), { addSuffix: true })}
            </div>
            {/* Expand toggle for DQL details */}
            <button
              onClick={toggleExpand}
              className={cn(
                "flex items-center justify-center h-5 w-5 rounded border transition-colors",
                expanded
                  ? "border-teal-500/40 bg-teal-500/10 text-teal-400"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-border/70"
              )}
              title={expanded ? "Hide predicate DQL" : "Show predicate DQL & DT links"}
            >
              {expanded
                ? <ChevronDown className="h-3 w-3" />
                : <ChevronRight className="h-3 w-3" />
              }
            </button>
          </div>
        </div>

        {/* Description */}
        <p className="mt-2 text-sm text-foreground leading-relaxed">{contract.description}</p>

        {/* ── Expanded: predicate DQL + DT links ── */}
        {expanded && (
          <div className="mt-3 space-y-2.5 animate-fade-in-up">
            {loadingDetail && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-3 w-3 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                Loading contract details…
              </div>
            )}

            {detail && (
              <>
                {/* Violation predicate DQL */}
                {detail.predicate_test_dql && (
                  <div className="rounded-lg border border-teal-500/20 bg-teal-500/[0.04] overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-teal-500/10">
                      <div className="flex items-center gap-1.5">
                        <Terminal className="h-3 w-3 text-teal-400 shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400/80">
                          Violation Predicate DQL
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {notebookUrl && (
                          <a
                            href={notebookUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "inline-flex items-center gap-1 rounded border px-2 py-0.5",
                              "text-[10px] font-medium font-mono transition-all duration-150",
                              "text-teal-400 border-teal-500/30 hover:bg-teal-500/10 hover:border-teal-400/50",
                            )}
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            Run in Dynatrace
                          </a>
                        )}
                      </div>
                    </div>
                    <pre className="px-3 py-2.5 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                      {detail.predicate_test_dql}
                    </pre>
                    {detail.predicate_threshold && (
                      <div className="px-3 py-1.5 border-t border-teal-500/10 flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground/60">Threshold:</span>
                        <span className="text-[10px] font-mono text-teal-300">{detail.predicate_threshold}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* DT deep links for this contract */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {sloUrl && (
                    <a
                      href={sloUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1",
                        "text-[11px] font-medium font-mono transition-all duration-150",
                        "text-amber-400 border-amber-500/25 hover:bg-amber-500/10 hover:border-amber-400/40",
                      )}
                    >
                      <BarChart2 className="h-3 w-3 shrink-0" />
                      View SLO in Dynatrace
                      <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
                    </a>
                  )}
                  {detail.downstream_dependents && detail.downstream_dependents.length > 0 && (
                    <span className="text-[10px] text-muted-foreground/50 font-mono ml-1">
                      {detail.downstream_dependents.length} downstream dependent{detail.downstream_dependents.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  {detail.predicate_type && (
                    <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] font-mono text-muted-foreground/70">
                      {detail.predicate_type}
                    </span>
                  )}
                  {detail.predicate_tolerance_seconds != null && (
                    <span className="text-[10px] text-muted-foreground/50">
                      tolerance: {detail.predicate_tolerance_seconds}s
                    </span>
                  )}
                </div>

                {/* Evidence queries */}
                {detail.evidence && detail.evidence.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Evidence DQL ({detail.evidence.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.evidence.filter(e => e.type === "dql_query").map((ev, i) => {
                        const dqlEv = ev as { type: "dql_query"; dql: string; sample_count?: number };
                        const nbUrl = buildNotebookUrl(dqlEv.dql);
                        if (!nbUrl) return null;
                        return (
                          <a
                            key={i}
                            href={nbUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary font-mono border border-border/40 rounded px-1.5 py-0.5 transition-colors"
                          >
                            <Database className="h-2.5 w-2.5" />
                            DQL evidence [{i + 1}]
                            {dqlEv.sample_count != null && (
                              <span className="text-muted-foreground/50 ml-0.5">({dqlEv.sample_count})</span>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 85 ? "bg-success" :
    pct >= 60 ? "bg-warning" :
                "bg-muted-foreground/50";

  return (
    <div className="flex items-center gap-2" title={`Confidence: ${pct}%`}>
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-medium tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}
