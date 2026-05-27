import Link from "next/link";
import { Ghost } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-8 sm:py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/25">
              <Ghost className="h-[15px] w-[15px] text-primary" />
            </div>
            <span className="text-sm font-extrabold gradient-text">Karma</span>
            <span className="text-xs text-slate-400 hidden sm:block">— The Reincarnation Agent</span>
          </div>
          <p className="text-xs text-slate-500 text-center order-last sm:order-none">
            © 2026 Karma · Google Cloud Rapid Agent Hackathon · Dynatrace Track
          </p>
          <div className="flex items-center gap-4 sm:gap-5">
            <Link href="/login"           className="text-xs text-slate-300 hover:text-foreground transition-colors">Sign in</Link>
            <Link href="/dashboard"       className="text-xs text-slate-300 hover:text-foreground transition-colors">Dashboard</Link>
            <Link href="#ghost-lifecycle" className="text-xs text-slate-300 hover:text-foreground transition-colors">Ghost Lifecycle</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
