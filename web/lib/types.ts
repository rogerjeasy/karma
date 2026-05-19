export type ServicePhase = "registered" | "learning" | "haunting" | "completed";

export interface ServiceRegistration {
  service_name: string;
  dynatrace_entity_id: string;
  deprecation_date: string;
  replacement_service_id?: string;
  learning_window_days: number;
}

export interface ServiceResponse {
  service_id: string;
  service_name: string;
  dynatrace_entity_id: string;
  deprecation_date: string;
  replacement_service_id: string | null;
  phase: ServicePhase;
  created_at: string;
  updated_at: string;
}

export type ContractCategory =
  | "latency"
  | "error_semantics"
  | "throughput"
  | "side_effect"
  | "timing"
  | "dependency"
  | "resource"
  | "sequencing";

export interface ContractResponse {
  contract_id: string;
  service_id: string;
  category: ContractCategory;
  subcategory: string;
  description: string;
  confidence: number;
  validated: boolean;
  detected_at: string;
}

export type ViolationSeverity = "low" | "medium" | "high" | "critical";

export interface GhostReport {
  report_id: string;
  violation_id: string;
  contract_id: string;
  category: ContractCategory;
  summary: string;
  root_cause: string;
  downstream_impact: string;
  severity: ViolationSeverity;
  evidence_links: string[];
  remediation_suggestions: string[];
  created_at: string;
}
