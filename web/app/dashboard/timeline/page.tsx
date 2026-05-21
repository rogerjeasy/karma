"use client";

import { useEffect, useState } from "react";
import { BeforeAfterTimeline } from "@/components/BeforeAfterTimeline";
import { useDashboardData } from "@/lib/dashboard-context";
import { cn } from "@/lib/utils";

export default function TimelinePage() {
  const { services, ghosts, contracts, loading } = useDashboardData();
  const [selectedId, setSelected] = useState<string | null>(null);

  // Pick the first service once the list loads
  useEffect(() => {
    if (selectedId === null && services.length > 0) {
      setSelected(services[0].service_id);
    }
  }, [services, selectedId]);

  const selectedSvc     = services.find((s) => s.service_id === selectedId);
  const isHaunting      = selectedSvc?.phase === "haunting";
  const replacementName = selectedSvc?.replacement_service_id ?? "Replacement service";

  // Slice context data to the selected service
  const serviceContracts = selectedId ? (contracts[selectedId] ?? []) : [];
  const serviceGhosts    = selectedId
    ? ghosts.filter((g) => g.karma_service_id === selectedId)
    : [];

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

      {/* ── Skeleton while context is loading ── */}
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

      {/* ── Before/After split — rendered instantly from shared context ── */}
      {!loading && (
        <BeforeAfterTimeline
          contracts={serviceContracts}
          ghosts={serviceGhosts}
          oldServiceName={selectedSvc?.service_name ?? "Deprecated service"}
          newServiceName={isHaunting ? replacementName : "Replacement service"}
        />
      )}
    </div>
  );
}
