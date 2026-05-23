"use client";

import Link from "next/link";
import type { Route } from "next";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Clock, Ghost } from "lucide-react";
import type { ContractCategory, ContractResponse, GhostReport, ViolationSeverity } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BeforeAfterTimelineProps {
  contracts: ContractResponse[];
  ghosts: GhostReport[];
  oldServiceName: string;
  newServiceName: string;
}

const CATEGORY_LABEL: Record<ContractCategory, string> = {
  latency:         "Latency",
  error_semantics: "Error semantics",
  throughput:      "Throughput",
  side_effect:     "Side effect",
  timing:          "Timing",
  dependency:      "Dependency",
  resource:        "Resource",
  sequencing:      "Sequencing",
};

const CATEGORY_COLOR: Record<ContractCategory, string> = {
  side_effect:     "bg-violet-500/15 text-violet-400  border-violet-500/30",
  error_semantics: "bg-red-500/15    text-red-400     border-red-500/30",
  latency:         "bg-amber-500/15  text-amber-400   border-amber-500/30",
  throughput:      "bg-blue-500/15   text-blue-400    border-blue-500/30",
  timing:          "bg-orange-500/15 text-orange-400  border-orange-500/30",
  dependency:      "bg-indigo-500/15 text-indigo-400  border-indigo-500/30",
  resource:        "bg-cyan-500/15   text-cyan-400    border-cyan-500/30",
  sequencing:      "bg-teal-500/15   text-teal-400    border-teal-500/30",
};

const SEVERITY_CONFIG: Record<ViolationSeverity, { label: string; class: string }> = {
  critical: { label: "Critical", class: "bg-red-500/20    text-red-400    border-red-500/40"    },
  high:     { label: "High",     class: "bg-orange-500/20 text-orange-400 border-orange-500/40" },
  medium:   { label: "Medium",   class: "bg-amber-500/20  text-amber-400  border-amber-500/40"  },
  low:      { label: "Low",      class: "bg-zinc-500/20   text-zinc-400   border-zinc-500/30"   },
};

const CATEGORY_PRIORITY: ContractCategory[] = [
  "side_effect", "error_semantics", "latency",
  "throughput", "timing", "dependency", "resource", "sequencing",
];

export function BeforeAfterTimeline({
  contracts,
  ghosts,
  oldServiceName,
  newServiceName,
}: BeforeAfterTimelineProps) {
  // Map contract_id → ghost reports (one contract can have multiple violations over time)
  const ghostsByContract = new Map<string, GhostReport[]>();
  for (const g of ghosts) {
    const existing = ghostsByContract.get(g.contract_id) ?? [];
    ghostsByContract.set(g.contract_id, [...existing, g]);
  }

  const sorted = [...contracts].sort((a, b) => {
    const pa = CATEGORY_PRIORITY.indexOf(a.category);
    const pb = CATEGORY_PRIORITY.indexOf(b.category);
    if (pa !== pb) return pa - pb;
    // Violated contracts surface first within the same category.
    const aViolated = ghostsByContract.has(a.contract_id) ? 0 : 1;
    const bViolated = ghostsByContract.has(b.contract_id) ? 0 : 1;
    if (aViolated !== bViolated) return aViolated - bViolated;
    return b.confidence - a.confidence;
  });

  if (contracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/30 px-6 py-16 text-center">
        <Ghost className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <p className="text-sm font-medium">No contracts to compare</p>
        <p className="mt-1 text-xs text-slate-300 max-w-xs">
          Run learning on the deprecated service to discover contracts before comparing.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* ── Column headers ── */}
      <div className="grid grid-cols-2 divide-x divide-border bg-muted/30">
        <div className="px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            Before — deprecated
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground truncate">{oldServiceName}</p>
        </div>
        <div className="px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            After — replacement
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground truncate">{newServiceName}</p>
        </div>
      </div>

      {/* ── Rows ── */}
      <div className="divide-y divide-border/60">
        {sorted.map((contract) => {
          const violations = ghostsByContract.get(contract.contract_id) ?? [];
          const isViolated = violations.length > 0;
          return (
            <div
              key={contract.contract_id}
              className={cn(
                "grid grid-cols-2 divide-x divide-border/60 transition-colors",
                isViolated && "bg-red-500/[0.03]"
              )}
            >
              {/* LEFT — learned contract */}
              <ContractCell contract={contract} />

              {/* RIGHT — replacement service status */}
              <StatusCell violations={violations} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContractCell({ contract }: { contract: ContractResponse }) {
  const colorClass = CATEGORY_COLOR[contract.category] ?? "bg-muted/30 text-muted-foreground border-border";
  return (
    <Link
      href={`/dashboard/contracts/${contract.contract_id}` as Route}
      className="block px-5 py-4 space-y-2 hover:bg-muted/20 transition-colors"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn(
          "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0",
          colorClass
        )}>
          {CATEGORY_LABEL[contract.category] ?? contract.category.replace("_", " ")}
        </span>
        {contract.subcategory && (
          <span className="text-[10px] text-slate-400">{contract.subcategory}</span>
        )}
        <span className="ml-auto text-[10px] text-slate-400 tabular-nums shrink-0">
          {Math.round(contract.confidence * 100)}% conf.
        </span>
      </div>
      <p className="text-xs text-slate-300 leading-snug line-clamp-3">
        {contract.description}
      </p>
    </Link>
  );
}

function StatusCell({
  violations,
}: {
  violations: GhostReport[];
}) {
  if (violations.length === 0) {
    return (
      <div className="px-5 py-4 flex items-start gap-2.5">
        <CheckCircle2 className="h-4 w-4 text-emerald-500/70 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-emerald-400/80">No violation detected</p>
          <p className="mt-0.5 text-[11px] text-slate-400 leading-snug">
            Replacement honours this contract.
          </p>
        </div>
      </div>
    );
  }

  // Show the most recent / most severe violation
  const latest = violations.sort((a, b) => {
    const severityOrder: ViolationSeverity[] = ["critical", "high", "medium", "low"];
    const sa = severityOrder.indexOf(a.severity);
    const sb = severityOrder.indexOf(b.severity);
    if (sa !== sb) return sa - sb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  })[0];

  const sev = SEVERITY_CONFIG[latest.severity] ?? SEVERITY_CONFIG.medium;
  const ago = formatDistanceToNow(new Date(latest.created_at), { addSuffix: true });

  return (
    <div className="px-5 py-4 space-y-2">
      <div className="flex items-center gap-2">
        {/* Ghost pulse indicator */}
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <span className="text-xs font-semibold text-red-400">Ghost detected</span>
        <span className={cn(
          "ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0",
          sev.class
        )}>
          {sev.label}
        </span>
      </div>

      <p className="text-xs text-slate-300 leading-snug line-clamp-3">
        {latest.summary}
      </p>

      {latest.downstream_impact && latest.downstream_impact !== "not confirmed" && (
        <p className="text-[11px] text-orange-400/80 leading-snug line-clamp-2">
          Impact: {latest.downstream_impact}
        </p>
      )}

      <div className="flex items-center gap-1 text-[10px] text-slate-400">
        <Clock className="h-3 w-3" />
        <span>{ago}</span>
        {violations.length > 1 && (
          <span className="ml-1">· {violations.length} occurrences</span>
        )}
      </div>
    </div>
  );
}
