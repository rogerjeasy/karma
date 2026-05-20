"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  checkGoogleRedirect,
  authErrorMessage,
} from "@/lib/firebase";
import { Ghost, Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();

  const [mode,            setMode]            = useState<Mode>("signin");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword,    setShowPassword]    = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [googleLoading,   setGoogleLoading]   = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  // ── Handle Google redirect result on mount ──────────────────────────────────
  useEffect(() => {
    checkGoogleRedirect()
      .then((user) => { if (user) router.replace("/dashboard"); })
      .catch((err) => setError(authErrorMessage(err)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Clear errors when switching mode or changing fields ─────────────────────
  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPassword("");
    setConfirmPassword("");
  }

  // ── Google sign-in ───────────────────────────────────────────────────────────
  async function handleGoogle() {
    setGoogleLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      router.replace("/dashboard");
    } catch (err: unknown) {
      const msg = authErrorMessage(err);
      if (msg !== "Redirecting…") setError(msg);
    } finally {
      setGoogleLoading(false);
    }
  }

  // ── Email / Password submit ──────────────────────────────────────────────────
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || googleLoading;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
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
        <div className="mb-7 flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <div className="flex h-[68px] w-[68px] items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 shadow-glow-sm">
              <Ghost className="h-8 w-8 text-primary" />
            </div>
            <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight gradient-text">Karma</h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground font-medium leading-snug">
              The Reincarnation Agent for Deprecated Services
            </p>
          </div>
        </div>

        {/* Glass card */}
        <div className="glass-card rounded-2xl p-7 space-y-5">

          {/* ── Mode tabs ── */}
          <div className="flex rounded-lg border border-border/60 bg-muted/30 p-1 gap-1">
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                disabled={busy}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-sm font-medium transition-all duration-150",
                  mode === m
                    ? "bg-card text-foreground shadow-sm border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          {/* ── Google button ── */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-border/80 bg-secondary hover:bg-secondary/70 hover:border-primary/30 px-4 py-2.5 text-sm font-medium text-foreground transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-55 active:scale-[0.98]"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <GoogleIcon />
            )}
            {mode === "signin" ? "Sign in" : "Sign up"} with Google
          </button>

          {/* ── Divider ── */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-[11px] text-muted-foreground/60 uppercase tracking-wider">
                or
              </span>
            </div>
          </div>

          {/* ── Email / Password form ── */}
          <form onSubmit={handleEmailSubmit} className="space-y-3">

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-muted-foreground mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                placeholder="you@example.com"
                className="input-base"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-muted-foreground mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  placeholder="••••••••"
                  className="input-base pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password (sign-up only) */}
            {mode === "signup" && (
              <div>
                <label htmlFor="confirm-password" className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={busy}
                  placeholder="••••••••"
                  className="input-base"
                />
              </div>
            )}

            {/* Error message */}
            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive leading-relaxed">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-55 active:scale-[0.98] mt-1"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {/* ── Toggle link ── */}
          <p className="text-center text-xs text-muted-foreground/70">
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
              className="text-primary hover:underline font-medium"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/40">
          Google Cloud Rapid Agent Hackathon · Dynatrace Track
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
