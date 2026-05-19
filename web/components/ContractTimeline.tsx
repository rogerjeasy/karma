import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import type { ContractResponse, ContractCategory } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ContractTimelineProps {
  contracts: ContractResponse[];
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

export function ContractTimeline({ contracts }: ContractTimelineProps) {
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
      {/* Vertical line */}
      <div className="absolute left-[19px] top-5 bottom-5 w-px bg-border/60" />

      {sorted.map((contract, index) => (
        <ContractRow
          key={contract.contract_id}
          contract={contract}
          index={index + 1}
          isLast={index === sorted.length - 1}
        />
      ))}
    </div>
  );
}

function ContractRow({
  contract,
  index,
  isLast,
}: {
  contract: ContractResponse;
  index: number;
  isLast: boolean;
}) {
  const isSideEffect = contract.category === "side_effect";
  const categoryClass = CATEGORY_COLORS[contract.category] ?? "bg-muted text-muted-foreground border-border";

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
          "hover:shadow-card-hover hover:-translate-y-px",
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

          {/* Right: confidence + time */}
          <div className="flex items-center gap-3 shrink-0">
            <ConfidenceBar confidence={contract.confidence} />
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(contract.detected_at), { addSuffix: true })}
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="mt-2 text-sm text-foreground leading-relaxed">{contract.description}</p>
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
