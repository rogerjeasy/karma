"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bot,
  Code2,
  Ghost,
  Loader2,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { useAdminData } from "@/lib/admin-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatCard } from "./components/StatCard";
import { ServiceCard } from "./components/ServiceCard";
import { AddServiceDialog } from "./components/AddServiceDialog";
import { ObservabilityPanel } from "./components/ObservabilityPanel";
import { InvestigationEnginePanel } from "./components/InvestigationEnginePanel";
import { AgentObservabilityPanel } from "./components/AgentObservabilityPanel";
import { DemoRunPanel } from "@/components/DemoRunPanel";

type Tab = "infrastructure" | "observability" | "investigation" | "agents";

const TABS: { id: Tab; label: string; icon?: string }[] = [
  { id: "infrastructure",  label: "Infrastructure" },
  { id: "observability",   label: "Platform Observability" },
  { id: "investigation",   label: "AI Investigation" },
  { id: "agents",          label: "Coding Agents" },
];

export default function AdminPage() {
  const { isAdmin, loading: profileLoading } = useUserProfile();
  const router = useRouter();

  const {
    services, stats, observability,
    serviceDetails, loading: loadingData, loadingObs,
    refresh, addService, removeService,
  } = useAdminData();

  const [tab, setTab]     = useState<Tab>("infrastructure");
  const [addOpen, setAddOpen] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profileLoading && !isAdmin) router.replace("/dashboard");
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
            <RefreshCw
              className={cn("h-3.5 w-3.5", (loadingData || loadingObs) && "animate-spin")}
            />
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
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-background text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.id === "investigation" && <Bot   className="h-3.5 w-3.5 text-cyan-400" />}
            {t.id === "agents"        && <Code2 className="h-3.5 w-3.5 text-violet-400" />}
            {t.label}
          </button>
        ))}
      </div>

      {/* Infrastructure tab */}
      {tab === "infrastructure" && (
        <>
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

          {/* Demo quick-start */}
          <DemoRunPanel />

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
                  onDelete={(id) => { removeService(id); refresh(); }}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Observability tab */}
      {tab === "observability" && (
        <ObservabilityPanel data={observability} loading={loadingObs} />
      )}

      {/* Investigation tab */}
      {tab === "investigation" && <InvestigationEnginePanel />}

      {/* Coding Agents tab */}
      {tab === "agents" && <AgentObservabilityPanel />}

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
