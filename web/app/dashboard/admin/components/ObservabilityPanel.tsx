import { Activity, CheckCircle2, GitCommit, Loader2, XCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { ObsSection } from "./ObsSection";
import { MiniStat } from "./MiniStat";
import { RecentDeploymentsTable } from "./RecentDeploymentsTable";
import { SessionActivityCard } from "./SessionActivityCard";
import type { PlatformObservability } from "@/lib/types";

export function ObservabilityPanel({
  data,
  loading,
}: {
  data: PlatformObservability | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-card">
        <p className="text-sm text-muted-foreground">Failed to load observability data.</p>
      </div>
    );
  }

  const { session_activity: sa, engineering_metrics: em, otel_pipeline: otel } = data;

  return (
    <div className="space-y-6">
      {/* Session Activity */}
      <ObsSection
        icon={<Activity className="h-4 w-4 text-primary" />}
        title="Session Activity"
        color="primary"
      >
        <SessionActivityCard sa={sa} />
      </ObsSection>

      {/* Engineering Metrics */}
      <ObsSection
        icon={<GitCommit className="h-4 w-4 text-violet-400" />}
        title="Engineering Metrics"
        color="violet"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <MiniStat label="Deployments"   value={em.total_deployments} />
          <MiniStat label="Commits"       value={em.total_commits} />
          <MiniStat label="PRs Merged"    value={em.total_prs} />
          <MiniStat label="Lines Added"   value={em.total_lines_added}   accent="emerald" />
          <MiniStat label="Lines Removed" value={em.total_lines_removed} accent="red" />
        </div>
        <RecentDeploymentsTable deployments={em.recent_deployments} />
      </ObsSection>

      {/* OTel Pipeline */}
      <ObsSection
        icon={<Zap className="h-4 w-4 text-amber-400" />}
        title="OTel Pipeline"
        color="amber"
      >
        <div className="flex flex-wrap gap-3">
          {(["traces", "metrics", "logs"] as const).map((signal) => (
            <div
              key={signal}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-3",
                otel[signal]
                  ? "border-emerald-500/25 bg-emerald-500/8"
                  : "border-red-500/25 bg-red-500/8",
              )}
            >
              {otel[signal] ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              )}
              <span className="text-sm font-medium capitalize text-foreground">{signal}</span>
            </div>
          ))}
        </div>
        {otel.dt_env && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Dynatrace environment:</span>
            <span className="font-mono text-foreground bg-muted/40 px-2 py-0.5 rounded">
              {otel.dt_env}
            </span>
          </div>
        )}
        {!otel.configured && (
          <p className="mt-3 text-xs text-red-400">
            DT_OTEL_TOKEN is not set — traces, metrics, and logs are not exported to Dynatrace.
          </p>
        )}
      </ObsSection>
    </div>
  );
}
