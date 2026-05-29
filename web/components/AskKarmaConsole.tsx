"use client";

import { useRef, useState } from "react";
import { Sparkles, Send, Loader2, Database, BookOpen, Copy, Check, Terminal } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ConsoleAnswer } from "@/lib/types";

interface Turn {
  role: "user" | "model";
  text: string;
  dql?: string | null;
  source?: ConsoleAnswer["dql_source"];
  rowCount?: number;
}

const STARTERS = [
  "What's the p95 latency of svc-payments-v3 in the last hour?",
  "Which services have active Davis problems?",
  "Did the Redis cache-warming side effect stop?",
];

function DqlBlock({ dql, rowCount }: { dql: string; rowCount?: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative mt-2">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-400/80">
        <Terminal className="h-3 w-3" />
        DQL by Davis CoPilot
        {typeof rowCount === "number" && (
          <span className="text-muted-foreground/60">· {rowCount} rows</span>
        )}
      </div>
      <pre className="max-h-28 overflow-auto rounded-md border border-teal-500/20 bg-black/40 p-2.5 pr-9 text-[10.5px] leading-relaxed font-mono text-teal-200/90 whitespace-pre-wrap break-words">
        {dql}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(dql);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        aria-label="Copy DQL"
        className="absolute right-1.5 top-7 rounded-md border border-teal-500/25 bg-background/60 p-1 text-teal-400 transition-colors hover:bg-teal-500/10"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

function SourceBadge({ source }: { source: ConsoleAnswer["dql_source"] }) {
  if (source === "davis_copilot") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
        <Database className="h-2.5 w-2.5" />
        live telemetry
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
      <BookOpen className="h-2.5 w-2.5" />
      from contracts
    </span>
  );
}

/**
 * Global "Ask Karma" console. Sends a free-form question to POST /console/ask, which
 * prefers Davis CoPilot → DQL → live Grail telemetry, and falls back to a
 * contracts-grounded answer when Davis CoPilot isn't configured. Surfaces the exact
 * DQL Davis generated so the answer is verifiable.
 */
export default function AskKarmaConsole({ serviceId }: { serviceId?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    const history = turns.slice(-10).map((t) => ({ role: t.role, text: t.text }));
    setTurns((t) => [...t, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await apiFetch<ConsoleAnswer>("/console/ask", {
        method: "POST",
        body: JSON.stringify({ question: q, service_id: serviceId ?? null, history }),
      });
      setTurns((t) => [
        ...t,
        {
          role: "model",
          text: res.answer,
          dql: res.dql,
          source: res.dql_source,
          rowCount: res.row_count,
        },
      ]);
    } catch {
      setTurns((t) => [
        ...t,
        { role: "model", text: "Sorry — I couldn't answer that just now. Please try again." },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
    }
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <h3 className="text-sm font-bold text-foreground">Ask Karma</h3>
        <span className="ml-auto text-[10px] text-muted-foreground/60">
          Davis CoPilot → DQL → live telemetry
        </span>
      </div>

      {turns.length > 0 && (
        <div ref={scrollRef} className="mb-3 max-h-80 space-y-2.5 overflow-y-auto pr-1">
          {turns.map((t, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg px-3 py-2 text-xs leading-relaxed",
                t.role === "user"
                  ? "ml-8 bg-primary/12 text-foreground"
                  : "mr-8 border border-border/60 bg-card text-slate-300",
              )}
            >
              {t.role === "model" && t.source && (
                <div className="mb-1.5 flex items-center gap-2">
                  <SourceBadge source={t.source} />
                </div>
              )}
              <p className="whitespace-pre-wrap">{t.text}</p>
              {t.role === "model" && t.dql && <DqlBlock dql={t.dql} rowCount={t.rowCount} />}
            </div>
          ))}
          {loading && (
            <div className="mr-8 flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Asking Davis CoPilot &amp; querying Grail…
            </div>
          )}
        </div>
      )}

      {turns.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={loading}
              className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-slate-300 transition-all hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          placeholder="Ask anything about your migrations or live telemetry…"
          className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-primary-foreground transition-all hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Send"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
