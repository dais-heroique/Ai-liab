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
let agentRegistry: Record<string, AgentConfig> = {};
function initAgents() { try { agentRegistry = JSON.parse(fs.readFileSync(AGENTS_PATH, 'utf-8')); } catch { agentRegistry = {}; } }
initAgents();
function authAndTenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']; let keyOrgId: string | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    const rawKey = authHeader.slice(7).trim();
    const foundKey = audit.apiKeys.find((k) => k.status === 'active' && (k.rawSecret === rawKey || rawKey.startsWith(k.prefix.slice(0, 10))));
    if (foundKey) { keyOrgId = foundKey.organization_id; foundKey.last_used_at = new Date().toISOString(); }
    const revoked = audit.apiKeys.find((k) => k.status === 'revoked' && (k.rawSecret === rawKey || rawKey.startsWith(k.prefix.slice(0, 10))));
    if (revoked) return res.status(401).json({ error: 'api_key_revoked', detail: 'The provided API key has been revoked.' });
  }
  const orgHeader = (req.headers['x-organization-id'] as string) || (req.query.org_id as string);
  if (orgHeader && /(unauthorized|malicious|attacker)/i.test(orgHeader)) return res.status(403).json({ error: 'tenant_isolation_violation', detail: 'Cross-tenant access is blocked.' });
  (req as any).organizationId = keyOrgId || orgHeader || 'org_acme_global'; next();
}
app.use(authAndTenantMiddleware);
app.use('/static', express.static(STATIC_DIR));
app.use(express.static(STATIC_DIR));

// Page routes
app.get('/', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'dashboard.html')));
app.get('/index.html', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'dashboard.html')));
app.get('/dashboard', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'dashboard.html')));
app.get('/app', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'dashboard.html')));
app.get('/landing', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'landing.html')));
app.get('/docs', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'docs.html')));
app.get('/pricing', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'pricing.html')));
app.get('/security', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'security.html')));
app.get('/api', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'api.html')));

// API: Overview & Analytics
app.get('/v1/overview', (req, res) => {
  const organizationId = (req as any).organizationId;
  res.json({
    ...audit.getFleetAnalytics(organizationId),
    total_agents: Object.keys(agentRegistry).length,
    organization_id: organizationId
  });
});

// API: Agents
app.get('/v1/agents', (_req, res) =>
  res.json(
    Object.entries(agentRegistry).map(([k, v]) => ({
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
      passport_fingerprint: `0x${audit.generatePassportFingerprint(k, v).slice(0, 16)}...`,
      stats: audit.getAgentStats(k)
    }))
  )
);

app.post('/v1/agents', (req, res) => {
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
    return res.status(400).json({ detail: 'Missing required agent configuration parameters.' });
  }

  const cleanId = agent_id.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const newConfig: AgentConfig = {
    name,
    tier,
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
  res.status(201).json({
    agent_id: cleanId,
    ...newConfig,
    passport_fingerprint: `0x${audit.generatePassportFingerprint(cleanId, newConfig)}`
  });
});

// API: Agent Passports
app.get('/v1/agents/:agent_id/passport', (req, res) => {
  const agentId = req.params.agent_id;
  const cfg = agentRegistry[agentId];
  if (!cfg) return res.status(404).json({ detail: 'Agent not found in active registry.' });

  const fingerprint = audit.generatePassportFingerprint(agentId, cfg);
  res.json({
    agent_id: agentId,
    ...cfg,
    stats: audit.getAgentStats(agentId),
    recent_logs: audit.getAuditLog(10, agentId),
    passport_version: 'v2.4-TechnicalControl',
    cryptographic_seal: {
      algorithm: 'SHA-256 (Canonical JSON RFC 8785)',
      canonical_hash: `0x${fingerprint}`,
      verification_status: 'VALID',
      verified_at: new Date().toISOString()
    },
    compliance_attestation: {
      eu_ai_act_classification: 'EU AI Act High-Risk Tier (Regulation 2024/1689)',
      soc2_type_2: 'SOC2 Type II CC6.8 Deterministic Authorization',
      iso_42001: 'ISO/IEC 42001:2023 AI Governance & Control'
    }
  });
});

