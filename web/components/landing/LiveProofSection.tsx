"use client";

import { useEffect, useState } from "react";
import { Radar, ShieldCheck, Database, ExternalLink, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInView } from "./hooks";
import type { LiveProof } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

const CATEGORY_COLOR: Record<string, string> = {
  latency: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  side_effect: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  error_semantics: "border-red-500/40 bg-red-500/10 text-red-300",
  throughput: "border-blue-500/40 bg-blue-500/10 text-blue-300",
};

function entityUrl(dtEnv?: string | null, entityId?: string | null): string | null {
  if (!dtEnv || !entityId) return null;
  return `https://${dtEnv}.apps.dynatrace.com/ui/apps/dynatrace.entity/${encodeURIComponent(entityId)}`;
}

function DqlBlock({ dql }: { dql: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="max-h-32 overflow-auto rounded-md border border-teal-500/20 bg-black/40 p-2.5 pr-9 text-[10.5px] leading-relaxed font-mono text-teal-200/90 whitespace-pre-wrap break-words">
        {dql}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(dql);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        aria-label="Copy DQL"
        className="absolute right-1.5 top-1.5 rounded-md border border-teal-500/25 bg-background/60 p-1 text-teal-400 transition-colors hover:bg-teal-500/10"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

export default function LiveProofSection() {
  const { ref, inView } = useInView(0.08);
  const [proof, setProof] = useState<LiveProof | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/proof/live`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: LiveProof | null) => {
        if (!cancelled) setProof(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Hidden until a real service has actually been learned — no empty placeholder.
  if (!proof || !proof.available) return null;

  const dtLink = entityUrl(proof.dt_env, proof.dynatrace_entity_id);

  return (
    <section id="live-proof" className="relative py-20 sm:py-28 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-[hsl(186_60%_2.5%)] to-background" />
      <div className="relative mx-auto max-w-5xl px-4 sm:px-8">
        <div
          ref={ref}
          className={cn(
            "text-center mb-12 transition-all duration-700",
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
          )}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/8 px-4 py-1.5 mb-5">
            <Radar className="h-3.5 w-3.5 text-teal-400 shrink-0" />
            <span className="text-[11.5px] font-semibold text-teal-300">Live Proof — not a scripted demo</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
            Learned from <span className="gradient-text">real production telemetry</span>
          </h2>
          <p className="mt-4 sm:mt-5 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            The same Learner that runs on the demo also runs on Karma&apos;s own live API. Every
            contract below was discovered from <span className="font-semibold text-slate-100">real OpenTelemetry</span> in
            Dynatrace Grail — no synthetic data, nothing hand-authored.
          </p>
        </div>

        <div
          className={cn(
            "rounded-2xl border border-teal-500/20 bg-teal-500/[0.03] p-5 sm:p-7 transition-all duration-700",
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
          )}
          style={{ transitionDelay: inView ? "150ms" : "0ms" }}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-sm font-bold text-foreground">{proof.service_name}</span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              <Database className="h-3 w-3" />
              real telemetry
            </span>
            {proof.dynatrace_entity_id && (
              <span className="text-[11px] font-mono text-muted-foreground/60">{proof.dynatrace_entity_id}</span>
            )}
            {dtLink && (
              <a
                href={dtLink}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-teal-500/25 px-2 py-1 text-[11px] font-medium text-teal-300 transition-colors hover:bg-teal-500/10"
              >
                View entity in Dynatrace
                <ExternalLink className="h-2.5 w-2.5 opacity-60" />
              </a>
            )}
          </div>

          <div className="space-y-3">
            {proof.contracts.map((c, i) => (
              <div key={i} className="rounded-lg border border-border/60 bg-card/60 p-3.5 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      CATEGORY_COLOR[c.category] ?? "border-border bg-muted/50 text-muted-foreground",
                    )}
                  >
                    {c.category}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground/70">{c.subcategory}</span>
                  <span className="ml-auto text-[11px] font-semibold text-teal-300">
                    {Math.round(c.confidence * 100)}% confidence
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{c.description}</p>
                {c.evidence_dql && <DqlBlock dql={c.evidence_dql} />}
              </div>
            ))}
          </div>

          <p className="mt-4 text-[11px] text-muted-foreground/60 leading-relaxed">
            Every claim is backed by a real DQL query you can run yourself in Dynatrace. This is Karma
            generalizing beyond its demo — the proof it works on services it has never seen.
          </p>
        </div>
      </div>
    </section>
  );
}
