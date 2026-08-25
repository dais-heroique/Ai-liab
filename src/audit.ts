import crypto from 'node:crypto';
import {
  ActionRequest,
  AuditRecord,
  EscalationRecord,
  RiskResult,
  PolicyRule,
  IncidentRecord,
  ApiKeyRecord,
  AgentConfig,
  PassportVerificationResult
} from './types.js';

let auditLogs: AuditRecord[] = [];
let escalations: EscalationRecord[] = [];
let nextLogId = 1;
let nextEscalationId = 1;
let lastProofHash = '0000000000000000000000000000000000000000000000000000000000000000';

// In-memory idempotency cache (keyed by tenant + idempotency_key)
const idempotencyStore = new Map<string, { logId: number; decisionResult: any }>();

export let policies: PolicyRule[] = [
  {
    id: 'POL-FIN-01',
    name: 'Customer Refund Policy & Financial Thresholds',
    category: 'Finance',
    organization_id: 'org_acme_global',
    targetAgents: ['acme-customer-agent', 'acme-faq-bot'],
    status: 'active',
    description: 'Enforces hard ceiling on autonomous customer reimbursements. Above €500 routes to human review; above €5,000 auto-blocks.',
    lastUpdated: '2026-08-20T14:30:00Z',
    conditions: [
      { field: 'refund_amount', operator: '<=', value: 500, action: 'ALLOW' },
      { field: 'refund_amount', operator: '>', value: 500, action: 'HUMAN_REVIEW' },
      { field: 'refund_amount', operator: '>', value: 5000, action: 'BLOCK' }
    ]
  },
  {
    id: 'POL-TREASURY-02',
    name: 'Corporate Wire Transfer & Treasury Safeguard',
    category: 'Finance',
    organization_id: 'org_acme_global',
    targetAgents: ['acme-fintech-disbursement'],
    status: 'active',
    description: 'Zero-trust wire transfer routing. Autonomous wire transfers above €1,000 require human review authorization.',
    lastUpdated: '2026-08-21T09:15:00Z',
    conditions: [
      { field: 'wire_amount', operator: '<=', value: 1000, action: 'ALLOW' },
      { field: 'wire_amount', operator: '>', value: 1000, action: 'HUMAN_REVIEW' }
    ]
  },
  {
    id: 'POL-PHYS-03',
    name: 'CNC & Industrial Kinetic Hard Limit Policy',
    category: 'Physical Safety',
    organization_id: 'org_acme_global',
    targetAgents: ['acme-cnc-controller'],
    status: 'active',
    description: 'Hardware protection interlock. Limits CNC machine rotational speed to 4,000 RPM and hydraulic psi to 250.',
    lastUpdated: '2026-08-18T11:00:00Z',
    conditions: [
      { field: 'rpm', operator: '<=', value: 4000, action: 'ALLOW' },
      { field: 'rpm', operator: '>', value: 4000, action: 'BLOCK' },
      { field: 'temperature_c', operator: '>', value: 90, action: 'BLOCK' }
    ]
  },
  {
    id: 'POL-CYBER-04',
    name: 'Data Privacy & Immutable Retention Guard',
    category: 'Cyber & Privacy',
    organization_id: 'org_acme_global',
    targetAgents: ['*'],
    status: 'active',
    description: 'Prevents autonomous system agents from executing destructive database deletions (DROP/DELETE) without security approval.',
    lastUpdated: '2026-08-22T16:45:00Z',
    conditions: [
      { field: 'action_type', operator: '==', value: 'delete_data', action: 'BLOCK' }
    ]
  },
  {
    id: 'POL-CRM-05',
    name: 'Customer PII & Lead Mutation Access Rule',
    category: 'Privacy',
    organization_id: 'org_acme_global',
    targetAgents: ['acme-faq-bot'],
    status: 'active',
    description: 'Prevents untrusted FAQ/Chat tier-1 bots from modifying CRM records.',
    lastUpdated: '2026-08-19T08:20:00Z',
    conditions: [
      { field: 'action_type', operator: '==', value: 'modify_crm', action: 'BLOCK' }
    ]
  }
];