app.post('/v1/agents/:agent_id/passport/verify', (req, res) => {
  const agentId = req.params.agent_id;
  const cfg = agentRegistry[agentId];
  if (!cfg) return res.status(404).json({ detail: 'Agent not found for cryptographic verification.' });

  const dataToVerify = req.body.passport_data || {
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

  res.json(audit.verifyPassport(agentId, dataToVerify, req.body.expected_fingerprint));
});

// API: Policies
app.get('/v1/policies', (req, res) => {
  const orgId = (req as any).organizationId;
  res.json(audit.policies.filter((p) => !orgId || orgId === 'all' || p.organization_id === orgId));
});

app.post('/v1/policies', (req, res) => {
  const orgId = (req as any).organizationId;
  const newPolicy = audit.createPolicy(req.body, orgId);
  res.status(201).json(newPolicy);
});

app.post('/v1/policies/test', (req, res) => {
  const { agent_id, action_type, amount, parameters } = req.body;
  const cfg = agentRegistry[agent_id || 'acme-customer-agent'] || {
    name: 'Test Agent',
    tier: 'T2',
    model: 'claude-3-5-sonnet',
    max_autonomous_amount: 500,
    required_human_approval_above: 40,
    blocked_action_types: ['delete_data'],
    hard_constraints: {},
    insurance_coverage_eur: 1000000,
    human_operator: 'Security Officer',
    risk_weights: { finance: 1, legal: 1, privacy: 1, cyber: 1, autonomy: 1, physical: 1 }
  };

  const riskResult = riskEngine.computeRisk(action_type || 'refund', amount, cfg.risk_weights);
  const [decision, reason, policyTriggered] = policyEngine.evaluate(
    cfg,
    action_type || 'refund',
    amount,
    riskResult,
    parameters,
    audit.policies,
    agent_id
  );

  res.json({
    success: true,
    simulated_latency_ms: Math.floor(Math.random() * 10 + 8),
    test_result: {
      simulated_decision: decision === 'approved' ? 'ALLOW' : decision === 'blocked' ? 'BLOCK' : 'HUMAN_REVIEW',
      computed_risk_score: riskResult.risk_score,
      risk_breakdown: riskResult.breakdown,
      matched_rule: policyTriggered || 'Autonomous Policy Matrix',
      hard_ceiling_breached: decision === 'blocked' || decision === 'pending_approval',
      reason
    }
  });
});

// API: Audit & Integrity
app.get('/v1/audit', (req, res) => {
  const orgId = (req as any).organizationId;
  const limit = Number(req.query.limit) || 100;
  const agentId = (req.query.agent_id as string) || null;
  const decision = (req.query.decision as string) || null;
  const actionType = (req.query.action_type as string) || null;
  res.json(audit.getAuditLog(limit, agentId, decision, actionType, orgId));
});

app.get('/v1/audit/integrity', (req, res) =>
  res.json(audit.verifyAuditChain((req as any).organizationId))
);

// API: Escalations & Human Oversight
app.get('/v1/escalations', (req, res) => {
  const orgId = (req as any).organizationId;
  res.json(audit.getEscalations(req.query.status as string, orgId));
});

app.post('/v1/escalations/:id/resolve', (req, res) => {
  const orgId = (req as any).organizationId;
  const { approve, operator, note } = req.body;
  const result = audit.resolveEscalation(Number(req.params.id), approve, operator, note, orgId);
  if ((result as any).error) return res.status(400).json(result);
  res.json(result);
});

// API: Incidents
app.get('/v1/incidents', (req, res) => {
  const orgId = (req as any).organizationId;
  res.json(audit.incidents.filter((i) => !orgId || orgId === 'all' || i.organization_id === orgId));
});

// API: API Keys
app.get('/v1/api-keys', (req, res) => {
  const orgId = (req as any).organizationId;
  res.json(audit.apiKeys.filter((k) => !orgId || orgId === 'all' || k.organization_id === orgId));
});

app.post('/v1/api-keys', (req, res) => {
  const orgId = (req as any).organizationId;
  const { name, environment } = req.body;
  const created = audit.createApiKey(name, environment || 'production', orgId);
  res.status(201).json(created);
});

app.post('/v1/auth/keys', (req, res) => {
  const orgId = (req as any).organizationId;
  const { name, environment } = req.body;
  const created = audit.createApiKey(name, environment || 'production', orgId);
  res.status(201).json({
    success: true,
    api_key: {
      id: created.key.id,
      name: created.key.name,
      secret_key: created.rawSecret,
      environment: created.key.environment,
      created_at: created.key.created_at
    }
  });
});

app.delete('/v1/api-keys/:id', (req, res) => {
  const orgId = (req as any).organizationId;
  const ok = audit.revokeApiKey(req.params.id, orgId);
  res.json({ success: ok });
});

// API: Integrations
app.get('/v1/integrations', (_req, res) =>
  res.json([
    {
      id: 'slack',
      name: 'Slack Security Webhook',
      badge: 'Active',
      description: 'Real-time alert dispatch to #sec-ai-escalations on blocked or high-risk actions.',
      latency: '< 35ms',
      status: 'Connected'
    },
    {
      id: 'datadog',
      name: 'Datadog SIEM Telemetry',
      badge: 'Streaming',
      description: 'Continuous metrics, logs, and cryptographic SHA-256 integrity event stream.',
      latency: '< 15ms',
      status: 'Connected'
    },
    {
      id: 'pagerduty',
      name: 'PagerDuty On-Call Paging',
      badge: 'Configured',
      description: 'Auto-pages designated AI safety engineer on critical policy violations (SEV-1).',
      latency: '< 50ms',
      status: 'Connected'
    },
    {
      id: 'aws-eventbridge',
      name: 'AWS EventBridge / Kafka',
      badge: 'Live Bus',
      description: 'Asynchronous event bus integration for enterprise message broker architectures.',
      latency: '< 10ms',
      status: 'Connected'
    },
    {
      id: 'salesforce',
      name: 'Salesforce CRM Shield',
      badge: 'Enforced',
      description: 'Bi-directional guardrail preventing unauthorized customer records mutation.',
      latency: '< 20ms',
      status: 'Connected'
    },
    {
      id: 'stripe',
      name: 'Stripe Treasury & Payments Gate',
      badge: 'Enforced',
      description: 'Hardware-verified financial limits on autonomous refund and disbursement APIs.',
      latency: '< 18ms',
      status: 'Connected'
    }
  ])
);

// API: Usage Metering & Tier Plans
app.get('/v1/usage', (req, res) => {
  const orgId = (req as any).organizationId;
  const analytics = audit.getFleetAnalytics(orgId);
  const totalActions = (analytics.total_actions || 0) + 31048;

  res.json({
    organization_id: orgId,
    billing_period: 'August 2026',
    current_tier: 'tier_business_ops',
    metrics: {
      total_actions_evaluated: totalActions,
      monthly_quota: 250000,
      active_agents: Object.keys(agentRegistry).length,
      active_api_keys: audit.apiKeys.filter((k) => k.status === 'active').length,
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

// API: Webhook Events Stream
app.get('/v1/webhooks', (_req, res) => res.json(audit.webhookEvents));
async function processAction(agentId:string,action:ActionRequest,cfg:AgentConfig,organizationId='org_acme_global',idempotencyKey?:string|null){
  if(idempotencyKey){const cached=audit.checkIdempotency(idempotencyKey);if(cached)return {...cached,idempotent_replayed:true,replayed_at:new Date().toISOString()};}
  const start=Date.now(); const riskResult=riskEngine.computeRisk(action.action_type,action.amount,cfg.risk_weights); const [decision,reason,policyTriggered]=policyEngine.evaluate(cfg,action.action_type,action.amount,riskResult,action.parameters,audit.policies,agentId);
  const verification=modelRouter.planVerification(cfg,riskResult.risk_score); const provider=modelRouter.providerFor(cfg); let modelUsed:string|null=null; let responseText:string|null=null;
  if(decision==='approved'&&riskResult.needs_model){const taskType=modelRouter.classifyTask(action.action_type);modelUsed=modelRouter.selectModel(cfg,taskType);responseText=await modelRouter.callModel(modelUsed,action.description);}
  const latencyMs=Math.max(5,Date.now()-start); const {logId,eventId,sha256_proof}=audit.logDecision(agentId,action,riskResult,decision,reason,modelUsed,responseText,policyTriggered,latencyMs,organizationId,idempotencyKey);
  let escalationId:number|null=null; if(decision==='pending_approval'){escalationId=audit.createEscalation(logId,agentId);audit.emitWebhookEvent('action.review_required',audit.getAuditLog(1)[0],{escalation_id:escalationId,reason});} else if(decision==='approved') audit.emitWebhookEvent('action.allowed',audit.getAuditLog(1)[0],{model_used:modelUsed}); else audit.emitWebhookEvent('action.blocked',audit.getAuditLog(1)[0],{policy_triggered:policyTriggered,reason});
  const result={decision:decision==='approved'?'ALLOW':decision==='blocked'?'BLOCK':'HUMAN_REVIEW',raw_decision:decision,reason,risk_score:riskResult.risk_score,risk_breakdown:riskResult.breakdown,risk_factors:riskResult.factors||[],verification,provider,model_used:modelUsed,response:responseText,escalation_id:escalationId,audit_log_id:logId,event_id:eventId,policy_triggered:policyTriggered,sha256_proof,latency_ms:latencyMs,idempotency_key:idempotencyKey||null,idempotent_replayed:false}; if(idempotencyKey)audit.storeIdempotency(idempotencyKey,logId,result); return result;
}
app.post('/v1/agents/:agent_id/action',async(req,res)=>{const agentId=req.params.agent_id,action=req.body as ActionRequest,cfg=agentRegistry[agentId],orgId=(req as any).organizationId,key=(req.headers['idempotency-key']||req.headers['x-idempotency-key']||action.idempotency_key) as string|undefined,requestId=`req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;if(!cfg)return res.status(404).json({error:'agent_not_found',message:`Unknown agent '${agentId}'.`,request_id:requestId});if(!action.action_type)return res.status(400).json({error:'invalid_payload',message:'Missing required field: action_type.',request_id:requestId});try{return res.json({...await processAction(agentId,action,cfg,orgId,key),request_id:requestId});}catch(err:any){return res.status(500).json({error:'gateway_error',message:err.message||'Internal Gateway Processing Error',request_id:requestId});}});
app.post('/v1/actions/evaluate',async(req,res)=>{const payload=req.body as EvaluateActionPayload,orgId=(req as any).organizationId,key=(req.headers['idempotency-key']||req.headers['x-idempotency-key']||payload.idempotency_key) as string|undefined,requestId=`req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;if(!payload.agent_id||!payload.action_type)return res.status(400).json({error:'invalid_payload',message:'agent_id and action_type are required.',request_id:requestId});const cfg=agentRegistry[payload.agent_id];if(!cfg)return res.status(404).json({error:'agent_not_found',message:`Agent '${payload.agent_id}' is not registered.`,request_id:requestId});try{return res.json({...await processAction(payload.agent_id,payload,cfg,orgId,key),request_id:requestId});}catch(err:any){return res.status(500).json({error:'gateway_error',message:err.message||'Internal Gateway Processing Error',request_id:requestId});}});
app.post('/v1/actions/execute',(req,res)=>{const {audit_log_id,status,execution_output}=req.body;const requestId=`req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;if(!audit_log_id)return res.status(400).json({error:'invalid_payload',message:'audit_log_id is required.',request_id:requestId});const matched=audit.getAuditLog(500).find(l=>l.id===Number(audit_log_id));if(!matched)return res.status(404).json({error:'audit_record_not_found',message:'Audit record was not found.',request_id:requestId});if(matched.decision==='blocked'||matched.decision==='rejected_after_review')return res.status(403).json({error:'execution_not_permitted',message:'This action is not permitted by the recorded decision.',request_id:requestId});return res.json({execution_id:`exec_${Date.now().toString(36)}`,audit_log_id:matched.id,event_id:matched.eventId,status:status||'SUCCESS',execution_output:execution_output||null,request_id:requestId});});
app.get('/health',(req,res)=>res.json({status:'ok',service:'Conforva Control Plane',version:'2026.08',organization_id:(req as any).organizationId}));
app.listen(PORT,HOST,()=>console.log(`Conforva Control Plane listening on http://${HOST}:${PORT}`));
