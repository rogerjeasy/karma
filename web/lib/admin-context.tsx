"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useUserProfile } from "@/lib/user-profile-context";
import { apiFetch } from "@/lib/api";
import type {
  AdminStats,
  ContractResponse,
  GhostReport,
  PlatformObservability,
  SystemService,
  WatcherRun,
} from "@/lib/types";

export type ServiceDetail = {
  contracts: ContractResponse[];
  ghosts: GhostReport[];
  watcherRuns: WatcherRun[];
  loading: boolean;
};

interface AdminContextValue {
  services: SystemService[];
  stats: AdminStats | null;
  observability: PlatformObservability | null;
  serviceDetails: Record<string, ServiceDetail>;
  loading: boolean;
  loadingObs: boolean;
  refresh: () => void;
  refreshServices: () => Promise<void>;
  loadServiceDetails: (svcs: SystemService[], quiet?: boolean) => Promise<void>;
  addService: (svc: SystemService) => void;
  removeService: (serviceId: string) => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading: profileLoading } = useUserProfile();

  const [services, setServices]             = useState<SystemService[]>([]);
  const [stats, setStats]                   = useState<AdminStats | null>(null);
  const [observability, setObservability]   = useState<PlatformObservability | null>(null);
  const [serviceDetails, setServiceDetails] = useState<Record<string, ServiceDetail>>({});
  const [loading, setLoading]               = useState(false);
  const [loadingObs, setLoadingObs]         = useState(false);
  const [fetched, setFetched]               = useState(false);

  const loadServiceDetails = useCallback(async (svcList: SystemService[], quiet = false) => {
    // In quiet mode (background polling) we skip the loading flags so cards
    // don't flash spinners on every poll tick.
    if (!quiet) {
      const init: Record<string, ServiceDetail> = {};
      for (const svc of svcList) {
        init[svc.service_id] = { contracts: [], ghosts: [], watcherRuns: [], loading: true };
      }
      setServiceDetails((prev) => ({ ...prev, ...init }));
    }

    await Promise.all(
      svcList.map(async (svc) => {
        const id   = svc.service_id;
        const base = `/admin/system-services/${id}`;
        const [contracts, ghosts, watcherRuns] = await Promise.all([
          apiFetch<ContractResponse[]>(`${base}/contracts`).catch(() => [] as ContractResponse[]),
          apiFetch<GhostReport[]>(`${base}/ghosts`).catch(() => [] as GhostReport[]),
          apiFetch<WatcherRun[]>(`${base}/watcher-runs`).catch(() => [] as WatcherRun[]),
        ]);
        setServiceDetails((prev) => ({
          ...prev,
          [id]: {
            contracts:   Array.isArray(contracts)   ? contracts   : [],
            ghosts:      Array.isArray(ghosts)      ? ghosts      : [],
            watcherRuns: Array.isArray(watcherRuns) ? watcherRuns : [],
            loading: false,
          },
        }));
      }),
    );
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setLoadingObs(true);

    const [svcs, st] = await Promise.all([
      apiFetch<SystemService[]>("/admin/system-services").catch(() => [] as SystemService[]),
      apiFetch<AdminStats>("/admin/stats").catch(() => null),
    ]);

    const svcList = Array.isArray(svcs) ? svcs : [];
    setServices(svcList);
    setStats(st);
    setLoading(false);
    setFetched(true);
    if (svcList.length > 0) loadServiceDetails(svcList);

    const obs = await apiFetch<PlatformObservability>("/admin/observability").catch(() => null);
    setObservability(obs);
    setLoadingObs(false);
  }, [loadServiceDetails]);

  useEffect(() => {
    if (!profileLoading && isAdmin && !fetched) {
      fetchAll();
    }
  }, [isAdmin, profileLoading, fetched, fetchAll]);

  const refresh = useCallback(() => {
    setFetched(false);
    setServiceDetails({});
  }, []);

  // Lightweight background refresh: re-fetch the services list + stats and
  // quietly reload details, without clearing state or flashing spinners. Used
  // to poll phase transitions (learning → ready → haunting) live.
  const refreshServices = useCallback(async () => {
    const [svcs, st] = await Promise.all([
      apiFetch<SystemService[]>("/admin/system-services").catch(() => null),
      apiFetch<AdminStats>("/admin/stats").catch(() => null),
    ]);
    if (Array.isArray(svcs)) {
      setServices(svcs);
      loadServiceDetails(svcs, true);
    }
    if (st) setStats(st);
  }, [loadServiceDetails]);

  const addService = useCallback((svc: SystemService) => {
    setServices((prev) => [svc, ...prev]);
    loadServiceDetails([svc]);
  }, [loadServiceDetails]);

  const removeService = useCallback((serviceId: string) => {
    setServices((prev) => prev.filter((s) => s.service_id !== serviceId));
    setServiceDetails((prev) => {
      const next = { ...prev };
      delete next[serviceId];
      return next;
    });
  }, []);

  return (
    <AdminContext.Provider value={{
      services, stats, observability, serviceDetails,
      loading, loadingObs,
      refresh, refreshServices, loadServiceDetails, addService, removeService,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdminData(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdminData must be used inside AdminDataProvider");
  return ctx;
}