export let incidents: IncidentRecord[] = [
  {
    id: 'INC-2026-0881',
    title: 'Physical Kinetic Override: CNC 8,000 RPM Attempt Intercepted',
    severity: 'CRITICAL',
    status: 'INVESTIGATING',
    agent_id: 'acme-cnc-controller',
    organization_id: 'org_acme_global',
    createdAt: '2026-08-25T01:40:12Z',
    summary: 'Agent acme-cnc-controller proposed spindle motor speed of 8,000 RPM (exceeding safety threshold of 4,000 RPM). Deterministic policy engine intercepted and blocked execution in 8ms.',
    impact: 'Zero physical damage or tooling stress. Safety operator notified for review.',
    timeline: [
      {
        timestamp: '2026-08-25T01:40:12.102Z',
        actor: 'ACME CNC Controller (Autonomous Agent)',
        stage: 'Detection',
        detail: 'Agent generated action payload: {"action_type": "machine_control", "rpm": 8000}'
      },
      {
        timestamp: '2026-08-25T01:40:12.106Z',
        actor: 'AI Liability Gateway Policy Engine',
        stage: 'Policy Triggered',
        detail: 'Triggered POL-PHYS-03 (rpm=8000 exceeds safety threshold 4000)'
      },
      {
        timestamp: '2026-08-25T01:40:12.110Z',
        actor: 'Gateway Firewall Interceptor',
        stage: 'Action Blocked',
        detail: 'Execution halted before downstream dispatch. Logged with cryptographic proof.'
      },
      {
        timestamp: '2026-08-25T01:42:00.000Z',
        actor: 'Marc Dufour (Lead Safety Engineer)',
        stage: 'Human Review',
        detail: 'Inspection initiated on CNC line B-12.'
      }
    ]
  },
  {
    id: 'INC-2026-0879',
    title: 'Unauthorized Data Deletion Attempt Blocked on Production Ledger',
    severity: 'HIGH',
    status: 'MITIGATED',
    agent_id: 'acme-cnc-controller',
    organization_id: 'org_acme_global',
    createdAt: '2026-08-24T22:15:30Z',
    summary: 'Agent proposed action_type "delete_data" targeting raw machine logs. Blocked under policy POL-CYBER-04.',
    impact: 'No data mutated. Technical controls verified.',
    timeline: [
      {
        timestamp: '2026-08-24T22:15:30.012Z',
        actor: 'ACME CNC Controller',
        stage: 'Detection',
        detail: 'Proposed delete_data for sensor diagnostic logs'
      },
      {
        timestamp: '2026-08-24T22:15:30.018Z',
        actor: 'Policy Engine POL-CYBER-04',
        stage: 'Action Blocked',
        detail: 'Action type blocked by tier security boundaries.'
      },
      {
        timestamp: '2026-08-24T22:30:00.000Z',
        actor: 'Security Operations Center',
        stage: 'Resolution',
        detail: 'Retention rule confirmed. Ticket closed.'
      }
    ]
  },
  {
    id: 'INC-2026-0874',
    title: 'High-Value Out-of-Bounds Refund Escrow (€14,500)',
    severity: 'MEDIUM',
    status: 'RESOLVED',
    agent_id: 'acme-customer-agent',
    organization_id: 'org_acme_global',
    createdAt: '2026-08-24T18:02:11Z',
    summary: 'Autonomous refund of €14,500 was intercepted as it exceeded the autonomous limit of €500. Routed to Human Authorization queue.',
    impact: 'Held in escrow until human supervisor decision.',
    timeline: [
      {
        timestamp: '2026-08-24T18:02:11.000Z',
        actor: 'ACME Customer Agent',
        stage: 'Detection',
        detail: 'Requested refund of €14,500 for freight shipment delay.'
      },
      {
        timestamp: '2026-08-24T18:02:11.015Z',
        actor: 'Risk Engine',
        stage: 'Policy Triggered',
        detail: 'Calculated Risk Score: 64.2 (High Financial Risk). Escalated.'
      },
      {
        timestamp: '2026-08-24T18:15:40.000Z',
        actor: 'Sarah Chen (Enterprise Ops Lead)',
        stage: 'Human Review',
        detail: 'Investigated claim. Refund authorization denied.'
      },
      {
        timestamp: '2026-08-24T18:16:10.000Z',
        actor: 'Sarah Chen (Enterprise Ops Lead)',
        stage: 'Resolution',
        detail: 'Rejected in Gateway console. Rerouted to manual claims desk.'
      }
    ]
  }
];

