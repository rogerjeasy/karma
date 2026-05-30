export type ServicePhase = "registered" | "learning" | "ready" | "haunting" | "completed" | "error";

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
  error_message?: string | null;
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

export interface DqlEvidence {
  type: "dql_query";
  dql: string;
  sample_count: number;
  timespan: string;
  result_summary?: string | null;
}

export interface TracePatternEvidence {
  type: "trace_pattern";
  pattern: string;
  frequency: string;
  sample_count: number;
}

export type ContractEvidence = DqlEvidence | TracePatternEvidence;

export interface ContractDetail extends ContractResponse {
  karma_service_id?: string | null;
  predicate_type?: string | null;
  predicate_test_dql?: string | null;
  predicate_threshold?: string | null;
  predicate_tolerance_seconds?: number | null;
  evidence?: ContractEvidence[] | null;
  downstream_dependents?: string[] | null;
  slo_id?: string | null;
  // Deep-link to a Dynatrace Notebook of this contract's DQL. Present when
  // precomputed; otherwise created on demand via /verify-notebook and cached.
  verification_notebook_url?: string | null;
}

export interface NotebookResponse {
  notebook_url: string;
  created: boolean;
}

export interface PlatformStats {
  total_services: number;
  total_contracts: number;
  total_ghost_reports: number;
  avg_contracts_per_service: number | null;
  avg_minutes_to_first_alert: number | null;
  pct_services_with_violations: number | null;
}

export interface WatcherRun {
  run_id: string;
  service_id: string;
  service_name?: string | null;
  run_at: string;
  contracts_checked: number;
  violations_found: number;
  duration_seconds?: number | null;
  skipped?: boolean;
}

export type ViolationSeverity = "low" | "medium" | "high" | "critical";

export interface UserProfile {
  uid: string;
  email: string;
  display_name: string;
  photo_url: string;
  roles: string[];
}

