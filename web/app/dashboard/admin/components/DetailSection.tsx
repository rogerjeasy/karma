import type { ReactNode } from "react";

export function DetailSection({
  icon,
  title,
  count,
  emptyText,
  children,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  emptyText: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-5 py-2.5 bg-muted/20">
        {icon}
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">{count} total</span>
      </div>
      {count === 0 ? (
        <div className="flex items-center justify-center h-16 px-5">
          <p className="text-xs text-muted-foreground text-center">{emptyText}</p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">{children}</div>
      )}
    </div>
  );
}