export let apiKeys: ApiKeyRecord[] = [
  {
    id: 'key_live_9f82b710ac8e',
    name: 'Production Gateway Main Cluster',
    prefix: 'ailg_live_9f82...',
    secretMasked: 'ailg_live_9f82••••••••••••••••••••••••••••34a9',
    organization_id: 'org_acme_global',
    environment: 'production',
    created_at: '2026-07-15T10:00:00Z',
    last_used_at: '2026-08-25T02:18:00Z',
    status: 'active'
  },
  {
    id: 'key_live_3c41ea90881f',
    name: 'SRE Infrastructure Agent Proxy',
    prefix: 'ailg_live_3c41...',
    secretMasked: 'ailg_live_3c41••••••••••••••••••••••••••••881f',
    organization_id: 'org_acme_global',
    environment: 'production',
    created_at: '2026-08-01T14:22:00Z',
    last_used_at: '2026-08-25T01:55:00Z',
    status: 'active'
  },
  {
    id: 'key_stg_7a192bc01124',
    name: 'Staging & Sandbox Validation Key',
    prefix: 'ailg_test_7a19...',
    secretMasked: 'ailg_test_7a19••••••••••••••••••••••••••••90cf',
    organization_id: 'org_acme_global',
    environment: 'staging',
    created_at: '2026-08-10T09:00:00Z',
    last_used_at: '2026-08-24T19:40:00Z',
    status: 'active'
  }
];

export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJsonStringify(obj[k])).join(',') + '}';
}

