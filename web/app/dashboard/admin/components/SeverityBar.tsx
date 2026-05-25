import { cn } from "@/lib/utils";
import { SEV_BAR_COLORS, SEV_TEXT_COLORS } from "./constants";
import type { ViolationSeverity } from "@/lib/types";

const SEVS: ViolationSeverity[] = ["critical", "high", "medium", "low"];

export function SeverityBar({
  breakdown,
  total,
  compact = false,
}: {
  breakdown: Record<ViolationSeverity, number>;
  total: number;
  compact?: boolean;
}) {
  if (total === 0) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div className={cn("flex flex-col gap-1", compact ? "w-28" : "w-full")}>
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        {SEVS.map((s) => {
          const pct = (breakdown[s] / total) * 100;
          return pct > 0 ? (
            <div
              key={s}
              className={cn("rounded-full", SEV_BAR_COLORS[s])}
              style={{ width: `${pct}%` }}
              title={`${s}: ${breakdown[s]}`}
            />
          ) : null;
        })}
      </div>
      {!compact && (
        <div className="flex gap-2 flex-wrap">
          {SEVS.map((s) =>
            breakdown[s] > 0 ? (
              <span key={s} className={cn("text-[10px] font-medium", SEV_TEXT_COLORS[s])}>
                {s[0].toUpperCase()}: {breakdown[s]}
              </span>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
