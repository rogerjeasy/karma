"use client";

import { cn } from "@/lib/utils";
import { Server, Brain, GitMerge, AlertOctagon, Zap } from "lucide-react";
import { useInView } from "./hooks";

const STEPS = [
  { num: "01", icon: Server,       title: "Register",          desc: "Point Karma at any deprecated service. No instrumentation needed — it reads your existing Dynatrace data via MCP.",                                                             accent: "border-primary/40 bg-primary/10 text-primary" },
  { num: "02", icon: Brain,        title: "Observe & Learn",   desc: "The Learner Agent runs a configurable observation window, extracting implicit contracts: latency bands, error semantics, side effects, throughput ceilings.",                     accent: "border-cyan-400/40 bg-cyan-400/10 text-cyan-400" },
  { num: "03", icon: GitMerge,     title: "Compare",           desc: "When the replacement deploys, the Haunter Agent continuously compares its behavior against every contract the Learner discovered — automatically.",                              accent: "border-amber-400/40 bg-amber-400/10 text-amber-400" },
  { num: "04", icon: AlertOctagon, title: "Alert & Remediate", desc: "Violations surface as ghost reports in real-time: severity triage, root cause, remediation suggestions, and Dynatrace evidence links.",                                        accent: "border-red-400/40 bg-red-400/10 text-red-400" },
];

export default function HowItWorks() {
  const { ref, inView } = useInView();
  return (
    <section id="how-it-works" className="py-20 sm:py-28 relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/4 blur-[130px]" />
      </div>
      <div className="relative mx-auto max-w-7xl px-4 sm:px-8">
        <div ref={ref} className={cn("text-center mb-12 sm:mb-16 transition-all duration-700", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8")}>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-4 py-1.5 mb-5">
            <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-[11.5px] font-semibold text-primary">How it Works</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
            Four steps from deprecated<br className="hidden sm:block" />
            <span className="gradient-text"> to shipped with confidence.</span>
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.num}
                className={cn("relative rounded-2xl border border-border bg-card p-6 space-y-4 transition-all duration-700 hover:-translate-y-1 hover:shadow-card-hover group", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10")}
                style={{ transitionDelay: inView ? `${i * 100}ms` : "0ms" }}>
                <span className="absolute top-4 right-5 text-5xl sm:text-6xl font-black text-primary/20 select-none leading-none tabular-nums">{step.num}</span>
                <div className={cn("inline-flex h-11 w-11 items-center justify-center rounded-xl border", step.accent)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-[15px] font-bold text-foreground">{step.title}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
