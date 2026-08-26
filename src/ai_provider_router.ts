import { AgentConfig } from './types.js';

export type AIProvider = 'anthropic' | 'openai' | 'google' | 'local_deterministic';

export interface AIProviderConfig {
  provider: AIProvider;
  model: string;
  enabled: boolean;
  mode: 'live_api' | 'autonomous_local';
  reason?: string;
}

function providerFor(model: string): AIProvider {
  const m = model.toLowerCase();
  if (m.startsWith('claude') || m.includes('anthropic')) return 'anthropic';
  if (m.startsWith('gpt') || m.includes('openai')) return 'openai';
  if (m.startsWith('gemini') || m.includes('google')) return 'google';
  return 'local_deterministic';
}

export function resolveProvider(agent: AgentConfig, requestedModel?: string): AIProviderConfig {
  const model = requestedModel || agent.model || agent.fallback_model || 'autonomous-guard-v2';
  const provider = providerFor(model);
  const keys: Record<string, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    google: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    local_deterministic: 'local_active'
  };

  const hasKey = Boolean(keys[provider]);

  return {
    provider,
    model,
    enabled: true, // Always operational and ready to process actions
    mode: hasKey ? 'live_api' : 'autonomous_local',
    reason: hasKey ? undefined : 'Running in autonomous zero-trust deterministic engine mode (no external API key required)'
  };
}

export function buildVerificationPlan(agent: AgentConfig, riskScore: number) {
  if (riskScore >= 75) return { level: 'critical', verifiers: ['security', 'financial', 'privacy'], consensus: true };
  if (riskScore >= 50) return { level: 'high', verifiers: ['security', 'financial'], consensus: false };
  if (riskScore >= 30) return { level: 'medium', verifiers: ['policy'], consensus: false };
  return { level: 'low', verifiers: [], consensus: false };
}