export interface SystemService {
  service_id: string;
  service_name: string;
  dynatrace_entity_id: string;
  replacement_service_id: string | null;
  phase: ServicePhase;
  error_message?: string | null;
  description?: string | null;
  url?: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminStats {
  total_users: number;
  total_system_services: number;
  system_services_haunting: number;
  system_ghost_reports: number;
}

export interface DeploymentMetric {
  service_id: string;
  service_name: string;
  deployed_at: string;
  commits: number;
  pull_requests: number;
  lines_added: number;
  lines_removed: number;
  github_repo: string;
}

export interface SessionActivity {
  total_watcher_runs: number;
  runs_last_24h: number;
  runs_last_7d: number;
  avg_duration_seconds: number | null;
  total_violations_found: number;
  services_by_phase: Record<string, number>;
  total_users: number;
}

export interface EngineeringMetrics {
  total_deployments: number;
  total_commits: number;
  total_prs: number;
  total_lines_added: number;
  total_lines_removed: number;
  recent_deployments: DeploymentMetric[];
}

export interface OtelPipeline {
  configured: boolean;
  dt_env: string | null;
  traces: boolean;
  metrics: boolean;
  logs: boolean;
}

export interface PlatformObservability {
  session_activity: SessionActivity;
  engineering_metrics: EngineeringMetrics;
  otel_pipeline: OtelPipeline;
}

// ── AI Investigation Engine ───────────────────────────────────────────────────

export interface UserInvestigationStats {
  user_id: string;
  email: string;
  display_name: string;
  total_reports: number;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  davis_enriched_count: number;
  severity_breakdown: Record<ViolationSeverity, number>;
  last_report_at: string | null;
}

export interface InvestigationAggregate {
  total_reports: number;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  davis_enriched_count: number;
  severity_breakdown: Record<ViolationSeverity, number>;
}

export interface InvestigationEngineData {
  aggregate: InvestigationAggregate;
  users: UserInvestigationStats[];
}

/**
 * A concrete, agent-generated code fix for the violated contract — rendered as a
 * "Suggested Fix" with a unified diff and a copyable PR description. Preview-only:
 * Karma never pushes; the engineer opens the PR.
 */
export interface RemediationPatch {
  pr_title: string;
  pr_body: string;
  target_file: string;
  language: string;
  patch_diff: string;
  github_url?: string | null;
}

// ── Live Proof (believability: contract learned from a real service) ──────────

export interface LiveProofContract {
  category: string;
  subcategory: string;
  description: string;
  confidence: number;
  validated: boolean;
  evidence_dql?: string | null;
}

export interface LiveProof {
  available: boolean;
  service_name?: string | null;
  dynatrace_entity_id?: string | null;
  dt_env?: string | null;
  learned_at?: string | null;
  contract_count: number;
  contracts: LiveProofContract[];
}

// ── Ask Karma console (NL → Davis CoPilot → DQL → Grail → Gemini) ─────────────

export interface ConsoleAnswer {
  answer: string;
  dql?: string | null;
  dql_source: "davis_copilot" | "contracts";
  row_count: number;
  davis_available: boolean;
}

export interface GhostReport {
  report_id: string;
  violation_id: string;
  contract_id: string;
  karma_service_id?: string | null;
  category: ContractCategory;
  summary: string;
  root_cause: string;
  downstream_impact: string;
  davis_ai_insights?: string | null;
  severity: ViolationSeverity;
  evidence_links: string[];
  remediation_suggestions: string[];
  remediation_patch?: RemediationPatch | null;
  // Draft PR opened from the remediation patch, once a user opens one.
  remediation_pr_url?: string | null;
  cost_estimate_usd?: number | null;
  investigation_input_tokens?: number | null;
  investigation_output_tokens?: number | null;
  dynatrace_event_id?: string | null;
  // New: avoided-incident cost + Dynatrace Notebook + Workflow + Slack
  avoided_incident_cost_usd?: number | null;
  dynatrace_notebook_url?: string | null;
  dynatrace_workflow_id?: string | null;
  slack_notification_sent?: boolean;
  // Deep-link fields for direct Dynatrace navigation
  davis_problem_id?: string | null;
  new_service_entity_id?: string | null;
  created_at: string;
}

// ── Migration Readiness Score ─────────────────────────────────────────────────

export interface CategoryCompliance {
  category: ContractCategory;
  total_contracts: number;
  compliant: number;
  violated: number;
  score: number | null;   // 0–100; null if no contracts in category
  weight: number;         // relative weight used in overall score
}

export interface MigrationReadiness {
  service_id: string;
  service_name: string;
  phase: string;
  overall_score: number | null;   // 0–100 weighted compliance; null if no contracts
  category_breakdown: CategoryCompliance[];
  total_contracts: number;
  total_violations_active: number;
  avoided_incident_cost_total_usd: number;
  recommendation: string;
  computed_at: string;
}

// ── Watcher live log SSE events ───────────────────────────────────────────────

export interface WatcherLogContractSummary {
  contract_id: string;
  category: ContractCategory;
  subcategory: string;
  description: string;
  predicate_dql: string;
  threshold: string;
}

export interface WatcherLogStarted {
  type: "started";
  service_id: string;
  service_name: string;
  contract_count: number;
  contracts: WatcherLogContractSummary[];
}

export interface WatcherLogContractCheck {
  type: "contract_check";
  contract_id: string;
  category: ContractCategory;
  subcategory: string;
  description: string;
  passed: boolean;
  threshold: string;
  predicate_dql: string;
  davis_problem_id?: string | null;
}

export interface WatcherLogComplete {
  type: "complete";
  service_id: string;
  service_name: string;
  contracts_checked: number;
  violations_found: number;
  duration_seconds: number;
}

export interface WatcherLogSkipped {
  type: "skipped";
  service_id: string;
  service_name: string;
  reason: string;
}

export type WatcherLogEvent =
  | WatcherLogStarted
  | WatcherLogContractCheck
  | WatcherLogComplete
  | WatcherLogSkipped;

// ── Agent observability ───────────────────────────────────────────────────────

export interface AgentSystemStats {
  service_name: string;
  description: string;
  model: string;
  span_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  from_grail: boolean;
  note?: string | null;
}

// Per-agent token breakdown (Learner, Watcher, Forensic, Coordinator)
export interface PerAgentStats {
  agent: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  span_count: number;
  cost_usd: number;
}

// One entry from the recent gen_ai.chat invocations DQL query (grouped by trace.id)
export interface RecentInvocation {
  trace_id: string;
  agent: string;
  started_at: string;
  session_id: string;
  user_id: string;
  model_turns: number;
  dt_trace_url: string | null;
}

export interface KarmaAgentsStats extends AgentSystemStats {
  per_agent: PerAgentStats[];
  recent_invocations: RecentInvocation[];
}

export interface ClaudeCodeStats extends AgentSystemStats {
  setup_required: boolean;
  week_input_tokens: number;
  week_output_tokens: number;
  week_span_count: number;
}

export interface AgentObservabilityData {
  grail_configured: boolean;
  karma_agents: KarmaAgentsStats;
  claude_code: ClaudeCodeStats;
}

// ── AI cost SSE event ─────────────────────────────────────────────────────────

export interface AiCostUpdateEvent {
  report_id: string;
  cost_estimate_usd?: number | null;
  investigation_input_tokens?: number | null;
  investigation_output_tokens?: number | null;
  severity?: ViolationSeverity;
  davis_enriched: boolean;
  created_at: string;
}
