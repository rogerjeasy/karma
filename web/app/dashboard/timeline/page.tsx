"use client";

import { useEffect, useState } from "react";
import { BeforeAfterTimeline } from "@/components/BeforeAfterTimeline";
import type { ContractResponse, GhostReport, ServiceResponse } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { useSSEEvent } from "@/lib/sse-context";
import { cn } from "@/lib/utils";

export default function TimelinePage() {
  const [services, setServices]   = useState<ServiceResponse[]>([]);
  const [selectedId, setSelected] = useState<string | null>(null);
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [ghosts, setGhosts]       = useState<GhostReport[]>([]);
  const [loading, setLoading]     = useState(false);

  // Load service list once
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

  // Load contracts + ghosts whenever the selected service changes
  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setContracts([]);
    setGhosts([]);

    Promise.all([
      apiFetch<ContractResponse[]>(`/contracts/${selectedId}`).catch(() => []),
      apiFetch<GhostReport[]>(`/ghosts?service_id=${selectedId}&limit=100`).catch(() => []),
    ]).then(([contractData, ghostData]) => {
      setContracts(Array.isArray(contractData) ? contractData : []);
      setGhosts(Array.isArray(ghostData) ? ghostData : []);
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Live: append new ghost reports for the selected service via SSE
  useSSEEvent("ghost_report", (data) => {
    const report = JSON.parse(data) as GhostReport;
    if (report.karma_service_id !== selectedId) return;
    setGhosts((prev) => [report, ...prev]);
  });

  // Live: re-fetch contracts when a service finishes learning
  useSSEEvent("service_update", (data) => {
    const updated = JSON.parse(data) as ServiceResponse;
    setServices((prev) =>
      prev.map((s) => s.service_id === updated.service_id ? { ...s, ...updated } : s)
    );
    if (updated.service_id === selectedId && updated.phase === "ready") {
      apiFetch<ContractResponse[]>(`/contracts/${selectedId}`)
        .then((d) => { if (Array.isArray(d)) setContracts(d); })
        .catch(() => {});
    }
  });

  const selectedSvc  = services.find((s) => s.service_id === selectedId);
  const isHaunting   = selectedSvc?.phase === "haunting";
  const replacementName = selectedSvc?.replacement_service_id ?? "Replacement service";

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contract Timeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Before / After view — learned contracts vs. replacement service behaviour.
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

      {/* ── Skeleton ── */}
      {loading && (
        <div className="space-y-px rounded-xl overflow-hidden border border-border">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="grid grid-cols-2 divide-x divide-border">
              <div className="h-20 bg-card animate-pulse" />
              <div className="h-20 bg-card animate-pulse opacity-70" />
            </div>
          ))}
        </div>
      )}

      {/* ── Before/After split — always shown once loading is done ── */}
      {!loading && (
        <BeforeAfterTimeline
          contracts={contracts}
          ghosts={ghosts}
          oldServiceName={selectedSvc?.service_name ?? "Deprecated service"}
          newServiceName={isHaunting ? replacementName : "Replacement service"}
        />
      )}
    </div>
  );
}
