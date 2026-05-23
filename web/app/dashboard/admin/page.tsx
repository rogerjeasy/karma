"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Server,
  Ghost,
  Users,
  Activity,
  Plus,
  Loader2,
  ExternalLink,
  RefreshCw,
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
import type { SystemService, AdminStats } from "@/lib/types";

const PHASE_COLORS: Record<string, string> = {
  registered: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  learning:   "bg-blue-500/20  text-blue-300  border-blue-500/30",
  ready:      "bg-violet-500/20 text-violet-300 border-violet-500/30",
  haunting:   "bg-primary/20   text-primary   border-primary/30",
  completed:  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  error:      "bg-red-500/20   text-red-300   border-red-500/30",
};

export default function AdminPage() {
  const { isAdmin, loading: profileLoading } = useUserProfile();
  const router = useRouter();

  const [services, setServices] = useState<SystemService[]>([]);
  const [stats, setStats]       = useState<AdminStats | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [addOpen, setAddOpen]   = useState(false);

  useEffect(() => {
    if (!profileLoading && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [isAdmin, profileLoading, router]);

  async function fetchData() {
    setLoadingData(true);
    const [svcs, st] = await Promise.all([
      apiFetch<SystemService[]>("/admin/system-services").catch(() => []),
      apiFetch<AdminStats>("/admin/stats").catch(() => null),
    ]);
    setServices(Array.isArray(svcs) ? svcs : []);
    setStats(st);
    setLoadingData(false);
  }

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin]);

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

      {/* System services table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Karma Infrastructure Services
          </h2>
          <span className="text-xs text-muted-foreground">
            {services.length} service{services.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loadingData ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : services.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <Server className="h-8 w-8 opacity-30" />
            <p className="text-sm">No system services registered yet.</p>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              Register first service
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {services.map((svc) => (
              <ServiceRow key={svc.service_id} service={svc} />
            ))}
          </div>
        )}
      </div>

      <AddServiceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(svc) => {
          setServices((prev) => [svc, ...prev]);
          setAddOpen(false);
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

function ServiceRow({ service }: { service: SystemService }) {
  const phaseClass = PHASE_COLORS[service.phase] ?? PHASE_COLORS.registered;
  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-accent/30 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{service.service_name}</p>
        {service.description && (
          <p className="text-xs text-muted-foreground truncate">{service.description}</p>
        )}
        <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">
          {service.dynatrace_entity_id}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize",
          phaseClass,
        )}
      >
        {service.phase}
      </span>
      {service.url && (
        <a
          href={service.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
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
        service_name: form.service_name.trim(),
        dynatrace_entity_id: form.dynatrace_entity_id.trim(),
        replacement_service_id: form.replacement_service_id.trim() || null,
        description: form.description.trim() || null,
        url: form.url.trim() || null,
      };
      const created = await apiFetch<SystemService>("/admin/system-services", {
        method: "POST",
        body: JSON.stringify(body),
      });
      onCreated(created);
      setForm({ service_name: "", dynatrace_entity_id: "", replacement_service_id: "", description: "", url: "" });
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
            Add a Karma infrastructure service for self-monitoring.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="svc-name">Service name *</Label>
            <Input
              id="svc-name"
              placeholder="Karma API"
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
              placeholder="FastAPI gateway for Karma"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-url">
              Cloud Run URL
              <span className="ml-1 text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="svc-url"
              placeholder="https://karma-api-…run.app"
              value={form.url}
              onChange={(e) => update("url", e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
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
