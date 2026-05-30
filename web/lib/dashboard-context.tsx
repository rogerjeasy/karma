"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ContractResponse, GhostReport, ServiceResponse } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { useSSEEvent } from "@/lib/sse-context";

interface DashboardContextValue {
  // Data
  services: ServiceResponse[];
  ghosts: GhostReport[];
  contracts: Record<string, ContractResponse[]>; // keyed by service_id
  loading: boolean;
  // Mutations called by pages after local API actions
  addService: (svc: ServiceResponse) => void;
  updateService: (id: string, patch: Partial<ServiceResponse>) => void;
  removeService: (id: string) => void;
  refreshContracts: (serviceId: string) => Promise<void>;
  // Re-fetch everything (services + ghosts + contracts). Call after an in-browser
  // action that mutates server state outside the SSE stream (e.g. the demo seed).
  refresh: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const [services, setServices]   = useState<ServiceResponse[]>([]);
  const [ghosts, setGhosts]       = useState<GhostReport[]>([]);
  const [contracts, setContracts] = useState<Record<string, ContractResponse[]>>({});
  const [loading, setLoading]     = useState(true);

  // ── Fetch services + ghosts in parallel, then contracts per service ──────────
  const loadAll = useCallback(async () => {
    const [svcs, ghsts] = await Promise.all([
      apiFetch<ServiceResponse[]>("/services").catch(() => [] as ServiceResponse[]),
      apiFetch<GhostReport[]>("/ghosts?limit=100").catch(() => [] as GhostReport[]),
    ]);

    const svcArr   = Array.isArray(svcs)  ? svcs  : [];
    const ghostArr = Array.isArray(ghsts) ? ghsts : [];
    setServices(svcArr);
    setGhosts(ghostArr);

    const pairs = await Promise.all(
      svcArr.map(async (s) => {
        const c = await apiFetch<ContractResponse[]>(`/contracts/${s.service_id}`)
          .catch(() => [] as ContractResponse[]);
        return [s.service_id, Array.isArray(c) ? c : []] as [string, ContractResponse[]];
      })
    );

    setContracts(Object.fromEntries(pairs));
    setLoading(false);
  }, []);

  // ── Initial fetch on mount ───────────────────────────────────────────────────
  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // ── SSE: live ghost reports → prepend to list ─────────────────────────────
  useSSEEvent("ghost_report", (data) => {
    const report = JSON.parse(data) as GhostReport;
    setGhosts((prev) => [report, ...prev].slice(0, 100));
  });

  // ── SSE: service phase changes → patch in place, refresh contracts on ready ─
  useSSEEvent("service_update", (data) => {
    const updated = JSON.parse(data) as ServiceResponse;
    setServices((prev) =>
      prev.map((s) => s.service_id === updated.service_id ? { ...s, ...updated } : s)
    );
    if (updated.phase === "ready") {
      apiFetch<ContractResponse[]>(`/contracts/${updated.service_id}`)
        .then((c) => {
          if (Array.isArray(c)) {
            setContracts((prev) => ({ ...prev, [updated.service_id]: c }));
          }
        })
        .catch(() => {});
    }
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const addService = useCallback((svc: ServiceResponse) => {
    setServices((prev) => [svc, ...prev]);
    setContracts((prev) => ({ ...prev, [svc.service_id]: [] }));
  }, []);

  const updateService = useCallback((id: string, patch: Partial<ServiceResponse>) => {
    setServices((prev) =>
      prev.map((s) => s.service_id === id ? { ...s, ...patch } : s)
    );
  }, []);

  const removeService = useCallback((id: string) => {
    setServices((prev) => prev.filter((s) => s.service_id !== id));
    setContracts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setGhosts((prev) => prev.filter((g) => g.karma_service_id !== id));
  }, []);

  const refreshContracts = useCallback(async (serviceId: string) => {
    const c = await apiFetch<ContractResponse[]>(`/contracts/${serviceId}`)
      .catch(() => [] as ContractResponse[]);
    setContracts((prev) => ({ ...prev, [serviceId]: Array.isArray(c) ? c : [] }));
  }, []);

  return (
    <DashboardContext.Provider value={{
      services, ghosts, contracts, loading,
      addService, updateService, removeService, refreshContracts,
      refresh: loadAll,
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardData(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboardData must be used inside DashboardDataProvider");
  return ctx;
}
