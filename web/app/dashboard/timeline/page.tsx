"use client";

import { useEffect, useState } from "react";
import { ContractTimeline } from "@/components/ContractTimeline";
import type { ContractResponse, ServiceResponse } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function TimelinePage() {
  const [services, setServices]   = useState<ServiceResponse[]>([]);
  const [selectedId, setSelected] = useState<string | null>(null);
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);

  useEffect(() => {
    apiFetch<ServiceResponse[]>("/services")
      .then((data) => {
        if (Array.isArray(data)) {
          setServices(data);
          if (data.length > 0) setSelected(data[0].service_id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingContracts(true);
    apiFetch<ContractResponse[]>(`/contracts/${selectedId}`)
      .then((data) => { if (Array.isArray(data)) setContracts(data); })
      .catch(() => setContracts([]))
      .finally(() => setLoadingContracts(false));
  }, [selectedId]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contract Timeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Implicit contracts discovered and validated during the learning phase.
        </p>
      </div>

      {/* ── Service selector ── */}
      {services.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground shrink-0">Service:</span>
          {services.map((svc) => (
            <button
              key={svc.service_id}
              onClick={() => setSelected(svc.service_id)}
              className={cn(
                "rounded-full px-3.5 py-1 text-xs font-medium transition-all duration-150 border",
                selectedId === svc.service_id
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {svc.service_name}
            </button>
          ))}
        </div>
      )}

      {/* ── Timeline ── */}
      {loadingContracts ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <ContractTimeline contracts={contracts} />
      )}
    </div>
  );
}
