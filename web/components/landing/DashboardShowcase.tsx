"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { MouseEvent } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Ghost, Activity, TrendingUp, Shield, Brain, Cpu,
  Monitor, User2, LayoutDashboard, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useInView } from "./hooks";

const USER_SHOTS = [
  { src: "/screenshots/users/user-dashboard-1.png",               label: "Live Overview",      desc: "Real-time stats: services monitored, active ghosts, and contracts discovered" },
  { src: "/screenshots/users/user-dashboard-2.png",               label: "Services Panel",     desc: "All registered services with phase indicators and contract counts" },
  { src: "/screenshots/users/user-dashboard-3.png",               label: "Ghost Reports",      desc: "Severity-triaged reports with AI-powered root-cause analysis" },
  { src: "/screenshots/users/user-ghost-dashboard.png",           label: "Ghost Details",      desc: "Full violation timeline, breached contracts, and AI remediation steps" },
  { src: "/screenshots/users/user-timeline-dashboard.png",        label: "Event Timeline",     desc: "Dynatrace-linked event stream with real-time push annotations" },
  { src: "/screenshots/users/user-contract-detail-dashboard.png", label: "Contract Inspector", desc: "Deep view of each implicit contract the Learner Agent extracted" },
];

const ADMIN_SHOTS = [
  { src: "/screenshots/admin/admin-dashboard-1.png",      label: "Admin Panel",            desc: "System overview with one-click demo mode and service registration" },
  { src: "/screenshots/admin/admin-dashboard-2.png",      label: "Infrastructure",         desc: "All system services with ghost counts, contracts, and direct view links" },
  { src: "/screenshots/admin/admin-ghosts.png",           label: "Ghost Management",       desc: "Platform-wide ghost reports across every user and registered service" },
  { src: "/screenshots/admin/admin-cost-dashboard.png",   label: "Cost Tracking",          desc: "Token counts and USD cost per investigation — no surprise bills" },
  { src: "/screenshots/admin/admin-platform-obs-1.png",   label: "Platform Observability", desc: "Agent OTel spans, latency distributions, and error rate dashboards" },
  { src: "/screenshots/admin/admin-platform-obs-2.png",   label: "Agent Tracing",          desc: "Live agent traces with gen_ai.* spans routed to Dynatrace Grail" },
  { src: "/screenshots/admin/admin-ai-investigation.png", label: "Davis AI Forensics",     desc: "Forensic sessions with Davis AI correlation and remediation guides" },
];

const SHOWCASE_DURATION = 4500;

