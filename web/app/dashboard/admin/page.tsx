"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Eye,
  FileCode2,
  Ghost,
  GitCommit,
  GitPullRequest,
  Loader2,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Timer,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { useAdminData, type ServiceDetail } from "@/lib/admin-context";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type {
  ContractCategory,
  PlatformObservability,
  SystemService,
  ViolationSeverity,
} from "@/lib/types";

// ── Display constants ──────────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  registered: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  learning:   "bg-blue-500/20  text-blue-300  border-blue-500/30",
  ready:      "bg-violet-500/20 text-violet-300 border-violet-500/30",
  haunting:   "bg-primary/20   text-primary   border-primary/30",
  completed:  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  error:      "bg-red-500/20   text-red-300   border-red-500/30",
};

const SEVERITY_CFG: Record<ViolationSeverity, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-red-500/20 text-red-400 border-red-500/40" },
  high:     { label: "High",     cls: "bg-orange-500/20 text-orange-400 border-orange-500/40" },
  medium:   { label: "Medium",   cls: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
  low:      { label: "Low",      cls: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
};

const CATEGORY_COLORS: Partial<Record<ContractCategory, string>> = {
  side_effect:     "text-red-400",
  latency:         "text-blue-400",
  error_semantics: "text-orange-400",
  throughput:      "text-teal-400",
  dependency:      "text-violet-400",
  timing:          "text-amber-400",
  sequencing:      "text-cyan-400",
  resource:        "text-pink-400",
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { isAdmin, loading: profileLoading } = useUserProfile();
  const router = useRouter();

  const {
    services, stats, observability,
    serviceDetails, loading: loadingData, loadingObs,
    refresh, addService,
  } = useAdminData();

  const [tab, setTab]                   = useState<"infrastructure" | "observability">("infrastructure");
  const [addOpen, setAddOpen]           = useState(false);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profileLoading && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [isAdmin, profileLoading, router]);

  function toggleExpanded(serviceId: string) {
    setExpandedServices((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  }

  if (profileLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/25">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">
              Karma self-monitoring — infrastructure services
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loadingData || loadingObs}
            className="gap-2"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", (loadingData || loadingObs) && "animate-spin")} />
            Refresh
          </Button>
          {tab === "infrastructure" && (
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Register Service
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1 w-fit">
        {(["infrastructure", "observability"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize",
              tab === t
                ? "bg-background text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "infrastructure" ? "Infrastructure" : "Platform Observability"}
          </button>
        ))}
      </div>

      {tab === "infrastructure" && (
        <>
          {/* Stats cards */}
          {stats && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                icon={<Users className="h-4 w-4 text-blue-400" />}
                label="Total Users"
                value={stats.total_users}
                color="blue"
              />
              <StatCard
                icon={<Server className="h-4 w-4 text-violet-400" />}
                label="System Services"
                value={stats.total_system_services}
                color="violet"
              />
              <StatCard
                icon={<Activity className="h-4 w-4 text-primary" />}
                label="Haunting"
                value={stats.system_services_haunting}
                color="primary"
              />
              <StatCard
                icon={<Ghost className="h-4 w-4 text-red-400" />}
                label="Ghost Reports"
                value={stats.system_ghost_reports}
                color="red"
              />
            </div>
          )}

          {/* Service detail cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Karma Infrastructure Services
              </h2>
              <span className="text-xs text-muted-foreground">
                {services.length} service{services.length !== 1 ? "s" : ""}
              </span>
            </div>

            {loadingData ? (
              <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-card">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : services.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground rounded-xl border border-border bg-card">
                <Server className="h-8 w-8 opacity-30" />
                <p className="text-sm">No system services registered yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddOpen(true)}
                  className="gap-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Register first service
                </Button>
              </div>
            ) : (
              services.map((svc) => (
                <ServiceCard
                  key={svc.service_id}
                  service={svc}
                  detail={serviceDetails[svc.service_id]}
                  expanded={expandedServices.has(svc.service_id)}
                  onToggle={() => toggleExpanded(svc.service_id)}
                  onRefresh={refresh}
                />
              ))
            )}
          </div>
        </>
      )}

      {tab === "observability" && (
        <ObservabilityPanel data={observability} loading={loadingObs} />
      )}

      <AddServiceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(svc) => {
          addService(svc);
          setAddOpen(false);
        }}
      />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

// ── Platform Observability Panel ──────────────────────────────────────────────

const PHASE_SIGNAL_COLORS: Record<string, string> = {
  registered: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  learning:   "bg-blue-500/20  text-blue-300  border-blue-500/30",
  ready:      "bg-violet-500/20 text-violet-300 border-violet-500/30",
  haunting:   "bg-primary/20   text-primary   border-primary/30",
  completed:  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  error:      "bg-red-500/20   text-red-300   border-red-500/30",
};

function ObservabilityPanel({
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
      {/* ── Session Activity ─────────────────────────────────────────── */}
      <ObsSection
        icon={<Activity className="h-4 w-4 text-primary" />}
        title="Session Activity"
        color="primary"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Total Runs" value={sa.total_watcher_runs} />
          <MiniStat label="Last 24 h" value={sa.runs_last_24h} />
          <MiniStat label="Last 7 d" value={sa.runs_last_7d} />
          <MiniStat label="Total Violations" value={sa.total_violations_found} accent="red" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">{sa.total_users}</span>
            <span>registered users</span>
          </div>
          {sa.avg_duration_seconds != null && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Timer className="h-3.5 w-3.5" />
              <span className="font-semibold text-foreground">
                {sa.avg_duration_seconds.toFixed(1)}s
              </span>
              <span>avg watcher duration</span>
            </div>
          )}
        </div>
        {Object.keys(sa.services_by_phase).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(sa.services_by_phase).map(([phase, count]) => (
              <span
                key={phase}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium border capitalize",
                  PHASE_SIGNAL_COLORS[phase] ?? PHASE_SIGNAL_COLORS.registered,
                )}
              >
                {phase} · {count}
              </span>
            ))}
          </div>
        )}
      </ObsSection>

      {/* ── Engineering Metrics ──────────────────────────────────────── */}
      <ObsSection
        icon={<GitCommit className="h-4 w-4 text-violet-400" />}
        title="Engineering Metrics"
        color="violet"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <MiniStat label="Deployments" value={em.total_deployments} />
          <MiniStat label="Commits" value={em.total_commits} />
          <MiniStat label="PRs Merged" value={em.total_prs} />
          <MiniStat label="Lines Added" value={em.total_lines_added} accent="emerald" />
          <MiniStat label="Lines Removed" value={em.total_lines_removed} accent="red" />
        </div>

        {em.recent_deployments.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Recent Deployments
            </p>
            <div className="rounded-lg border border-border overflow-hidden">
              {em.recent_deployments.map((dep, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-3 text-xs hover:bg-muted/20 transition-colors border-b border-border/40 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{dep.service_name}</p>
                    <p className="text-muted-foreground font-mono text-[10px] truncate">
                      {dep.github_repo}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 tabular-nums">
                    <span className="flex items-center gap-1 text-slate-300">
                      <GitCommit className="h-3 w-3" />
                      {dep.commits}
                    </span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <GitPullRequest className="h-3 w-3" />
                      {dep.pull_requests}
                    </span>
                    <span className="text-emerald-400">+{dep.lines_added}</span>
                    <span className="text-red-400">-{dep.lines_removed}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(dep.deployed_at), { addSuffix: true })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {em.total_deployments === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Git metrics appear here after a service cutover with a GitHub token configured.
          </p>
        )}
      </ObsSection>

      {/* ── OTel Pipeline ───────────────────────────────────────────── */}
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

function ObsSection({
  icon,
  title,
  color,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  const border: Record<string, string> = {
    primary: "border-primary/20",
    violet:  "border-violet-500/20",
    amber:   "border-amber-500/20",
  };
  return (
    <div className={cn("rounded-xl border bg-card p-5 space-y-3", border[color])}>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function MiniStat({
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

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  const bg: Record<string, string> = {
    blue:    "bg-blue-500/8 border-blue-500/20",
    violet:  "bg-violet-500/8 border-violet-500/20",
    primary: "bg-primary/8 border-primary/20",
    red:     "bg-red-500/8 border-red-500/20",
  };
  return (
    <div className={cn("rounded-xl border p-4 flex flex-col gap-2", bg[color])}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-2xl font-bold text-foreground">{value}</span>
    </div>
  );
}

function ServiceCard({
  service,
  detail,
  expanded,
  onToggle,
  onRefresh,
}: {
  service: SystemService;
  detail: ServiceDetail | undefined;
  expanded: boolean;
  onToggle: () => void;
  onRefresh?: () => void;
}) {
  const phaseClass = PHASE_COLORS[service.phase] ?? PHASE_COLORS.registered;
  const isLoading  = detail?.loading ?? true;

  const [actionBusy, setActionBusy]     = useState(false);
  const [actionMsg,  setActionMsg]      = useState<{text: string; ok: boolean} | null>(null);
  const [replId,     setReplId]         = useState(service.dynatrace_entity_id);

  async function triggerLearn() {
    setActionBusy(true);
    setActionMsg(null);
    try {
      await apiFetch(`/admin/system-services/${service.service_id}/learn`, { method: "POST" });
      setActionMsg({ text: "Learning started — phase will update shortly.", ok: true });
      onRefresh?.();
    } catch (e: unknown) {
      setActionMsg({ text: (e as Error).message ?? "Failed to start learning", ok: false });
    } finally {
      setActionBusy(false);
    }
  }

  async function triggerCutover() {
    if (!replId.trim()) return;
    setActionBusy(true);
    setActionMsg(null);
    try {
      await apiFetch(`/admin/system-services/${service.service_id}/cutover`, {
        method: "POST",
        body: JSON.stringify({ replacement_service_id: replId.trim() }),
      });
      setActionMsg({ text: "Haunting activated — watcher will run on next cycle.", ok: true });
      onRefresh?.();
    } catch (e: unknown) {
      setActionMsg({ text: (e as Error).message ?? "Failed to activate haunting", ok: false });
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-4 flex items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 mt-0.5">
          <Server className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{service.service_name}</p>
            <span
              className={cn(
                "shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize",
                phaseClass,
              )}
            >
              {service.phase}
            </span>
            <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-amber-500/10 text-amber-400 border-amber-500/25">
              System
            </span>
          </div>
          {service.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{service.description}</p>
          )}
          <p className="text-[11px] text-slate-500 font-mono mt-1 truncate">
            {service.dynatrace_entity_id}
          </p>
        </div>

        {/* Inline stat badges */}
        <div className="flex items-center gap-2 shrink-0">
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <div className="flex items-center gap-1.5">
              <CountBadge
                icon={<FileCode2 className="h-3 w-3 text-teal-400" />}
                count={detail!.contracts.length}
                label="contracts"
                colorClass="border-teal-500/20 bg-teal-500/5"
              />
              <CountBadge
                icon={<Ghost className="h-3 w-3 text-red-400" />}
                count={detail!.ghosts.length}
                label="ghost reports"
                colorClass="border-red-500/20 bg-red-500/5"
              />
              <CountBadge
                icon={<Eye className="h-3 w-3 text-blue-400" />}
                count={detail!.watcherRuns.length}
                label="watcher runs"
                colorClass="border-blue-500/20 bg-blue-500/5"
              />
            </div>
          )}

          {service.url && (
            <a
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              title="Open Cloud Run URL"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          <Link
            href={`/dashboard/services/${service.service_id}`}
            className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View
            <ArrowRight className="h-3 w-3" />
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title={expanded ? "Collapse" : "Expand observability detail"}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border/60">
          {isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {/* Actions panel */}
              {(service.phase === "registered" || service.phase === "error" || service.phase === "ready") && (
                <div className="px-5 py-3 bg-muted/10 flex flex-col gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Actions</p>
                  <div className="flex flex-wrap items-start gap-3">
                    {(service.phase === "registered" || service.phase === "error") && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={triggerLearn} disabled={actionBusy}>
                        {actionBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                        Start Learning
                      </Button>
                    )}
                    {service.phase === "ready" && (
                      <div className="flex items-center gap-2">
                        <input
                          className="h-7 rounded border border-border bg-background px-2 text-xs font-mono text-foreground w-56"
                          placeholder="Replacement entity ID (SERVICE-…)"
                          value={replId}
                          onChange={(e) => setReplId(e.target.value)}
                        />
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={triggerCutover} disabled={actionBusy || !replId.trim()}>
                          {actionBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
                          Activate Haunting
                        </Button>
                      </div>
                    )}
                  </div>
                  {actionMsg && (
                    <p className={`text-xs ${actionMsg.ok ? "text-emerald-400" : "text-red-400"}`}>
                      {actionMsg.text}
                    </p>
                  )}
                </div>
              )}
              {/* Ghost Reports */}
              <DetailSection
                icon={<Ghost className="h-3.5 w-3.5 text-red-400" />}
                title="Ghost Reports"
                count={detail!.ghosts.length}
                emptyText={
                  service.phase === "registered" || service.phase === "learning"
                    ? "No ghost reports yet — the watcher runs after cutover."
                    : "No ghost reports for this service."
                }
              >
                {detail!.ghosts.map((g) => {
                  const sev = SEVERITY_CFG[g.severity] ?? SEVERITY_CFG.medium;
                  return (
                    <div
                      key={g.report_id}
                      className="flex items-start gap-3 px-5 py-3 hover:bg-muted/20 transition-colors"
                    >
                      <span
                        className={cn(
                          "mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          sev.cls,
                        )}
                      >
                        {sev.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-300 leading-snug">{g.summary}</p>
                        {g.root_cause && (
                          <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                            {g.root_cause}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 text-[10px] text-slate-400">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(g.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  );
                })}
              </DetailSection>

              {/* Contracts */}
              <DetailSection
                icon={<FileCode2 className="h-3.5 w-3.5 text-teal-400" />}
                title="Discovered Contracts"
                count={detail!.contracts.length}
                emptyText="No contracts discovered yet — learning phase required."
              >
                {detail!.contracts.map((c) => (
                  <div
                    key={c.contract_id}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <span
                      className={cn(
                        "mt-px shrink-0 text-[10px] font-bold uppercase tracking-wide w-24 truncate",
                        CATEGORY_COLORS[c.category as ContractCategory] ?? "text-muted-foreground",
                      )}
                    >
                      {c.category.replace(/_/g, " ")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 leading-snug">{c.description}</p>
                      {c.subcategory && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{c.subcategory}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "text-[11px] font-mono tabular-nums",
                          c.confidence >= 0.9
                            ? "text-emerald-400"
                            : c.confidence >= 0.7
                              ? "text-amber-400"
                              : "text-muted-foreground",
                        )}
                      >
                        {(c.confidence * 100).toFixed(0)}%
                      </span>
                      {c.validated && (
                        <span className="text-[10px] text-emerald-400 border border-emerald-500/30 rounded-full px-1.5 py-px">
                          validated
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </DetailSection>

              {/* Watcher Runs */}
              <DetailSection
                icon={<Eye className="h-3.5 w-3.5 text-blue-400" />}
                title="Watcher Run History"
                count={detail!.watcherRuns.length}
                emptyText="No watcher runs yet — runs after cutover to haunting phase."
              >
                {detail!.watcherRuns.map((run) => {
                  const hasViolations = run.violations_found > 0;
                  return (
                    <div
                      key={run.run_id}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-muted/20 transition-colors"
                    >
                      <div className="shrink-0">
                        {hasViolations ? (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10 border border-red-500/25">
                            <XCircle className="h-3.5 w-3.5 text-red-400" />
                          </div>
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/25">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-300">
                        <ShieldCheck className="h-3 w-3 shrink-0" />
                        <span className="tabular-nums">{run.contracts_checked}</span>
                        <span className="text-slate-400">checked</span>
                      </div>
                      <div
                        className={cn(
                          "flex items-center gap-1 text-xs",
                          hasViolations ? "text-red-400" : "text-emerald-400/70",
                        )}
                      >
                        <Ghost className="h-3 w-3 shrink-0" />
                        <span className="tabular-nums font-medium">{run.violations_found}</span>
                        <span className="opacity-70">
                          violation{run.violations_found !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {run.duration_seconds != null && (
                        <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400">
                          <Timer className="h-3 w-3" />
                          <span className="tabular-nums">{run.duration_seconds.toFixed(1)}s</span>
                        </div>
                      )}
                      <div className="ml-auto flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(run.run_at), { addSuffix: true })}
                      </div>
                    </div>
                  );
                })}
              </DetailSection>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CountBadge({
  icon,
  count,
  label,
  colorClass,
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
  colorClass: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-md border px-2 py-1",
        colorClass,
      )}
      title={`${count} ${label}`}
    >
      {icon}
      <span className="text-xs font-semibold tabular-nums text-foreground">{count}</span>
    </div>
  );
}

function DetailSection({
  icon,
  title,
  count,
  emptyText,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  emptyText: string;
  children?: React.ReactNode;
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

function AddServiceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (svc: SystemService) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [form, setForm]     = useState({
    service_name: "",
    dynatrace_entity_id: "",
    replacement_service_id: "",
    description: "",
    url: "",
  });

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        service_name:           form.service_name.trim(),
        dynatrace_entity_id:    form.dynatrace_entity_id.trim(),
        replacement_service_id: form.replacement_service_id.trim() || null,
        description:            form.description.trim() || null,
        url:                    form.url.trim() || null,
      };
      const created = await apiFetch<SystemService>("/admin/system-services", {
        method: "POST",
        body: JSON.stringify(body),
      });
      onCreated(created);
      setForm({
        service_name: "",
        dynatrace_entity_id: "",
        replacement_service_id: "",
        description: "",
        url: "",
      });
    } catch (err: unknown) {
      setError((err as Error).message ?? "Failed to register service");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Register System Service</DialogTitle>
          <DialogDescription>
            Add a Karma infrastructure service for self-monitoring. The Dynatrace
            entity ID appears in the Services screen (SERVICE-…) once OTel traces
            are flowing.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="svc-name">Service name *</Label>
            <Input
              id="svc-name"
              placeholder="Karma Agent System"
              value={form.service_name}
              onChange={(e) => update("service_name", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-dt-id">Dynatrace entity ID *</Label>
            <Input
              id="svc-dt-id"
              placeholder="SERVICE-XXXXXXXXXXXXXXXXX"
              value={form.dynatrace_entity_id}
              onChange={(e) => update("dynatrace_entity_id", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-repl-id">
              Replacement entity ID
              <span className="ml-1 text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="svc-repl-id"
              placeholder="SERVICE-XXXXXXXXXXXXXXXXX"
              value={form.replacement_service_id}
              onChange={(e) => update("replacement_service_id", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-desc">
              Description
              <span className="ml-1 text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="svc-desc"
              placeholder="Multi-agent coordinator — Learner, Watcher, Forensic"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-url">
              Service URL
              <span className="ml-1 text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="svc-url"
              placeholder="https://karma-api-…run.app"
              value={form.url}
              onChange={(e) => update("url", e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Registering…" : "Register"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
