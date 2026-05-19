"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Ghost, Zap, Activity, Bell, ChevronRight, AlertOctagon,
  Server, Code2, Cpu, Brain, GitMerge, CheckCircle2,
  ArrowRight, ArrowDown, Menu, X, Sparkles, Shield,
  TrendingUp, Layers, ChevronDown,
} from "lucide-react";

/* ─── useScrolled ─────────────────────────────────────────────────────────── */
function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, [threshold]);
  return scrolled;
}

/* ─── useInView ──────────────────────────────────────────────────────────── */
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ─── useCountUp ─────────────────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1800, trigger = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    const steps = duration / 16;
    const step = target / steps;
    let cur = 0;
    const t = setInterval(() => {
      cur = Math.min(cur + step, target);
      setValue(Math.round(cur));
      if (cur >= target) clearInterval(t);
    }, 16);
    return () => clearInterval(t);
  }, [target, duration, trigger]);
  return value;
}

/* ══════════════════════════════════════════════════════════════════════════
   NAV BAR
══════════════════════════════════════════════════════════════════════════ */
function NavBar() {
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);
  const links = [
    { label: "Features",     href: "#features" },
    { label: "How it Works", href: "#how-it-works" },
    { label: "Ghost Lifecycle", href: "#ghost-lifecycle" },
    { label: "Tech Stack",   href: "#tech-stack" },
  ];
  return (
    <header className={cn(
      "fixed inset-x-0 top-0 z-50 transition-all duration-500",
      scrolled
        ? "bg-card/85 backdrop-blur-2xl border-b border-border/50 shadow-[0_2px_28px_rgba(0,0,0,0.5)]"
        : "bg-transparent"
    )}>
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/35 bg-primary/10 transition-all group-hover:shadow-glow-sm">
              <Ghost className="h-[17px] w-[17px] text-primary" />
            </div>
            <span className="text-[15px] font-extrabold tracking-tight gradient-text">Karma</span>
          </Link>
          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {links.map((l) => (
              <a key={l.label} href={l.href}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap">
                {l.label}
              </a>
            ))}
          </nav>
          {/* CTA */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link href="/login" className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link href="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 sm:px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-glow-sm hover:bg-primary/90 hover:shadow-glow-md transition-all whitespace-nowrap">
              Get started <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            <button
              className="lg:hidden rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              onClick={() => setOpen(!open)} aria-label="Toggle menu">
              {open ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        {open && (
          <div className="lg:hidden border-t border-border/40 pb-4 pt-2 space-y-0.5 animate-fade-in">
            {links.map((l) => (
              <a key={l.label} href={l.href} onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
                {l.label}
              </a>
            ))}
            <div className="pt-2 border-t border-border/40">
              <Link href="/login" onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm text-foreground font-medium hover:bg-white/5 transition-colors">
                Sign in →
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TERMINAL MOCKUP
══════════════════════════════════════════════════════════════════════════ */
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
  { delay: 8000, type: "info",    text: "Alerting → Slack #payments-oncall" },
  { delay: 8600, type: "success", text: "✓ Ghost report generated: GHO-00142" },
];

function TerminalMockup() {
  const [count, setCount] = useState(0);
  const [cursor, setCursor] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers = TERMINAL_LINES.map((l, i) => setTimeout(() => setCount(i + 1), l.delay));
    const blink = setInterval(() => setCursor((c) => !c), 530);
    return () => { timers.forEach(clearTimeout); clearInterval(blink); };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [count]);

  const colorClass = (type: string) => {
    switch (type) {
      case "cmd":     return "text-primary font-semibold";
      case "success": return "text-emerald-400";
      case "warn":    return "text-amber-400";
      case "error":   return "text-red-400 font-medium";
      default:        return "text-muted-foreground";
    }
  };

  return (
    <div className="relative rounded-2xl border border-primary/20 bg-[#030e0d] overflow-hidden shadow-[0_0_80px_-12px_hsl(170_100%_42%/0.3),0_0_0_1px_hsl(170_100%_42%/0.08)]">
      {/* Chrome */}
      <div className="flex items-center gap-2 border-b border-border/40 bg-black/40 px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-3 text-[11px] text-muted-foreground/50 font-mono tracking-wider">karma · agent · v1.0</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] text-primary/70 font-mono">live</span>
        </div>
      </div>
      {/* Body */}
      <div className="p-4 sm:p-5 font-mono text-[11.5px] sm:text-[12.5px] space-y-1.5 min-h-[260px] max-h-[340px] overflow-y-auto overflow-x-hidden leading-relaxed">
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
        <div ref={endRef} />
      </div>
      <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   HERO SECTION
══════════════════════════════════════════════════════════════════════════ */
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-[10%] h-[500px] w-[500px] sm:h-[700px] sm:w-[700px] rounded-full bg-primary/7 blur-[140px] animate-float-slow" />
        <div className="absolute top-[30%] -right-48 h-[400px] w-[400px] sm:h-[550px] sm:w-[550px] rounded-full bg-cyan-500/6 blur-[120px] animate-float" style={{ animationDelay: "2.5s" }} />
        <div className="absolute -bottom-48 left-[30%] h-[350px] w-[350px] sm:h-[500px] sm:w-[500px] rounded-full bg-teal-500/6 blur-[110px] animate-float-slow" style={{ animationDelay: "1.2s" }} />
      </div>
      {/* Grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.022]" aria-hidden
        style={{ backgroundImage: "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-8 py-20 sm:py-28 w-full">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          {/* Copy */}
          <div className="space-y-6 sm:space-y-8 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-3.5 py-1.5 flex-wrap">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-[11px] sm:text-[12px] font-semibold text-primary">Google Cloud Hackathon · Dynatrace Track</span>
            </div>
            <div className="space-y-4">
              <h1 className="text-[clamp(2.4rem,8vw,4.5rem)] font-black tracking-tight leading-[1.07]">
                <span className="text-foreground block">Your tests pass.</span>
                <span className="gradient-text block">Production burns.</span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg">
                Karma learns what deprecated services secretly did, then watches replacements and flags silent regressions that pass every test.
              </p>
            </div>
            <div className="flex flex-col xs:flex-row gap-3">
              <Link href="/login"
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-primary px-6 py-3.5 text-[14px] sm:text-[15px] font-bold text-primary-foreground shadow-glow-md hover:bg-primary/90 hover:shadow-[0_0_40px_-6px_hsl(170_100%_42%/0.6)] transition-all active:scale-[0.98] w-full xs:w-auto">
                <Ghost className="h-5 w-5 shrink-0" />
                Start detecting ghosts
              </Link>
              <Link href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-6 py-3.5 text-[14px] sm:text-[15px] font-medium text-foreground hover:bg-card transition-all w-full xs:w-auto">
                Live dashboard <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {["Zero config setup", "No false positives", "Real-time alerts"].map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  {s}
                </div>
              ))}
            </div>
          </div>
          {/* Terminal */}
          <div className="w-full animate-fade-in-up" style={{ animationDelay: "0.18s" }}>
            <TerminalMockup />
          </div>
        </div>
      </div>
      {/* Scroll cue */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-35 animate-bounce">
        <span className="text-[10px] text-muted-foreground tracking-[0.18em] uppercase">scroll</span>
        <div className="h-8 w-px bg-gradient-to-b from-border to-transparent" />
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   STATS STRIP
══════════════════════════════════════════════════════════════════════════ */
const STATS = [
  { value: 97,  suffix: "%",    label: "of regressions start silent",  sub: "never caught by existing tests"  },
  { value: 31,  suffix: "",     label: "avg contracts auto-discovered", sub: "per deprecated service"           },
  { value: 2,   suffix: " min", label: "to first violation alert",      sub: "from replacement deployment"      },
];

function StatsStrip() {
  const { ref, inView } = useInView(0.3);
  const v0 = useCountUp(STATS[0].value, 1600, inView);
  const v1 = useCountUp(STATS[1].value, 1500, inView);
  const v2 = useCountUp(STATS[2].value, 1200, inView);
  const vals = [v0, v1, v2];
  return (
    <section className="relative border-y border-border/50">
      <div className="absolute inset-0 bg-card/40 backdrop-blur-sm" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-8 py-12 sm:py-16">
        <div ref={ref} className="grid gap-8 sm:grid-cols-3">
          {STATS.map((s, i) => (
            <div key={s.label} className="text-center space-y-1.5">
              <p className="text-4xl sm:text-5xl lg:text-6xl font-black tabular-nums gradient-text">
                {vals[i]}{s.suffix}
              </p>
              <p className="text-[13px] sm:text-[14px] font-semibold text-foreground">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PROBLEM SECTION
══════════════════════════════════════════════════════════════════════════ */
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

function ProblemSection() {
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
          <p className="mt-4 sm:mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
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
                <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   HOW IT WORKS
══════════════════════════════════════════════════════════════════════════ */
const STEPS = [
  { num: "01", icon: Server,       title: "Register",          desc: "Point Karma at any deprecated service. No instrumentation needed — it reads your existing Dynatrace data via MCP.",                                                             accent: "border-primary/40 bg-primary/10 text-primary" },
  { num: "02", icon: Brain,        title: "Observe & Learn",   desc: "The Learner Agent runs a configurable observation window, extracting implicit contracts: latency bands, error semantics, side effects, throughput ceilings.",                     accent: "border-cyan-400/40 bg-cyan-400/10 text-cyan-400" },
  { num: "03", icon: GitMerge,     title: "Compare",           desc: "When the replacement deploys, the Haunter Agent continuously compares its behavior against every contract the Learner discovered — automatically.",                              accent: "border-amber-400/40 bg-amber-400/10 text-amber-400" },
  { num: "04", icon: AlertOctagon, title: "Alert & Remediate", desc: "Violations surface as ghost reports in real-time: severity triage, root cause, remediation suggestions, and Dynatrace evidence links.",                                        accent: "border-red-400/40 bg-red-400/10 text-red-400" },
];

function HowItWorks() {
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
                <span className="absolute top-4 right-5 text-5xl sm:text-6xl font-black text-muted-foreground/[0.07] select-none leading-none tabular-nums">{step.num}</span>
                <div className={cn("inline-flex h-11 w-11 items-center justify-center rounded-xl border", step.accent)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-[15px] font-bold text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   GHOST LIFECYCLE SECTION
══════════════════════════════════════════════════════════════════════════ */

/* Rising bioluminescent particles */
function GhostParticles() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    size:     2 + (i % 3),
    left:     (i * 3.37 + 5) % 100,
    bottom:   8 + (i * 4.1) % 55,
    delay:    (i * 0.28) % 7,
    duration: 4 + (i % 5),
    color:    i % 3 === 0 ? "bg-primary/40" : i % 3 === 1 ? "bg-cyan-400/30" : "bg-emerald-400/25",
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div key={p.id}
          className={cn("absolute rounded-full animate-particle-rise", p.color)}
          style={{ width: p.size, height: p.size, left: `${p.left}%`, bottom: `${p.bottom}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }} />
      ))}
    </div>
  );
}

/* Animated contract tag (floating around learning ghost) */
const CONTRACT_TAGS = [
  { text: "latency",       cls: "top-0 -left-4 sm:-left-6  -translate-y-full rotate-[-8deg]",  color: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  { text: "side_effect",   cls: "top-2 -right-4 sm:-right-6 rotate-[6deg]",                    color: "border-violet-500/40 bg-violet-500/10 text-violet-300" },
  { text: "error_semantics", cls: "bottom-4 -left-3 sm:-left-5 rotate-[4deg]",                 color: "border-red-500/40 bg-red-500/10 text-red-300" },
  { text: "throughput",    cls: "bottom-0 -right-4 sm:-right-5 rotate-[-7deg]",                color: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
];

function ContractTag({ tag, show }: { tag: typeof CONTRACT_TAGS[0]; show: boolean }) {
  return (
    <div className={cn(
      "absolute whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide transition-all duration-500 backdrop-blur-sm",
      "block md:hidden lg:block",
      tag.cls, tag.color,
      show ? "opacity-100 scale-100 animate-contract-appear" : "opacity-0 scale-75"
    )}>
      {tag.text}
    </div>
  );
}

/* Violation badge (floating near haunter ghost) */
function ViolationBadge({ show }: { show: boolean }) {
  return (
    <div className={cn(
      "absolute -top-5 -right-3 rounded-xl border border-red-500/50 bg-red-500/15 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-700",
      "shadow-[0_0_20px_-4px_hsl(0_72%_51%/0.5)]",
      show ? "opacity-100 scale-100 animate-fade-in-up" : "opacity-0 scale-75"
    )}>
      <p className="text-[10px] font-mono font-bold text-red-400 whitespace-nowrap">✗ CRITICAL</p>
      <p className="text-[9px] text-red-400/70 font-mono whitespace-nowrap">side_effect</p>
    </div>
  );
}

const GHOST_STAGES = [
  {
    phase: "01 · Deprecated",
    title: "The Ghost is Born",
    desc: "A service is marked for retirement. Its implicit contracts — side effects, timing, error behavior — live only inside traffic patterns no one ever wrote down.",
    ghostColor: "text-muted-foreground/60",
    ringColor: "border-muted-foreground/25",
    glowColor: "bg-muted-foreground/10",
    shadowGlow: "",
    badgeColor: "border-border bg-muted/50 text-muted-foreground",
    animation: "animate-float-slow",
    animDelay: "0s",
    extra: "deprecated",
  },
  {
    phase: "02 · Learning",
    title: "The Ghost Absorbs",
    desc: "Karma's Learner Agent observes every trace, extracting the hidden contracts. The ghost grows — a precise behavioral model of the dead service crystallising in the abyss.",
    ghostColor: "text-primary",
    ringColor: "border-primary/40",
    glowColor: "bg-primary/15",
    shadowGlow: "shadow-glow-md",
    badgeColor: "border-primary/35 bg-primary/10 text-primary",
    animation: "animate-ghost-wobble",
    animDelay: "0s",
    extra: "learning",
  },
  {
    phase: "03 · Haunting",
    title: "The Ghost Strikes",
    desc: "The replacement goes live. The ghost watches. The moment behavior diverges from what it learned, a violation surfaces — severity-triaged, explained, and ready to act on.",
    ghostColor: "text-red-400",
    ringColor: "border-red-400/40",
    glowColor: "bg-red-500/12",
    shadowGlow: "shadow-[0_0_40px_-8px_hsl(0_72%_51%/0.45)]",
    badgeColor: "border-red-500/35 bg-red-500/10 text-red-400",
    animation: "animate-ghost-alarm",
    animDelay: "0s",
    extra: "haunting",
  },
];

function GhostConnector({ color = "primary", vertical = false }: { color?: "primary" | "red"; vertical?: boolean }) {
  const dotColor = color === "red" ? "bg-red-400/50" : "bg-primary/50";
  const arrowColor = color === "red" ? "text-red-400/50" : "text-primary/50";
  if (vertical) {
    return (
      <div className="flex md:hidden justify-center py-2">
        <div className="flex flex-col items-center gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn("h-1.5 w-1.5 rounded-full animate-pulse", dotColor)} style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
          <ChevronDown className={cn("h-5 w-5 mt-0.5", arrowColor)} />
        </div>
      </div>
    );
  }
  return (
    <div className="hidden md:flex flex-col items-center justify-center px-2 lg:px-4 mt-14 shrink-0">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={cn("h-1.5 w-1.5 rounded-full animate-pulse", dotColor)} style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
        <ArrowRight className={cn("h-5 w-5 shrink-0 ml-0.5", arrowColor)} />
      </div>
    </div>
  );
}

function GhostSection() {
  const { ref, inView } = useInView(0.08);
  return (
    <section id="ghost-lifecycle" className="relative py-20 sm:py-28 overflow-hidden">
      {/* Deep ocean backdrop */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-[hsl(186_60%_2.5%)] to-background" />
      {/* Ocean-floor grid */}
      <div className="absolute inset-0 opacity-[0.035]" aria-hidden
        style={{ backgroundImage: "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)", backgroundSize: "38px 38px" }} />
      {/* Fade edges */}
      <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-background to-transparent pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      {/* Rising particles */}
      <GhostParticles />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-8">
        {/* Header */}
        <div ref={ref} className={cn("text-center mb-14 sm:mb-20 transition-all duration-700", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8")}>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-4 py-1.5 mb-5">
            <Ghost className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-[11.5px] font-semibold text-primary">The Ghost Lifecycle</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
            Deprecated services don't die.
            <br />
            <span className="gradient-text">They haunt you.</span>
          </h2>
          <p className="mt-4 sm:mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Every deprecated service leaves a ghost — a behavioral shadow that lingers and watches its replacement for signs of betrayal.
          </p>
        </div>

        {/* Ghost entities */}
        <div className="flex flex-col md:flex-row md:items-start">
          {GHOST_STAGES.map((stage, i) => (
            <Fragment key={stage.phase}>
              <div
                className={cn("flex-1 min-w-0 flex flex-col items-center text-center transition-all duration-700", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12")}
                style={{ transitionDelay: inView ? `${i * 180}ms` : "0ms" }}>
                {/* Ghost entity */}
                <div className="relative mb-6 sm:mb-8">
                  {/* Outer ambient glow */}
                  <div className={cn("absolute -inset-6 sm:-inset-10 rounded-full blur-2xl animate-glow-breathe", stage.glowColor)}
                    style={{ animationDelay: `${i}s` }} />
                  {/* Slow-orbit ring */}
                  <div className={cn("absolute -inset-4 sm:-inset-5 rounded-full border opacity-20 animate-spin-slow", stage.ringColor)}
                    style={{ animationDuration: `${12 + i * 3}s` }} />
                  {/* Ping ring for learning ghost */}
                  {stage.extra === "learning" && (
                    <div className={cn("absolute -inset-2 rounded-full border animate-ping opacity-25", stage.ringColor)} />
                  )}
                  {/* Ghost container */}
                  <div className={cn(
                    "relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full border-2 bg-background/60 backdrop-blur-sm",
                    stage.ringColor, stage.shadowGlow
                  )}>
                    {/* Extra glow layers for learning */}
                    {stage.extra === "learning" && (
                      <>
                        <div className="absolute inset-2 rounded-full bg-primary/10 blur-sm" />
                        <div className="absolute inset-0 rounded-full bg-primary/5" />
                      </>
                    )}
                    <Ghost className={cn("h-12 w-12 sm:h-14 sm:w-14 relative z-10", stage.ghostColor, stage.animation)}
                      style={{ animationDelay: stage.animDelay }} />
                    {/* Contract tags floating around learning ghost */}
                    {stage.extra === "learning" && CONTRACT_TAGS.map((tag) => (
                      <ContractTag key={tag.text} tag={tag} show={inView} />
                    ))}
                    {/* Violation badge on haunting ghost */}
                    {stage.extra === "haunting" && <ViolationBadge show={inView} />}
                  </div>
                  {/* Phase badge */}
                  <div className={cn("absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap backdrop-blur-sm", stage.badgeColor)}>
                    {stage.phase}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2 max-w-xs px-2">
                  <h3 className="text-lg sm:text-xl font-black text-foreground">{stage.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{stage.desc}</p>
                </div>

                {/* Mobile vertical connector (not after last) */}
                {i < 2 && <GhostConnector color={i === 1 ? "red" : "primary"} vertical />}
              </div>

              {/* Desktop horizontal connector */}
              {i < 2 && <GhostConnector color={i === 1 ? "red" : "primary"} />}
            </Fragment>
          ))}
        </div>

        {/* Bottom callout */}
        <div className={cn(
          "mt-16 sm:mt-20 rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8 text-center space-y-3 transition-all duration-700 max-w-2xl mx-auto",
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )} style={{ transitionDelay: inView ? "600ms" : "0ms" }}>
          <div className="flex justify-center gap-3">
            {/* Three ghost size variants to show "the abyss" */}
            <Ghost className="h-6 w-6 text-muted-foreground/25 animate-float-slow" style={{ animationDelay: "0s" } as React.CSSProperties} />
            <Ghost className="h-8 w-8 text-primary/60 animate-ghost-wobble" />
            <Ghost className="h-6 w-6 text-muted-foreground/25 animate-float-slow" style={{ animationDelay: "1.5s" } as React.CSSProperties} />
          </div>
          <p className="text-sm sm:text-base font-semibold text-foreground">
            "In the deep, every ghost that goes undetected becomes a liability."
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Karma ensures no ghost haunts your production system unchallenged.
          </p>
          <Link href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-primary/15 border border-primary/30 px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors">
            <Ghost className="h-4 w-4" />
            Exorcise your ghosts
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FEATURES GRID
══════════════════════════════════════════════════════════════════════════ */
const FEATURES = [
  { icon: Brain,       title: "AI Contract Learning",      desc: "The Learner Agent uses Google ADK + Gemini to analyze Dynatrace traces and extract implicit behavioral contracts — zero manual spec writing.",               badge: "ADK v1.0",    badgeColor: "bg-blue-500/15 text-blue-400 border-blue-500/25",     accent: "group-hover:border-blue-500/30"    },
  { icon: Ghost,       title: "Ghost Detection Engine",    desc: "The Haunter Agent continuously compares replacement behavior against every learned contract, generating structured violation reports the moment drift is detected.", badge: "Real-time",  badgeColor: "bg-primary/15 text-primary border-primary/30",         accent: "group-hover:border-primary/30"     },
  { icon: Activity,    title: "Dynatrace Native",          desc: "Built on the official Dynatrace MCP server. No new agents to deploy, no SDK changes. Karma reads the observability data you already collect.",                   badge: "MCP",         badgeColor: "bg-violet-500/15 text-violet-400 border-violet-500/25", accent: "group-hover:border-violet-500/30" },
  { icon: Cpu,         title: "Multi-Agent Orchestration", desc: "Orchestrator, Learner, and Haunter agents coordinate via ADK to cover the full migration lifecycle from first observation to final sign-off.",                   badge: "3 agents",   badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", accent: "group-hover:border-emerald-500/30" },
  { icon: Bell,        title: "Live Violation Alerts",     desc: "Ghost reports stream to the dashboard via Server-Sent Events the instant they're generated. Severity triage and remediation suggestions included.",              badge: "SSE",         badgeColor: "bg-red-500/15 text-red-400 border-red-500/25",         accent: "group-hover:border-red-500/30"     },
  { icon: TrendingUp,  title: "Contract Timeline",         desc: "A visual audit trail of every contract discovered, validated, or violated across the full migration window — sorted by priority and confidence.",                badge: "Audit trail", badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/25",   accent: "group-hover:border-amber-500/30"  },
];

function FeaturesGrid() {
  const { ref, inView } = useInView();
  return (
    <section className="py-20 sm:py-28 relative">
      <div className="absolute inset-0 bg-card/20" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-8">
        <div ref={ref} className={cn("text-center mb-12 sm:mb-16 transition-all duration-700", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8")}>
          <div className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 mb-5">
            <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-[11.5px] font-semibold text-muted-foreground">Features</span>
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
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TECH STACK
══════════════════════════════════════════════════════════════════════════ */
const TECH = [
  { name: "Google ADK v1.0",    icon: Cpu,      color: "border-blue-500/30 bg-blue-500/8 text-blue-300 hover:bg-blue-500/14" },
  { name: "Dynatrace MCP",      icon: Activity, color: "border-violet-500/30 bg-violet-500/8 text-violet-300 hover:bg-violet-500/14" },
  { name: "Gemini 2.0 Flash",   icon: Brain,    color: "border-primary/30 bg-primary/8 text-primary hover:bg-primary/14" },
  { name: "FastAPI",            icon: Zap,      color: "border-emerald-500/30 bg-emerald-500/8 text-emerald-300 hover:bg-emerald-500/14" },
  { name: "Next.js 15",         icon: Code2,    color: "border-border bg-card text-foreground hover:bg-card/80" },
  { name: "Firebase Auth",      icon: Shield,   color: "border-amber-500/30 bg-amber-500/8 text-amber-300 hover:bg-amber-500/14" },
  { name: "Tailwind CSS",       icon: Layers,   color: "border-sky-500/30 bg-sky-500/8 text-sky-300 hover:bg-sky-500/14" },
  { name: "Server-Sent Events", icon: Bell,     color: "border-red-500/30 bg-red-500/8 text-red-300 hover:bg-red-500/14" },
];

function TechStack() {
  const { ref, inView } = useInView();
  return (
    <section id="tech-stack" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div ref={ref} className={cn("text-center mb-10 sm:mb-14 transition-all duration-700", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8")}>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Built on a <span className="gradient-text">best-in-class stack.</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-md mx-auto leading-relaxed text-sm sm:text-base">
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

/* ══════════════════════════════════════════════════════════════════════════
   CTA SECTION
══════════════════════════════════════════════════════════════════════════ */
function CTASection() {
  const { ref, inView } = useInView();
  return (
    <section className="py-20 sm:py-28 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] sm:h-[500px] sm:w-[800px] rounded-full bg-primary/6 blur-[100px] animate-glow-breathe" />
      </div>
      <div ref={ref} className={cn("relative mx-auto max-w-3xl px-4 sm:px-8 text-center space-y-6 sm:space-y-8 transition-all duration-700", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10")}>
        <div className="space-y-4 sm:space-y-5">
          <h2 className="text-[clamp(2.2rem,7vw,4rem)] font-black tracking-tight leading-tight">
            Stop guessing.<br /><span className="gradient-text">Start knowing.</span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Give your migration team the confidence to ship. Register your first deprecated service and let Karma do the rest.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
          <Link href="/login"
            className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-primary px-7 sm:px-9 py-3.5 sm:py-4 text-[14px] sm:text-[15px] font-bold text-primary-foreground shadow-glow-md hover:bg-primary/90 hover:shadow-[0_0_50px_-8px_hsl(170_100%_42%/0.65)] transition-all active:scale-[0.98] w-full sm:w-auto">
            <Ghost className="h-5 w-5" />
            Start for free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-7 sm:px-9 py-3.5 sm:py-4 text-[14px] sm:text-[15px] font-medium text-foreground hover:bg-card transition-all w-full sm:w-auto">
            Explore dashboard
          </Link>
        </div>
        <p className="text-xs text-muted-foreground/50">Google Cloud Rapid Agent Hackathon · Dynatrace Track · 2026</p>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FOOTER
══════════════════════════════════════════════════════════════════════════ */
function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-8 sm:py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/25">
              <Ghost className="h-[15px] w-[15px] text-primary" />
            </div>
            <span className="text-sm font-extrabold gradient-text">Karma</span>
            <span className="text-xs text-muted-foreground/50 hidden sm:block">— The Reincarnation Agent</span>
          </div>
          <p className="text-xs text-muted-foreground/45 text-center order-last sm:order-none">
            © 2026 Karma · Google Cloud Rapid Agent Hackathon · Dynatrace Track
          </p>
          <div className="flex items-center gap-4 sm:gap-5">
            <Link href="/login"         className="text-xs text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
            <Link href="/dashboard"     className="text-xs text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
            <Link href="#ghost-lifecycle" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Ghost Lifecycle</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ROOT PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <NavBar />
      <main>
        <HeroSection />
        <StatsStrip />
        <ProblemSection />
        <HowItWorks />
        <GhostSection />
        <FeaturesGrid />
        <TechStack />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
