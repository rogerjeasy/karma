"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import type { UserProfile } from "@/lib/types";

interface UserProfileContextValue {
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
}

const UserProfileContext = createContext<UserProfileContextValue>({
  profile: null,
  isAdmin: false,
  loading: true,
});

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiFetch<UserProfile>("/users/me")
      .then((p) => setProfile(p))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [user]);

  const isAdmin = profile?.roles?.includes("admin") ?? false;

  return (
    <UserProfileContext.Provider value={{ profile, isAdmin, loading }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile(): UserProfileContextValue {
  return useContext(UserProfileContext);
}
