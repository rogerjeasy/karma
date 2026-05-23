"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, Copy, Check, ExternalLink, Shield, Clock,
  FileCode2, AlertTriangle, ChevronRight, Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useDashboardData } from "@/lib/dashboard-context";
import { GhostCard } from "@/components/GhostCard";
import type { ContractDetail, ContractEvidence } from "@/lib/types";

const DT_ENV = process.env.NEXT_PUBLIC_DT_ENV ?? "";

const CATEGORY_COLOR: Record<string, string> = {
  latency:         "bg-blue-500/15   text-blue-400   border-blue-500/20",
  error_semantics: "bg-red-500/15    text-red-400    border-red-500/20",
  side_effect:     "bg-purple-500/15 text-purple-400 border-purple-500/20",
  throughput:      "bg-cyan-500/15   text-cyan-400   border-cyan-500/20",
  timing:          "bg-amber-500/15  text-amber-400  border-amber-500/20",
  dependency:      "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  resource:        "bg-orange-500/15 text-orange-400 border-orange-500/20",
  sequencing:      "bg-teal-500/15   text-teal-400   border-teal-500/20",
};

const PREDICATE_LABEL: Record<string, string> = {
  absence:             "Absence",
  threshold_breach:    "Threshold Breach",
  distribution_shift:  "Distribution Shift",
  pattern_mismatch:    "Pattern Mismatch",
};

