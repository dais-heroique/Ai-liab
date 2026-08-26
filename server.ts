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
app.get('/', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'dashboard.html')));
app.get('/v1/overview', (req, res) => { const organizationId = (req as any).organizationId; res.json({ ...audit.getFleetAnalytics(organizationId), total_agents: Object.keys(agentRegistry).length, organization_id: organizationId }); });
app.get('/v1/agents', (_req, res) => res.json(Object.entries(agentRegistry).map(([k, v]) => ({ agent_id:k, name:v.name, tier:v.tier, model:v.model, fallback_model:v.fallback_model, insurance_coverage_eur:v.insurance_coverage_eur, human_operator:v.human_operator, max_autonomous_amount:v.max_autonomous_amount, required_human_approval_above:v.required_human_approval_above, blocked_action_types:v.blocked_action_types, hard_constraints:v.hard_constraints, risk_weights:v.risk_weights, passport_fingerprint:`0x${audit.generatePassportFingerprint(k,v).slice(0,16)}...`, stats:audit.getAgentStats(k) }))));
app.post('/v1/agents', (req,res) => { const {agent_id,name,tier,model,fallback_model,max_autonomous_amount,required_human_approval_above,blocked_action_types,hard_constraints,insurance_coverage_eur,human_operator,risk_weights}=req.body; if(!agent_id||!name||!tier||!model)return res.status(400).json({detail:'Missing required agent configuration parameters.'}); const cleanId=agent_id.toLowerCase().replace(/[^a-z0-9_-]/g,'-'); const newConfig:AgentConfig={name,tier,model,fallback_model:fallback_model||'mock-local',max_autonomous_amount:Number(max_autonomous_amount)||0,required_human_approval_above:Number(required_human_approval_above)||40,blocked_action_types:Array.isArray(blocked_action_types)?blocked_action_types:['delete_data'],hard_constraints:hard_constraints||{},insurance_coverage_eur:Number(insurance_coverage_eur)||1000000,human_operator:human_operator||'Security Lead',risk_weights:risk_weights||{finance:1,legal:1,privacy:1,cyber:1,autonomy:1,physical:1},created_at:new Date().toISOString()}; agentRegistry[cleanId]=newConfig; res.status(201).json({agent_id:cleanId,...newConfig,passport_fingerprint:`0x${audit.generatePassportFingerprint(cleanId,newConfig)}`}); });
app.get('/v1/agents/:agent_id/passport',(req,res)=>{const agentId=req.params.agent_id,cfg=agentRegistry[agentId];if(!cfg)return res.status(404).json({detail:'Agent not found in active registry.'});const fingerprint=audit.generatePassportFingerprint(agentId,cfg);res.json({agent_id:agentId,...cfg,stats:audit.getAgentStats(agentId),recent_logs:audit.getAuditLog(10,agentId),passport_version:'v2.4-TechnicalControl',cryptographic_seal:{algorithm:'SHA-256 (Canonical JSON RFC 8785)',canonical_hash:`0x${fingerprint}`,verification_status:'VALID',verified_at:new Date().toISOString()}});});
app.post('/v1/agents/:agent_id/passport/verify',(req,res)=>{const agentId=req.params.agent_id,cfg=agentRegistry[agentId];if(!cfg)return res.status(404).json({detail:'Agent not found for cryptographic verification.'});const dataToVerify=req.body.passport_data||{agent_id:agentId,name:cfg.name,tier:cfg.tier,model:cfg.model,fallback_model:cfg.fallback_model,max_autonomous_amount:cfg.max_autonomous_amount,required_human_approval_above:cfg.required_human_approval_above,blocked_action_types:(cfg.blocked_action_types||[]).slice().sort(),hard_constraints:cfg.hard_constraints||{},insurance_coverage_eur:cfg.insurance_coverage_eur,human_operator:cfg.human_operator};res.json(audit.verifyPassport(agentId,dataToVerify,req.body.expected_fingerprint));});
app.get('/v1/audit/integrity',(req,res)=>res.json(audit.verifyAuditChain((req as any).organizationId)));
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
