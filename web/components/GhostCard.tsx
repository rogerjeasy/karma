"use client";

import { useState, useRef } from "react";
import {
  ExternalLink, ArrowRight, Clock, Copy, Check,
  Brain, Coins, Cpu, AlertOctagon, ServerCrash,
  BookOpen, Zap, FileSearch, TrendingUp, Bell, NotebookText,
  GitPullRequest, FileCode2, Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { GhostReport, NotebookResponse, RemediationPatch, ViolationSeverity } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import GhostChat from "@/components/GhostChat";

interface GhostCardProps {
  report: GhostReport;
}

const SEVERITY_CONFIG: Record<
  ViolationSeverity,
  { variant: "ghost" | "warning" | "destructive" | "critical"; bar: string; glow: string }
> = {
  low:      { variant: "ghost",       bar: "bg-zinc-500",    glow: "" },
  medium:   { variant: "warning",     bar: "bg-amber-400",   glow: "" },
  high:     { variant: "destructive", bar: "bg-red-400",     glow: "" },
  critical: { variant: "critical",    bar: "bg-red-500",     glow: "shadow-[0_0_18px_-4px_hsl(0_72%_51%/0.45)]" },
};

const DT_ENV = process.env.NEXT_PUBLIC_DT_ENV ?? "";

function buildDtBase(): string {
  return DT_ENV ? `https://${DT_ENV}.apps.dynatrace.com` : "";
}

function extractDql(raw: string): string {
  const withoutPrefix = raw.replace(/^DQL#?\d*\s*[^:]*:\s*/i, "");
  return withoutPrefix.replace(/\s*--\s*RESULT:[\s\S]*$/i, "").trim();
}

function buildProblemUrl(problemId: string): string | null {
  const base = buildDtBase();
  if (!base || !problemId) return null;
  return `${base}/ui/problems/${encodeURIComponent(problemId)}`;
}

function buildEntityUrl(entityId: string): string | null {
  const base = buildDtBase();
  if (!base || !entityId) return null;
  return `${base}/ui/apps/dynatrace.entity/${encodeURIComponent(entityId)}`;
}

// ── Shared DT link button ──────────────────────────────────────────────────────

const DT_LINK_COLORS = {
  teal:   "text-teal-400 hover:text-teal-300 border-teal-500/25 hover:border-teal-400/40 hover:bg-teal-500/10",
  violet: "text-violet-400 hover:text-violet-300 border-violet-500/25 hover:border-violet-400/40 hover:bg-violet-500/10",
  amber:  "text-amber-400 hover:text-amber-300 border-amber-500/25 hover:border-amber-400/40 hover:bg-amber-500/10",
  blue:   "text-blue-400 hover:text-blue-300 border-blue-500/25 hover:border-blue-400/40 hover:bg-blue-500/10",
  red:    "text-red-400 hover:text-red-300 border-red-500/25 hover:border-red-400/40 hover:bg-red-500/10",
} as const;

const DT_LINK_BASE = cn(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1",
  "text-[11px] font-medium font-mono transition-all duration-150",
);

/**
 * Opens a Dynatrace Notebook of this ghost's investigation (evidence DQL etc.).
 * If the report already has a notebook URL it links straight to it; otherwise it
 * creates one on demand (cached server-side), so the link always lands on a real,
 * executable notebook instead of an uninstalled events app.
 */
function GhostNotebookLink({
  reportId,
  precomputedUrl,
  icon: Icon,
  label,
  color = "teal",
}: {
  reportId: string;
  precomputedUrl: string | null;
  icon: React.ElementType;
  label: string;
  color?: keyof typeof DT_LINK_COLORS;
}) {
  const [busy, setBusy] = useState(false);
  const urlRef = useRef<string | null>(precomputedUrl);
  const promiseRef = useRef<Promise<string> | null>(null);

  function open() {
    if (urlRef.current) {
      window.open(urlRef.current, "_blank", "noopener,noreferrer");
      return;
    }
    setBusy(true);
    if (!promiseRef.current) {
      promiseRef.current = apiFetch<NotebookResponse>(`/ghosts/${reportId}/notebook`, {
        method: "POST",
      }).then((r) => r.notebook_url);
    }
    promiseRef.current
      .then((url) => {
        urlRef.current = url;
        window.open(url, "_blank", "noopener,noreferrer");
      })
      .catch(() => {
        // Fallback: open the Notebooks app so the user isn't left on a dead link.
        promiseRef.current = null;
        const base = buildDtBase();
        if (base) window.open(`${base}/ui/apps/dynatrace.notebooks/`, "_blank", "noopener,noreferrer");
      })
      .finally(() => setBusy(false));
  }

  return (
    <button
      onClick={open}
      disabled={busy}
      className={cn(DT_LINK_BASE, DT_LINK_COLORS[color], "disabled:opacity-60")}
    >
      {busy ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : <Icon className="h-3 w-3 shrink-0" />}
      {busy ? "Opening notebook…" : label}
      {!busy && <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />}
    </button>
  );
}

function DtLink({
  href,
  icon: Icon,
  label,
  color = "teal",
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  color?: "teal" | "violet" | "amber" | "blue" | "red";
}) {
  const colorMap = {
    teal:   "text-teal-400 hover:text-teal-300 border-teal-500/25 hover:border-teal-400/40 hover:bg-teal-500/10",
    violet: "text-violet-400 hover:text-violet-300 border-violet-500/25 hover:border-violet-400/40 hover:bg-violet-500/10",
    amber:  "text-amber-400 hover:text-amber-300 border-amber-500/25 hover:border-amber-400/40 hover:bg-amber-500/10",
    blue:   "text-blue-400 hover:text-blue-300 border-blue-500/25 hover:border-blue-400/40 hover:bg-blue-500/10",
    red:    "text-red-400 hover:text-red-300 border-red-500/25 hover:border-red-400/40 hover:bg-red-500/10",
  };
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1",
        "text-[11px] font-medium font-mono transition-all duration-150",
        colorMap[color],
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {label}
      <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
    </a>
  );
}

// ── Evidence DQL link/copy ────────────────────────────────────────────────────

function EvidenceLink({ raw, index, notebookUrl }: { raw: string; index: number; notebookUrl: string | null }) {
  const [copied, setCopied] = useState(false);
  const isUrl = /^https?:\/\//i.test(raw);
  const dql = isUrl ? "" : extractDql(raw);
  // Absolute URLs (e.g. Davis problem deep-links) are used as-is.
  // DQL strings link to the report's Dynatrace Notebook (which has the DQL embedded as an executable cell).
  const href = isUrl ? raw : notebookUrl;

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-mono transition-colors"
      >
        <ExternalLink className="h-3 w-3" />
        evidence [{index}]
      </a>
    );
  }

  function copyDql() {
    navigator.clipboard.writeText(dql || raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copyDql}
      title={dql || raw}
      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-mono transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      evidence [{index}]
    </button>
  );
}