function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className={cn("text-muted-foreground/50 hover:text-muted-foreground transition-colors", className)}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function DqlBlock({ dql, label }: { dql: string; label?: string }) {
  const href = DT_ENV
    ? `https://${DT_ENV}.apps.dynatrace.com/ui/apps/dynatrace.notebooks/?query=${encodeURIComponent(dql)}`
    : null;
  return (
    <div className="rounded-lg border border-border bg-zinc-950/60 overflow-hidden">
      {label && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-muted/20">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{label}</span>
          <div className="flex items-center gap-2">
            <CopyButton value={dql} />
            {href && (
              <a href={href} target="_blank" rel="noopener noreferrer"
                className="text-primary/60 hover:text-primary transition-colors">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      )}
      <pre className="px-4 py-3 text-[11px] font-mono text-emerald-300/80 leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
        {dql}
      </pre>
    </div>
  );
}

function EvidenceItem({ ev, index }: { ev: ContractEvidence; index: number }) {
  if (ev.type === "dql_query") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            DQL Evidence #{index + 1}
          </span>
          <span className="text-[10px] text-muted-foreground/40">
            · {ev.sample_count.toLocaleString()} samples · {ev.timespan}
          </span>
        </div>
        <DqlBlock dql={ev.dql} />
        {ev.result_summary && (
          <p className="text-xs text-muted-foreground/70 pl-1">{ev.result_summary}</p>
        )}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card/50 px-4 py-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
          Trace Pattern #{index + 1}
        </span>
        <span className="text-[10px] text-muted-foreground/40">
          · {ev.sample_count.toLocaleString()} samples
        </span>
      </div>
      <p className="text-xs font-mono text-foreground">{ev.pattern}</p>
      <p className="text-xs text-muted-foreground/70">{ev.frequency}</p>
    </div>
  );
}

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const { contracts, ghosts, services, loading: ctxLoading } = useDashboardData();

  const [detail, setDetail]       = useState<ContractDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [notFound, setNotFound]   = useState(false);

  // Find the base contract in context (already loaded)
  const baseContract = Object.values(contracts).flat().find((c) => c.contract_id === id) ?? null;

  // Find service name for the breadcrumb
  const ownerService = baseContract
    ? services.find((s) =>
        Object.entries(contracts).some(([sid, arr]) => sid === s.service_id && arr.some((c) => c.contract_id === id))
      )
    : null;

  // Related ghost reports
  const relatedGhosts = ghosts.filter((g) => g.contract_id === id);

  // Fetch full detail (predicate + evidence)
  useEffect(() => {
    if (!id) return;
    setDetailLoading(true);
    apiFetch<ContractDetail>(`/contracts/detail/${id}`)
      .then((d) => setDetail(d))
      .catch(() => setNotFound(true))
      .finally(() => setDetailLoading(false));
  }, [id]);

  if (!ctxLoading && !baseContract && !detailLoading && notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
        <FileCode2 className="h-10 w-10 text-muted-foreground/30" />
        <h2 className="text-lg font-semibold">Contract not found</h2>
        <p className="text-sm text-muted-foreground">This contract may have been deleted.</p>
        <button onClick={() => router.back()}
          className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Go back
        </button>
      </div>
    );
  }

  const c = detail ?? baseContract;
  const colorClass = CATEGORY_COLOR[c?.category ?? ""] ?? "bg-muted/30 text-muted-foreground border-border";

  return (
    <div className="space-y-8 animate-fade-in-up max-w-4xl">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/dashboard/timeline" className="hover:text-foreground transition-colors">
          Contracts
        </Link>
        {ownerService && (
          <>
            <ChevronRight className="h-3 w-3" />
            <Link href="/dashboard/services" className="hover:text-foreground transition-colors">
              {ownerService.service_name}
            </Link>
          </>
        )}
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-mono">{id?.slice(0, 8)}…</span>
      </div>

      {/* ── Header ── */}
      {c ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3 flex-wrap">
            <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide", colorClass)}>
              {c.category.replace("_", " ")}
            </span>
            {c.subcategory && (
              <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                {c.subcategory}
              </span>
            )}
            {c.validated && (
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-400 flex items-center gap-1">
                <Shield className="h-3 w-3" /> Validated
              </span>
            )}
          </div>
          <p className="text-base leading-relaxed text-foreground">{c.description}</p>

          {/* Confidence + metadata */}
          <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-2 min-w-36">
              <span className="text-muted-foreground/60 shrink-0">Confidence</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-20">
                <div
                  className={cn("h-full rounded-full transition-all", c.confidence >= 0.9 ? "bg-emerald-400" : c.confidence >= 0.7 ? "bg-amber-400" : "bg-red-400")}
                  style={{ width: `${Math.round(c.confidence * 100)}%` }}
                />
              </div>
              <span className="font-mono font-semibold text-foreground tabular-nums">
                {Math.round(c.confidence * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span>Discovered {formatDistanceToNow(new Date(c.detected_at), { addSuffix: true })}</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono">
              <FileCode2 className="h-3 w-3" />
              <span className="text-muted-foreground/60">{id?.slice(0, 8)}</span>
              <CopyButton value={id ?? ""} />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 animate-pulse">
          <div className="h-5 w-24 rounded-full bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-3/4 rounded bg-muted" />
        </div>
      )}

      {/* ── Violation predicate ── */}
      {(detail?.predicate_test_dql || detailLoading) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Violation Predicate
          </h2>
          {detailLoading && !detail ? (
            <div className="h-24 rounded-lg bg-muted animate-pulse" />
          ) : detail?.predicate_test_dql ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                {detail.predicate_type && (
                  <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-400">
                    {PREDICATE_LABEL[detail.predicate_type] ?? detail.predicate_type}
                  </span>
                )}
                {detail.predicate_threshold && (
                  <span className="text-xs text-muted-foreground">
                    Threshold: <span className="font-medium text-foreground">{detail.predicate_threshold}</span>
                  </span>
                )}
                {detail.predicate_tolerance_seconds != null && (
                  <span className="text-xs text-muted-foreground">
                    Tolerance: <span className="font-medium text-foreground">{detail.predicate_tolerance_seconds}s</span>
                  </span>
                )}
              </div>
              <DqlBlock dql={detail.predicate_test_dql} label="Test DQL — evaluated against replacement service" />
            </div>
          ) : null}
        </section>
      )}

      {/* ── Evidence ── */}
      {(detail?.evidence?.length || detailLoading) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-teal-400" />
            Evidence from Learning Window
          </h2>
          {detailLoading && !detail ? (
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-muted animate-pulse" />
              <div className="h-16 rounded-lg bg-muted animate-pulse" />
            </div>
          ) : (
            <div className="space-y-4">
              {detail?.evidence?.map((ev, i) => (
                <EvidenceItem key={i} ev={ev} index={i} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Downstream dependents ── */}
      {detail?.downstream_dependents && detail.downstream_dependents.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Downstream Dependents</h2>
          <div className="flex flex-wrap gap-2">
            {detail.downstream_dependents.map((dep) => (
              <span key={dep} className="rounded-lg border border-border bg-muted/30 px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
                {dep}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── Violation history ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-400" />
          Violation History
          {relatedGhosts.length > 0 && (
            <span className="ml-1 text-muted-foreground font-normal">({relatedGhosts.length})</span>
          )}
        </h2>
        {relatedGhosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/30 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">No violations recorded for this contract.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {relatedGhosts.map((g) => (
              <GhostCard key={g.report_id} report={g} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
