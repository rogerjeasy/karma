"use client";

import { cn } from "@/lib/utils";
import { AlertOctagon, Ghost, Bell, Shield } from "lucide-react";
import { useInView } from "./hooks";

const PROBLEMS = [
  {
    icon: Shield,
    title: "Tests can't see what they were never told",
    body: "Unit and integration tests verify the contract you explicitly wrote. They have no idea about implicit behaviors — undocumented side effects, timing guarantees, and error semantics callers silently depend on.",
    color: "text-red-400 bg-red-500/10 border-red-500/25",
  },
  {
    icon: Ghost,
    title: "Replacement services look fine — until they don't",
    body: "A new service can pass every SLO and still silently break a downstream team's flow. The breakage is real; the signal is missing. Karma generates that signal automatically.",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/25",
  },
  {
    icon: Bell,
    title: "By the time you know, it's already in production",
    body: "Silent regressions spread through your system during the migration window. Detection needs to happen at deployment — not at post-mortem time.",
    color: "text-blue-400 bg-blue-500/10 border-blue-500/25",
  },
];

export default function ProblemSection() {
  const { ref, inView } = useInView();
  return (
    <section id="features" className="py-20 sm:py-28 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div ref={ref} className={cn("text-center mb-12 sm:mb-16 transition-all duration-700", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8")}>
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/8 px-4 py-1.5 mb-5">
            <AlertOctagon className="h-3.5 w-3.5 text-red-400 shrink-0" />
            <span className="text-[11.5px] font-semibold text-red-400">The Problem</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
            Silent regressions are<br className="hidden sm:block" />
            <span className="gradient-text"> the hardest bugs to catch.</span>
          </h2>
          <p className="mt-4 sm:mt-5 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Service migrations hide an entire class of regression that no conventional test can find.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {PROBLEMS.map((p, i) => {
            const Icon = p.icon;
            return (
              <div key={p.title}
                className={cn("rounded-2xl border border-border bg-card p-6 sm:p-7 space-y-4 transition-all duration-700 hover:-translate-y-1 hover:shadow-card-hover hover:border-border/70", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10")}
                style={{ transitionDelay: inView ? `${i * 120}ms` : "0ms" }}>
                <div className={cn("inline-flex h-11 w-11 items-center justify-center rounded-xl border", p.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-[15px] font-bold text-foreground leading-snug">{p.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{p.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
