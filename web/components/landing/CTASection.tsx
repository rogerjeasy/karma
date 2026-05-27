"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Ghost, ArrowRight } from "lucide-react";
import { useInView } from "./hooks";

export default function CTASection() {
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
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl mx-auto">
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
        <p className="text-xs text-slate-400">Google Cloud Rapid Agent Hackathon · Dynatrace Track · 2026</p>
      </div>
    </section>
  );
}
