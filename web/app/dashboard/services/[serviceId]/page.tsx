"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FileCode2,
  Ghost,
  Loader2,
  Server,
  ShieldCheck,
  Timer,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useUserProfile } from "@/lib/user-profile-context";
import { apiFetch } from "@/lib/api";
import { ContractTimeline } from "@/components/ContractTimeline";
import { GhostCard } from "@/components/GhostCard";
import { MigrationReadinessScore } from "@/components/MigrationReadinessScore";
import { ContractRadarChart } from "@/components/ContractRadarChart";
import type {
  CategoryCompliance,
  ContractResponse,
  GhostReport,
  MigrationReadiness,
  ServiceResponse,
  SystemService,
  WatcherRun,
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

// ── Page ──────────────────────────────────────────────────────────────────────

type AnyService = ServiceResponse | SystemService;

export default function ServiceDetailPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const searchParams = useSearchParams();
  const isSystemParam = searchParams.get("system") === "true";
  const { isAdmin, loading: profileLoading } = useUserProfile();

  const [service, setService]       = useState<AnyService | null>(null);
  const [isSystem, setIsSystem]     = useState(false);
  const [contracts, setContracts]   = useState<ContractResponse[]>([]);
  const [ghosts, setGhosts]         = useState<GhostReport[]>([]);
  const [watcherRuns, setWatcherRuns] = useState<WatcherRun[]>([]);
  const [loading, setLoading]       = useState(true);
  const [notFound, setNotFound]     = useState(false);

  useEffect(() => {
    if (profileLoading) return;

    async function load() {
      setLoading(true);
      setNotFound(false);

      let svc: AnyService | null = null;
      let system = false;

      if (isSystemParam && isAdmin) {
        svc = await apiFetch<SystemService>(
          `/admin/system-services/${serviceId}`
        ).catch(() => null);
        system = !!svc;
      } else {
        svc = await apiFetch<ServiceResponse>(
          `/services/${serviceId}`
        ).catch(() => null);
        if (!svc && isAdmin) {
          svc = await apiFetch<SystemService>(
            `/admin/system-services/${serviceId}`
          ).catch(() => null);
          system = !!svc;
        }
      }

      if (!svc) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setService(svc);
      setIsSystem(system);

      const base         = system ? `/admin/system-services/${serviceId}` : "";
      const contractsUrl = system ? `${base}/contracts`                    : `/contracts/${serviceId}`;
      const ghostsUrl    = system ? `${base}/ghosts`                       : `/ghosts?service_id=${serviceId}`;
      const runsUrl      = system ? `${base}/watcher-runs`                 : `/services/${serviceId}/watcher-runs`;

      const [c, g, w] = await Promise.all([
        apiFetch<ContractResponse[]>(contractsUrl).catch(() => [] as ContractResponse[]),
        apiFetch<GhostReport[]>(ghostsUrl).catch(() => [] as GhostReport[]),
        apiFetch<WatcherRun[]>(runsUrl).catch(() => [] as WatcherRun[]),
      ]);

      setContracts(Array.isArray(c) ? c : []);
      setGhosts(Array.isArray(g) ? g : []);
      setWatcherRuns(Array.isArray(w) ? w : []);
      setLoading(false);
    }

    load();
  }, [serviceId, isAdmin, isSystemParam, profileLoading]);

  if (profileLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <Server className="h-8 w-8 opacity-30" />
        <p className="text-sm">Service not found.</p>
        <Link href="/dashboard/services">
          <Button variant="outline" size="sm">Back to services</Button>
        </Link>
      </div>
    );
  }

  if (!service) return null;

  const phase      = service.phase;
  const phaseClass = PHASE_COLORS[phase] ?? PHASE_COLORS.registered;
  const sysSvc     = isSystem ? (service as SystemService) : null;
  const backHref   = isSystem ? "/dashboard/admin" : "/dashboard/services";
  const backLabel  = isSystem ? "Admin" : "Services";

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href={backHref}
          className="hover:text-foreground transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium truncate">{service.service_name}</span>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30">
            <Server className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-foreground">{service.service_name}</h1>
              <span className={cn(
                "shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize",
                phaseClass,
              )}>
                {phase}
              </span>
              {isSystem && (
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-amber-500/10 text-amber-400 border-amber-500/25">
                  System
                </span>
              )}
            </div>
            {sysSvc?.description && (
              <p className="text-sm text-muted-foreground mt-1">{sysSvc.description}</p>
            )}
            <p className="text-xs text-slate-400 font-mono mt-1.5">
              {service.dynatrace_entity_id}
            </p>
            {"deprecation_date" in service && service.deprecation_date && (
              <p className="text-xs text-slate-400 mt-0.5">
                Deprecation: {new Date(service.deprecation_date).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        {sysSvc?.url && (
          <a
            href={sysSvc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Cloud Run
          </a>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<FileCode2 className="h-4 w-4 text-teal-400" />}
          label="Contracts"
          value={contracts.length}
          colorClass="border-teal-500/20"
        />
        <StatCard
          icon={<Ghost className="h-4 w-4 text-red-400" />}
          label="Ghost Reports"
          value={ghosts.length}
          colorClass="border-red-500/20"
        />
        <StatCard
          icon={<Eye className="h-4 w-4 text-blue-400" />}
          label="Watcher Runs"
          value={watcherRuns.length}
          colorClass="border-blue-500/20"
        />
      </div>

      {/* ── Migration Readiness + Radar (shown when learning is complete) ── */}
      {(phase === "haunting" || phase === "ready" || phase === "completed") && contracts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <MigrationReadinessScore serviceId={serviceId} isSystem={isSystem} />
          <ReadinessRadarBridge serviceId={serviceId} />
        </div>
      )}

      {/* Ghost reports */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Ghost className="h-4 w-4 text-red-400" />
          <h2 className="text-sm font-semibold text-foreground">Ghost Reports</h2>
          <span className="ml-auto text-xs text-muted-foreground">{ghosts.length} total</span>
        </div>
        {ghosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-card flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
            <Ghost className="h-6 w-6 opacity-30" />
            <p className="text-sm text-center px-8">
              {phase === "registered" || phase === "learning"
                ? "No ghost reports yet — the watcher runs after cutover."
                : "No ghost reports for this service."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {ghosts.map((g) => (
              <GhostCard key={g.report_id} report={g} />
            ))}
          </div>
        )}
      </div>

      {/* Contracts */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <FileCode2 className="h-4 w-4 text-teal-400" />
          <h2 className="text-sm font-semibold text-foreground">Discovered Contracts</h2>
          <span className="ml-auto text-xs text-muted-foreground">{contracts.length} total</span>
        </div>
        <ContractTimeline contracts={contracts} ghosts={ghosts} />
      </div>

      {/* Watcher runs */}
      {watcherRuns.length > 0 && (
        <Section
          icon={<Eye className="h-4 w-4 text-blue-400" />}
          title="Watcher Run History"
          count={watcherRuns.length}
        >
          {watcherRuns.map((run) => {
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
                <div className={cn(
                  "flex items-center gap-1 text-xs",
                  hasViolations ? "text-red-400" : "text-emerald-400/70",
                )}>
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
        </Section>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * Fetches MigrationReadiness data and passes the breakdown to the radar chart.
 * Keeps the service detail page clean by co-locating the data-fetch with the display.
 */
function ReadinessRadarBridge({ serviceId }: { serviceId: string }) {
  const [breakdown, setBreakdown] = useState<CategoryCompliance[]>([]);
  const [loaded, setLoaded]       = useState(false);

  useEffect(() => {
    apiFetch<MigrationReadiness>(`/services/${serviceId}/readiness`)
      .then((d) => { setBreakdown(d.category_breakdown); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [serviceId]);

  if (!loaded) return null;
  return <ContractRadarChart breakdown={breakdown} />;
}

function StatCard({
  icon,
  label,
  value,
  colorClass = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  colorClass?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 flex flex-col gap-1.5", colorClass || "border-border")}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Section({
  icon,
  title,
  count,
  emptyIcon,
  emptyText,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  emptyIcon?: React.ReactNode;
  emptyText?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
        {icon}
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="ml-auto text-xs text-muted-foreground">{count} total</span>
      </div>
      {count === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
          {emptyIcon}
          <p className="text-sm text-center px-8">{emptyText ?? `No ${title.toLowerCase()} yet.`}</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">{children}</div>
      )}
    </div>
  );
}