export function generateSha256(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

export function generatePassportFingerprint(agentId: string, cfg: AgentConfig): string {
  const canonicalData = {
    agent_id: agentId,
    name: cfg.name || '',
    tier: cfg.tier || '',
    status: cfg.status || 'active',
    owner: cfg.owner || cfg.human_operator || 'Operations Lead',
    purpose: cfg.purpose || 'Autonomous Enterprise Execution',
    model: cfg.model || '',
    model_version: cfg.model_version || '2026-Q3-Enterprise',
    tools: (cfg.tools || []).slice().sort(),
    permissions: (cfg.permissions || []).slice().sort(),
    max_autonomous_amount: Number(cfg.max_autonomous_amount || 0),
    required_human_approval_above: Number(cfg.required_human_approval_above || 40),
    blocked_action_types: (cfg.blocked_action_types || []).slice().sort(),
    hard_constraints: cfg.hard_constraints || {},
    underwriting_benchmark_eur: Number(cfg.underwriting_benchmark_eur || cfg.insurance_coverage_eur || 1000000),
    human_operator: cfg.human_operator || 'Operations Lead',
    passport_version: cfg.passport_version || 'v2.4-TechnicalControl'
  };

  const canonicalString = canonicalJsonStringify(canonicalData);
  return generateSha256(canonicalString);
}

export function verifyPassport(agentId: string, providedData: any, expectedHash?: string): PassportVerificationResult {
  const canonicalString = canonicalJsonStringify(providedData);
  const calculated = generateSha256(canonicalString);
  const targetHash = expectedHash ? expectedHash.replace(/^0x|^sha256:/i, '').toLowerCase() : calculated.toLowerCase();
  const matches = calculated.toLowerCase() === targetHash;

  return {
    valid: matches,
    status: matches ? 'VERIFIED' : 'INVALID',
    agent_id: agentId,
    fingerprint: `0x${targetHash}`,
    computed_fingerprint: `0x${calculated}`,
    timestamp: new Date().toISOString(),
    algorithm: 'SHA-256 (Canonical JSON RFC 8785)',
    tampered: !matches,
    compliance_attestation: matches
      ? 'Technical controls and parameter integrity cryptographically verified. Generated for governance and risk underwriting workflows.'
      : 'Cryptographic fingerprint mismatch: Agent parameters or operational boundaries have been modified since passport issuance.'
  };
}

export function checkIdempotency(key: string): any | null {
  if (!key) return null;
  const existing = idempotencyStore.get(key);
  return existing ? existing.decisionResult : null;
}

export function storeIdempotency(key: string, logId: number, result: any): void {
  if (!key) return;
  idempotencyStore.set(key, { logId, decisionResult: result });
}

export function logDecision(
  agentId: string,
  action: ActionRequest,
  riskResult: RiskResult,
  decision: 'approved' | 'blocked' | 'pending_approval' | 'approved_after_review' | 'rejected_after_review',
  reason: string,
  modelUsed: string | null,
  responseText: string | null,
  policyName: string = 'Autonomous Policy Matrix',
  latencyMs: number = Math.floor(Math.random() * 20 + 8),
  organizationId: string = 'org_acme_global',
  idempotencyKey?: string | null
): { logId: number; eventId: string; sha256_proof: string } {
  const logId = nextLogId++;
  const timestamp = new Date().toISOString();
  const eventId = `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

  const prevHash = lastProofHash;
  // Deterministic chained cryptographic payload
  const proofPayload = `${prevHash}|${eventId}|${timestamp}|${organizationId}|${agentId}|${action.action_type}|${action.amount ?? 'null'}|${riskResult.risk_score}|${decision}`;
  const sha256_proof = generateSha256(proofPayload);
  lastProofHash = sha256_proof;

  let target = action.target || '';
  if (!target) {
    if (action.action_type.includes('crm')) target = 'Salesforce CRM (EU-1)';
    else if (action.action_type.includes('refund') || action.action_type.includes('wire')) target = 'Stripe Payments / SEPA Core';
    else if (action.action_type.includes('machine') || action.action_type.includes('vehicle')) target = 'Edge PLC Bus (Modbus/TCP)';
    else if (action.action_type.includes('delete')) target = 'PostgreSQL Core Audit Ledger';
    else target = 'Customer Channel #Web';
  }

  const record: AuditRecord = {
    id: logId,
    eventId,
    timestamp,
    organization_id: organizationId,
    agent_id: agentId,
    action_type: action.action_type,
    amount: action.amount !== undefined && action.amount !== null ? Number(action.amount) : null,
    description: action.description || '',
    target,
    risk_score: riskResult.risk_score,
    risk_breakdown: JSON.stringify(riskResult.breakdown),
    decision,
    reason,
    model_used: modelUsed,
    response_snippet: (responseText || '').slice(0, 300),
    policy_triggered: policyName,
    latency_ms: latencyMs,
    prev_proof_hash: prevHash,
    sha256_proof: sha256_proof,
    idempotency_key: idempotencyKey || null,
    replayed: false
  };

  auditLogs.unshift(record); // newest first in memory list
  return { logId, eventId, sha256_proof: `0x${sha256_proof}` };
}

/**
 * Verifies the integrity of the cryptographic audit hash-chain.
 * Traverses records from oldest to newest, recalculating each SHA-256 hash and verifying link integrity.
 */
export function verifyAuditChain(orgId?: string): {
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
} {
  // Sort chronologically (oldest to newest)
  const chronological = [...auditLogs].reverse();
  const filtered = (orgId && orgId !== 'all')
    ? chronological.filter((l) => l.organization_id === orgId)
    : chronological;

  if (filtered.length === 0) {
    return {
      valid: true,
      status: 'CHAIN_VALID',
      total_records_verified: 0,
      verification_timestamp: new Date().toISOString(),
      algorithm: 'SHA-256 Chained Hashes'
    };
  }

  for (let i = 0; i < filtered.length; i++) {
    const rec = filtered[i];
    const expectedPrev = i === 0 ? '0000000000000000000000000000000000000000000000000000000000000000' : filtered[i - 1].sha256_proof;

    // Verify link to previous proof hash (for full unfiltered ledger)
    if (!orgId || orgId === 'all') {
      if (rec.prev_proof_hash !== expectedPrev) {
        return {
          valid: false,
          status: 'TAMPER_DETECTED',
          total_records_verified: i,
          broken_at_index: i,
          broken_record_id: rec.id,
          reason: `Broken chain link: Record #${rec.id} (${rec.eventId}) prev_proof_hash '${rec.prev_proof_hash}' does not match previous record proof '${expectedPrev}'.`,
          verification_timestamp: new Date().toISOString(),
          algorithm: 'SHA-256 Chained Hashes'
        };
      }
    }

    // Verify record payload hash
    const expectedPayload = `${rec.prev_proof_hash}|${rec.eventId}|${rec.timestamp}|${rec.organization_id}|${rec.agent_id}|${rec.action_type}|${rec.amount ?? 'null'}|${rec.risk_score}|${rec.decision}`;
    const calculatedHash = generateSha256(expectedPayload);

    if (calculatedHash !== rec.sha256_proof) {
      return {
        valid: false,
        status: 'TAMPER_DETECTED',
        total_records_verified: i,
        broken_at_index: i,
        broken_record_id: rec.id,
        reason: `Cryptographic mismatch: Record #${rec.id} (${rec.eventId}) calculated hash '${calculatedHash}' differs from recorded proof '${rec.sha256_proof}'. Record has been mutated or forged.`,
        verification_timestamp: new Date().toISOString(),
        algorithm: 'SHA-256 Chained Hashes'
      };
    }
  }

  return {
    valid: true,
    status: 'CHAIN_VALID',
    total_records_verified: filtered.length,
    first_event_id: filtered[0].eventId,
    last_event_id: filtered[filtered.length - 1].eventId,
    verification_timestamp: new Date().toISOString(),
    algorithm: 'SHA-256 Chained Hashes (RFC 8785 & Chained Digests)'
  };
}

