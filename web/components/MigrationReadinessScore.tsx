"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, TrendingUp, DollarSign, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import type { MigrationReadiness, CategoryCompliance } from "@/lib/types";

interface MigrationReadinessScoreProps {
  serviceId: string;
  isSystem?: boolean;
}

// Gauge arc: renders a circular progress arc in SVG
function GaugeArc({ score }: { score: number | null }) {
  const radius = 54;
  const stroke = 10;
  const cx = 70;
  const cy = 70;
  const circumference = Math.PI * radius; // half-circle arc

  const safeScore = score ?? 0;
  const filled = (safeScore / 100) * circumference;
  const empty = circumference - filled;

  const color =
    score === null  ? "stroke-muted"
    : score >= 95   ? "stroke-emerald-400"
    : score >= 80   ? "stroke-teal-400"
    : score >= 60   ? "stroke-amber-400"
    : "stroke-red-400";

  const textColor =
    score === null  ? "text-muted-foreground"
    : score >= 95   ? "text-emerald-400"
    : score >= 80   ? "text-teal-400"
    : score >= 60   ? "text-amber-400"
    : "text-red-400";

  return (
    <div className="relative flex flex-col items-center">
      <svg width="140" height="80" viewBox="0 0 140 80" className="overflow-visible">
        {/* Track */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted/40"
          strokeLinecap="round"
        />
        {/* Progress */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          strokeWidth={stroke}
          className={cn("transition-all duration-700", color)}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${empty}`}
          strokeDashoffset={0}
        />
      </svg>
      {/* Score label */}
      <div className={cn("absolute bottom-0 text-center", textColor)}>
        {score === null ? (
          <span className="text-xl font-bold text-muted-foreground">—</span>
        ) : (
          <span className="text-3xl font-bold tabular-nums">{score.toFixed(0)}</span>
        )}
        <div className="text-[10px] font-medium text-muted-foreground tracking-wide mt-0.5">
          / 100
        </div>
      </div>
    </div>
  );
}

// Category bar: horizontal compliance bar for a single contract category
function CategoryBar({ cat }: { cat: CategoryCompliance }) {
  if (cat.total_contracts === 0) return null;

  const pct = cat.score ?? 0;
  const barColor =
    pct >= 95   ? "bg-emerald-400"
    : pct >= 80 ? "bg-teal-400"
    : pct >= 60 ? "bg-amber-400"
    : "bg-red-400";

  const label = cat.category.replace(/_/g, " ");

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground capitalize font-medium">{label}</span>
        <div className="flex items-center gap-2">
          {cat.violated > 0 && (
            <span className="text-red-400 font-mono">{cat.violated} violated</span>
          )}
          <span className={cn("font-bold tabular-nums", pct >= 80 ? "text-foreground" : "text-amber-400")}>
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function MigrationReadinessScore({ serviceId, isSystem = false }: MigrationReadinessScoreProps) {
  const [data, setData]       = useState<MigrationReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    if (!serviceId) return;
    setLoading(true);
    setError(false);
    apiFetch<MigrationReadiness>(`/services/${serviceId}/readiness`)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [serviceId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-center h-48">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-center h-48">
        <p className="text-sm text-muted-foreground">Readiness score unavailable</p>
      </div>
    );
  }

  const score = data.overall_score;
  const readyIcon =
    score === null     ? null
    : score >= 95      ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
    : score >= 60      ? <TrendingUp className="h-4 w-4 text-amber-400" />
    : <ShieldAlert className="h-4 w-4 text-red-400" />;

  // Only show categories that have at least one contract
  const activeCategories = data.category_breakdown.filter(c => c.total_contracts > 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary shrink-0" />
        <h3 className="text-sm font-semibold text-foreground">Migration Readiness</h3>
      </div>

      {/* Gauge + score */}
      <div className="flex flex-col items-center gap-1">
        <GaugeArc score={score} />
        <div className="flex items-center gap-1.5 mt-1">
          {readyIcon}
          <p className="text-xs text-center text-muted-foreground max-w-[240px] leading-snug">
            {data.recommendation}
          </p>
        </div>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/30 p-2.5">
          <div className="text-lg font-bold text-foreground tabular-nums">{data.total_contracts}</div>
          <div className="text-[10px] text-muted-foreground">contracts</div>
        </div>
        <div className="rounded-lg bg-muted/30 p-2.5">
          <div className={cn(
            "text-lg font-bold tabular-nums",
            data.total_violations_active > 0 ? "text-red-400" : "text-emerald-400"
          )}>
            {data.total_violations_active}
          </div>
          <div className="text-[10px] text-muted-foreground">active violations</div>
        </div>
        <div className="rounded-lg bg-muted/30 p-2.5">
          <div className="text-lg font-bold text-emerald-400 tabular-nums">
            ${(data.avoided_incident_cost_total_usd / 1000).toFixed(0)}k
          </div>
          <div className="text-[10px] text-muted-foreground">avoided costs</div>
        </div>
      </div>

      {/* Per-category compliance bars */}
      {activeCategories.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Category Compliance
          </p>
          {activeCategories.map((cat) => (
            <CategoryBar key={cat.category} cat={cat} />
          ))}
        </div>
      )}

      {activeCategories.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/20 border border-border/60 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-xs text-muted-foreground">
            No contracts discovered yet — run the Learner agent to begin analysis.
          </p>
        </div>
      )}

      {/* Avoided cost detail */}
      {data.avoided_incident_cost_total_usd > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2">
          <DollarSign className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <p className="text-[11px] text-emerald-300 leading-snug">
            Karma detected violations early, avoiding an estimated{" "}
            <span className="font-bold">${data.avoided_incident_cost_total_usd.toLocaleString()}</span>{" "}
            in incident costs across all ghost reports.
          </p>
        </div>
      )}
    </div>
  );
}
