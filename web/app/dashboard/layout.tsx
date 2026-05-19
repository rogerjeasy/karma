"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Server,
  Ghost,
  Activity,
  Menu,
  X,
  Zap,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",          label: "Overview",  icon: LayoutDashboard, exact: true },
  { href: "/dashboard/services", label: "Services",  icon: Server },
  { href: "/dashboard/ghosts",   label: "Ghosts",    icon: Ghost },
  { href: "/dashboard/timeline", label: "Timeline",  icon: Activity },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => setSidebarOpen(false), [pathname]);

  // Lock body scroll while mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col w-64",
          "bg-card border-r border-border shadow-sidebar",
          "transition-transform [transition-duration:280ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
          "lg:static lg:translate-x-0 lg:z-auto lg:shadow-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 border border-primary/25 shadow-glow-sm">
            <Ghost className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-bold text-foreground leading-none">Karma</span>
            <span className="text-[10px] text-muted-foreground/70 leading-none mt-0.5 truncate">
              Reincarnation Agent
            </span>
          </div>
          <button
            aria-label="Close sidebar"
            className="ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 select-none">
            Main menu
          </p>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}

          <Separator className="my-3" />

          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 select-none">
            System
          </p>
          <div className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground/60 select-none">
            <Zap className="h-4 w-4 shrink-0" />
            <span>Dynatrace MCP</span>
            <ChevronRight className="ml-auto h-3 w-3 opacity-40" />
          </div>
        </nav>

        {/* Footer badge */}
        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-center gap-2.5 rounded-lg bg-primary/8 border border-primary/15 px-3 py-2.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-foreground leading-none">Demo Mode</p>
              <p className="text-[10px] text-muted-foreground/70 leading-none mt-0.5">API not connected</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/50 backdrop-blur-sm px-4 lg:hidden">
          <button
            aria-label="Open menu"
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Ghost className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Karma</span>
          </div>
          {/* Current page breadcrumb */}
          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <CurrentPageLabel />
          </div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden lg:flex h-14 shrink-0 items-center border-b border-border bg-card/30 backdrop-blur-sm px-8 gap-2">
          <Breadcrumb />
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const Icon = item.icon;
  const active = item.exact
    ? pathname === item.href
    : pathname.startsWith(item.href) && item.href !== "/dashboard";

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
        active
          ? "bg-primary/12 text-primary border border-primary/20"
          : "text-muted-foreground border border-transparent hover:text-foreground hover:bg-accent"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-all",
          active
            ? "text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]"
            : "group-hover:scale-105"
        )}
      />
      {item.label}
      {active && (
        <ChevronRight className="ml-auto h-3 w-3 text-primary/60" />
      )}
    </Link>
  );
}

function Breadcrumb() {
  const pathname = usePathname();
  const active = NAV_ITEMS.find((i) =>
    i.exact ? pathname === i.href : pathname.startsWith(i.href)
  );
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Ghost className="h-3.5 w-3.5 text-primary/70" />
      <span className="text-muted-foreground/60">Karma</span>
      {active && (
        <>
          <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
          <span className="font-medium text-foreground">{active.label}</span>
        </>
      )}
    </div>
  );
}

function CurrentPageLabel() {
  const pathname = usePathname();
  const active = NAV_ITEMS.find((i) =>
    i.exact ? pathname === i.href : pathname.startsWith(i.href)
  );
  return active ? <span className="font-medium text-foreground">{active.label}</span> : null;
}