export default function DashboardShowcase() {
  const { ref, inView } = useInView(0.05);
  const [tab, setTab] = useState<"user" | "admin">("user");
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);

  const shots = tab === "user" ? USER_SHOTS : ADMIN_SHOTS;

  const goTo = useCallback((next: number) => {
    const t = ((next % shots.length) + shots.length) % shots.length;
    setIdx(t);
    setProgress(0);
  }, [shots.length]);

  useEffect(() => { setIdx(0); setProgress(0); }, [tab]);

  useEffect(() => {
    if (!inView || paused) return;
    const start = Date.now();
    const prog = setInterval(() => {
      setProgress(Math.min(((Date.now() - start) / SHOWCASE_DURATION) * 100, 100));
    }, 50);
    const advance = setTimeout(() => {
      setIdx(i => (i + 1) % shots.length);
      setProgress(0);
    }, SHOWCASE_DURATION);
    return () => { clearTimeout(advance); clearInterval(prog); };
  }, [inView, paused, idx, tab, shots.length]);

  useEffect(() => {
    const container = thumbsRef.current;
    if (!container) return;
    const thumb = container.children[idx] as HTMLElement | undefined;
    if (!thumb) return;
    const target = thumb.offsetLeft - container.offsetWidth / 2 + thumb.offsetWidth / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [idx]);

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = frameRef.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = ((e.clientX - left) / width - 0.5) * 2;
    const y = ((e.clientY - top) / height - 0.5) * 2;
    setTilt({ x: -y * 4, y: x * 4 });
  };
  const onMouseLeave = () => { setTilt({ x: 0, y: 0 }); setPaused(false); };

  const tabItems = [
    { key: "user"  as const, label: "User Dashboard",  Icon: User2           },
    { key: "admin" as const, label: "Admin Dashboard", Icon: LayoutDashboard },
  ];

  const highlights = tab === "user"
    ? [
        { Icon: Ghost,      label: "Ghost Detection", desc: "Severity-triaged ghost reports the moment a behavioral violation is detected" },
        { Icon: Activity,   label: "Live Contracts",  desc: "Browse every implicit contract the Learner Agent extracted from your services" },
        { Icon: TrendingUp, label: "Timeline View",   desc: "Chronological event stream synced with Dynatrace push annotations" },
      ]
    : [
        { Icon: Shield, label: "Platform Health",   desc: "Full infrastructure view across all users, services, and agent invocations" },
        { Icon: Brain,  label: "AI Cost Control",   desc: "Per-investigation token counts and USD spend — no surprise bills ever" },
        { Icon: Cpu,    label: "OTel Agent Traces", desc: "Every agent emits gen_ai.* spans, visible directly in Dynatrace Grail" },
      ];

  return (
    <section id="dashboard" className="py-20 sm:py-28 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute top-1/3 left-1/4 h-[520px] w-[520px] rounded-full bg-primary/4 blur-[150px] animate-glow-breathe" />
        <div className="absolute bottom-1/4 right-1/4 h-[420px] w-[420px] rounded-full bg-cyan-500/4 blur-[130px] animate-glow-breathe" style={{ animationDelay: "1.8s" }} />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-8">
        <div ref={ref} className={cn("text-center mb-10 sm:mb-14 transition-all duration-700", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8")}>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-4 py-1.5 mb-5">
            <Monitor className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-[11.5px] font-semibold text-primary">Live Dashboard Preview</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
            Built for teams who demand
            <br className="hidden sm:block" />
            <span className="gradient-text"> full observability.</span>
          </h2>
          <p className="mt-4 sm:mt-5 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Two powerful interfaces — one for engineers tracking service migrations, one for platform admins overseeing system-wide health.
          </p>
        </div>

        <div className={cn("flex justify-center mb-8 sm:mb-10 transition-all duration-700 delay-100", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6")}>
          <div className="relative flex rounded-xl border border-border bg-card/60 p-1 gap-1">
            <div
              className="absolute inset-y-1 w-[calc(50%-4px)] rounded-lg bg-primary/15 border border-primary/30 transition-all duration-300 ease-out pointer-events-none"
              style={{ left: tab === "user" ? "4px" : "calc(50% + 2px)" }}
            />
            {tabItems.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "relative z-10 flex items-center gap-2 px-5 sm:px-7 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-200 whitespace-nowrap select-none",
                  tab === key ? "text-primary" : "text-slate-400 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className={cn("transition-all duration-700 delay-200", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10")}>
          <div
            ref={frameRef}
            className="rounded-2xl"
            style={{
              transform: `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
              transition: tilt.x === 0 && tilt.y === 0
                ? "transform 0.7s cubic-bezier(0.23,1,0.32,1)"
                : "transform 0.12s ease-out",
              transformStyle: "preserve-3d",
              willChange: "transform",
            }}
            onMouseMove={onMouseMove}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={onMouseLeave}
          >
            <div className="relative rounded-2xl p-px bg-gradient-to-br from-primary/35 via-primary/8 to-cyan-500/20 shadow-[0_0_100px_-20px_hsl(170_100%_42%/0.28),0_60px_120px_-30px_rgba(0,0,0,0.65)]">
              <div className="rounded-[calc(var(--radius)+7px)] overflow-hidden bg-[#060f0e]">
                <div className="flex items-center gap-3 bg-black/55 border-b border-white/[0.06] px-4 py-3">
                  <div className="flex gap-1.5 shrink-0">
                    <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                    <div className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
                    <div className="h-3 w-3 rounded-full bg-[#28C840]" />
                  </div>
                  <div className="flex-1 flex items-center gap-2 bg-white/[0.05] rounded-md border border-white/[0.07] px-3 py-1.5 min-w-0">
                    <div className="relative h-2.5 w-2.5 shrink-0">
                      <div className="absolute inset-0 rounded-full bg-primary/40 animate-ping opacity-50" />
                      <div className="relative h-full w-full rounded-full bg-primary/70" />
                    </div>
                    <span className="text-[11px] text-slate-400/80 font-mono truncate select-none">
                      karma-web-ucvx5uwt5q-uc.a.run.app{tab === "admin" ? "/dashboard/admin" : "/dashboard"}
                    </span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-400/70 font-mono">live</span>
                  </div>
                </div>

                <div className="relative overflow-hidden aspect-video bg-[#031110]">
                  {shots.map((shot, i) => (
                    <div
                      key={shot.src}
                      className="absolute inset-0 transition-opacity duration-500"
                      style={{ opacity: i === idx ? 1 : 0, zIndex: i === idx ? 2 : 1 }}
                    >
                      <Image
                        src={shot.src}
                        alt={shot.label}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 1200px"
                        className="object-contain"
                        loading={i === 0 ? "eager" : "lazy"}
                        priority={i === 0}
                      />
                    </div>
                  ))}
                  <div className="absolute bottom-0 inset-x-0 h-36 bg-gradient-to-t from-[#060f0e] via-[#060f0e]/40 to-transparent pointer-events-none z-10" />
                  <div className="absolute bottom-4 left-4 right-4 z-20 flex items-end justify-between gap-3">
                    <div className="rounded-xl border border-white/10 bg-black/75 backdrop-blur-md px-4 py-2.5 max-w-md transition-all duration-500">
                      <p className="text-[12px] font-bold text-primary leading-snug">{shots[idx].label}</p>
                      <p className="text-[11px] text-slate-300/90 mt-0.5 leading-relaxed">{shots[idx].desc}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0 hidden sm:block tabular-nums">
                      {String(idx + 1).padStart(2, "0")}&thinsp;/&thinsp;{String(shots.length).padStart(2, "0")}
                    </span>
                  </div>
                </div>

                <div className="h-[3px] bg-white/[0.04]">
                  <div
                    className="h-full bg-gradient-to-r from-primary/70 via-primary to-cyan-400/80 rounded-full"
                    style={{ width: `${progress}%`, transition: progress === 0 ? "none" : "width 0.05s linear" }}
                  />
                </div>

                <div ref={thumbsRef} className="flex items-center gap-2 overflow-x-auto px-4 py-3 bg-black/40 no-scrollbar">
                  {shots.map((shot, i) => (
                    <button
                      key={shot.src}
                      onClick={() => goTo(i)}
                      title={shot.label}
                      className={cn(
                        "relative shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-200",
                        i === idx
                          ? "border-primary shadow-[0_0_14px_-3px_hsl(170_100%_42%/0.65)] scale-[1.1] z-10"
                          : "border-white/10 opacity-40 hover:opacity-75 hover:border-white/25 hover:scale-105"
                      )}
                      style={{ width: 80, height: 50 }}
                    >
                      <Image src={shot.src} alt={shot.label} fill sizes="80px" className="object-contain" loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => goTo(idx - 1)}
            aria-label="Previous slide"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/50 text-slate-400 hover:text-foreground hover:border-border hover:bg-card/80 transition-all active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5">
            {shots.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={cn(
                  "rounded-full transition-all duration-300",
                  i === idx
                    ? "w-6 h-2 bg-primary shadow-[0_0_8px_-1px_hsl(170_100%_42%/0.7)]"
                    : "w-2 h-2 bg-border hover:bg-muted-foreground"
                )}
              />
            ))}
          </div>
          <button
            onClick={() => goTo(idx + 1)}
            aria-label="Next slide"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/50 text-slate-400 hover:text-foreground hover:border-border hover:bg-card/80 transition-all active:scale-95"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className={cn("mt-10 sm:mt-12 grid gap-4 sm:grid-cols-3 transition-all duration-700 delay-300", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8")}>
          {highlights.map(({ Icon, label, desc }, i) => (
            <div
              key={label}
              className="flex items-start gap-3.5 rounded-xl border border-border/60 bg-card/40 p-4 sm:p-5 hover:border-border hover:bg-card/60 hover:-translate-y-0.5 transition-all duration-200 group"
              style={{ transitionDelay: inView ? `${300 + i * 80}ms` : "0ms" }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-foreground">{label}</p>
                <p className="text-[12px] text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
