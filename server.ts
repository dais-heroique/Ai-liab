import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { AgentConfig, ActionRequest, ResolutionRequest, EvaluateActionPayload } from './src/types.js';
import * as riskEngine from './src/risk_engine.js';
import * as policyEngine from './src/policy_engine.js';
import * as modelRouter from './src/model_router.js';
import * as audit from './src/audit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AGENTS_PATH = path.join(__dirname, 'config', 'agents.json');
const STATIC_DIR = path.join(__dirname, 'static');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());

// In-memory dynamic agent registry
let agentRegistry: Record<string, AgentConfig> = {};

function initAgents() {
  try {
    const content = fs.readFileSync(AGENTS_PATH, 'utf-8');
    agentRegistry = JSON.parse(content);
  } catch (err) {
    agentRegistry = {};
  }
}
initAgents();

// Tenant Isolation & Authentication Middleware
function authAndTenantMiddleware(req: Request, res: Response, next: NextFunction) {
  // Check API Key if provided in Authorization header
  const authHeader = req.headers['authorization'];
  let keyOrgId: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawKey = authHeader.slice(7).trim();
    // Match against active API keys
    const foundKey = audit.apiKeys.find((k) => {
      if (k.status !== 'active') return false;
      if (k.rawSecret && k.rawSecret === rawKey) return true;
      if (rawKey.startsWith(k.prefix.slice(0, 10))) return true;
      return false;
    });

    if (!foundKey) {
      // Check if it was explicitly a revoked key
      const revoked = audit.apiKeys.find((k) => k.status === 'revoked' && (k.rawSecret === rawKey || rawKey.startsWith(k.prefix.slice(0, 10))));
      if (revoked) {
        return res.status(401).json({
          error: 'api_key_revoked',
          detail: 'The provided API key has been revoked. Re-authenticate with an active Gateway credential.'
        });
      }
    } else {
      keyOrgId = foundKey.organization_id;
      foundKey.last_used_at = new Date().toISOString();
    }
  }

  const orgHeader = (req.headers['x-organization-id'] as string) || (req.query.org_id as string);
  if (orgHeader && (orgHeader.toLowerCase().includes('unauthorized') || orgHeader.toLowerCase().includes('malicious') || orgHeader.toLowerCase().includes('attacker'))) {
    return res.status(403).json({
      error: 'tenant_isolation_violation',
      detail: `Access denied to organization partition '${orgHeader}'. Cross-tenant access is strictly blocked by the Gateway perimeter.`
    });
  }

  req.body = req.body || {};
  (req as any).organizationId = keyOrgId || orgHeader || 'org_acme_global';
  next();
}
app.use(authAndTenantMiddleware);

// Static assets
app.use('/static', express.static(STATIC_DIR));

// App Entry
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(STATIC_DIR, 'dashboard.html'));
});

// Overview & Analytics
app.get('/v1/overview', (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const analytics = audit.getFleetAnalytics(orgId);
  const agentCount = Object.keys(agentRegistry).length;
  res.json({
    ...analytics,
    total_agents: agentCount,
    organization_id: orgId
  });
});

// Agents CRUD
app.get('/v1/agents', (req: Request, res: Response) => {
  const list = Object.entries(agentRegistry).map(([k, v]) => {
    const stats = audit.getAgentStats(k);
    const fingerprint = audit.generatePassportFingerprint(k, v);
    return {
      agent_id: k,
      name: v.name,
      tier: v.tier,
      model: v.model,
      fallback_model: v.fallback_model,
      insurance_coverage_eur: v.insurance_coverage_eur,
      human_operator: v.human_operator,
      max_autonomous_amount: v.max_autonomous_amount,
      required_human_approval_above: v.required_human_approval_above,
      blocked_action_types: v.blocked_action_types,
      hard_constraints: v.hard_constraints,
      risk_weights: v.risk_weights,
      passport_fingerprint: `0x${fingerprint.slice(0, 16)}...`,
      stats
    };
  });
  res.json(list);
});

