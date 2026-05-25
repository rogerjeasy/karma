"use client";

import { useState } from "react";
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
  Server,
  ShieldCheck,
  Timer,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PHASE_COLORS, SEVERITY_CFG, CATEGORY_COLORS } from "./constants";
import { CountBadge } from "./CountBadge";
import { DetailSection } from "./DetailSection";
import type { ServiceDetail } from "@/lib/admin-context";
import type { ContractCategory, SystemService } from "@/lib/types";

export function ServiceCard({
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

  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg,  setActionMsg]  = useState<{ text: string; ok: boolean } | null>(null);
  const [replId,     setReplId]     = useState(service.dynatrace_entity_id);

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

  async function resumeHaunting() {
    setActionBusy(true);
    setActionMsg(null);
    try {
      await apiFetch(`/admin/system-services/${service.service_id}/haunt`, { method: "POST" });
      setActionMsg({ text: "Haunting resumed — watcher will run on next cycle.", ok: true });
      onRefresh?.();
    } catch (e: unknown) {
      setActionMsg({ text: (e as Error).message ?? "Failed to resume haunting", ok: false });
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

        {/* Stat badges + actions */}
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
            href={`/dashboard/services/${service.service_id}?system=true`}
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
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
              {/* Actions */}
              {(service.phase === "registered" ||
                service.phase === "error" ||
                service.phase === "ready" ||
                service.phase === "completed") && (
                <div className="px-5 py-3 bg-muted/10 flex flex-col gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Actions
                  </p>
                  <div className="flex flex-wrap items-start gap-3">
                    {(service.phase === "registered" || service.phase === "error") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        onClick={triggerLearn}
                        disabled={actionBusy}
                      >
                        {actionBusy ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Zap className="h-3 w-3" />
                        )}
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5"
                          onClick={triggerCutover}
                          disabled={actionBusy || !replId.trim()}
                        >
                          {actionBusy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Activity className="h-3 w-3" />
                          )}
                          Activate Haunting
                        </Button>
                      </div>
                    )}
                    {service.phase === "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                        onClick={resumeHaunting}
                        disabled={actionBusy}
                      >
                        {actionBusy ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Ghost className="h-3 w-3" />
                        )}
                        Resume Haunting
                      </Button>
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

              {/* Discovered Contracts */}
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

              {/* Watcher Run History */}
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
