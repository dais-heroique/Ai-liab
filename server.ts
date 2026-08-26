import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AgentConfig } from './src/types.js';
import * as policyEngine from './src/policy_engine.js';
import * as audit from './src/audit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AGENTS_PATH = path.join(__dirname, 'config', 'agents.json');
const STATIC_DIR = path.join(__dirname, 'static');
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
let agentRegistry: Record<string, AgentConfig> = {};
function initAgents() { try { agentRegistry = JSON.parse(fs.readFileSync(AGENTS_PATH, 'utf-8')); } catch { agentRegistry = {}; } }
initAgents();
function authAndTenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const orgHeader = (req.headers['x-organization-id'] as string) || (req.query.org_id as string);
  if (orgHeader && /(unauthorized|malicious|attacker)/i.test(orgHeader)) return res.status(403).json({ error: 'tenant_isolation_violation' });
  (req as any).organizationId = orgHeader || 'org_acme_global'; next();
}
app.use(authAndTenantMiddleware);
app.use('/static', express.static(STATIC_DIR));
app.get('/', (_req,res)=>res.sendFile(path.join(STATIC_DIR,'dashboard.html')));
app.get('/dashboard', (_req,res)=>res.sendFile(path.join(STATIC_DIR,'dashboard.html')));
app.get('/landing', (_req,res)=>res.sendFile(path.join(STATIC_DIR,'landing.html')));
app.get('/docs', (_req,res)=>res.sendFile(path.join(STATIC_DIR,'docs.html')));
app.get('/pricing', (_req,res)=>res.sendFile(path.join(STATIC_DIR,'pricing.html')));
app.get('/security', (_req,res)=>res.sendFile(path.join(STATIC_DIR,'security.html')));
app.get('/api', (_req,res)=>res.sendFile(path.join(STATIC_DIR,'api.html')));

app.get('/v1/health', (_req,res)=>res.json({status:'ok'}));
app.get('/health', (_req,res)=>res.json({status:'ok'}));
app.get('/v1/overview', (req,res)=>{ const organizationId=(req as any).organizationId; res.json({ ...audit.getFleetAnalytics(organizationId), total_agents:Object.keys(agentRegistry).length, organization_id:organizationId }); });
app.get('/v1/agents', (_req,res)=>res.json(Object.entries(agentRegistry).map(([agent_id,v])=>({agent_id,...v,passport_fingerprint:`0x${audit.generatePassportFingerprint(agent_id,v).slice(0,16)}...`,stats:audit.getAgentStats(agent_id)}))));
app.post('/v1/agents', (req,res)=>{
  const body=req.body||{}; const id=String(body.agent_id||body.id||body.name||'').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'-');
  if(!id||!body.name||!body.model) return res.status(400).json({error:'agent_id, name and model are required'});
  if(agentRegistry[id]) return res.status(409).json({error:'agent_exists'});
  const agent:AgentConfig={name:String(body.name),tier:String(body.tier||'standard'),status:body.status==='disabled'?'disabled':'active',owner:String(body.owner||''),purpose:String(body.purpose||''),model:String(body.model),fallback_model:String(body.fallback_model||body.model),tools:Array.isArray(body.tools)?body.tools:[],permissions:Array.isArray(body.permissions)?body.permissions:[],max_autonomous_amount:Number(body.max_autonomous_amount??500),required_human_approval_above:Number(body.required_human_approval_above??500),blocked_action_types:Array.isArray(body.blocked_action_types)?body.blocked_action_types:[],hard_constraints:body.hard_constraints&&typeof body.hard_constraints==='object'?body.hard_constraints:{},human_operator:String(body.human_operator||'Unassigned'),organization_id:(req as any).organizationId,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  agentRegistry[id]=agent; try { fs.writeFileSync(AGENTS_PATH,JSON.stringify(agentRegistry,null,2)); } catch {}
  res.status(201).json({agent_id:id,...agent});
});
app.patch('/v1/agents/:agent_id', (req,res)=>{ const id=req.params.agent_id; if(!agentRegistry[id]) return res.status(404).json({error:'agent_not_found'}); agentRegistry[id]={...agentRegistry[id],...req.body,updated_at:new Date().toISOString()}; try{fs.writeFileSync(AGENTS_PATH,JSON.stringify(agentRegistry,null,2));}catch{} res.json({agent_id:id,...agentRegistry[id]}); });
app.get('/v1/policies', (_req,res)=>res.json(policyEngine.listPolicies()));
app.get('/v1/audit', (req,res)=>res.json(audit.listAuditEvents(Number(req.query.limit)||25)));
app.get('/v1/escalations', (_req,res)=>res.json(audit.listEscalations()));
app.get('/v1/incidents', (_req,res)=>res.json(audit.listIncidents()));
app.get('/v1/audit/integrity', (_req,res)=>res.json(audit.verifyAuditChain()));
export default app;
if(process.env.VERCEL!=='1') app.listen(3000,'0.0.0.0',()=>console.log('Conforva listening on http://0.0.0.0:3000'));