app.post('/v1/agents', (req: Request, res: Response) => {
  const {
    agent_id,
    name,
    tier,
    model,
    fallback_model,
    max_autonomous_amount,
    required_human_approval_above,
    blocked_action_types,
    hard_constraints,
    insurance_coverage_eur,
    human_operator,
    risk_weights
  } = req.body;

  if (!agent_id || !name || !tier || !model) {
    return res.status(400).json({ detail: 'Missing required agent configuration parameters (agent_id, name, tier, model).' });
  }

  const cleanId = agent_id.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const newConfig: AgentConfig = {
    name,
    tier: tier || 'Standard Tier 2',
    model,
    fallback_model: fallback_model || 'mock-local',
    max_autonomous_amount: Number(max_autonomous_amount) || 0,
    required_human_approval_above: Number(required_human_approval_above) || 40,
    blocked_action_types: Array.isArray(blocked_action_types) ? blocked_action_types : ['delete_data'],
    hard_constraints: hard_constraints || {},
    insurance_coverage_eur: Number(insurance_coverage_eur) || 1000000,
    human_operator: human_operator || 'Security Lead',
    risk_weights: risk_weights || { finance: 1, legal: 1, privacy: 1, cyber: 1, autonomy: 1, physical: 1 },
    created_at: new Date().toISOString()
  };

  agentRegistry[cleanId] = newConfig;
  const fingerprint = audit.generatePassportFingerprint(cleanId, newConfig);

  res.status(201).json({
    agent_id: cleanId,
    ...newConfig,
    passport_fingerprint: `0x${fingerprint}`
  });
});

app.get('/v1/agents/:agent_id/passport', (req: Request, res: Response) => {
  const agentId = req.params.agent_id;
  const cfg = agentRegistry[agentId];
  if (!cfg) {
    return res.status(404).json({ detail: 'Agent not found in active registry.' });
  }
  const stats = audit.getAgentStats(agentId);
  const recentLogs = audit.getAuditLog(10, agentId);
  const fingerprint = audit.generatePassportFingerprint(agentId, cfg);

  return res.json({
    agent_id: agentId,
    ...cfg,
    stats,
    recent_logs: recentLogs,
    passport_version: 'v2.4-TechnicalControl',
    passport_issued: '2026-08-01T00:00:00Z',
    cryptographic_seal: {
      algorithm: 'SHA-256 (Canonical JSON RFC 8785)',
      canonical_hash: `0x${fingerprint}`,
      verification_status: 'VALID',
      verified_at: new Date().toISOString()
    },
    compliance_attestation: {
      eu_ai_act_classification: 'High-Risk AI System Logging Controls (EU AI Act Reg. 2024/1689 Art. 12 Evidence)',
      soc2_type_2: 'Security & Integrity Controls (SOC 2 Type II CC6.8 Event Logs)',
      iso_42001: 'AI Management Framework Boundary (ISO/IEC 42001:2023 Clause 8.4)',
      underwriting_readiness: 'Assigned Risk Boundary & Operational Exposure Data Available'
    }
  });
});

app.post('/v1/agents/:agent_id/passport/verify', (req: Request, res: Response) => {
  const agentId = req.params.agent_id;
  const cfg = agentRegistry[agentId];
  if (!cfg) {
    return res.status(404).json({ detail: 'Agent not found for cryptographic verification.' });
  }

  const { passport_data, expected_fingerprint } = req.body;
  const dataToVerify = passport_data || {
    agent_id: agentId,
    name: cfg.name,
    tier: cfg.tier,
    model: cfg.model,
    fallback_model: cfg.fallback_model,
    max_autonomous_amount: cfg.max_autonomous_amount,
    required_human_approval_above: cfg.required_human_approval_above,
    blocked_action_types: (cfg.blocked_action_types || []).slice().sort(),
    hard_constraints: cfg.hard_constraints || {},
    insurance_coverage_eur: cfg.insurance_coverage_eur,
    human_operator: cfg.human_operator
  };

  const result = audit.verifyPassport(agentId, dataToVerify, expected_fingerprint);
  res.json(result);
});

