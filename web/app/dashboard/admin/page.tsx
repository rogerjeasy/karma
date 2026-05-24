"use client";

import { useCallback, useEffect, useState } from "react";
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
  Loader2,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Timer,
  Users,
  XCircle,
} from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
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
  AdminStats,
  ContractCategory,
  ContractResponse,
  GhostReport,
  SystemService,
  ViolationSeverity,
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

// ── Types ──────────────────────────────────────────────────────────────────────

type ServiceDetail = {
  contracts: ContractResponse[];
  ghosts: GhostReport[];
  watcherRuns: WatcherRun[];
  loading: boolean;
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { isAdmin, loading: profileLoading } = useUserProfile();
  const router = useRouter();

  const [services, setServices]         = useState<SystemService[]>([]);
  const [stats, setStats]               = useState<AdminStats | null>(null);
  const [loadingData, setLoadingData]   = useState(true);
  const [addOpen, setAddOpen]           = useState(false);
  const [serviceDetails, setServiceDetails] = useState<Record<string, ServiceDetail>>({});
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profileLoading && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [isAdmin, profileLoading, router]);

  const loadServiceDetails = useCallback(async (svcList: SystemService[]) => {
    const init: Record<string, ServiceDetail> = {};
    for (const svc of svcList) {
      init[svc.service_id] = { contracts: [], ghosts: [], watcherRuns: [], loading: true };
    }
    setServiceDetails(init);

    await Promise.all(
      svcList.map(async (svc) => {
        const id   = svc.service_id;
        const base = `/admin/system-services/${id}`;
        const [contracts, ghosts, watcherRuns] = await Promise.all([
          apiFetch<ContractResponse[]>(`${base}/contracts`).catch(() => [] as ContractResponse[]),
          apiFetch<GhostReport[]>(`${base}/ghosts`).catch(() => [] as GhostReport[]),
          apiFetch<WatcherRun[]>(`${base}/watcher-runs`).catch(() => [] as WatcherRun[]),
        ]);
        setServiceDetails((prev) => ({
          ...prev,
          [id]: {
            contracts:   Array.isArray(contracts)   ? contracts   : [],
            ghosts:      Array.isArray(ghosts)      ? ghosts      : [],
            watcherRuns: Array.isArray(watcherRuns) ? watcherRuns : [],
            loading: false,
          },
        }));
      }),
    );
  }, []);

  async function fetchData() {
    setLoadingData(true);
    const [svcs, st] = await Promise.all([
      apiFetch<SystemService[]>("/admin/system-services").catch(() => []),
      apiFetch<AdminStats>("/admin/stats").catch(() => null),
    ]);
    const svcList = Array.isArray(svcs) ? svcs : [];
    setServices(svcList);
    setStats(st);
    setLoadingData(false);
    if (svcList.length > 0) loadServiceDetails(svcList);
  }

  useEffect(() => {
    if (isAdmin) fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

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
            onClick={fetchData}
            disabled={loadingData}
            className="gap-2"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loadingData && "animate-spin")} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Register Service
          </Button>
        </div>
      </div>

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
            />
          ))
        )}
      </div>

      <AddServiceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(svc) => {
          setServices((prev) => [svc, ...prev]);
          setAddOpen(false);
          loadServiceDetails([svc]);
        }}
      />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
}: {
  service: SystemService;
  detail: ServiceDetail | undefined;
  expanded: boolean;
  onToggle: () => void;
}) {
  const phaseClass = PHASE_COLORS[service.phase] ?? PHASE_COLORS.registered;
  const isLoading  = detail?.loading ?? true;

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
