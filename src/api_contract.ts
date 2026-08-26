export const CONFORVA_API_VERSION = 'v1';

export const PUBLIC_API = {
  evaluate: 'POST /v1/actions/evaluate',
  execute: 'POST /v1/actions/execute',
  agents: 'GET /v1/agents',
  passport: 'GET /v1/agents/:agent_id/passport',
  verifyPassport: 'POST /v1/agents/:agent_id/passport/verify',
  auditIntegrity: 'GET /v1/audit/integrity',
  health: 'GET /health'
} as const;

export const EVALUATION_STEPS = ['policy', 'risk', 'verification', 'decision', 'audit'] as const;
export const DECISIONS = ['ALLOW', 'MODIFY', 'BLOCK'] as const;

export function normalizeDecision(raw: string): 'ALLOW' | 'BLOCK' | 'HUMAN_REVIEW' {
  if (raw === 'approved') return 'ALLOW';
  if (raw === 'blocked') return 'BLOCK';
  return 'HUMAN_REVIEW';
}
