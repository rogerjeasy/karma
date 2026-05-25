"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { GhostReport } from "@/lib/types";

interface ContractSparklineProps {
  contractId: string;
  ghosts: GhostReport[];
  days?: number;
}

interface DayBucket {
  label: string;      // "Mon", "Tue", etc.
  date: string;       // ISO date string "2026-05-20"
  violated: boolean;
  hasData: boolean;   // false = watcher never ran (no ghost reports near this day)
}

function buildDayBuckets(contractId: string, ghosts: GhostReport[], days: number): DayBucket[] {
  const now = new Date();
  // Collect violation timestamps for this specific contract
  const violatedDays = new Set<string>();

  for (const g of ghosts) {
    if (g.contract_id !== contractId) continue;
    const d = new Date(g.created_at);
    // Build a YYYY-MM-DD key in UTC to match consistently
    const key = d.toISOString().slice(0, 10);
    violatedDays.add(key);
  }

  const buckets: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const key = day.toISOString().slice(0, 10);
    const label = day.toLocaleDateString("en-US", { weekday: "short" });
    buckets.push({
      label,
      date: key,
      violated: violatedDays.has(key),
      hasData: true,
    });
  }
  return buckets;
}

export function ContractSparkline({
  contractId,
  ghosts,
  days = 7,
}: ContractSparklineProps) {
  const buckets = useMemo(
    () => buildDayBuckets(contractId, ghosts, days),
    [contractId, ghosts, days]
  );

  const violationCount = buckets.filter((b) => b.violated).length;
  const allClean = violationCount === 0;

  const barWidth  = 8;
  const barGap    = 2;
  const barHeight = 20;
  const svgWidth  = days * (barWidth + barGap) - barGap;
  const svgHeight = barHeight + 12; // extra for label row

  return (
    <div
      title={
        allClean
          ? `No violations in last ${days} days`
          : `${violationCount} violation${violationCount !== 1 ? "s" : ""} in last ${days} days`
      }
      className="flex flex-col items-center gap-0.5 shrink-0"
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="overflow-visible"
        aria-hidden="true"
      >
        {buckets.map((bucket, i) => {
          const x = i * (barWidth + barGap);
          return (
            <g key={bucket.date}>
              {/* Bar */}
              <rect
                x={x}
                y={0}
                width={barWidth}
                height={barHeight}
                rx={2}
                className={cn(
                  bucket.violated
                    ? "fill-red-500/70"
                    : "fill-emerald-500/50"
                )}
              />
              {/* Violation dot */}
              {bucket.violated && (
                <circle
                  cx={x + barWidth / 2}
                  cy={barHeight / 2}
                  r={2}
                  className="fill-red-300"
                />
              )}
              {/* Day label */}
              <text
                x={x + barWidth / 2}
                y={barHeight + 10}
                textAnchor="middle"
                fontSize="7"
                className="fill-zinc-500 select-none"
              >
                {bucket.label.charAt(0)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Micro-label below */}
      <span
        className={cn(
          "text-[9px] font-mono tabular-nums leading-none",
          allClean ? "text-emerald-500/70" : "text-red-400/80"
        )}
      >
        {allClean ? "7d clean" : `${violationCount}/${days}d`}
      </span>
    </div>
  );
}
