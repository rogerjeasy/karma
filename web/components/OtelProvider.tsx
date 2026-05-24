"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/firebase";
import { initOtel, setOtelUser } from "@/lib/otel";

// Initializes browser-side OpenTelemetry and keeps user context in sync with
// Firebase auth. Renders nothing — mount once in the root layout.
export function OtelProvider() {
  const { user } = useAuth();

  // Initialize once on first client render.
  useEffect(() => {
    initOtel();
  }, []);

  // Update span attributes whenever Firebase auth state changes.
  useEffect(() => {
    if (user) {
      setOtelUser(user.uid, user.email ?? "");
    }
  }, [user]);

  return null;
}
