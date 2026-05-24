"use client";

import { useState, useEffect, useRef } from "react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Server,
  Ghost,
  Activity,
  Menu,
  X,
  Zap,
  ChevronRight,
  ChevronUp,
  LogOut,
  Loader2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth, signOutUser } from "@/lib/firebase";
import { SSEProvider, useSSEContext } from "@/lib/sse-context";
import { DashboardDataProvider } from "@/lib/dashboard-context";
import { AdminDataProvider } from "@/lib/admin-context";
import { UserProfileProvider, useUserProfile } from "@/lib/user-profile-context";

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",          label: "Overview",  icon: LayoutDashboard, exact: true },
  { href: "/dashboard/services", label: "Services",  icon: Server },
  { href: "/dashboard/ghosts",   label: "Ghosts",    icon: Ghost },
  { href: "/dashboard/timeline", label: "Timeline",  icon: Activity },
];

const ADMIN_NAV_ITEM: NavItem = {
  href: "/dashboard/admin",
  label: "Admin",
  icon: ShieldCheck,
};

// ── Auth guard + SSE provider ─────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const intentionalSignOut = useRef(false);

  useEffect(() => {
    if (!loading && !user && !intentionalSignOut.current) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  async function handleSignOut() {
    intentionalSignOut.current = true;
    await signOutUser();
    router.push("/");
  }

  const sseUrl = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/stream/ghosts`;

  return (
    <UserProfileProvider>
      <SSEProvider url={sseUrl}>
        <DashboardDataProvider>
          <AdminDataProvider>
            <DashboardShell onSignOut={handleSignOut}>{children}</DashboardShell>
          </AdminDataProvider>
        </DashboardDataProvider>
      </SSEProvider>
    </UserProfileProvider>
  );
}

// ── Shell (rendered inside SSEProvider) ──────────────────────────────────────
function DashboardShell({ children, onSignOut }: { children: React.ReactNode; onSignOut: () => Promise<void> }) {
  const { connectionState } = useSSEContext();
  const { isAdmin } = useUserProfile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const pathname = usePathname();

  useEffect(() => setSidebarOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  async function confirmSignOut() {
    setSigningOut(true);
    await onSignOut();
  }

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
            <span className="text-[10px] text-slate-400 leading-none mt-0.5 truncate">
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
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 select-none">
            Main menu
          </p>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}

          <Separator className="my-3" />

          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 select-none">
            System
          </p>
          <div className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 select-none">
            <Zap className="h-4 w-4 shrink-0" />
            <span>Dynatrace MCP</span>
            <ChevronRight className="ml-auto h-3 w-3 opacity-40" />
          </div>
          {isAdmin && (
            <>
              <Separator className="my-3" />
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-400/80 select-none">
                Admin
              </p>
              <NavLink item={ADMIN_NAV_ITEM} />
            </>
          )}
        </nav>

        {/* Footer: SSE-derived API status + sign-out */}
        <div className="shrink-0 border-t border-border p-3 space-y-2">
          {/* API health — driven by SSE connection state, zero polling */}
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-3 py-2.5",
              connectionState === "open"
                ? "bg-emerald-500/8 border-emerald-500/20"
                : connectionState === "connecting"
                ? "bg-primary/8 border-primary/15"
                : "bg-amber-500/8 border-amber-500/20"
            )}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              {connectionState === "connecting" && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
              )}
              <span
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  connectionState === "open"
                    ? "bg-emerald-500"
                    : connectionState === "connecting"
                    ? "bg-primary"
                    : "bg-amber-500"
                )}
              />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-foreground leading-none">
                {connectionState === "open"
                  ? "Live Mode"
                  : connectionState === "connecting"
                  ? "Connecting…"
                  : "Demo Mode"}
              </p>
              <p className="text-[10px] text-slate-400 leading-none mt-0.5">
                {connectionState === "open"
                  ? "API connected"
                  : connectionState === "connecting"
                  ? "Reaching API…"
                  : "API not connected"}
              </p>
            </div>
          </div>

          <UserMenu onSignOut={() => setSignOutOpen(true)} />
        </div>
      </aside>

      {/* ── Sign-out confirmation dialog ─────────────────────────── */}
      <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign out</DialogTitle>
            <DialogDescription>
              Are you sure you want to sign out of Karma?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setSignOutOpen(false)}
              disabled={signingOut}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmSignOut}
              disabled={signingOut}
              className="gap-2"
            >
              {signingOut && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      href={item.href as Route}
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
      {active && <ChevronRight className="ml-auto h-3 w-3 text-primary/60" />}
    </Link>
  );
}

function Breadcrumb() {
  const pathname = usePathname();
  const ALL_ITEMS = [...NAV_ITEMS, ADMIN_NAV_ITEM];
  const active = ALL_ITEMS.find((i) =>
    i.exact ? pathname === i.href : pathname.startsWith(i.href)
  );
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Ghost className="h-3.5 w-3.5 text-primary/70" />
      <span className="text-slate-300">Karma</span>
      {active && (
        <>
          <ChevronRight className="h-3 w-3 text-slate-500" />
          <span className="font-medium text-foreground">{active.label}</span>
        </>
      )}
    </div>
  );
}

function CurrentPageLabel() {
  const pathname = usePathname();
  const ALL_ITEMS = [...NAV_ITEMS, ADMIN_NAV_ITEM];
  const active = ALL_ITEMS.find((i) =>
    i.exact ? pathname === i.href : pathname.startsWith(i.href)
  );
  return active ? <span className="font-medium text-foreground">{active.label}</span> : null;
}

// ── User avatar menu ──────────────────────────────────────────────────────────
function UserMenu({ onSignOut }: { onSignOut: () => void }) {
  const { user }             = useAuth();
  const { profile, isAdmin } = useUserProfile();
  const [open, setOpen]      = useState(false);
  const containerRef         = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const displayName = profile?.display_name || user?.displayName || user?.email?.split("@")[0] || "User";
  const email       = profile?.email || user?.email || "";
  const photoUrl    = profile?.photo_url || user?.photoURL || "";
  const initials    = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const roles = profile?.roles ?? ["user"];

  return (
    <div className="relative" ref={containerRef}>
      {/* Popover — floats above the trigger */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-border bg-card shadow-lg overflow-hidden z-50">
          {/* User info */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar photoUrl={photoUrl} initials={initials} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{email}</p>
              {/* Role badges */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {roles.map((role) => (
                  <span
                    key={role}
                    className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide border",
                      role === "admin"
                        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        : role === "premium"
                        ? "bg-violet-500/15 text-violet-400 border-violet-500/30"
                        : "bg-slate-500/15 text-slate-400 border-slate-500/30"
                    )}
                  >
                    {role}
                  </span>
                ))}
                {isAdmin && !roles.includes("admin") && null}
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Sign out */}
          <button
            onClick={() => { setOpen(false); onSignOut(); }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            Sign out
          </button>
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors",
          open
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
      >
        <Avatar photoUrl={photoUrl} initials={initials} size="sm" />
        <span className="flex-1 min-w-0 text-left text-[13px] font-medium truncate">
          {displayName}
        </span>
        <ChevronUp
          className={cn(
            "h-3 w-3 shrink-0 opacity-50 transition-transform duration-200",
            open ? "rotate-180" : ""
          )}
        />
      </button>
    </div>
  );
}

function Avatar({
  photoUrl,
  initials,
  size,
}: {
  photoUrl: string;
  initials: string;
  size: "sm" | "lg";
}) {
  const dim = size === "lg" ? 36 : 28;
  const cls = size === "lg"
    ? "h-9 w-9 text-[13px]"
    : "h-7 w-7 text-[11px]";

  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt="Avatar"
        width={dim}
        height={dim}
        className={cn("shrink-0 rounded-full object-cover ring-1 ring-border", cls)}
        unoptimized={!photoUrl.includes("googleusercontent.com")}
      />
    );
  }
  return (
    <span
      className={cn(
        "shrink-0 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-semibold text-primary",
        cls,
      )}
    >
      {initials || "?"}
    </span>
  );
}