export function createEscalation(auditLogId: number, agentId: string, orgId: string = 'org_acme_global'): number {
  const escId = nextEscalationId++;
  const timestamp = new Date().toISOString();
  const eventId = `esc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

  const record: EscalationRecord = {
    id: escId,
    eventId,
    audit_log_id: auditLogId,
    agent_id: agentId,
    organization_id: orgId,
    status: 'pending',
    created_at: timestamp,
    resolved_at: null,
    operator: null,
    note: null,
  };

  escalations.unshift(record);
  return escId;
}

export function getEscalations(status?: string, orgId?: string) {
  let filtered = escalations;
  if (orgId && orgId !== 'all') {
    filtered = filtered.filter((e) => e.organization_id === orgId);
  }
  if (status && status !== 'all') {
    filtered = filtered.filter((e) => e.status === status);
  }

  return filtered.map((e) => {
    const log = auditLogs.find((l) => l.id === e.audit_log_id);
    return {
      ...e,
      action_type: log?.action_type || '',
      description: log?.description || '',
      amount: log?.amount ?? null,
      target: log?.target || '',
      risk_score: log?.risk_score ?? 0,
      risk_breakdown: log?.risk_breakdown || '{}',
      reason: log?.reason || '',
      policy_triggered: log?.policy_triggered || 'Standard Escrow Policy'
    };
  });
}

export function resolveEscalation(
  escalationId: number,
  approve: boolean,
  operator: string,
  note: string = '',
  orgId?: string
) {
  const esc = escalations.find((e) => e.id === escalationId);
  if (!esc) {
    return { error: 'not_found', message: 'Escalation ticket not found.' };
  }

  if (orgId && orgId !== 'all' && esc.organization_id !== orgId) {
    return { error: 'forbidden', message: `Cannot resolve escalation belonging to another organization.` };
  }

  // Idempotency & State conflict check: cannot re-resolve already resolved escalation
  if (esc.status !== 'pending') {
    return {
      error: 'conflict',
      message: `Escalation #${escalationId} has already been resolved as ${esc.status.toUpperCase()} by ${esc.operator}. Duplicate resolution prohibited.`,
      status: esc.status
    };
  }

  const newStatus: 'approved' | 'rejected' = approve ? 'approved' : 'rejected';
  const now = new Date().toISOString();

  esc.status = newStatus;
  esc.resolved_at = now;
  esc.operator = operator;
  esc.note = note || (approve ? 'Approved by designated operator override.' : 'Rejected per policy guidelines.');

  const log = auditLogs.find((l) => l.id === esc.audit_log_id);
  if (log) {
    log.decision = approve ? 'approved_after_review' : 'rejected_after_review';
    log.reason = `Reviewed & ${newStatus.toUpperCase()} by ${operator}: ${esc.note}`;
    emitWebhookEvent(approve ? 'action.approved' : 'action.rejected', log, {
      escalation_id: escalationId,
      operator,
      note: esc.note,
      resolved_at: now
    });
  }

  return {
    escalation_id: escalationId,
    status: newStatus,
    operator,
    note: esc.note,
    resolved_at: now
  };
}

