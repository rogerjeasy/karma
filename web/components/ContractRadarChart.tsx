"use client";

import { cn } from "@/lib/utils";
import type { CategoryCompliance } from "@/lib/types";

interface ContractRadarChartProps {
  breakdown: CategoryCompliance[];
  className?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  latency:         "Latency",
  error_semantics: "Error Semantics",
  throughput:      "Throughput",
  side_effect:     "Side Effects",
  timing:          "Timing",
  dependency:      "Dependency",
  resource:        "Resource",
  sequencing:      "Sequencing",
};

// The 8 axes are evenly spaced around a circle (every 45°).
// We map category order to axis index for a visually grouped layout.
const AXIS_ORDER = [
  "latency",
  "error_semantics",
  "throughput",
  "side_effect",
  "timing",
  "dependency",
  "resource",
  "sequencing",
];

const N = AXIS_ORDER.length;
const CENTER_X = 120;
const CENTER_Y = 120;
const MAX_RADIUS = 85;
const LABEL_OFFSET = 22;

function polarToCartesian(angle: number, radius: number): [number, number] {
  // angle in radians, 0 = up (12 o'clock), clockwise
  const x = CENTER_X + radius * Math.sin(angle);
  const y = CENTER_Y - radius * Math.cos(angle);
  return [x, y];
}

function axisAngle(index: number): number {
  return (2 * Math.PI * index) / N;
}

function buildPolygonPoints(scores: (number | null)[]): string {
  return scores
    .map((s, i) => {
      const r = ((s ?? 0) / 100) * MAX_RADIUS;
      const [x, y] = polarToCartesian(axisAngle(i), r);
      return `${x},${y}`;
    })
    .join(" ");
}

function buildGridRingPoints(fraction: number): string {
  const r = fraction * MAX_RADIUS;
  return Array.from({ length: N }, (_, i) => {
    const [x, y] = polarToCartesian(axisAngle(i), r);
    return `${x},${y}`;
  }).join(" ");
}

export function ContractRadarChart({ breakdown, className }: ContractRadarChartProps) {
  // Map breakdown to ordered scores
  const scoreMap: Record<string, number | null> = {};
  for (const c of breakdown) {
    scoreMap[c.category] = c.total_contracts > 0 ? (c.score ?? null) : null;
  }

  const scores = AXIS_ORDER.map((cat) => scoreMap[cat] ?? null);
  const hasData = scores.some((s) => s !== null);

  // Build grid rings at 25%, 50%, 75%, 100%
  const gridFractions = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className={cn("rounded-xl border border-border bg-card p-5 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Contract Coverage Radar</h3>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-primary/60" />
            compliance %
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-muted/60" />
            target
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <svg
          width="240"
          height="240"
          viewBox="0 0 240 240"
          className="overflow-visible"
          aria-label="Contract compliance radar chart"
        >
          {/* Grid rings */}
          {gridFractions.map((f) => (
            <polygon
              key={f}
              points={buildGridRingPoints(f)}
              fill="none"
              className={cn(
                f === 1.0 ? "stroke-border/60" : "stroke-border/30",
                "stroke-[0.5]"
              )}
            />
          ))}

          {/* Axis spokes */}
          {AXIS_ORDER.map((_, i) => {
            const [x, y] = polarToCartesian(axisAngle(i), MAX_RADIUS);
            return (
              <line
                key={i}
                x1={CENTER_X}
                y1={CENTER_Y}
                x2={x}
                y2={y}
                className="stroke-border/30 stroke-[0.5]"
              />
            );
          })}

          {/* Compliance polygon */}
          {hasData && (
            <>
              <polygon
                points={buildPolygonPoints(scores)}
                className="fill-primary/15 stroke-primary/60 stroke-[1.5]"
              />
              {/* Data points */}
              {scores.map((s, i) => {
                if (s === null) return null;
                const r = (s / 100) * MAX_RADIUS;
                const [x, y] = polarToCartesian(axisAngle(i), r);
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={3}
                    className="fill-primary stroke-background stroke-[1.5]"
                  />
                );
              })}
            </>
          )}

          {/* No data placeholder polygon */}
          {!hasData && (
            <polygon
              points={buildGridRingPoints(0.05)}
              className="fill-muted/20 stroke-muted/40 stroke-[1]"
            />
          )}

          {/* Percentage ring labels (25%, 50%, 75%) */}
          {[0.25, 0.5, 0.75].map((f) => {
            const [lx, ly] = polarToCartesian(axisAngle(0), f * MAX_RADIUS);
            return (
              <text
                key={f}
                x={lx + 3}
                y={ly - 2}
                className="fill-muted-foreground text-[7px]"
                fontSize="7"
              >
                {Math.round(f * 100)}
              </text>
            );
          })}

          {/* Axis labels */}
          {AXIS_ORDER.map((cat, i) => {
            const angle = axisAngle(i);
            const [bx, by] = polarToCartesian(angle, MAX_RADIUS + LABEL_OFFSET);
            const label = CATEGORY_LABELS[cat] ?? cat;
            const score = scoreMap[cat];

            // Determine text anchor based on position
            const sinA = Math.sin(angle);
            const anchor =
              Math.abs(sinA) < 0.1 ? "middle"
              : sinA > 0           ? "start"
              : "end";

            const lineCount = label.includes(" ") ? 2 : 1;
            const words = label.split(" ");

            const dotColor =
              score === null       ? "fill-muted"
              : score >= 95        ? "fill-emerald-400"
              : score >= 80        ? "fill-teal-400"
              : score >= 60        ? "fill-amber-400"
              : "fill-red-400";

            return (
              <g key={cat}>
                <text
                  x={bx}
                  y={by - (lineCount > 1 ? 5 : 0)}
                  textAnchor={anchor}
                  dominantBaseline="central"
                  fontSize="8"
                  className="fill-muted-foreground font-medium"
                >
                  {lineCount === 1 ? (
                    label
                  ) : (
                    <>
                      <tspan x={bx} dy="0">{words[0]}</tspan>
                      <tspan x={bx} dy="10">{words.slice(1).join(" ")}</tspan>
                    </>
                  )}
                </text>
                {/* Score dot indicator */}
                {score !== null && (
                  <circle
                    cx={bx + (anchor === "start" ? -5 : anchor === "end" ? 5 : 0) * 0}
                    cy={by + (lineCount > 1 ? 8 : 0)}
                    r={2.5}
                    className={dotColor}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend: worst categories */}
      {hasData && (() => {
        const worst = breakdown
          .filter(c => c.total_contracts > 0 && (c.score ?? 100) < 100)
          .sort((a, b) => (a.score ?? 100) - (b.score ?? 100))
          .slice(0, 3);
        if (worst.length === 0) return null;
        return (
          <div className="space-y-1 pt-1 border-t border-border/40">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Needs Attention
            </p>
            {worst.map((c) => (
              <div key={c.category} className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground capitalize">
                  {(CATEGORY_LABELS[c.category] ?? c.category)}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-red-400 font-mono">{c.violated} violations</span>
                  <span className={cn(
                    "font-bold tabular-nums",
                    (c.score ?? 0) >= 60 ? "text-amber-400" : "text-red-400"
                  )}>
                    {(c.score ?? 0).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {!hasData && (
        <p className="text-center text-xs text-muted-foreground py-2">
          No contract data — run the Learner agent to populate the radar.
        </p>
      )}
    </div>
  );
}
