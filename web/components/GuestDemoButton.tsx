"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { signInAsGuest, authErrorMessage } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";

/**
 * One-click "explore the live demo" entry for judges and visitors.
 *
 * Signs in anonymously, ensures a user profile exists, seeds the canonical
 * svc-payments ghost scenario (idempotent), then lands on the dashboard — so a
 * visitor sees a fully populated workspace without creating an account.
 */
export default function GuestDemoButton({
  className,
  children,
  onError,
}: {
  className?: string;
  children: React.ReactNode;
  onError?: (message: string) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function enterDemo() {
    setLoading(true);
    try {
      await signInAsGuest();
      // Best-effort: create the profile and seed the demo scenario. Neither
      // should block entry — the dashboard tolerates an empty workspace.
      await apiFetch("/users/sync", { method: "POST" }).catch(() => {});
      await apiFetch("/demo/seed", { method: "POST" }).catch(() => {});
      router.replace("/dashboard");
    } catch (err: unknown) {
      setLoading(false);
      onError?.(authErrorMessage(err));
    }
  }

  return (
    <button type="button" onClick={enterDemo} disabled={loading} className={className}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? "Loading demo…" : children}
    </button>
  );
}
