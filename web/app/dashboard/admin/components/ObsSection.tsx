import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const BORDER: Record<string, string> = {
  primary: "border-primary/20",
  violet:  "border-violet-500/20",
  amber:   "border-amber-500/20",
};

export function ObsSection({
  icon,
  title,
  color,
  children,
}: {
  icon: ReactNode;
  title: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 space-y-3", BORDER[color])}>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}
