"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import {
  Plus, Server, Calendar, Clock, ExternalLink, Loader2, AlertCircle,
  Copy, Check, Eye, GitMerge, RefreshCw, FileCode2, Trash2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { ServiceRegistration, ServiceResponse, ServicePhase, ContractResponse } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { useDashboardData } from "@/lib/dashboard-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ── Auto-updating relative time ─────────────────────────────── */
function useRelativeTime(dateStr: string): string {
  const compute = () => formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  const [label, setLabel] = useState(compute);
  useEffect(() => {
    const id = setInterval(() => setLabel(compute()), 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr]);
  return label;
}

/* ── Copy-to-clipboard button ────────────────────────────────── */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={copy} className="ml-1.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

/* ── Service Details Dialog ──────────────────────────────────── */
const PHASE_DESC: Record<ServicePhase, string> = {
  registered: "Queued for observation. Learning has not started yet.",
  learning:   "Karma is analysing historical Dynatrace telemetry to discover implicit contracts.",
  ready:      "Learning complete. Contracts have been discovered. Mark cutover when the replacement service is live.",
  haunting:   "Cutover complete. Watcher is monitoring for violations. Auto-completes after 3 consecutive clean runs.",
  completed:  "Migration validated. No further agent runs scheduled.",
  error:      "The last agent run failed. See the error details below and retry.",
};

function ServiceDetailsDialog({
  service,
  onClose,
  onPhaseChange,
  onDeleted,
}: {
  service: ServiceResponse;
  onClose: () => void;
  onPhaseChange: (id: string, phase: ServicePhase, extra?: Partial<ServiceResponse>) => void;
  onDeleted: (id: string) => void;
}) {
  const [contracts, setContracts]         = useState<ContractResponse[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg]         = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Replacement entity ID for cutover form
  const [replacementId, setReplacementId] = useState(service.replacement_service_id ?? "");

  useEffect(() => {
    setContractsLoading(true);
    apiFetch<ContractResponse[]>(`/contracts/${service.service_id}`)
      .then((d) => setContracts(Array.isArray(d) ? d : []))
      .catch(() => setContracts([]))
      .finally(() => setContractsLoading(false));
  }, [service.service_id, service.phase]);

  async function rerunLearning() {
    setActionLoading("learn");
    setActionMsg(null);
    try {
      await apiFetch(`/services/${service.service_id}/learn`, { method: "POST" });
      onPhaseChange(service.service_id, "learning", { error_message: null });
      setActionMsg("Learning job dispatched — contracts will update within a few minutes.");
    } catch (e) {
      setActionMsg(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function markCutover() {
    if (!replacementId.trim()) {
      setActionMsg("Replacement entity ID is required to mark cutover.");
      return;
    }
    setActionLoading("cutover");
    setActionMsg(null);
    try {
      await apiFetch(`/cutover/${service.service_id}`, {
        method: "POST",
        body: JSON.stringify({ replacement_service_id: replacementId.trim() }),
      });
      onPhaseChange(service.service_id, "haunting", {
        replacement_service_id: replacementId.trim(),
      });
      setActionMsg("Cutover recorded. Watcher is now active.");
    } catch (e) {
      setActionMsg(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function runWatcher() {
    setActionLoading("watcher");
    setActionMsg(null);
    try {
      await apiFetch(`/cutover/watchers/run-now`, {
        method: "POST",
        body: JSON.stringify({ service_id: service.service_id }),
      });
      setActionMsg("Watcher dispatched — ghost reports will appear if violations are detected.");
    } catch (e) {
      setActionMsg(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteService() {
    setActionLoading("delete");
    setActionMsg(null);
    try {
      await apiFetch(`/services/${service.service_id}`, { method: "DELETE" });
      onDeleted(service.service_id);
      onClose();
    } catch (e) {
      setActionMsg(`Failed: ${e instanceof Error ? e.message : String(e)}`);
      setConfirmDelete(false);
    } finally {
      setActionLoading(null);
    }
  }

  const registeredAgo = useRelativeTime(service.created_at);
  const updatedAgo    = useRelativeTime(service.updated_at);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted border border-border">
              <Server className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base">{service.service_name}</DialogTitle>
              <DialogDescription className="text-[11px] font-mono mt-0.5">
                {service.service_id}
                <CopyButton value={service.service_id} />
              </DialogDescription>
            </div>
            <div className="ml-auto shrink-0">
              <PhaseBadge phase={service.phase} />
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">

          {/* ── Phase status ── */}
          <div className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            service.phase === "learning"   && "bg-amber-500/8   border-amber-500/20   text-amber-300",
            service.phase === "ready"      && "bg-emerald-500/8 border-emerald-500/20 text-emerald-300",
            service.phase === "haunting"   && "bg-red-500/8     border-red-500/20     text-red-300",
            service.phase === "completed"  && "bg-emerald-500/8 border-emerald-500/20 text-emerald-300",
            service.phase === "registered" && "bg-muted/40      border-border         text-muted-foreground",
            service.phase === "error"      && "bg-destructive/8 border-destructive/30 text-destructive",
          )}>
            {PHASE_DESC[service.phase]}
            {service.phase === "error" && service.error_message && (
              <p className="mt-2 font-mono text-[11px] opacity-80 break-all leading-relaxed">
                {service.error_message}
              </p>
            )}
          </div>

          {/* ── Metadata grid ── */}
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailRow label="Dynatrace entity" value={service.dynatrace_entity_id} mono copy />
            {service.replacement_service_id && (
              <DetailRow label="Replacement entity" value={service.replacement_service_id} mono copy />
            )}
            <DetailRow
              label="Deprecation date"
              value={format(new Date(service.deprecation_date), "PPP")}
            />
            <DetailRow label="Registered" value={registeredAgo} />
            <DetailRow label="Last updated" value={updatedAgo} />
          </div>

          {/* ── Contracts ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileCode2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Contracts discovered
                {!contractsLoading && (
                  <span className="ml-1.5 text-muted-foreground font-normal">({contracts.length})</span>
                )}
              </h3>
            </div>

            {contractsLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading contracts…
              </div>
            ) : contracts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">No contracts discovered yet.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {service.phase === "learning"
                    ? "The Learner agent is running — contracts will appear once analysis completes."
                    : "Trigger learning to discover contracts from Dynatrace telemetry."}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {contracts.map((c) => (
                  <ContractRow key={c.contract_id} contract={c} />
                ))}
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">Actions</h3>

            {/* Learning / registered / ready / error: re-run learning + cutover form */}
            {(service.phase === "learning" || service.phase === "registered" || service.phase === "ready" || service.phase === "error") && (
              <div className="space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={actionLoading === "learn"}
                  onClick={rerunLearning}
                >
                  {actionLoading === "learn"
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <RefreshCw className="h-3.5 w-3.5" />}
                  {service.phase === "error" ? "Retry learning" : "Re-run learning"}
                </Button>

                {/* Cutover form only shown when not in error state */}
                {service.phase !== "error" && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                    <p className="text-xs font-medium text-foreground">Mark cutover</p>
                    <p className="text-xs text-muted-foreground">
                      Signals that the replacement service is live. Activates the Watcher.
                    </p>
                    <div className="flex gap-2 mt-1">
                      <Input
                        placeholder="SERVICE-YYYYYYYYYYYYYYYY (replacement entity ID)"
                        value={replacementId}
                        onChange={(e) => setReplacementId(e.target.value)}
                        className="text-xs h-8 font-mono"
                      />
                      <Button
                        size="sm"
                        className="gap-1.5 shrink-0"
                        disabled={actionLoading === "cutover"}
                        onClick={markCutover}
                      >
                        {actionLoading === "cutover"
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <GitMerge className="h-3.5 w-3.5" />}
                        Cutover
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Haunting: run watcher now */}
            {service.phase === "haunting" && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={actionLoading === "watcher"}
                  onClick={runWatcher}
                >
                  {actionLoading === "watcher"
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Eye className="h-3.5 w-3.5" />}
                  Run watcher now
                </Button>
                <p className="text-[11px] text-muted-foreground/60">
                  Auto-completes after 3 consecutive clean runs with no violations.
                </p>
              </div>
            )}

            {/* Completed */}
            {service.phase === "completed" && (
              <p className="text-xs text-muted-foreground">
                Migration complete. No further actions required.
              </p>
            )}

            {/* Delete service */}
            <div className="border-t border-border/60 pt-3 mt-1">
              {!confirmDelete ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={actionLoading === "delete"}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete service
                </Button>
              ) : (
                <div className="rounded-lg border border-destructive/30 bg-destructive/8 p-3 space-y-2">
                  <p className="text-xs text-destructive font-medium">
                    This will permanently delete the service, all discovered contracts, and all ghost reports. This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1.5 h-7 text-xs"
                      disabled={actionLoading === "delete"}
                      onClick={deleteService}
                    >
                      {actionLoading === "delete"
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />}
                      Yes, delete everything
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={actionLoading === "delete"}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Feedback message */}
            {actionMsg && (
              <p className={cn(
                "text-xs rounded-lg border px-3 py-2 leading-relaxed",
                actionMsg.startsWith("Failed")
                  ? "border-destructive/30 bg-destructive/8 text-destructive"
                  : "border-emerald-500/30 bg-emerald-500/8 text-emerald-400"
              )}>
                {actionMsg}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  label, value, mono = false, copy = false,
}: {
  label: string; value: string; mono?: boolean; copy?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">{label}</p>
      <div className="flex items-center">
        <p className={cn("text-[13px] text-foreground truncate", mono && "font-mono")}>{value}</p>
        {copy && <CopyButton value={value} />}
      </div>
    </div>
  );
}

const CATEGORY_COLOR: Record<string, string> = {
  latency:         "bg-blue-500/15   text-blue-400   border-blue-500/20",
  error_semantics: "bg-red-500/15    text-red-400    border-red-500/20",
  side_effect:     "bg-purple-500/15 text-purple-400 border-purple-500/20",
  throughput:      "bg-cyan-500/15   text-cyan-400   border-cyan-500/20",
  timing:          "bg-amber-500/15  text-amber-400  border-amber-500/20",
  dependency:      "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  resource:        "bg-orange-500/15 text-orange-400 border-orange-500/20",
  sequencing:      "bg-teal-500/15   text-teal-400   border-teal-500/20",
};

function ContractRow({ contract: c }: { contract: ContractResponse }) {
  const colorClass = CATEGORY_COLOR[c.category] ?? "bg-muted/30 text-muted-foreground border-border";
  return (
    <Link
      href={`/dashboard/contracts/${c.contract_id}` as Route}
      className="block rounded-lg border border-border bg-card/50 px-3 py-2.5 space-y-1.5 hover:border-border/70 hover:bg-card transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", colorClass)}>
          {c.category.replace("_", " ")}
        </span>
        {c.subcategory && (
          <span className="text-[10px] text-muted-foreground/60">{c.subcategory}</span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground/50 tabular-nums">
          {Math.round(c.confidence * 100)}% confidence
        </span>
        <ExternalLink className="h-3 w-3 text-muted-foreground/30 shrink-0" />
      </div>
      <p className="text-xs text-muted-foreground leading-snug">{c.description}</p>
    </Link>
  );
}

/* ── Main page ───────────────────────────────────────────────── */
export default function ServicesPage() {
  const { services, loading, addService, updateService, removeService } = useDashboardData();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedId, setSelectedId]     = useState<string | null>(null);

  // Derive selected service from shared data — SSE updates propagate automatically.
  const selectedSvc = services.find((s) => s.service_id === selectedId) ?? null;

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
        <Button className="gap-2 self-start sm:self-auto sm:shrink-0" onClick={() => setRegisterOpen(true)}>
          <Plus className="h-4 w-4" />
          Register service
        </Button>
      </div>

      {/* ── Registration dialog ── */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Register a service</DialogTitle>
            <DialogDescription>
              Add a service slated for deprecation. Karma will begin learning its implicit contracts during the observation window.
            </DialogDescription>
          </DialogHeader>
          <RegistrationForm
            onSuccess={(svc) => {
              addService(svc);
              setRegisterOpen(false);
            }}
            onCancel={() => setRegisterOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── Details dialog ── */}
      {selectedSvc && (
        <ServiceDetailsDialog
          service={selectedSvc}
          onClose={() => setSelectedId(null)}
          onPhaseChange={(id, phase, extra) => updateService(id, { phase, ...extra })}
          onDeleted={(id) => {
            removeService(id);
            setSelectedId(null);
          }}
        />
      )}

      {/* ── Content ── */}
      {loading ? (
        <ServiceGridSkeleton />
      ) : services.length === 0 ? (
        <EmptyState onRegister={() => setRegisterOpen(true)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((svc) => (
            <ServiceCard
              key={svc.service_id}
              service={svc}
              onDetails={() => setSelectedId(svc.service_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Registration form ─────────────────────────────────────── */
function RegistrationForm({
  onSuccess, onCancel,
}: {
  onSuccess: (s: ServiceResponse) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ServiceRegistration>({
    service_name: "",
    dynatrace_entity_id: "",
    deprecation_date: "",
    replacement_service_id: "",
    learning_window_days: 14,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  function field(key: keyof ServiceRegistration) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: key === "learning_window_days" ? Number(e.target.value) : e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = { ...form, replacement_service_id: form.replacement_service_id?.trim() || null };
      const svc = await apiFetch<ServiceResponse>("/services", {
        method: "POST",
        body: JSON.stringify(body),
      });
      onSuccess(svc);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service name" hint="e.g. svc-payments-v2">
          <Input required placeholder="svc-payments-v2" value={form.service_name} onChange={field("service_name")} />
        </Field>
        <Field label="Dynatrace entity ID" hint="SERVICE-… (deprecated)">
          <Input required placeholder="SERVICE-XXXXXXXXXXXXXXXX" value={form.dynatrace_entity_id} onChange={field("dynatrace_entity_id")} />
        </Field>
        <Field label="Replacement entity ID" hint="SERVICE-… (optional)">
          <Input placeholder="SERVICE-YYYYYYYYYYYYYYYY" value={form.replacement_service_id ?? ""} onChange={field("replacement_service_id")} />
        </Field>
        <Field label="Deprecation date">
          <Input required type="date" value={form.deprecation_date} onChange={field("deprecation_date")} />
        </Field>
        <Field label="Learning window" hint="1–30 days">
          <Input type="number" min={1} max={30} value={form.learning_window_days} onChange={field("learning_window_days")} />
        </Field>
      </div>
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading} className="gap-2">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {loading ? "Registering…" : "Register and begin learning"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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

/* ── Service card ────────────────────────────────────────────── */
function ServiceCard({
  service: svc,
  onDetails,
}: {
  service: ServiceResponse;
  onDetails: () => void;
}) {
  const registeredAgo = useRelativeTime(svc.created_at);

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
        <MetaRow icon={Clock}    label="Registered"  value={registeredAgo} />
      </div>

      {/* Error message (only shown when phase === "error") */}
      {svc.phase === "error" && svc.error_message && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="leading-snug line-clamp-2">{svc.error_message}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border/60">
        <p className="text-[11px] font-mono text-muted-foreground/60 truncate">{svc.service_id?.slice(0, 12) ?? '—'}…</p>
        <button
          onClick={onDetails}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors opacity-0 group-hover:opacity-100"
        >
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

/* ── Skeleton / Error / Empty ────────────────────────────────── */
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

/* ── Phase badge ─────────────────────────────────────────────── */
const PHASE_CONFIG: Record<ServicePhase, {
  variant: "ghost" | "warning" | "destructive" | "success";
  dot: string;
  label: string;
}> = {
  registered: { variant: "ghost",       dot: "bg-zinc-500",    label: "Registered" },
  learning:   { variant: "warning",     dot: "bg-amber-400",   label: "Learning"   },
  ready:      { variant: "success",     dot: "bg-emerald-400", label: "Ready"      },
  haunting:   { variant: "destructive", dot: "bg-red-400",     label: "Haunting"   },
  completed:  { variant: "success",     dot: "bg-emerald-400", label: "Completed"  },
  error:      { variant: "destructive", dot: "bg-red-500",     label: "Error"      },
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
