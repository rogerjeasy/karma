"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Ghost, ChevronRight, Menu, X } from "lucide-react";
import { useScrolled } from "./hooks";

const links = [
  { label: "Features",          href: "#features" },
  { label: "How it Works",      href: "#how-it-works" },
  { label: "Dashboard Preview", href: "#dashboard" },
  { label: "Ghost Lifecycle",   href: "#ghost-lifecycle" },
  { label: "Tech Stack",        href: "#tech-stack" },
];

export default function NavBar() {
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);

  return (
    <header className={cn(
      "fixed inset-x-0 top-0 z-50 transition-all duration-500",
      scrolled
        ? "bg-card/85 backdrop-blur-2xl border-b border-border/50 shadow-[0_2px_28px_rgba(0,0,0,0.5)]"
        : "bg-transparent"
    )}>
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/35 bg-primary/10 transition-all group-hover:shadow-glow-sm">
              <Ghost className="h-[17px] w-[17px] text-primary" />
            </div>
            <span className="text-[15px] font-extrabold tracking-tight gradient-text">Karma</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-0.5">
            {links.map((l) => (
              <a key={l.label} href={l.href}
                className="px-3 py-2 text-sm text-slate-300 hover:text-foreground rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link href="/login" className="hidden sm:block text-sm text-slate-300 hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link href="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 sm:px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-glow-sm hover:bg-primary/90 hover:shadow-glow-md transition-all whitespace-nowrap">
              Get started <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            <button
              className="lg:hidden rounded-lg p-2 text-slate-300 hover:text-foreground hover:bg-white/5 transition-colors"
              onClick={() => setOpen(!open)} aria-label="Toggle menu">
              {open ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="lg:hidden border-t border-border/40 pb-4 pt-2 space-y-0.5 animate-fade-in">
            {links.map((l) => (
              <a key={l.label} href={l.href} onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:text-foreground hover:bg-white/5 transition-colors">
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
