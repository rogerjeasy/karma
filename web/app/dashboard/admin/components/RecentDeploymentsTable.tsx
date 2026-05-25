"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Clock,
  GitCommit,
  GitPullRequest,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeploymentMetric } from "@/lib/types";

export function RecentDeploymentsTable({ deployments }: { deployments: DeploymentMetric[] }) {
  const [search, setSearch]               = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [sortBy, setSortBy]               = useState<"date" | "impact">("date");
  const [page, setPage]                   = useState(1);
  const PAGE_SIZE = 5;

  const uniqueServices = useMemo(
    () => [...new Set(deployments.map((d) => d.service_name))].sort(),
    [deployments],
  );

  const filtered = useMemo(() => {
    let items = [...deployments];
    if (serviceFilter !== "all") items = items.filter((d) => d.service_name === serviceFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (d) =>
          d.service_name.toLowerCase().includes(q) ||
          d.github_repo.toLowerCase().includes(q),
      );
    }
    if (sortBy === "impact") {
      items.sort((a, b) => (b.lines_added + b.lines_removed) - (a.lines_added + a.lines_removed));
    }
    return items;
  }, [deployments, serviceFilter, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, serviceFilter, sortBy]);

  if (deployments.length === 0) {
    return (
      <p className="mt-3 text-xs text-muted-foreground italic">
        Git metrics appear here after a service cutover with a GitHub token configured.
      </p>
    );
  }

  const pageNums: number[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNums.push(i);
  } else {
    const start = Math.max(1, Math.min(safePage - 2, totalPages - 4));
    for (let i = start; i <= Math.min(start + 4, totalPages); i++) pageNums.push(i);
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Label + result count */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Recent Deployments
        </p>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {filtered.length !== deployments.length
            ? `${filtered.length} / ${deployments.length}`
            : deployments.length}{" "}
          total
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search service or repo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/40"
          />
        </div>
        {uniqueServices.length > 1 && (
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/40"
          >
            <option value="all">All services</option>
            {uniqueServices.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => setSortBy((s) => (s === "date" ? "impact" : "date"))}
          className={cn(
            "h-8 px-3 rounded-md border text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0",
            sortBy === "impact"
              ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
              : "border-border bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          <BarChart2 className="h-3 w-3" />
          {sortBy === "date" ? "By date" : "By impact"}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Column headers */}
        <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-muted/30 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
          <div className="flex-1 min-w-0">Service / Repo</div>
          <div className="w-16 text-right shrink-0">Commits</div>
          <div className="w-10 text-right shrink-0">PRs</div>
          <div className="w-32 text-right shrink-0">Delta</div>
          <div className="w-24 text-right shrink-0">Deployed</div>
        </div>

        {/* Scrollable body */}
        <div className="max-h-[320px] overflow-y-auto divide-y divide-border/40">
          {paginated.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
              No deployments match your filters
            </div>
          ) : (
            paginated.map((dep, i) => {
              const net   = dep.lines_added - dep.lines_removed;
              const isApi = dep.service_name.toLowerCase().includes("api");
              return (
                <div
                  key={`${dep.service_id}-${dep.deployed_at}-${i}`}
                  className="flex items-center gap-3 px-4 py-3 text-xs hover:bg-muted/20 transition-colors"
                >
                  <span
                    className={cn(
                      "shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border",
                      isApi
                        ? "bg-blue-500/10 text-blue-300 border-blue-500/25"
                        : "bg-violet-500/10 text-violet-300 border-violet-500/25",
                    )}
                  >
                    {isApi ? "API" : "WEB"}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate leading-snug">
                      {dep.service_name}
                    </p>
                    <p className="text-muted-foreground font-mono text-[10px] truncate">
                      {dep.github_repo}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 tabular-nums">
                    <span className="flex items-center gap-1 text-slate-300 w-16 justify-end">
                      <GitCommit className="h-3 w-3" />
                      {dep.commits}
                    </span>
                    <span className="hidden sm:flex items-center gap-1 text-slate-300 w-10 justify-end">
                      <GitPullRequest className="h-3 w-3" />
                      {dep.pull_requests}
                    </span>
                    <div className="hidden sm:flex items-center gap-1.5 w-32 justify-end">
                      <span className="text-emerald-400 font-mono text-[11px]">+{dep.lines_added}</span>
                      <span className="text-red-400 font-mono text-[11px]">−{dep.lines_removed}</span>
                      <span
                        className={cn(
                          "text-[10px] font-semibold rounded px-1.5 py-px",
                          net > 0
                            ? "bg-emerald-500/10 text-emerald-300"
                            : net < 0
                              ? "bg-red-500/10 text-red-300"
                              : "bg-muted/40 text-muted-foreground",
                        )}
                      >
                        {net >= 0 ? "+" : ""}{net}
                      </span>
                    </div>
                    <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground w-24 justify-end">
                      <Clock className="h-3 w-3 shrink-0" />
                      {formatDistanceToNow(new Date(dep.deployed_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/10">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              Page {safePage} of {totalPages} · {filtered.length} deployments
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="h-6 w-6 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {pageNums.map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={cn(
                    "h-6 min-w-[24px] px-1.5 flex items-center justify-center rounded text-[11px] font-medium transition-colors",
                    n === safePage
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                      : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border",
                  )}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="h-6 w-6 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
