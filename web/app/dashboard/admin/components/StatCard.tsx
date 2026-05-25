import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const BG: Record<string, string> = {
  blue:    "bg-blue-500/8 border-blue-500/20",
  violet:  "bg-violet-500/8 border-violet-500/20",
  primary: "bg-primary/8 border-primary/20",
  red:     "bg-red-500/8 border-red-500/20",
};

export function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={cn("rounded-xl border p-4 flex flex-col gap-2", BG[color])}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-2xl font-bold text-foreground">{value}</span>
    </div>
  );
}
