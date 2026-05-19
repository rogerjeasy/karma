"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Server, Ghost, FileCode2, Activity,
  ArrowRight, Plus, Zap, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Stats {
  totalServices: number;
  activeGhosts: number;
  contractsLearned: number;
  learningPhase: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL;
    Promise.all([
      fetch(`${api}/services`).then((r) => r.json()).catch(() => []),
      fetch(`${api}/ghosts?limit=50`).then((r) => r.json()).catch(() => []),
    ]).then(async ([services, ghosts]) => {
      const arr: { service_id: string; phase: string }[] = Array.isArray(services) ? services : [];

      // Fetch contract counts for all services in parallel
      const contractCounts = await Promise.all(
        arr.map((s) =>
          fetch(`${api}/contracts/${s.service_id}`)
            .then((r) => r.json())
            .then((c) => (Array.isArray(c) ? c.length : 0))
            .catch(() => 0)
        )
      );

      setStats({
        totalServices:   arr.length,
        activeGhosts:    Array.isArray(ghosts) ? ghosts.length : 0,
        contractsLearned: contractCounts.reduce((a, b) => a + b, 0),
        learningPhase:   arr.filter((s) => s.phase === "learning").length,
      });
    });
  }, []);

  const cards = [
    {
      label: "Total Services",
      value: stats?.totalServices ?? null,
      icon: Server,
      href: "/dashboard/services",
      accent: "from-blue-500/20 to-blue-600/5 border-blue-500/20",
      iconClass: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      glow: "group-hover:shadow-[0_0_20px_-4px_rgba(59,130,246,0.3)]",
    },
    {
      label: "Active Ghosts",
      value: stats?.activeGhosts ?? null,
      icon: Ghost,
      href: "/dashboard/ghosts",
      accent: "from-red-500/20 to-red-600/5 border-red-500/20",
      iconClass: "text-red-400 bg-red-500/10 border-red-500/20",
      glow: "group-hover:shadow-[0_0_20px_-4px_rgba(239,68,68,0.3)]",
    },
    {
      label: "Contracts Learned",
      value: stats?.contractsLearned ?? null,
      icon: FileCode2,
      href: "/dashboard/timeline",
      accent: "from-teal-500/20 to-teal-600/5 border-teal-500/20",
      iconClass: "text-teal-400 bg-teal-500/10 border-teal-500/20",
      glow: "group-hover:shadow-[0_0_20px_-4px_rgba(0,212,168,0.3)]",
    },
    {
      label: "In Learning Phase",
      value: stats?.learningPhase ?? null,
      icon: Activity,
      href: "/dashboard/services",
      accent: "from-amber-500/20 to-amber-600/5 border-amber-500/20",
      iconClass: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      glow: "group-hover:shadow-[0_0_20px_-4px_rgba(245,158,11,0.3)]",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* ── Page header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Services under observation, ghost activity, and discovered contracts.
          </p>
        </div>
        <Link href="/dashboard/services">
          <Button size="sm" className="gap-2 shrink-0">
            <Plus className="h-3.5 w-3.5" />
            Register service
          </Button>
        </Link>
      </div>

      {/* ── Stats grid ── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={cn(
              "group relative overflow-hidden rounded-xl border border-border bg-card p-5",
              "transition-all duration-250 hover:-translate-y-0.5 hover:border-border/70",
              "hover:shadow-card-hover",
              card.glow
            )}
          >
            {/* Background gradient */}
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300", card.accent)} />

            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className={cn("rounded-lg p-2 border", card.iconClass)}>
                  <card.icon className="h-4 w-4" />
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground/70" />
              </div>
              <div>
                {stats === null ? (
                  <div className="h-8 w-12 rounded bg-muted animate-pulse mb-1" />
                ) : (
                  <p className="text-3xl font-bold tracking-tight tabular-nums">{card.value}</p>
                )}
                <p className="text-xs font-medium text-muted-foreground mt-0.5">{card.label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Platform overview ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Getting started / empty state */}
        <div className="lg:col-span-2 rounded-xl border border-dashed border-border/70 bg-card/40 p-10 flex flex-col items-center justify-center text-center min-h-[260px]">
          <div className="relative mb-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-card">
              <Ghost className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <div className="absolute -inset-1.5 rounded-2xl border border-primary/10 animate-pulse" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No ghosts yet</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs leading-relaxed">
            Register a deprecated service to start the learning phase and automatically discover implicit contracts.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
            <Link href="/dashboard/services">
              <Button className="gap-2">
                <Zap className="h-4 w-4" />
                Register a service
              </Button>
            </Link>
            <Link href="/dashboard/timeline">
              <Button variant="outline" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                View contracts
              </Button>
            </Link>
          </div>
        </div>

        {/* Phase legend */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Service Phases</h3>
          <div className="space-y-3">
            {PHASES.map((p) => (
              <div key={p.label} className="flex items-start gap-3">
                <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", p.icon)} />
                <div>
                  <p className="text-[13px] font-medium text-foreground leading-none">{p.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const PHASES = [
  {
    label: "Registered",
    desc: "Service is queued for deprecation tracking.",
    icon: "bg-zinc-500/15 border-zinc-500/40 before:content-[''] text-zinc-400",
  },
  {
    label: "Learning",
    desc: "Agent is observing traffic and extracting implicit contracts.",
    icon: "bg-amber-500/15 border-amber-500/40 text-amber-400",
  },
  {
    label: "Haunting",
    desc: "Replacement service is live; agent is comparing behaviour.",
    icon: "bg-red-500/15 border-red-500/40 text-red-400",
  },
  {
    label: "Completed",
    desc: "Migration validated. No further action required.",
    icon: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400",
  },
];
