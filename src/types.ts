export interface AgentConfig {
  name: string;
  tier: string;
  status?: 'active' | 'disabled' | 'revoked' | 'quarantined';
  owner?: string;
  purpose?: string;
  model: string;
  model_version?: string;
  fallback_model: string;
  tools?: string[];
  permissions?: string[];
  max_autonomous_amount: number;
  required_human_approval_above: number;
  blocked_action_types: string[];
  hard_constraints: Record<string, number>;
  underwriting_benchmark_eur?: number;
  insurance_coverage_eur?: number; // legacy alias
  human_operator: string;
  risk_weights?: Record<string, number>;
  version?: string;
  passport_version?: string;
  created_at?: string;
  updated_at?: string;
  organization_id?: string;
}

export interface ActionRequest {
  action_type: string;
  description?: string;
  amount?: number | null;
  parameters?: Record<string, any> | null;
  target?: string | null;
  idempotency_key?: string | null;
  request_id?: string | null;
}

export interface EvaluateActionPayload extends ActionRequest {
  agent_id: string;
}

export interface ResolutionRequest {
  approve: boolean;
  operator: string;
  note?: string;
}

export interface RiskResult {
  breakdown: Record<string, number>;
  risk_score: number;
  needs_model: boolean;
  factors: string[];
}

export interface AuditRecord {
  id: number;
  eventId: string;
  timestamp: string;
  organization_id: string;
  agent_id: string;
  action_type: string;
  amount: number | null;
  description: string;
  target: string;
  risk_score: number;
  risk_breakdown: string;
  decision: 'approved' | 'blocked' | 'pending_approval' | 'approved_after_review' | 'rejected_after_review';
  reason: string;
  model_used: string | null;
  response_snippet: string | null;
  policy_triggered: string;
  latency_ms: number;
  prev_proof_hash: string;
  sha256_proof: string;
  idempotency_key?: string | null;
  replayed?: boolean;
}

export interface EscalationRecord {
  id: number;
  eventId: string;
  audit_log_id: number;
  agent_id: string;
  organization_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  resolved_at: string | null;
  operator: string | null;
  note: string | null;
}

export interface PolicyRule {
  id: string;
  name: string;
  category: string;
  organization_id?: string;
  targetAgents: string[];
  conditions: Array<{
    field: string;
    operator: '<=' | '>=' | '>' | '<' | '==' | '!=' | 'in' | 'contains';
    value: string | number;
    action: 'ALLOW' | 'HUMAN_REVIEW' | 'BLOCK';
  }>;
  status: 'active' | 'draft' | 'paused';
  description: string;
  lastUpdated: string;
}

export interface IncidentRecord {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED';
  agent_id: string;
  organization_id?: string;
  createdAt: string;
  summary: string;
  impact: string;
  timeline: Array<{
    timestamp: string;
    actor: string;
    stage: 'Detection' | 'Policy Triggered' | 'Action Blocked' | 'Human Review' | 'Resolution' | 'Forensic Log';
    detail: string;
  }>;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  secretMasked: string;
  rawSecret?: string;
  organization_id: string;
  environment: 'production' | 'staging' | 'development';
  created_at: string;
  last_used_at: string;
  status: 'active' | 'revoked';
}

export interface PassportVerificationResult {
  valid: boolean;
  status: 'VERIFIED' | 'INVALID';
  agent_id: string;
  fingerprint: string;
  computed_fingerprint: string;
  timestamp: string;
  algorithm: string;
  tampered: boolean;
  tampered_fields?: string[];
  compliance_attestation: string;
}

export interface AuditChainVerificationResult {
  valid: boolean;
  status: 'CHAIN_VALID' | 'TAMPER_DETECTED';
  total_records_verified: number;
  first_event_id?: string;
  last_event_id?: string;
  broken_at_index?: number;
  broken_record_id?: number;
  reason?: string;
  verification_timestamp: string;
  algorithm: string;
}

export interface WebhookEvent {
  event_id: string;
  event_type: 'action.allowed' | 'action.blocked' | 'action.review_required' | 'action.approved' | 'action.rejected' | 'incident.created';
  timestamp: string;
  organization_id: string;
  request_id: string;
  agent_id: string;
  decision: string;
  audit_id: number;
  sha256_proof: string;
  payload: Record<string, any>;
}

export interface ExecutionRecord {
  execution_id: string;
  audit_log_id: number;
  event_id: string;
  agent_id: string;
  organization_id: string;
  executed_at: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  execution_output?: any;
}