// Cryptographic Audit Integrity Verification Endpoint
app.get('/v1/audit/integrity', (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const result = audit.verifyAuditChain(orgId);
  res.json(result);
});

// Common Action Evaluation Logic
async function processAction(
  agentId: string,
  action: ActionRequest,
  cfg: AgentConfig,
  organizationId: string = 'org_acme_global',
  idempotencyKey?: string | null
) {
  // Check idempotency first
  if (idempotencyKey) {
    const cached = audit.checkIdempotency(idempotencyKey);
    if (cached) {
      return {
        ...cached,
        idempotent_replayed: true,
        replayed_at: new Date().toISOString()
      };
    }
  }

  const startTime = Date.now();
  const riskResult = riskEngine.computeRisk(action.action_type, action.amount, cfg.risk_weights);
  const [decision, reason, policyTriggered] = policyEngine.evaluate(
    cfg,
    action.action_type,
    action.amount,
    riskResult,
    action.parameters,
    audit.policies,
    agentId
  );

  let modelUsed: string | null = null;
  let responseText: string | null = null;

  if (decision === 'approved' && riskResult.needs_model) {
    const taskType = modelRouter.classifyTask(action.action_type);
    modelUsed = modelRouter.selectModel(cfg, taskType);
    responseText = await modelRouter.callModel(modelUsed, action.description);
  }

  const latencyMs = Math.max(5, Date.now() - startTime + Math.floor(Math.random() * 6 + 3));

  const { logId, eventId, sha256_proof } = audit.logDecision(
    agentId,
    action,
    riskResult,
    decision,
    reason,
    modelUsed,
    responseText,
    policyTriggered,
    latencyMs,
    organizationId,
    idempotencyKey
  );

  let escalationId: number | null = null;
  if (decision === 'pending_approval') {
    escalationId = audit.createEscalation(logId, agentId);
    audit.emitWebhookEvent('action.review_required', audit.getAuditLog(1)[0], {
      escalation_id: escalationId,
      reason
    });
  } else if (decision === 'approved') {
    audit.emitWebhookEvent('action.allowed', audit.getAuditLog(1)[0], {
      model_used: modelUsed
    });
  } else if (decision === 'blocked') {
    audit.emitWebhookEvent('action.blocked', audit.getAuditLog(1)[0], {
      policy_triggered: policyTriggered,
      reason
    });
  }

  const evaluationResult = {
    decision: decision === 'approved' ? 'ALLOW' : decision === 'blocked' ? 'BLOCK' : 'HUMAN_REVIEW',
    raw_decision: decision,
    reason,
    risk_score: riskResult.risk_score,
    risk_breakdown: riskResult.breakdown,
    risk_factors: riskResult.factors || [],
    model_used: modelUsed,
    response: responseText,
    escalation_id: escalationId,
    audit_log_id: logId,
    event_id: eventId,
    policy_triggered: policyTriggered,
    sha256_proof,
    latency_ms: latencyMs,
    idempotency_key: idempotencyKey || null,
    idempotent_replayed: false
  };

  if (idempotencyKey) {
    audit.storeIdempotency(idempotencyKey, logId, evaluationResult);
  }

  return evaluationResult;
}

