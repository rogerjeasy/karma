import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CountBadge({
  icon,
  count,
  label,
  colorClass,
}: {
  icon: ReactNode;
  count: number;
  label: string;
  colorClass: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-1 rounded-md border px-2 py-1", colorClass)}
      title={`${count} ${label}`}
    >
      {icon}
      <span className="text-xs font-semibold tabular-nums text-foreground">{count}</span>
    </div>
  );
}