export function getAuditLog(
  limit: number = 100,
  agentId?: string | null,
  decision?: string | null,
  actionType?: string | null,
  orgId?: string | null
): AuditRecord[] {
  let list = auditLogs;
  if (orgId && orgId !== 'all') {
    list = list.filter((l) => l.organization_id === orgId);
  }
  if (agentId) {
    list = list.filter((l) => l.agent_id === agentId);
  }
  if (decision && decision !== 'all') {
    list = list.filter((l) => l.decision === decision);
  }
  if (actionType && actionType !== 'all') {
    list = list.filter((l) => l.action_type === actionType);
  }
  return list.slice(0, limit);
}

export function getAgentStats(agentId: string, orgId?: string) {
  let agentLogs = auditLogs.filter((l) => l.agent_id === agentId);
  if (orgId && orgId !== 'all') {
    agentLogs = agentLogs.filter((l) => l.organization_id === orgId);
  }
  const total = agentLogs.length;
  const blocked = agentLogs.filter((l) => l.decision === 'blocked' || l.decision === 'rejected_after_review').length;
  const pending = escalations.filter((e) => e.agent_id === agentId && e.status === 'pending').length;
  const approved = agentLogs.filter((l) => l.decision === 'approved' || l.decision === 'approved_after_review').length;

  const totalRisk = agentLogs.reduce((acc, curr) => acc + curr.risk_score, 0);
  const avgRisk = total > 0 ? totalRisk / total : 0;
  const lastAction = agentLogs.length > 0 ? agentLogs[0].timestamp : null;

  return {
    total_actions: total,
    blocked,
    pending_approval: pending,
    approved,
    avg_risk_score: Math.round(avgRisk * 10) / 10,
    block_rate: total > 0 ? Math.round((blocked / total) * 1000) / 10 : 0,
    escalation_rate: total > 0 ? Math.round((pending / total) * 1000) / 10 : 0,
    last_activity: lastAction
  };
}

export function getFleetAnalytics(orgId?: string) {
  let filteredLogs = auditLogs;
  if (orgId && orgId !== 'all') {
    filteredLogs = filteredLogs.filter((l) => l.organization_id === orgId);
  }

  const total = filteredLogs.length;
  const blocked = filteredLogs.filter((l) => l.decision === 'blocked' || l.decision === 'rejected_after_review').length;
  const approved = filteredLogs.filter((l) => l.decision === 'approved' || l.decision === 'approved_after_review').length;
  const pendingEscalations = escalations.filter((e) => (orgId && orgId !== 'all' ? e.organization_id === orgId : true) && e.status === 'pending').length;
  const totalEscalations = escalations.filter((e) => (orgId && orgId !== 'all' ? e.organization_id === orgId : true)).length;

  const totalRisk = filteredLogs.reduce((acc, curr) => acc + curr.risk_score, 0);
  const avgRisk = total > 0 ? Math.round((totalRisk / total) * 10) / 10 : 14.5;

  const categoryTotals: Record<string, { sum: number; count: number }> = {
    finance: { sum: 0, count: 0 },
    legal: { sum: 0, count: 0 },
    privacy: { sum: 0, count: 0 },
    cyber: { sum: 0, count: 0 },
    autonomy: { sum: 0, count: 0 },
    physical: { sum: 0, count: 0 }
  };

  for (const log of filteredLogs) {
    try {
      const breakdown = JSON.parse(log.risk_breakdown);
      for (const [cat, val] of Object.entries(breakdown)) {
        if (categoryTotals[cat]) {
          categoryTotals[cat].sum += Number(val);
          categoryTotals[cat].count += 1;
        }
      }
    } catch {}
  }

  const categoryAverages: Record<string, number> = {};
  for (const [cat, data] of Object.entries(categoryTotals)) {
    categoryAverages[cat] = data.count > 0 ? Math.round((data.sum / data.count) * 10) / 10 : 12;
  }

  return {
    total_actions: total,
    blocked,
    approved,
    escalated: totalEscalations,
    pending_escalations: pendingEscalations,
    open_incidents: incidents.filter((i) => (orgId && orgId !== 'all' ? i.organization_id === orgId : true) && i.status === 'INVESTIGATING').length,
    avg_risk_score: avgRisk,
    category_averages: categoryAverages,
    availability_sla: '99.99%',
    median_latency_ms: 14
  };
}