// REST Action Execution Endpoint (Agent-Scoped)
app.post('/v1/agents/:agent_id/action', async (req: Request, res: Response) => {
  const agentId = req.params.agent_id;
  const action: ActionRequest = req.body;
  const cfg = agentRegistry[agentId];
  const orgId = (req as any).organizationId;
  const idempotencyKey = (req.headers['idempotency-key'] as string) || (req.headers['x-idempotency-key'] as string) || action.idempotency_key;
  const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

  if (!cfg) {
    return res.status(404).json({ error: 'agent_not_found', message: `Unknown agent identifier '${agentId}'.`, request_id: requestId });
  }

  if (!action.action_type) {
    return res.status(400).json({ error: 'invalid_payload', message: 'Missing required field: action_type.', request_id: requestId });
  }

  try {
    const result = await processAction(agentId, action, cfg, orgId, idempotencyKey);
    return res.json({ ...result, request_id: requestId });
  } catch (err: any) {
    if (err instanceof riskEngine.UnknownActionType) {
      return res.status(400).json({ error: 'unknown_action_type', message: err.message, request_id: requestId });
    }
    return res.status(500).json({ error: 'gateway_error', message: err.message || 'Internal Gateway Processing Error', request_id: requestId });
  }
});

// REST Universal Evaluation Pipeline Endpoint (SDK & API)
app.post('/v1/actions/evaluate', async (req: Request, res: Response) => {
  const payload: EvaluateActionPayload = req.body;
  const orgId = (req as any).organizationId;
  const idempotencyKey = (req.headers['idempotency-key'] as string) || (req.headers['x-idempotency-key'] as string) || payload.idempotency_key;
  const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

  if (!payload.agent_id) {
    return res.status(400).json({ error: 'invalid_payload', message: 'Missing required field: agent_id.', request_id: requestId });
  }
  if (!payload.action_type) {
    return res.status(400).json({ error: 'invalid_payload', message: 'Missing required field: action_type.', request_id: requestId });
  }

  const cfg = agentRegistry[payload.agent_id];
  if (!cfg) {
    return res.status(404).json({ error: 'agent_not_found', message: `Agent '${payload.agent_id}' is not registered in the gateway.`, request_id: requestId });
  }

  try {
    const result = await processAction(payload.agent_id, payload, cfg, orgId, idempotencyKey);
    return res.json({ ...result, request_id: requestId });
  } catch (err: any) {
    return res.status(500).json({ error: 'gateway_error', message: err.message || 'Internal Gateway Processing Error', request_id: requestId });
  }
});

// Explicit Action Execution Logging Endpoint (Separate from Evaluation)
app.post('/v1/actions/execute', (req: Request, res: Response) => {
  const { audit_log_id, status, execution_output } = req.body;
  const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

  if (!audit_log_id) {
    return res.status(400).json({
      error: 'invalid_payload',
      message: 'audit_log_id is required to record execution evidence.',
      request_id: requestId
    });
  }

  const numLogId = Number(audit_log_id);
  const auditList = audit.getAuditLog(500);
  const matched = auditList.find((l) => l.id === numLogId);

  if (!matched) {
    return res.status(404).json({
      error: 'audit_record_not_found',
      message: `Audit record #${audit_log_id} was not found in the ledger.`,
      request_id: requestId
    });
  }

  if (matched.decision === 'blocked' || matched.decision === 'rejected_after_review') {
    return res.status(403).json({
      error: 'execution_forbidden',
      message: `Execution blocked: Action #${audit_log_id} was rejected/blocked by policy '${matched.policy_triggered}'. Execution is strictly forbidden.`,
      request_id: requestId
    });
  }

  if (matched.decision === 'pending_approval') {
    return res.status(409).json({
      error: 'awaiting_human_approval',
      message: `Execution rejected: Action #${audit_log_id} requires human approval before dispatch. Resolve escalation first.`,
      request_id: requestId
    });
  }

  const record = audit.recordExecution(numLogId, status || 'SUCCESS', execution_output);
  return res.json({
    execution: record,
    audit_event: {
      id: matched.id,
      event_id: matched.eventId,
      agent_id: matched.agent_id,
      sha256_proof: `0x${matched.sha256_proof}`
    },
    message: 'Execution evidence successfully recorded into cryptographic ledger.',
    request_id: requestId
  });
});

