"use client";

import { cn } from "@/lib/utils";
import { Brain, Ghost, Activity, Cpu, Bell, TrendingUp, Layers } from "lucide-react";
import { useInView } from "./hooks";

const FEATURES = [
  { icon: Brain,      title: "AI Contract Learning",        desc: "The Learner Agent uses Google ADK + Gemini 2.5 Pro to analyze Dynatrace traces and extract implicit behavioral contracts — zero manual spec writing.",                                                                  badge: "ADK v1.0",    badgeColor: "bg-blue-500/15 text-blue-400 border-blue-500/25",        accent: "group-hover:border-blue-500/30"    },
  { icon: Ghost,      title: "Ghost Detection Engine",      desc: "The Forensic Agent continuously compares replacement behavior against every learned contract, generating structured violation reports the moment drift is detected.",                                                    badge: "Real-time",   badgeColor: "bg-primary/15 text-primary border-primary/30",            accent: "group-hover:border-primary/30"     },
  { icon: Activity,   title: "Davis AI Forensics",          desc: "Every violation triggers mandatory Davis AI correlation via the Dynatrace MCP server — root-cause analysis, changepoint detection, and AI-powered remediation guides surfaced in every ghost report.",                  badge: "MCP · Davis", badgeColor: "bg-violet-500/15 text-violet-400 border-violet-500/25",  accent: "group-hover:border-violet-500/30"  },
  { icon: Cpu,        title: "Full OTel Observability",     desc: "All four agents emit gen_ai.* OpenTelemetry spans with token usage, latency, and cost. Routed via Bindplane to Dynatrace — every agent run is a first-class trace in Grail.",                                         badge: "OTel",        badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", accent: "group-hover:border-emerald-500/30" },
  { icon: Bell,       title: "Bidirectional Dynatrace",     desc: "Ghost reports push CUSTOM_ANNOTATION events back to the violated service's Dynatrace timeline. SREs navigate from a Dynatrace problem directly to the Karma ghost report and vice versa.",                            badge: "Events API",  badgeColor: "bg-red-500/15 text-red-400 border-red-500/25",            accent: "group-hover:border-red-500/30"     },
  { icon: TrendingUp, title: "Investigation Cost Tracking", desc: "Every forensic report includes exact token counts and estimated USD cost from the Gemini 2.5 Pro investigation session. Cumulative AI spend visible in the dashboard — no surprise bills.",                        badge: "Cost",        badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/25",     accent: "group-hover:border-amber-500/30"  },
];

export default function FeaturesGrid() {
  const { ref, inView } = useInView();
  return (
    <section className="py-20 sm:py-28 relative">
      <div className="absolute inset-0 bg-card/20" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-8">
        <div ref={ref} className={cn("text-center mb-12 sm:mb-16 transition-all duration-700", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8")}>
          <div className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 mb-5">
            <Layers className="h-3.5 w-3.5 text-slate-300 shrink-0" />
            <span className="text-[11.5px] font-semibold text-slate-300">Features</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
            Everything you need to
            <br className="hidden sm:block" />
            <span className="gradient-text"> ship migrations confidently.</span>
          </h2>
        </div>
        <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={f.title}
                className={cn("group rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 transition-all duration-700 hover:-translate-y-1 hover:shadow-card-hover", f.accent, inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10")}
                style={{ transitionDelay: inView ? `${i * 75}ms` : "0ms" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/25 group-hover:bg-primary/15 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0", f.badgeColor)}>
                    {f.badge}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-[14px] sm:text-[15px] font-bold text-foreground">{f.title}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
