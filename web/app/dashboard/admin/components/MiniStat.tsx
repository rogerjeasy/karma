import { cn } from "@/lib/utils";

export function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "red" | "emerald";
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-xl font-bold tabular-nums mt-0.5",
          accent === "red"
            ? "text-red-400"
            : accent === "emerald"
              ? "text-emerald-400"
              : "text-foreground",
        )}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}