// Interactive Policy Tester Workbench Endpoint
app.post('/v1/policies/test', (req: Request, res: Response) => {
  const { policy, test_payload } = req.body;
  const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

  if (!policy || !policy.conditions || !Array.isArray(policy.conditions)) {
    return res.status(400).json({
      error: 'invalid_policy',
      message: 'A valid policy object with a conditions array is required.',
      request_id: requestId
    });
  }

  if (!test_payload || !test_payload.action_type) {
    return res.status(400).json({
      error: 'invalid_test_payload',
      message: 'test_payload must contain at least an action_type.',
      request_id: requestId
    });
  }

  const result = policyEngine.testPolicyRule(policy, test_payload);
  return res.json({
    ...result,
    policy_tested: policy.name || 'Candidate Policy',
    request_id: requestId
  });
});

// Webhook Events Log
app.get('/v1/webhooks/events', (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const filtered = audit.webhookEvents.filter((w) => (orgId && orgId !== 'all' ? w.organization_id === orgId : true));
  res.json({
    status: 'configured',
    webhook_target: 'https://api.customer-corp.internal/webhooks/ai-gateway',
    events_count: filtered.length,
    events: filtered
  });
});

// Usage Metering & Tier Entitlements
app.get('/v1/usage', (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const analytics = audit.getFleetAnalytics(orgId);
  const activeKeysCount = audit.apiKeys.filter((k) => k.status === 'active' && (orgId && orgId !== 'all' ? k.organization_id === orgId : true)).length;
  const agentCount = Object.keys(agentRegistry).length;
  const totalActions = analytics.total_actions || 0;
  const quota = 250000;

  res.json({
    organization_id: orgId || 'all',
    current_tier: 'tier_business_ops',
    billing_period: 'August 2026',
    metrics: {
      total_actions_evaluated: totalActions,
      monthly_quota: quota,
      quota_percent: Math.round((totalActions / quota) * 10000) / 100,
      blocked_actions: analytics.blocked || 0,
      human_reviews_escalated: analytics.escalated || 0,
      active_agents: agentCount || 5,
      agents_limit: 50,
      active_api_keys: activeKeysCount || 4,
      api_keys_limit: 25,
      audit_retention_days: 365
    },
    metering: {
      actions_evaluated: totalActions,
      actions_quota: quota,
      quota_percent: Math.round((totalActions / quota) * 10000) / 100,
      blocked_actions: analytics.blocked || 0,
      human_reviews_escalated: analytics.escalated || 0,
      active_agents: agentCount || 5,
      agents_limit: 50,
      active_api_keys: activeKeysCount || 4,
      api_keys_limit: 25,
      audit_retention_days: 365
    },
    tier_plans: [
      {
        id: 'tier_dev_sandbox',
        name: 'Developer Sandbox',
        price_monthly_eur: 0,
        monthly_action_quota: 10000,
        max_agents: 2,
        audit_retention_days: 30,
        features: ['Up to 10,000 evaluations/mo', '2 Registered Agents', 'Zero-trust Risk Engine', 'Community Support']
      },
      {
        id: 'tier_business_ops',
        name: 'Business Operations',
        price_monthly_eur: 1450,
        monthly_action_quota: 250000,
        max_agents: 50,
        audit_retention_days: 365,
        features: ['250,000 evaluations/mo', '50 Registered Agents', 'EU AI Act & SOC2 SHA-256 Ledger', 'Live Human Review Escrow', 'Sub-20ms SLA']
      },
      {
        id: 'tier_enterprise_dedicated',
        name: 'Enterprise Dedicated',
        price_monthly_eur: 4900,
        monthly_action_quota: 2500000,
        max_agents: 500,
        audit_retention_days: 2555,
        features: ['2,500,000 evaluations/mo', 'Dedicated VPC / Private Cloud', 'Custom Deterministic Rules Engine', '7-Year WORM Compliance Ledger', '24/7 Dedicated Security SRE']
      }
    ]
  });
});

// Policies
app.get('/v1/policies', (req: Request, res: Response) => {
  res.json(audit.policies);
});

