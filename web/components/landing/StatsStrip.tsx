"use client";

import { useState, useEffect } from "react";
import { useInView, useCountUp } from "./hooks";

const STAT_META = [
  { suffix: "%",    label: "of regressions start silent",  sub: "never caught by existing tests"  },
  { suffix: "",     label: "avg contracts auto-discovered", sub: "per deprecated service"           },
  { suffix: " min", label: "to first violation alert",      sub: "from replacement deployment"      },
];

interface PlatformStats {
  pct_services_with_violations: number | null;
  avg_contracts_per_service: number | null;
  avg_minutes_to_first_alert: number | null;
}

const FALLBACKS = [97, 31, 2];

export default function StatsStrip() {
  const { ref, inView } = useInView(0.3);
  const [targets, setTargets] = useState(FALLBACKS);
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
          setTargets([
            Math.round(data.pct_services_with_violations ?? FALLBACKS[0]),
            Math.round(data.avg_contracts_per_service    ?? FALLBACKS[1]),
            Math.round(data.avg_minutes_to_first_alert   ?? FALLBACKS[2]),
          ]);
        }
        setReady(true);
      });

    return () => { ctrl.abort(); clearTimeout(timeout); };
  }, []);

  const trigger = inView && ready;
  const v0 = useCountUp(targets[0], 1600, trigger);
  const v1 = useCountUp(targets[1], 1500, trigger);
  const v2 = useCountUp(targets[2], 1200, trigger);
  const vals = [v0, v1, v2];

  return (
    <section className="relative border-y border-border/50">
      <div className="absolute inset-0 bg-card/40 backdrop-blur-sm" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-8 py-12 sm:py-16">
        <div ref={ref} className="grid gap-8 sm:grid-cols-3">
          {STAT_META.map((s, i) => (
            <div key={s.label} className="text-center space-y-1.5">
              <p className="text-4xl sm:text-5xl lg:text-6xl font-black tabular-nums gradient-text">
                {vals[i]}{s.suffix}
              </p>
              <p className="text-[13px] sm:text-[14px] font-semibold text-foreground">{s.label}</p>
              <p className="text-xs text-slate-300">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
