"use client";

import { useRef, useState } from "react";
import { MessageCircleQuestion, Send, Loader2, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

const STARTERS = [
  "What broke, in one sentence?",
  "How do I fix this?",
  "What's the downstream impact?",
];

/**
 * Constrained "Ask Karma" chat for a single ghost report. Sends the question and
 * prior turns to POST /ghosts/{id}/ask, which answers only from this report's data
 * (one lightweight Gemini call — no agent pipeline, no new telemetry).
 */
export default function GhostChat({ reportId }: { reportId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    const history = messages.slice(-10);
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await apiFetch<{ answer: string }>(
        `/ghosts/${reportId}/ask`,
        { method: "POST", body: JSON.stringify({ question: q, history }) },
      );
      setMessages((m) => [...m, { role: "model", text: res.answer }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "model", text: "Sorry — I couldn't answer that just now. Please try again." },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-primary/25 px-2.5 py-1.5 text-[11px] font-medium text-primary transition-all hover:border-primary/40 hover:bg-primary/10"
      >
        <MessageCircleQuestion className="h-3.5 w-3.5" />
        Ask Karma about this ghost
      </button>
    );
  }

  return (
    <div className="space-y-2.5 rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary/80">
          Ask Karma
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground/50">grounded in this report</span>
      </div>

      {messages.length > 0 && (
        <div ref={scrollRef} className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg px-3 py-2 text-xs leading-relaxed",
                m.role === "user"
                  ? "ml-6 bg-primary/12 text-foreground"
                  : "mr-6 bg-card border border-border/60 text-slate-300",
              )}
            >
              {m.text}
            </div>
          ))}
          {loading && (
            <div className="mr-6 flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
            </div>
          )}
        </div>
      )}

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
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
          placeholder="Ask about this regression…"
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