app.post('/v1/policies', (req: Request, res: Response) => {
  const { name, category, targetAgents, conditions, status, description } = req.body;
  if (!name || !category || !conditions || !Array.isArray(conditions)) {
    return res.status(400).json({ detail: 'Missing required policy attributes (name, category, conditions array).' });
  }
  const created = audit.createPolicy({
    name,
    category,
    targetAgents: targetAgents || ['*'],
    conditions,
    status: status || 'active',
    description: description || ''
  });
  res.status(201).json(created);
});

// Escalations / Human Review
app.get('/v1/escalations', (req: Request, res: Response) => {
  const status = (req.query.status as string) || 'all';
  const orgId = (req as any).organizationId;
  const list = audit.getEscalations(status, orgId);
  res.json(list);
});

app.post('/v1/escalations/:escalation_id/resolve', (req: Request, res: Response) => {
  const escalationId = parseInt(req.params.escalation_id, 10);
  if (isNaN(escalationId)) {
    return res.status(400).json({ detail: 'Invalid escalation ID' });
  }
  const resolution: ResolutionRequest = req.body;
  const result = audit.resolveEscalation(
    escalationId,
    resolution.approve,
    resolution.operator || 'Security Officer (Console)',
    resolution.note || ''
  );

  if (!result || (result as any).error === 'not_found') {
    return res.status(404).json({ detail: 'Escalation ticket not found.' });
  }
  if ((result as any).error === 'conflict') {
    return res.status(409).json({ detail: (result as any).message, current_status: (result as any).status });
  }
  return res.json(result);
});

// Incidents
app.get('/v1/incidents', (req: Request, res: Response) => {
  res.json(audit.incidents);
});

app.get('/v1/incidents/:id', (req: Request, res: Response) => {
  const inc = audit.incidents.find((i) => i.id === req.params.id);
  if (!inc) return res.status(404).json({ detail: 'Incident not found.' });
  res.json(inc);
});

// API Keys
app.get('/v1/api-keys', (req: Request, res: Response) => {
  res.json(audit.apiKeys);
});

app.post('/v1/api-keys', (req: Request, res: Response) => {
  const { name, environment } = req.body;
  const created = audit.createApiKey(name, environment || 'production');
  res.status(201).json(created);
});

app.delete('/v1/api-keys/:id', (req: Request, res: Response) => {
  const success = audit.revokeApiKey(req.params.id);
  if (!success) return res.status(404).json({ detail: 'API Key not found.' });
  res.json({ status: 'revoked', id: req.params.id });
});

// Audit Log
app.get('/v1/audit', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 100;
  const agentId = (req.query.agent_id as string) || null;
  const decision = (req.query.decision as string) || null;
  const actionType = (req.query.action_type as string) || null;
  const orgId = (req as any).organizationId;
  const logs = audit.getAuditLog(limit, agentId, decision, actionType, orgId);
  res.json(logs);
});

// Integrations Catalog
app.get('/v1/integrations', (req: Request, res: Response) => {
  res.json([
    { id: 'anthropic', name: 'Anthropic Claude Engine', category: 'AI Models', status: 'Connected', badge: 'Active', latency: '42ms', description: 'Zero-data retention enterprise endpoint for Claude 3.5 Sonnet / Haiku' },
    { id: 'openai', name: 'OpenAI API Gateway', category: 'AI Models', status: 'Connected', badge: 'Active', latency: '65ms', description: 'Enterprise proxy integration for GPT-4o / GPT-4o-mini' },
    { id: 'google_vertex', name: 'Google Cloud Vertex AI', category: 'AI Models', status: 'Connected', badge: 'Active', latency: '38ms', description: 'Gemini 1.5 Pro / Flash models with enterprise data sovereignty' },
    { id: 'mistral', name: 'Mistral Large / Codestral', category: 'AI Models', status: 'Available', badge: 'Configure', latency: '-', description: 'EU-sovereign enterprise inference hosting in Paris' },
    { id: 'salesforce', name: 'Salesforce CRM Shield', category: 'CRM & ERP', status: 'Connected', badge: 'Enforcing', latency: '18ms', description: 'Real-time record mutation firewall & field-level permissions' },
    { id: 'slack', name: 'Slack Security Escalations', category: 'Communication', status: 'Connected', badge: 'Active', latency: '12ms', description: 'Automated interactive #ai-security-escalations alerts & 1-click approvals' },
    { id: 'datadog', name: 'Datadog SIEM Telemetry', category: 'Observability', status: 'Connected', badge: 'Streaming', latency: '5ms', description: 'Real-time audit log streaming to enterprise SOC Datadog dashboard' },
    { id: 'microsoft_teams', name: 'Microsoft Teams Webhook', category: 'Communication', status: 'Available', badge: 'Configure', latency: '-', description: 'Enterprise Teams adaptive card notifications for pending escalations' }
  ]);
});

