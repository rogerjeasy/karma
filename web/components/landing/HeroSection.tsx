"use client";

import Link from "next/link";
import { Ghost, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import TerminalMockup from "./TerminalMockup";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-[10%] h-[500px] w-[500px] sm:h-[700px] sm:w-[700px] rounded-full bg-primary/7 blur-[140px] animate-float-slow" />
        <div className="absolute top-[30%] -right-48 h-[400px] w-[400px] sm:h-[550px] sm:w-[550px] rounded-full bg-cyan-500/6 blur-[120px] animate-float" style={{ animationDelay: "2.5s" }} />
        <div className="absolute -bottom-48 left-[30%] h-[350px] w-[350px] sm:h-[500px] sm:w-[500px] rounded-full bg-teal-500/6 blur-[110px] animate-float-slow" style={{ animationDelay: "1.2s" }} />
      </div>
      <div className="pointer-events-none absolute inset-0 opacity-[0.022]" aria-hidden
        style={{ backgroundImage: "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-8 py-20 sm:py-28 w-full">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
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
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-lg">
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
                Live dashboard <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {["Zero config setup", "No false positives", "Real-time alerts"].map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-sm text-slate-300">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  {s}
                </div>
              ))}
            </div>
          </div>
          <div className="w-full animate-fade-in-up" style={{ animationDelay: "0.18s" }}>
            <TerminalMockup />
          </div>
        </div>
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-35 animate-bounce">
        <span className="text-[10px] text-slate-400 tracking-[0.18em] uppercase">scroll</span>
        <div className="h-8 w-px bg-gradient-to-b from-border to-transparent" />
      </div>
    </section>
  );
}
