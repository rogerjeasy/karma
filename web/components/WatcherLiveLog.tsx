"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2, XCircle, Radio, Clock, Terminal,
  ExternalLink, AlertOctagon, Loader2, ChevronDown,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { WatcherLogEvent, WatcherLogContractCheck } from "@/lib/types";
import { useSSEEvent } from "@/lib/sse-context";
import { cn } from "@/lib/utils";

const DT_ENV = process.env.NEXT_PUBLIC_DT_ENV ?? "";

// dynatrace.notebooks ignores ?query= — callers fall back to copy-to-clipboard
function buildNotebookUrl(_dql: string): string | null {
  return null;
}

function buildProblemUrl(problemId: string): string | null {
  if (!DT_ENV || !problemId) return null;
  return `https://${DT_ENV}.apps.dynatrace.com/ui/problems/${encodeURIComponent(problemId)}`;
}

interface LogEntry {
  id: string;
  event: WatcherLogEvent;
  receivedAt: Date;
}

export function WatcherLiveLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

  useSSEEvent("watcher_log", (raw) => {
    try {
      const event = JSON.parse(raw) as WatcherLogEvent;
      setEntries((prev) => {
        const id = `wl-${++idCounter.current}`;
        // Cap at 200 entries to avoid memory growth during long demo sessions
        const next = [...prev, { id, event, receivedAt: new Date() }].slice(-200);
        return next;
      });
    } catch {
      // ignore malformed events
    }
  });

  // Auto-scroll to bottom whenever entries change
  useEffect(() => {
    if (!collapsed) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [entries, collapsed]);

  if (entries.length === 0) return null;

  const lastEntry = entries[entries.length - 1];
  const isRunning =
    lastEntry.event.type === "started" ||
    lastEntry.event.type === "contract_check";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* ── Header ── */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border/60 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-lg border",
              isRunning
                ? "border-teal-500/40 bg-teal-500/10"
                : "border-border bg-muted/20"
            )}
          >
            {isRunning
              ? <Loader2 className="h-3.5 w-3.5 text-teal-400 animate-spin" />
              : <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            }
          </div>
          <h3 className="text-sm font-semibold text-foreground">Watcher Live Log</h3>
          {isRunning && (
            <span className="flex items-center gap-1 text-[11px] text-teal-400">
              <Radio className="h-3 w-3" />
              running…
            </span>
          )}
          {!isRunning && lastEntry.event.type === "complete" && (
            <span className="text-[11px] text-muted-foreground">
              · completed {formatDistanceToNow(lastEntry.receivedAt, { addSuffix: true })}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            collapsed && "-rotate-90"
          )}
        />
      </button>

      {/* ── Log body ── */}
      {!collapsed && (
        <div className="max-h-80 overflow-y-auto bg-zinc-950/80 font-mono text-xs">
          {entries.map((entry) => (
            <LogLine key={entry.id} entry={entry} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  const { event } = entry;

  if (event.type === "started") {
    return (
      <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2 text-teal-300">
        <Radio className="h-3 w-3 shrink-0 animate-pulse" />
        <span>
          Watcher started on{" "}
          <span className="font-semibold text-teal-200">{event.service_name}</span>
          {" "}— checking{" "}
          <span className="font-semibold text-white">{event.contract_count}</span>
          {" "}contract{event.contract_count !== 1 ? "s" : ""}
        </span>
      </div>
    );
  }

  if (event.type === "skipped") {
    return (
      <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2 text-zinc-500">
        <Clock className="h-3 w-3 shrink-0" />
        <span>
          Skipped{" "}
          <span className="text-zinc-400">{event.service_name}</span>
          {" "}— {event.reason}
        </span>
      </div>
    );
  }

  if (event.type === "contract_check") {
    return <ContractCheckLine check={event} />;
  }

  if (event.type === "complete") {
    const hasViolations = event.violations_found > 0;
    return (
      <div
        className={cn(
          "px-4 py-2.5 border-b border-white/5 flex items-center gap-2",
          hasViolations ? "text-red-300 bg-red-500/5" : "text-emerald-300 bg-emerald-500/5"
        )}
      >
        {hasViolations
          ? <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
          : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
        }
        <span>
          <span className="font-semibold text-white">{event.service_name}</span>
          {" — "}
          {event.contracts_checked} checked,{" "}
          <span className={cn("font-semibold", hasViolations ? "text-red-300" : "text-emerald-300")}>
            {event.violations_found} violation{event.violations_found !== 1 ? "s" : ""}
          </span>
          {event.duration_seconds != null && (
            <span className="text-zinc-500 ml-1.5">({event.duration_seconds.toFixed(1)}s)</span>
          )}
        </span>
      </div>
    );
  }

  return null;
}

function ContractCheckLine({ check }: { check: WatcherLogContractCheck }) {
  const nbUrl      = buildNotebookUrl(check.predicate_dql);
  const problemUrl = check.davis_problem_id ? buildProblemUrl(check.davis_problem_id) : null;

  return (
    <div
      className={cn(
        "px-4 py-2 border-b border-white/5 hover:bg-white/[0.02] transition-colors",
        !check.passed && "bg-red-500/[0.04]"
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Status icon */}
        {check.passed
          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-px shrink-0" />
          : <XCircle className="h-3.5 w-3.5 text-red-400 mt-px shrink-0" />
        }

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Category + subcategory line */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "font-semibold",
                check.passed ? "text-emerald-300" : "text-red-300"
              )}
            >
              {check.category}
            </span>
            {check.subcategory && (
              <>
                <span className="text-zinc-600">/</span>
                <span className="text-zinc-300">{check.subcategory}</span>
              </>
            )}
            {check.threshold && (
              <span className="text-zinc-500 ml-1">
                — <span className="text-zinc-400">{check.threshold}</span>
              </span>
            )}
          </div>

          {/* Description (truncated) */}
          {check.description && (
            <p className="text-zinc-500 text-[11px] leading-snug line-clamp-1">
              {check.description}
            </p>
          )}

          {/* Links row */}
          {(nbUrl || problemUrl) && (
            <div className="flex items-center gap-2 pt-0.5">
              {nbUrl && (
                <a
                  href={nbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-teal-400/80 hover:text-teal-300 transition-colors"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  Run DQL in Dynatrace
                </a>
              )}
              {problemUrl && (
                <a
                  href={problemUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-red-400/80 hover:text-red-300 transition-colors"
                >
                  <AlertOctagon className="h-2.5 w-2.5" />
                  Davis AI Problem
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