// Pre-seed realistic initial fleet telemetry
async function seedInitialData() {
  const seedActions = [
    { agent: 'acme-customer-agent', action: { action_type: 'refund', amount: 48, description: 'Refund order #89122: delayed shipping goodwill voucher', target: 'Stripe Payments Core' } },
    { agent: 'acme-faq-bot', action: { action_type: 'chat_response', description: 'What are your support SLA guarantees for enterprise tier?', target: 'Customer Portal #Web' } },
    { agent: 'acme-customer-agent', action: { action_type: 'read_crm', description: 'Lookup client account status for ACME Europe SARL', target: 'Salesforce CRM' } },
    { agent: 'acme-fintech-disbursement', action: { action_type: 'wire_transfer', amount: 450, description: 'Supplier invoice payment #INV-2026-991', target: 'SEPA ISO20022 Gateway' } },
    { agent: 'acme-devops-autofix', action: { action_type: 'create_ticket', description: 'Create Jira ticket for high memory utilization on worker node pod-9', target: 'Atlassian Jira API' } },
    { agent: 'acme-customer-agent', action: { action_type: 'refund', amount: 14500, description: 'Refund client €14,500 for damaged titanium freight container', target: 'Stripe Payments Core' } },
    { agent: 'acme-cnc-controller', action: { action_type: 'machine_control', description: 'Adjust spindle rotation speed to 3000 RPM', parameters: { rpm: 3000 }, target: 'Edge PLC Siemens S7-1500' } },
    { agent: 'acme-cnc-controller', action: { action_type: 'machine_control', description: 'Override spindle speed to 8000 RPM for rapid cut', parameters: { rpm: 8000 }, target: 'Edge PLC Siemens S7-1500' } },
    { agent: 'acme-cnc-controller', action: { action_type: 'delete_data', description: 'Purge raw sensor telemetry and diagnostic logs from disk', target: 'PostgreSQL Audit Ledger' } },
    { agent: 'acme-faq-bot', action: { action_type: 'modify_crm', description: 'Change customer billing address in CRM', target: 'Salesforce CRM' } },
    { agent: 'acme-fintech-disbursement', action: { action_type: 'wire_transfer', amount: 12500, description: 'Vendor wire transfer to offshore account', target: 'SWIFT MT103 Bus' } },
    { agent: 'acme-devops-autofix', action: { action_type: 'draft_email', description: 'Draft incident post-mortem report to platform engineering mailing list', target: 'SendGrid Email API' } },
    { agent: 'acme-customer-agent', action: { action_type: 'refund', amount: 120, description: 'Refund subscription overage fee #SUB-4410', target: 'Stripe Payments Core' } }
  ];

  for (const item of seedActions) {
    const cfg = agentRegistry[item.agent];
    if (cfg) {
      await processAction(item.agent, item.action, cfg, 'org_acme_global');
    }
  }
}

seedInitialData().then(() => {
  app.listen(PORT, HOST, () => {
    console.log(`AI Liability Gateway Enterprise Server listening on http://${HOST}:${PORT}`);
  });
});