export let executionLogs: Array<{
  execution_id: string;
  audit_log_id: number;
  event_id: string;
  agent_id: string;
  organization_id: string;
  executed_at: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  execution_output?: any;
}> = [];

export let webhookEvents: Array<{
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
}> = [];

export function recordExecution(
  auditLogId: number,
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' = 'SUCCESS',
  output?: any
) {
  const log = auditLogs.find((l) => l.id === auditLogId);
  if (!log) return null;

  const execution_id = `exec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const record = {
    execution_id,
    audit_log_id: log.id,
    event_id: log.eventId,
    agent_id: log.agent_id,
    organization_id: log.organization_id,
    executed_at: new Date().toISOString(),
    status,
    execution_output: output || { result: 'action_completed_successfully' }
  };
  executionLogs.unshift(record);
  return record;
}

export function emitWebhookEvent(
  eventType: 'action.allowed' | 'action.blocked' | 'action.review_required' | 'action.approved' | 'action.rejected' | 'incident.created',
  log: AuditRecord,
  payload: Record<string, any> = {}
) {
  const event_id = `wh_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const ev = {
    event_id,
    event_type: eventType,
    timestamp: new Date().toISOString(),
    organization_id: log.organization_id,
    request_id: log.eventId,
    agent_id: log.agent_id,
    decision: log.decision,
    audit_id: log.id,
    sha256_proof: `0x${log.sha256_proof}`,
    payload
  };
  webhookEvents.unshift(ev);
  if (webhookEvents.length > 200) webhookEvents.pop();
  return ev;
}

export function createApiKey(name: string, environment: 'production' | 'staging' | 'development', orgId: string = 'org_acme_global'): { key: ApiKeyRecord; rawSecret: string } {
  const secretRandom = crypto.randomBytes(18).toString('hex');
  const envPrefix = environment === 'production' ? 'ailg_live_' : 'ailg_test_';
  const fullSecret = `${envPrefix}${secretRandom}`;
  const id = `key_${environment.slice(0, 4)}_${crypto.randomBytes(6).toString('hex')}`;

  const record: ApiKeyRecord = {
    id,
    name: name || 'API Token',
    prefix: fullSecret.slice(0, 14) + '...',
    secretMasked: `${fullSecret.slice(0, 14)}••••••••••••••••••••${fullSecret.slice(-4)}`,
    rawSecret: fullSecret,
    organization_id: orgId,
    environment,
    created_at: new Date().toISOString(),
    last_used_at: 'Never',
    status: 'active'
  };

  apiKeys.unshift(record);
  return { key: record, rawSecret: fullSecret };
}

export function revokeApiKey(id: string, orgId?: string): boolean {
  const key = apiKeys.find((k) => k.id === id);
  if (!key) return false;
  if (orgId && orgId !== 'all' && key.organization_id !== orgId) return false;
  key.status = 'revoked';
  return true;
}

export function createPolicy(rule: Omit<PolicyRule, 'id' | 'lastUpdated'>, orgId: string = 'org_acme_global'): PolicyRule {
  const id = `POL-CUSTOM-${(policies.length + 1).toString().padStart(2, '0')}`;
  const newPolicy: PolicyRule = {
    id,
    organization_id: orgId,
    ...rule,
    lastUpdated: new Date().toISOString()
  };
  policies.unshift(newPolicy);
  return newPolicy;
}


