"use client";

import { useEffect, useState } from "react";
import { Plus, Server, Calendar, Clock, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ServiceRegistration, ServiceResponse, ServicePhase } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceResponse[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/services`)
      .then((r) => {
        if (!r.ok) throw new Error(`API error ${r.status}`);
        return r.json();
      })
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch((err) => setFetchError(err instanceof Error ? err.message : "Failed to load services."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Services</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage deprecated services under observation and track their replacement status.
          </p>
        </div>
        <Button className="gap-2 self-start sm:self-auto sm:shrink-0" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Register service
        </Button>
      </div>

      {/* ── Registration dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Register a service</DialogTitle>
            <DialogDescription>
              Add a service slated for deprecation. Karma will begin learning its implicit contracts during the observation window.
            </DialogDescription>
          </DialogHeader>
          <RegistrationForm
            onSuccess={(svc) => {
              setServices((prev) => [svc, ...prev]);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── Content ── */}
      {loading ? (
        <ServiceGridSkeleton />
      ) : fetchError ? (
        <ErrorBanner message={fetchError} />
      ) : services.length === 0 ? (
        <EmptyState onRegister={() => setOpen(true)} />
      ) : (
        <ServiceGrid services={services} />
      )}
    </div>
  );
}

/* ── Registration form ─────────────────────────────────────── */
function RegistrationForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (s: ServiceResponse) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ServiceRegistration>({
    service_name: "",
    dynatrace_entity_id: "",
    deprecation_date: "",
    learning_window_days: 14,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function field(key: keyof ServiceRegistration) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: key === "learning_window_days" ? Number(e.target.value) : e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.text();
        const ct   = res.headers.get("content-type") ?? "";
        throw new Error(ct.includes("html") ? `Server error ${res.status}` : body);
      }
      onSuccess(await res.json());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.startsWith("<!") ? "Could not reach the API server." : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service name" hint="e.g. svc-payments-v2">
          <Input
            required
            placeholder="svc-payments-v2"
            value={form.service_name}
            onChange={field("service_name")}
          />
        </Field>
        <Field label="Dynatrace entity ID" hint="SERVICE-…">
          <Input
            required
            placeholder="SERVICE-XXXXXXXXXXXXXXXX"
            value={form.dynatrace_entity_id}
            onChange={field("dynatrace_entity_id")}
          />
        </Field>
        <Field label="Deprecation date">
          <Input
            required
            type="date"
            value={form.deprecation_date}
            onChange={field("deprecation_date")}
          />
        </Field>
        <Field label="Learning window" hint="1–30 days">
          <Input
            type="number"
            min={1}
            max={30}
            value={form.learning_window_days}
            onChange={field("learning_window_days")}
          />
        </Field>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="gap-2">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {loading ? "Registering…" : "Register and begin learning"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {hint && <span className="ml-1 text-muted-foreground/60 font-normal">({hint})</span>}
      </Label>
      {children}
    </div>
  );
}

/* ── Loading skeleton ───────────────────────────────────────── */
function ServiceGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-4 animate-pulse">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-28 rounded bg-muted" />
                <div className="h-2.5 w-36 rounded bg-muted" />
              </div>
            </div>
            <div className="h-5 w-16 rounded-full bg-muted" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-40 rounded bg-muted" />
            <div className="h-3 w-32 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Error banner ────────────────────────────────────────────── */
function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────── */
function EmptyState({ onRegister }: { onRegister: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/30 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-card mb-5">
        <Server className="h-6 w-6 text-muted-foreground/50" />
      </div>
      <h3 className="text-base font-semibold text-foreground">No services registered</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs leading-relaxed">
        Register your first service to begin learning its implicit contracts and detect silent regressions.
      </p>
      <Button className="mt-6 gap-2" onClick={onRegister}>
        <Plus className="h-4 w-4" />
        Register a service
      </Button>
    </div>
  );
}

/* ── Service grid ───────────────────────────────────────────── */
function ServiceGrid({ services }: { services: ServiceResponse[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((svc) => (
        <ServiceCard key={svc.service_id} service={svc} />
      ))}
    </div>
  );
}

function ServiceCard({ service: svc }: { service: ServiceResponse }) {
  return (
    <div className="group rounded-xl border border-border bg-card p-5 space-y-4 transition-all duration-200 hover:border-border/70 hover:shadow-card-hover hover:-translate-y-px">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted border border-border">
            <Server className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight truncate">{svc.service_name}</p>
            <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">{svc.dynatrace_entity_id}</p>
          </div>
        </div>
        <PhaseBadge phase={svc.phase} />
      </div>

      {/* Metadata */}
      <div className="space-y-1.5">
        <MetaRow icon={Calendar} label="Deprecation" value={new Date(svc.deprecation_date).toLocaleDateString()} />
        <MetaRow icon={Clock} label="Registered" value={formatDistanceToNow(new Date(svc.created_at), { addSuffix: true })} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border/60">
        <p className="text-[11px] font-mono text-muted-foreground/60 truncate">{svc.service_id.slice(0, 12)}…</p>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100">
          <ExternalLink className="h-3 w-3" />
          Details
        </button>
      </div>
    </div>
  );
}

function MetaRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
      <span className="text-muted-foreground/60">{label}:</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}

/* ── Phase badge ────────────────────────────────────────────── */
const PHASE_CONFIG: Record<ServicePhase, { variant: "ghost" | "warning" | "destructive" | "success"; dot: string; label: string }> = {
  registered: { variant: "ghost",       dot: "bg-zinc-500",    label: "Registered" },
  learning:   { variant: "warning",     dot: "bg-amber-400",   label: "Learning"   },
  haunting:   { variant: "destructive", dot: "bg-red-400",     label: "Haunting"   },
  completed:  { variant: "success",     dot: "bg-emerald-400", label: "Completed"  },
};

function PhaseBadge({ phase }: { phase: ServicePhase }) {
  const cfg = PHASE_CONFIG[phase] ?? PHASE_CONFIG.registered;
  const pulsing = phase === "learning" || phase === "haunting";
  return (
    <Badge variant={cfg.variant} className="shrink-0 gap-1.5">
      <span className="relative flex h-1.5 w-1.5">
        {pulsing && (
          <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping", cfg.dot)} />
        )}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", cfg.dot)} />
      </span>
      {cfg.label}
    </Badge>
  );
}
