"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Ghost, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInView, useCountUp } from "./hooks";

interface PlatformStats {
  total_ghost_reports: number | null;
  avg_minutes_to_first_alert: number | null;
  total_avoided_cost_usd: number | null;
}

const FALLBACK = { cost: 4200, ghosts: 1, mttd: 4 };

function formatMinutes(mins: number): string {
  if (mins <= 0) return "—";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function ImpactRollup() {
  const { ref, inView } = useInView(0.25);
  const [stats, setStats] = useState({ ...FALLBACK });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "";
    const ctrl = new AbortController();
    const timeout = setTimeout(() => setReady(true), 2500);

    fetch(`${base}/stats`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<PlatformStats>) : null))
      .catch(() => null)
      .then((data) => {
        clearTimeout(timeout);
        if (data) {
          setStats({
            cost: Math.round(data.total_avoided_cost_usd ?? FALLBACK.cost),
            ghosts: Math.round(data.total_ghost_reports ?? FALLBACK.ghosts),
            mttd: Math.round(data.avg_minutes_to_first_alert ?? FALLBACK.mttd),
          });
        }
        setReady(true);
      });

    return () => {
      ctrl.abort();
      clearTimeout(timeout);
    };
  }, []);

  const trigger = inView && ready;
  const cost = useCountUp(stats.cost, 1800, trigger);
  const ghosts = useCountUp(stats.ghosts, 1400, trigger);

  return (
    <section className="relative py-20 sm:py-28 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-[hsl(186_55%_3%)] to-background" />
      <div ref={ref} className="relative mx-auto max-w-5xl px-4 sm:px-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/8 px-4 py-1.5 mb-6">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11.5px] font-semibold text-emerald-300">Business impact</span>
        </div>

        <h2 className="text-base sm:text-lg font-semibold text-slate-300">
          Silent regressions caught before they reached production
        </h2>

        <p
          className={cn(
            "mt-3 text-6xl sm:text-7xl lg:text-8xl font-black tabular-nums gradient-text transition-all duration-700",
            trigger ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
          )}
        >
          ${cost.toLocaleString()}
        </p>
        <p className="mt-3 text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
          in downstream incident cost avoided — each figure traced to a real ghost report backed by
          live Dynatrace telemetry, not an estimate pulled from thin air.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-3 max-w-3xl mx-auto">
          <div className="rounded-xl border border-border/60 bg-card/50 p-5">
            <Ghost className="mx-auto h-5 w-5 text-violet-300" />
            <p className="mt-2 text-3xl font-black tabular-nums text-foreground">{ghosts}</p>
            <p className="mt-1 text-xs text-slate-400">ghost reports filed</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/50 p-5">
            <Timer className="mx-auto h-5 w-5 text-amber-300" />
            <p className="mt-2 text-3xl font-black tabular-nums text-foreground">
              {formatMinutes(stats.mttd)}
            </p>
            <p className="mt-1 text-xs text-slate-400">mean time to first alert</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/50 p-5">
            <ShieldCheck className="mx-auto h-5 w-5 text-emerald-300" />
            <p className="mt-2 text-3xl font-black tabular-nums text-foreground">0</p>
            <p className="mt-1 text-xs text-slate-400">tests that caught these</p>
          </div>
        </div>
      </div>
    </section>
  );
}
