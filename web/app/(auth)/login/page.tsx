"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithGoogle } from "@/lib/firebase";
import { Ghost, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      router.replace("/dashboard");
    } catch {
      setError("Sign-in failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* ── Background gradient orbs ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-48 right-0 h-[640px] w-[640px] rounded-full bg-teal-500/12 blur-[130px]" />
        <div className="absolute -bottom-48 left-0 h-[520px] w-[520px] rounded-full bg-cyan-700/10 blur-[110px]" />
        <div className="absolute left-1/2 top-1/3 h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-emerald-600/8 blur-[100px]" />
      </div>

      {/* ── Subtle grid overlay ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      {/* ── Card ── */}
      <div className="relative z-10 w-full max-w-[400px] animate-fade-in-up">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 shadow-glow-sm">
              <Ghost className="h-9 w-9 text-primary" />
            </div>
            {/* Glow ring */}
            <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight gradient-text">Karma</h1>
            <p className="mt-2 text-[13px] text-muted-foreground font-medium leading-snug">
              The Reincarnation Agent for Deprecated Services
            </p>
          </div>
        </div>

        {/* Sign-in card */}
        <div className="glass-card rounded-2xl p-7 space-y-5">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">Welcome back</h2>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              Monitor service migrations and catch contract violations before they reach production.
            </p>
          </div>

          {/* Google button */}
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="group w-full flex items-center justify-center gap-3 rounded-xl border border-border/80 bg-secondary hover:bg-secondary/70 hover:border-primary/30 px-4 py-3 text-sm font-medium text-foreground transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-55 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span>Signing in…</span>
              </>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          {error && (
            <p className="text-center text-xs text-destructive">{error}</p>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-[11px] text-muted-foreground/70">
                Secure · Private · No password required
              </span>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/50">
          Google Cloud Rapid Agent Hackathon · Dynatrace Track
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
