"use client";

import { Fragment } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Ghost, ArrowRight, ChevronDown } from "lucide-react";
import { useInView } from "./hooks";

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

const CONTRACT_TAGS = [
  { text: "latency",         cls: "top-0 -left-4 sm:-left-6  -translate-y-full rotate-[-8deg]", color: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  { text: "side_effect",     cls: "top-2 -right-4 sm:-right-6 rotate-[6deg]",                   color: "border-violet-500/40 bg-violet-500/10 text-violet-300" },
  { text: "error_semantics", cls: "bottom-4 -left-3 sm:-left-5 rotate-[4deg]",                  color: "border-red-500/40 bg-red-500/10 text-red-300" },
  { text: "throughput",      cls: "bottom-0 -right-4 sm:-right-5 rotate-[-7deg]",               color: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
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
    ringColor:  "border-muted-foreground/25",
    glowColor:  "bg-muted-foreground/10",
    shadowGlow: "",
    badgeColor: "border-border bg-muted/50 text-muted-foreground",
    animation:  "animate-float-slow",
    animDelay:  "0s",
    extra:      "deprecated",
  },
  {
    phase: "02 · Learning",
    title: "The Ghost Absorbs",
    desc: "Karma's Learner Agent observes every trace, extracting the hidden contracts. The ghost grows — a precise behavioral model of the dead service crystallising in the abyss.",
    ghostColor: "text-primary",
    ringColor:  "border-primary/40",
    glowColor:  "bg-primary/15",
    shadowGlow: "shadow-glow-md",
    badgeColor: "border-primary/35 bg-primary/10 text-primary",
    animation:  "animate-ghost-wobble",
    animDelay:  "0s",
    extra:      "learning",
  },
  {
    phase: "03 · Haunting",
    title: "The Ghost Strikes",
    desc: "The replacement goes live. The ghost watches. The moment behavior diverges from what it learned, a violation surfaces — severity-triaged, explained, and ready to act on.",
    ghostColor: "text-red-400",
    ringColor:  "border-red-400/40",
    glowColor:  "bg-red-500/12",
    shadowGlow: "shadow-[0_0_40px_-8px_hsl(0_72%_51%/0.45)]",
    badgeColor: "border-red-500/35 bg-red-500/10 text-red-400",
    animation:  "animate-ghost-alarm",
    animDelay:  "0s",
    extra:      "haunting",
  },
];

function GhostConnector({ color = "primary", vertical = false }: { color?: "primary" | "red"; vertical?: boolean }) {
  const dotColor   = color === "red" ? "bg-red-400/50" : "bg-primary/50";
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

export default function GhostSection() {
  const { ref, inView } = useInView(0.08);
  return (
    <section id="ghost-lifecycle" className="relative py-20 sm:py-28 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-[hsl(186_60%_2.5%)] to-background" />
      <div className="absolute inset-0 opacity-[0.035]" aria-hidden
        style={{ backgroundImage: "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)", backgroundSize: "38px 38px" }} />
      <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-background to-transparent pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      <GhostParticles />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-8">
        <div ref={ref} className={cn("text-center mb-14 sm:mb-20 transition-all duration-700", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8")}>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-4 py-1.5 mb-5">
            <Ghost className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-[11.5px] font-semibold text-primary">The Ghost Lifecycle</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
            Deprecated services don&apos;t die.
            <br />
            <span className="gradient-text">They haunt you.</span>
          </h2>
          <p className="mt-4 sm:mt-5 text-base sm:text-lg text-slate-300 max-w-xl mx-auto leading-relaxed">
            Every deprecated service leaves a ghost — a behavioral shadow that lingers and watches its replacement for signs of betrayal.
          </p>
        </div>

        <div className="flex flex-col md:flex-row md:items-start">
          {GHOST_STAGES.map((stage, i) => (
            <Fragment key={stage.phase}>
              <div
                className={cn("flex-1 min-w-0 flex flex-col items-center text-center transition-all duration-700", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12")}
                style={{ transitionDelay: inView ? `${i * 180}ms` : "0ms" }}>
                <div className="relative mb-6 sm:mb-8">
                  <div className={cn("absolute -inset-6 sm:-inset-10 rounded-full blur-2xl animate-glow-breathe", stage.glowColor)}
                    style={{ animationDelay: `${i}s` }} />
                  <div className={cn("absolute -inset-4 sm:-inset-5 rounded-full border opacity-20 animate-spin-slow", stage.ringColor)}
                    style={{ animationDuration: `${12 + i * 3}s` }} />
                  {stage.extra === "learning" && (
                    <div className={cn("absolute -inset-2 rounded-full border animate-ping opacity-25", stage.ringColor)} />
                  )}
                  <div className={cn(
                    "relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full border-2 bg-background/60 backdrop-blur-sm",
                    stage.ringColor, stage.shadowGlow
                  )}>
                    {stage.extra === "learning" && (
                      <>
                        <div className="absolute inset-2 rounded-full bg-primary/10 blur-sm" />
                        <div className="absolute inset-0 rounded-full bg-primary/5" />
                      </>
                    )}
                    <Ghost className={cn("h-12 w-12 sm:h-14 sm:w-14 relative z-10", stage.ghostColor, stage.animation)}
                      style={{ animationDelay: stage.animDelay }} />
                    {stage.extra === "learning" && CONTRACT_TAGS.map((tag) => (
                      <ContractTag key={tag.text} tag={tag} show={inView} />
                    ))}
                    {stage.extra === "haunting" && <ViolationBadge show={inView} />}
                  </div>
                  <div className={cn("absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap backdrop-blur-sm", stage.badgeColor)}>
                    {stage.phase}
                  </div>
                </div>

                <div className="space-y-2 max-w-xs px-2">
                  <h3 className="text-lg sm:text-xl font-black text-foreground">{stage.title}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{stage.desc}</p>
                </div>

                {i < 2 && <GhostConnector color={i === 1 ? "red" : "primary"} vertical />}
              </div>

              {i < 2 && <GhostConnector color={i === 1 ? "red" : "primary"} />}
            </Fragment>
          ))}
        </div>

        <div className={cn(
          "mt-16 sm:mt-20 rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8 text-center space-y-3 transition-all duration-700 max-w-2xl mx-auto",
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )} style={{ transitionDelay: inView ? "600ms" : "0ms" }}>
          <div className="flex justify-center gap-3">
            <Ghost className="h-6 w-6 text-muted-foreground/25 animate-float-slow" style={{ animationDelay: "0s" }} />
            <Ghost className="h-8 w-8 text-primary/60 animate-ghost-wobble" />
            <Ghost className="h-6 w-6 text-muted-foreground/25 animate-float-slow" style={{ animationDelay: "1.5s" }} />
          </div>
          <p className="text-sm sm:text-base font-semibold text-foreground">
            &ldquo;In the deep, every ghost that goes undetected becomes a liability.&rdquo;
          </p>
          <p className="text-xs sm:text-sm text-slate-300">
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
