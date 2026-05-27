"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const TERMINAL_LINES: { delay: number; type: string; text: string }[] = [
  { delay: 400,  type: "cmd",     text: "karma observe --service deprecated-payments-api" },
  { delay: 1100, type: "info",    text: "Connecting to Dynatrace MCP server..." },
  { delay: 1900, type: "success", text: "✓ Observation window started (72 h)" },
  { delay: 2700, type: "info",    text: "Learning contracts from 14,392 traces..." },
  { delay: 3700, type: "success", text: "✓ 31 contracts extracted (high confidence)" },
  { delay: 4600, type: "divider", text: "" },
  { delay: 4700, type: "info",    text: "Replacement detected: payments-api-v2" },
  { delay: 5400, type: "info",    text: "Comparing against 31 contracts..." },
  { delay: 6100, type: "warn",    text: "⚠  P95 latency: 847 ms → 2.1 s" },
  { delay: 6800, type: "error",   text: "✗  CRITICAL  side_effect — inventory skipped" },
  { delay: 7400, type: "error",   text: "✗  HIGH      error_semantics — 400 → 500" },
  { delay: 8000, type: "info",    text: "Querying Davis AI docs via MCP..." },
  { delay: 8700, type: "success", text: "✓ Davis AI: 3 remediation steps retrieved" },
  { delay: 9300, type: "success", text: "✓ Ghost report GHO-00142 · cost: $0.0031" },
  { delay: 9900, type: "info",    text: "→ Annotation pushed to Dynatrace timeline" },
];

export default function TerminalMockup() {
  const [count, setCount] = useState(0);
  const [cursor, setCursor] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers = TERMINAL_LINES.map((l, i) => setTimeout(() => setCount(i + 1), l.delay));
    const blink = setInterval(() => setCursor((c) => !c), 530);
    return () => { timers.forEach(clearTimeout); clearInterval(blink); };
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [count]);

  const colorClass = (type: string) => {
    switch (type) {
      case "cmd":     return "text-primary font-semibold";
      case "success": return "text-emerald-400";
      case "warn":    return "text-amber-400";
      case "error":   return "text-red-400 font-medium";
      default:        return "text-slate-300";
    }
  };

  return (
    <div className="relative rounded-2xl border border-primary/20 bg-[#030e0d] overflow-hidden shadow-[0_0_80px_-12px_hsl(170_100%_42%/0.3),0_0_0_1px_hsl(170_100%_42%/0.08)]">
      <div className="flex items-center gap-2 border-b border-border/40 bg-black/40 px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-3 text-[11px] text-slate-400 font-mono tracking-wider">karma · agent · v1.0</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] text-primary/70 font-mono">live</span>
        </div>
      </div>
      <div ref={containerRef} className="p-4 sm:p-5 font-mono text-[11.5px] sm:text-[12.5px] space-y-1.5 min-h-[260px] max-h-[340px] overflow-y-auto overflow-x-hidden leading-relaxed">
        {TERMINAL_LINES.slice(0, count).map((line, i) =>
          line.type === "divider" ? (
            <div key={i} className="my-2 border-t border-border/25" />
          ) : (
            <div key={i} className={cn("flex items-start gap-0 break-words", colorClass(line.type))}>
              {line.type === "cmd" && <span className="text-primary/50 mr-1.5 shrink-0 select-none">$</span>}
              <span className="min-w-0 break-all">{line.text}</span>
            </div>
          )
        )}
        {count < TERMINAL_LINES.length && (
          <span className={cn("inline-block w-[7px] h-[13px] rounded-[1px] align-middle bg-primary transition-opacity", cursor ? "opacity-100" : "opacity-0")} />
        )}
      </div>
      <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
    </div>
  );
}
