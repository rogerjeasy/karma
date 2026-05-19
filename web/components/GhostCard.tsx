import { ExternalLink, ArrowRight, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { GhostReport, ViolationSeverity } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface GhostCardProps {
  report: GhostReport;
}

const SEVERITY_CONFIG: Record<
  ViolationSeverity,
  { variant: "ghost" | "warning" | "destructive" | "critical"; bar: string; glow: string }
> = {
  low:      { variant: "ghost",       bar: "bg-zinc-500",    glow: "" },
  medium:   { variant: "warning",     bar: "bg-amber-400",   glow: "" },
  high:     { variant: "destructive", bar: "bg-red-400",     glow: "" },
  critical: { variant: "critical",    bar: "bg-red-500",     glow: "shadow-[0_0_18px_-4px_hsl(0_72%_51%/0.45)]" },
};

export function GhostCard({ report }: GhostCardProps) {
  const cfg = SEVERITY_CONFIG[report.severity] ?? SEVERITY_CONFIG.medium;

  return (
    <article
      className={cn(
        "group relative rounded-xl border border-border bg-card overflow-hidden",
        "transition-all duration-200 hover:border-border/70 hover:shadow-card-hover hover:-translate-y-px",
        cfg.glow
      )}
    >
      {/* ── Severity accent bar ── */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", cfg.bar)} />

      <div className="pl-5 pr-5 pt-4 pb-4 space-y-3">
        {/* ── Top row ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Badge variant={cfg.variant} className="shrink-0 uppercase text-[10px] tracking-wider">
              {report.severity}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">{report.category}</span>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <span className="text-[11px] text-muted-foreground/70 font-mono">
              #{report.contract_id.slice(0, 8)}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground/60">
            <Clock className="h-3 w-3" />
            <time>{formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}</time>
          </div>
        </div>

        {/* ── Summary ── */}
        <p className="text-sm font-semibold text-foreground leading-snug">{report.summary}</p>

        {/* ── Impact ── */}
        {report.downstream_impact && (
          <p className="text-sm text-muted-foreground leading-relaxed">{report.downstream_impact}</p>
        )}

        {/* ── Remediation suggestions ── */}
        {report.remediation_suggestions.length > 0 && (
          <div className="space-y-1.5 rounded-lg bg-muted/40 border border-border/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
              Remediation
            </p>
            {report.remediation_suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/70" />
                <span className="text-muted-foreground leading-relaxed">{s}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Evidence links ── */}
        {report.evidence_links.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {report.evidence_links.map((link, i) => (
              <a
                key={i}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-mono transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                evidence [{i + 1}]
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
