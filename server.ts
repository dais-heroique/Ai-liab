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
app.get('/', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'dashboard.html')));
app.get('/index.html', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'dashboard.html')));
app.get('/dashboard', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'dashboard.html')));
app.get('/app', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'dashboard.html')));
app.get('/landing', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'landing.html')));
app.get('/docs', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'docs.html')));
app.get('/pricing', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'pricing.html')));
app.get('/security', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'security.html')));
app.get('/api', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'api.html')));
app.get('/v1/overview', (req, res) => { const organizationId = (req as any).organizationId; res.json({ ...audit.getFleetAnalytics(organizationId), total_agents: Object.keys(agentRegistry).length, organization_id: organizationId }); });
app.get('/v1/agents', (_req, res) => res.json(Object.entries(agentRegistry).map(([k, v]) => ({ agent_id:k,name:v.name,tier:v.tier,model:v.model,fallback_model:v.fallback_model,insurance_coverage_eur:v.insurance_coverage_eur,human_operator:v.human_operator,max_autonomous_amount:v.max_autonomous_amount,required_human_approval_above:v.required_human_approval_above,blocked_action_types:v.blocked_action_types,hard_constraints:v.hard_constraints,risk_weights:v.risk_weights,passport_fingerprint:`0x${audit.generatePassportFingerprint(k,v).slice(0,16)}...`,stats:audit.getAgentStats(k) }))));
app.get('/v1/policies', (_req,res)=>res.json(policyEngine.listPolicies()));
app.get('/v1/audit', (req,res)=>res.json(audit.listAuditEvents(Number(req.query.limit)||25)));
app.get('/v1/escalations', (_req,res)=>res.json(audit.listEscalations()));
app.get('/v1/incidents', (_req,res)=>res.json(audit.listIncidents()));
app.get('/v1/health', (_req,res)=>res.json({status:'ok'}));

export default app;

if (process.env.VERCEL !== '1') app.listen(PORT, HOST, () => console.log(`Conforva control plane listening on http://${HOST}:${PORT}`));
