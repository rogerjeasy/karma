"use client";

import { cn } from "@/lib/utils";
import { Cpu, Activity, Brain, TrendingUp, Layers, Zap, Code2, Shield, Bell } from "lucide-react";
import { useInView } from "./hooks";

const TECH = [
  { name: "Google ADK v1.0",    icon: Cpu,        color: "border-blue-500/30 bg-blue-500/8 text-blue-300 hover:bg-blue-500/14" },
  { name: "Dynatrace MCP",      icon: Activity,   color: "border-violet-500/30 bg-violet-500/8 text-violet-300 hover:bg-violet-500/14" },
  { name: "Gemini 2.5 Pro",     icon: Brain,      color: "border-primary/30 bg-primary/8 text-primary hover:bg-primary/14" },
  { name: "OpenTelemetry",      icon: TrendingUp, color: "border-cyan-500/30 bg-cyan-500/8 text-cyan-300 hover:bg-cyan-500/14" },
  { name: "Bindplane",          icon: Layers,     color: "border-indigo-500/30 bg-indigo-500/8 text-indigo-300 hover:bg-indigo-500/14" },
  { name: "FastAPI",            icon: Zap,        color: "border-emerald-500/30 bg-emerald-500/8 text-emerald-300 hover:bg-emerald-500/14" },
  { name: "Next.js 15",         icon: Code2,      color: "border-border bg-card text-foreground hover:bg-card/80" },
  { name: "Firebase Auth",      icon: Shield,     color: "border-amber-500/30 bg-amber-500/8 text-amber-300 hover:bg-amber-500/14" },
  { name: "Server-Sent Events", icon: Bell,       color: "border-red-500/30 bg-red-500/8 text-red-300 hover:bg-red-500/14" },
];

export default function TechStack() {
  const { ref, inView } = useInView();
  return (
    <section id="tech-stack" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div ref={ref} className={cn("text-center mb-10 sm:mb-14 transition-all duration-700", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8")}>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Built on a <span className="gradient-text">best-in-class stack.</span>
          </h2>
          <p className="mt-4 text-slate-300 max-w-md mx-auto leading-relaxed text-sm sm:text-base">
            Cutting-edge AI agents fused with production-grade observability infrastructure.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3">
          {TECH.map((t, i) => {
            const Icon = t.icon;
            return (
              <div key={t.name}
                className={cn("inline-flex items-center gap-2 rounded-full border px-3.5 sm:px-5 py-2 sm:py-2.5 text-[12px] sm:text-[13px] font-medium transition-all duration-700 hover:-translate-y-0.5 cursor-default", t.color, inView ? "opacity-100 scale-100" : "opacity-0 scale-90")}
                style={{ transitionDelay: inView ? `${i * 55}ms` : "0ms" }}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{t.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
