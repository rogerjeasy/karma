import type { ContractCategory, ViolationSeverity } from "@/lib/types";

export const PHASE_COLORS: Record<string, string> = {
  registered: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  learning:   "bg-blue-500/20 text-blue-300 border-blue-500/30",
  ready:      "bg-violet-500/20 text-violet-300 border-violet-500/30",
  haunting:   "bg-primary/20 text-primary border-primary/30",
  completed:  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  error:      "bg-red-500/20 text-red-300 border-red-500/30",
};

export const SEVERITY_CFG: Record<ViolationSeverity, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-red-500/20 text-red-400 border-red-500/40" },
  high:     { label: "High",     cls: "bg-orange-500/20 text-orange-400 border-orange-500/40" },
  medium:   { label: "Medium",   cls: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
  low:      { label: "Low",      cls: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
};

export const CATEGORY_COLORS: Partial<Record<ContractCategory, string>> = {
  side_effect:     "text-red-400",
  latency:         "text-blue-400",
  error_semantics: "text-orange-400",
  throughput:      "text-teal-400",
  dependency:      "text-violet-400",
  timing:          "text-amber-400",
  sequencing:      "text-cyan-400",
  resource:        "text-pink-400",
};

export const SEV_BAR_COLORS: Record<ViolationSeverity, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-500",
  medium:   "bg-amber-500",
  low:      "bg-zinc-500",
};

export const SEV_TEXT_COLORS: Record<ViolationSeverity, string> = {
  critical: "text-red-400",
  high:     "text-orange-400",
  medium:   "text-amber-400",
  low:      "text-zinc-400",
};

export const PHASE_BAR_COLORS: Record<string, string> = {
  registered: "bg-slate-500",
  learning:   "bg-blue-500",
  ready:      "bg-violet-500",
  haunting:   "bg-primary",
  completed:  "bg-emerald-500",
  error:      "bg-red-500",
};