// ── Suggested fix (agent-generated patch, preview-only) ───────────────────────

function DiffBlock({ diff }: { diff: string }) {
  return (
    <pre className="max-h-72 overflow-auto rounded-md border border-border/60 bg-black/40 p-3 text-[11px] leading-relaxed font-mono">
      {diff.split("\n").map((line, i) => {
        const added = line.startsWith("+") && !line.startsWith("+++");
        const removed = line.startsWith("-") && !line.startsWith("---");
        const meta =
          line.startsWith("@@") ||
          line.startsWith("+++") ||
          line.startsWith("---") ||
          line.startsWith("diff ");
        return (
          <div
            key={i}
            className={cn(
              "whitespace-pre-wrap break-words",
              added && "bg-emerald-500/10 text-emerald-300",
              removed && "bg-red-500/10 text-red-300",
              meta && "text-slate-500",
              !added && !removed && !meta && "text-slate-400",
            )}
          >
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

function SuggestedFix({
  patch,
  reportId,
  existingPrUrl,
}: {
  patch: RemediationPatch;
  reportId: string;
  existingPrUrl?: string | null;
}) {
  const [copiedPatch, setCopiedPatch] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [prUrl, setPrUrl] = useState<string | null>(existingPrUrl ?? null);
  const [opening, setOpening] = useState(false);
  const [prError, setPrError] = useState<string | null>(null);

  function copy(text: string, mark: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    mark(true);
    setTimeout(() => mark(false), 1500);
  }

  async function openPr() {
    if (opening || prUrl) return;
    setOpening(true);
    setPrError(null);
    try {
      const res = await apiFetch<{ pr_url: string }>(`/ghosts/${reportId}/open-pr`, {
        method: "POST",
      });
      setPrUrl(res.pr_url);
    } catch (err: unknown) {
      setPrError(err instanceof Error ? err.message : "Couldn't open the pull request.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="space-y-2.5 rounded-lg border border-sky-500/20 bg-sky-500/[0.04] p-3">
      <div className="flex items-center gap-1.5">
        <GitPullRequest className="h-3.5 w-3.5 text-sky-400 shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400/80">
          Suggested Fix
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 font-mono">
          <FileCode2 className="h-3 w-3" />
          {patch.target_file}
        </span>
      </div>

      <p className="text-xs font-semibold text-slate-200 leading-snug">{patch.pr_title}</p>

      {patch.patch_diff && <DiffBlock diff={patch.patch_diff} />}

      <div className="flex flex-wrap items-center gap-1.5">
        {prUrl ? (
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-300 transition-all hover:border-emerald-400/50 hover:bg-emerald-500/15"
          >
            <GitPullRequest className="h-3 w-3" />
            View draft PR
            <ExternalLink className="h-2.5 w-2.5 opacity-60" />
          </a>
        ) : (
          <button
            onClick={openPr}
            disabled={opening}
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-2.5 py-1 text-[11px] font-semibold text-white transition-all hover:bg-sky-400 disabled:opacity-60"
          >
            {opening ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitPullRequest className="h-3 w-3" />}
            {opening ? "Opening draft PR…" : "Open draft PR"}
          </button>
        )}
        <button
          onClick={() => copy(patch.patch_diff, setCopiedPatch)}
          className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/25 px-2 py-1 text-[11px] font-medium text-sky-400 transition-all hover:border-sky-400/40 hover:bg-sky-500/10"
        >
          {copiedPatch ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copiedPatch ? "Copied" : "Copy patch"}
        </button>
        <button
          onClick={() => copy(patch.pr_body, setCopiedBody)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1 text-[11px] font-medium text-slate-300 transition-all hover:border-border hover:bg-accent"
        >
          {copiedBody ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copiedBody ? "Copied" : "Copy PR description"}
        </button>
        {patch.github_url && (
          <a
            href={patch.github_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1 text-[11px] font-medium text-slate-300 transition-all hover:border-border hover:bg-accent"
          >
            <FileCode2 className="h-3 w-3" />
            View target file
            <ExternalLink className="h-2.5 w-2.5 opacity-60" />
          </a>
        )}
      </div>

      {prError && <p className="text-[11px] text-red-400 leading-snug">{prError}</p>}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function GhostCard({ report }: GhostCardProps) {
  const cfg = SEVERITY_CONFIG[report.severity] ?? SEVERITY_CONFIG.medium;
  const dtBase = buildDtBase();

  // Build all DT deep links
  const problemUrl       = report.davis_problem_id  ? buildProblemUrl(report.davis_problem_id) : null;
  const entityUrl        = report.new_service_entity_id ? buildEntityUrl(report.new_service_entity_id) : null;
  const notebookUrl      = report.dynatrace_notebook_url ?? null;
  // The timeline-annotation event opens as a real Dynatrace Notebook (created on
  // demand) — available whenever there's an event or evidence to put in it.
  const canOpenNotebook  = !!(notebookUrl || report.dynatrace_event_id || (report.evidence_links?.length ?? 0) > 0);
  const hasDtLinks       = dtBase && (problemUrl || entityUrl || canOpenNotebook);

  return (
    <article
      className={cn(
        "group relative rounded-xl border border-border bg-card overflow-hidden",
        "transition-all duration-200 hover:border-border/70 hover:shadow-card-hover hover:-translate-y-px",
        cfg.glow
      )}
    >
      {/* ── Severity accent bar ── */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", cfg.bar)} />

      <div className="pl-5 pr-5 pt-4 pb-4 space-y-3">
        {/* ── Top row ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Badge variant={cfg.variant} className="shrink-0 uppercase text-[10px] tracking-wider">
              {report.severity}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">{report.category}</span>
            <span className="text-slate-400 text-xs">·</span>
            <span className="text-[11px] text-muted-foreground/70 font-mono">
              #{report.contract_id?.slice(0, 8) ?? '—'}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0 text-xs text-slate-300">
            <Clock className="h-3 w-3" />
            <time>{formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}</time>
          </div>
        </div>

        {/* ── Summary ── */}
        <p className="text-sm font-semibold text-foreground leading-snug">{report.summary}</p>

        {/* ── Impact ── */}
        {report.downstream_impact && (
          <p className="text-sm text-slate-300 leading-relaxed">{report.downstream_impact}</p>
        )}

        {/* ── Davis AI insights ── */}
        {report.davis_ai_insights && report.davis_ai_insights !== "not available" && (
          <div className="space-y-1.5 rounded-lg bg-violet-500/5 border border-violet-500/20 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Brain className="h-3.5 w-3.5 text-violet-400 shrink-0" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400/80">
                Davis AI Insights
              </p>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
              {report.davis_ai_insights}
            </p>
          </div>
        )}

        {/* ── Remediation suggestions ── */}
        {report.remediation_suggestions.length > 0 && (
          <div className="space-y-1.5 rounded-lg bg-muted/40 border border-border/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
              Remediation
            </p>
            {report.remediation_suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/70" />
                <span className="text-slate-300 leading-relaxed">{s}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Suggested fix (agent-generated patch) ── */}
        {report.remediation_patch && (
          <SuggestedFix
            patch={report.remediation_patch}
            reportId={report.report_id}
            existingPrUrl={report.remediation_pr_url}
          />
        )}

        {/* ── Evidence DQL links (raw query copies) ── */}
        {report.evidence_links.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-0.5">
            {report.evidence_links.map((link, i) => (
              <EvidenceLink key={i} raw={link} index={i + 1} notebookUrl={notebookUrl} />
            ))}
          </div>
        )}

        {/* ── Open in Dynatrace — deep link panel ── */}
        {hasDtLinks && (
          <div className="rounded-lg border border-teal-500/15 bg-teal-500/[0.04] p-3 space-y-2">
            {/* DT brand header */}
            <div className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-teal-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400/80">
                Open in Dynatrace
              </span>
            </div>
            {/* Link buttons */}
            <div className="flex flex-wrap gap-1.5">
              {problemUrl && (
                <DtLink
                  href={problemUrl}
                  icon={AlertOctagon}
                  label="Davis AI Problem"
                  color="red"
                />
              )}
              {entityUrl && (
                <DtLink
                  href={entityUrl}
                  icon={ServerCrash}
                  label="Service Entity"
                  color="blue"
                />
              )}
              {canOpenNotebook && (
                <GhostNotebookLink
                  reportId={report.report_id}
                  precomputedUrl={notebookUrl}
                  icon={FileSearch}
                  label="Timeline Annotation"
                  color="teal"
                />
              )}
              {notebookUrl && (
                <DtLink
                  href={notebookUrl}
                  icon={BookOpen}
                  label="BizEvent"
                  color="violet"
                />
              )}
              {notebookUrl && (
                <DtLink
                  href={notebookUrl}
                  icon={NotebookText}
                  label="DT Notebook"
                  color="violet"
                />
              )}
            </div>
          </div>
        )}

        {/* ── Avoided incident cost highlight ── */}
        {report.avoided_incident_cost_usd != null && report.avoided_incident_cost_usd > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <p className="text-[11px] text-emerald-300">
              Early detection avoided an estimated{" "}
              <span className="font-bold">${report.avoided_incident_cost_usd.toLocaleString()}</span>{" "}
              incident cost
            </p>
            {report.slack_notification_sent && (
              <div className="ml-auto flex items-center gap-1 text-[10px] text-sky-400">
                <Bell className="h-3 w-3" />
                <span>Slack notified</span>
              </div>
            )}
          </div>
        )}

        {/* ── Investigation cost ── */}
        {report.cost_estimate_usd != null && (
          <div className="flex items-center gap-4 pt-0.5 border-t border-border/40">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
              <Coins className="h-3 w-3" />
              <span>${report.cost_estimate_usd.toFixed(4)}</span>
            </div>
            {(report.investigation_input_tokens != null || report.investigation_output_tokens != null) && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                <Cpu className="h-3 w-3" />
                <span>
                  {((report.investigation_input_tokens ?? 0) + (report.investigation_output_tokens ?? 0)).toLocaleString()} tokens
                </span>
              </div>
            )}
            <span className="text-[10px] text-muted-foreground/30 ml-auto">investigation cost</span>
          </div>
        )}

        {/* ── Ask Karma (constrained chat) ── */}
        <div className="pt-1">
          <GhostChat reportId={report.report_id} />
        </div>
      </div>
    </article>
  );
}
