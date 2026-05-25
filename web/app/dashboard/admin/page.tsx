"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  ExternalLink,
  Eye,
  FileCode2,
  Ghost,
  GitCommit,
  GitPullRequest,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
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
  InvestigationEngineData,
  PlatformObservability,
  SystemService,
  UserInvestigationStats,
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

  const [tab, setTab]                   = useState<"infrastructure" | "observability" | "investigation">("infrastructure");
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
        {(["infrastructure", "observability", "investigation"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              tab === t
                ? "bg-background text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "investigation" && <Bot className="h-3.5 w-3.5 text-cyan-400" />}
            {t === "infrastructure" ? "Infrastructure" : t === "observability" ? "Platform Observability" : "AI Investigation"}
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

      {tab === "investigation" && (
        <InvestigationEnginePanel />
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

// ── AI Investigation Engine Panel ─────────────────────────────────────────────

const SEV_BAR_COLORS: Record<ViolationSeverity, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-500",
  medium:   "bg-amber-500",
  low:      "bg-zinc-500",
};

const SEV_TEXT_COLORS: Record<ViolationSeverity, string> = {
  critical: "text-red-400",
  high:     "text-orange-400",
  medium:   "text-amber-400",
  low:      "text-zinc-400",
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.0001) return `$${n.toFixed(6)}`;
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(4)}`;
}

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function SeverityBar({
  breakdown,
  total,
  compact = false,
}: {
  breakdown: Record<ViolationSeverity, number>;
  total: number;
  compact?: boolean;
}) {
  if (total === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const sevs: ViolationSeverity[] = ["critical", "high", "medium", "low"];
  return (
    <div className={cn("flex flex-col gap-1", compact ? "w-28" : "w-full")}>
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        {sevs.map((s) => {
          const pct = (breakdown[s] / total) * 100;
          return pct > 0 ? (
            <div
              key={s}
              className={cn("rounded-full", SEV_BAR_COLORS[s])}
              style={{ width: `${pct}%` }}
              title={`${s}: ${breakdown[s]}`}
            />
          ) : null;
        })}
      </div>
      {!compact && (
        <div className="flex gap-2 flex-wrap">
          {sevs.map((s) =>
            breakdown[s] > 0 ? (
              <span key={s} className={cn("text-[10px] font-medium", SEV_TEXT_COLORS[s])}>
                {s[0].toUpperCase()}: {breakdown[s]}
              </span>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

function UserRow({
  user,
  expanded,
  onToggle,
}: {
  user: UserInvestigationStats;
  expanded: boolean;
  onToggle: () => void;
}) {
  const total = user.total_reports;
  const enrichPct = total > 0 ? Math.round((user.davis_enriched_count / total) * 100) : 0;
  const initials = userInitials(user.display_name || user.email || user.user_id);
  const totalTokens = user.total_input_tokens + user.total_output_tokens;

  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors text-left"
      >
        {/* Avatar */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/20 text-[11px] font-bold text-cyan-300">
          {initials}
        </div>

        {/* Name / email */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{user.display_name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{user.email || user.user_id}</p>
        </div>

        {/* Reports badge */}
        <div className="hidden sm:flex shrink-0 items-center gap-1.5 min-w-[60px] justify-end">
          <Ghost className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm font-semibold tabular-nums text-foreground">{total}</span>
        </div>

        {/* Cost */}
        <div className="hidden md:block shrink-0 min-w-[80px] text-right">
          <p className="text-xs text-muted-foreground">Cost</p>
          <p className="text-sm font-semibold tabular-nums text-emerald-400">
            {formatCost(user.total_cost_usd)}
          </p>
        </div>

        {/* Tokens */}
        <div className="hidden lg:block shrink-0 min-w-[70px] text-right">
          <p className="text-xs text-muted-foreground">Tokens</p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {formatTokens(totalTokens)}
          </p>
        </div>

        {/* Davis AI */}
        <div className="hidden lg:flex shrink-0 flex-col items-end min-w-[60px] gap-0.5">
          <p className="text-xs text-muted-foreground">Davis AI</p>
          <div className="flex items-center gap-1">
            {enrichPct === 100 ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            ) : enrichPct === 0 ? (
              <XCircle className="h-3 w-3 text-muted-foreground" />
            ) : (
              <div className="h-3 w-3 rounded-full border-2 border-amber-400" />
            )}
            <span className={cn(
              "text-xs font-semibold tabular-nums",
              enrichPct === 100 ? "text-emerald-400" : enrichPct > 0 ? "text-amber-400" : "text-muted-foreground",
            )}>
              {enrichPct}%
            </span>
          </div>
        </div>

        {/* Severity bar */}
        <div className="hidden xl:block shrink-0 w-28">
          <SeverityBar breakdown={user.severity_breakdown} total={total} compact />
        </div>

        {/* Last report */}
        <div className="hidden sm:flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground min-w-[80px] justify-end">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {user.last_report_at
              ? formatDistanceToNow(new Date(user.last_report_at), { addSuffix: true })
              : "—"}
          </span>
        </div>

        {/* Expand icon */}
        <div className="shrink-0 text-muted-foreground ml-1">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-4 bg-muted/10 border-t border-border/30">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-4">
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ghost Reports</p>
              <p className="text-lg font-bold text-foreground">{total}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Spend</p>
              <p className="text-lg font-bold text-emerald-400">{formatCost(user.total_cost_usd)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Input Tokens</p>
              <p className="text-lg font-bold text-foreground">{formatTokens(user.total_input_tokens)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Output Tokens</p>
              <p className="text-lg font-bold text-foreground">{formatTokens(user.total_output_tokens)}</p>
            </div>
          </div>

          {total > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Severity Distribution</p>
              <SeverityBar breakdown={user.severity_breakdown} total={total} />
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <div>
                <p className="text-[10px] text-muted-foreground">Davis AI Enriched</p>
                <p className="text-sm font-semibold text-emerald-400">
                  {user.davis_enriched_count} / {total}
                  {total > 0 && <span className="ml-1 text-xs opacity-70">({enrichPct}%)</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/8 px-3 py-2">
              <Bot className="h-3.5 w-3.5 text-cyan-400" />
              <div>
                <p className="text-[10px] text-muted-foreground">Model</p>
                <p className="text-sm font-semibold text-cyan-400">Gemini 2.5 Pro</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InvestigationEnginePanel() {
  const [data, setData]       = useState<InvestigationEngineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState("");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await apiFetch<InvestigationEngineData>("/admin/investigation-engine");
        if (!cancelled) setData(result);
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error).message ?? "Failed to load investigation data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.users;
    return data.users.filter(
      (u) =>
        u.display_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.user_id.toLowerCase().includes(q),
    );
  }, [data, search]);

  function toggleUser(uid: string) {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
            <Bot className="absolute inset-0 m-auto h-3.5 w-3.5 text-cyan-300" />
          </div>
          <p className="text-sm text-muted-foreground">Loading investigation data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-red-500/20 bg-card">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { aggregate: agg } = data;
  const enrichPct = agg.total_reports > 0
    ? Math.round((agg.davis_enriched_count / agg.total_reports) * 100)
    : 0;
  const totalTokens = agg.total_input_tokens + agg.total_output_tokens;

  return (
    <div className="space-y-6">
      {/* ── Header card ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 via-card to-violet-950/30 p-5">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-violet-500/5 blur-3xl" />

        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/25">
              <Bot className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">AI Investigation Engine</h2>
              <p className="text-xs text-muted-foreground">
                Autonomous forensic analysis · Vertex AI · Gemini 2.5 Pro
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-medium text-emerald-400">Active</span>
          </div>
        </div>

        {/* KPI cards */}
        <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border/60 bg-background/40 backdrop-blur-sm px-4 py-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Ghost className="h-3.5 w-3.5" />
              <span className="text-[11px]">Ghost Reports</span>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{agg.total_reports}</p>
          </div>

          <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 backdrop-blur-sm px-4 py-3">
            <div className="flex items-center gap-1.5 text-emerald-400/70 mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="text-[11px]">Total Spend</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400 tabular-nums">{formatCost(agg.total_cost_usd)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Gemini 2.5 Pro</p>
          </div>

          <div className="rounded-lg border border-cyan-500/25 bg-cyan-950/20 backdrop-blur-sm px-4 py-3">
            <div className="flex items-center gap-1.5 text-cyan-400/70 mb-1">
              <Zap className="h-3.5 w-3.5" />
              <span className="text-[11px]">Tokens Consumed</span>
            </div>
            <p className="text-2xl font-bold text-cyan-400 tabular-nums">{formatTokens(totalTokens)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              ↑ {formatTokens(agg.total_input_tokens)} · ↓ {formatTokens(agg.total_output_tokens)}
            </p>
          </div>

          <div className="rounded-lg border border-violet-500/25 bg-violet-950/20 backdrop-blur-sm px-4 py-3">
            <div className="flex items-center gap-1.5 text-violet-400/70 mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-[11px]">Davis AI Enriched</span>
            </div>
            <p className="text-2xl font-bold text-violet-400 tabular-nums">{enrichPct}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {agg.davis_enriched_count} / {agg.total_reports} reports
            </p>
          </div>
        </div>

        {/* Aggregate severity bar */}
        {agg.total_reports > 0 && (
          <div className="relative mt-4 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Platform Severity Distribution
            </p>
            <div className="flex h-2 overflow-hidden rounded-full gap-px bg-muted/20">
              {(["critical", "high", "medium", "low"] as ViolationSeverity[]).map((s) => {
                const pct = (agg.severity_breakdown[s] / agg.total_reports) * 100;
                return pct > 0 ? (
                  <div
                    key={s}
                    className={cn("transition-all", SEV_BAR_COLORS[s])}
                    style={{ width: `${pct}%` }}
                    title={`${s}: ${agg.severity_breakdown[s]}`}
                  />
                ) : null;
              })}
            </div>
            <div className="flex flex-wrap gap-3">
              {(["critical", "high", "medium", "low"] as ViolationSeverity[]).map((s) =>
                agg.severity_breakdown[s] > 0 ? (
                  <div key={s} className="flex items-center gap-1">
                    <div className={cn("h-2 w-2 rounded-full", SEV_BAR_COLORS[s])} />
                    <span className={cn("text-[11px] font-medium capitalize", SEV_TEXT_COLORS[s])}>
                      {s}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {agg.severity_breakdown[s]}
                    </span>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Per-user breakdown ─────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/10">
          <div className="flex items-center gap-2 flex-1">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold text-foreground">
              Per-User Forensics
            </span>
            <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
              {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-52 rounded-md border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
            />
          </div>
        </div>

        {/* Column headers */}
        {filteredUsers.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-2 bg-muted/5 border-b border-border/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <div className="w-8 shrink-0" />
            <div className="flex-1">User</div>
            <div className="hidden sm:block shrink-0 min-w-[60px] text-right">Reports</div>
            <div className="hidden md:block shrink-0 min-w-[80px] text-right">Cost</div>
            <div className="hidden lg:block shrink-0 min-w-[70px] text-right">Tokens</div>
            <div className="hidden lg:block shrink-0 min-w-[60px] text-right">Davis AI</div>
            <div className="hidden xl:block shrink-0 w-28">Severity</div>
            <div className="hidden sm:block shrink-0 min-w-[80px] text-right">Last Report</div>
            <div className="w-4 shrink-0" />
          </div>
        )}

        {/* User rows */}
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
            {search ? (
              <>
                <Search className="h-6 w-6 opacity-30" />
                <p className="text-sm">No users match &ldquo;{search}&rdquo;</p>
              </>
            ) : (
              <>
                <Bot className="h-6 w-6 opacity-30" />
                <p className="text-sm">No forensic investigations have run yet.</p>
                <p className="text-xs">Ghost reports appear here after the Watcher detects violations.</p>
              </>
            )}
          </div>
        ) : (
          <div>
            {filteredUsers.map((user) => (
              <UserRow
                key={user.user_id}
                user={user}
                expanded={expandedUsers.has(user.user_id)}
                onToggle={() => toggleUser(user.user_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
