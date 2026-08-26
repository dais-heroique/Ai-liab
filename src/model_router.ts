import { AgentConfig } from './types.js';
import { buildVerificationPlan, resolveProvider } from './ai_provider_router.js';

const ANTHROPIC_MODEL = 'claude-sonnet-5';

export function classifyTask(actionType: string): string {
  if (actionType === 'chat_response' || actionType === 'draft_email') return 'generation';
  return 'none';
}

export function selectModel(agentCfg: AgentConfig, taskType: string): string | null {
  if (taskType === 'none') return null;
  return agentCfg.model || 'mock-model';
}

export function planVerification(agentCfg: AgentConfig, riskScore: number) {
  return buildVerificationPlan(agentCfg, riskScore);
}

export function providerFor(agentCfg: AgentConfig, requestedModel?: string) {
  return resolveProvider(agentCfg, requestedModel);
}

export async function callModel(modelName: string | null, prompt?: string | null): Promise<string | null> {
  if (!modelName) return null;
  if (modelName.startsWith('claude')) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 300, messages: [{ role: 'user', content: prompt || '(no prompt)' }] })
        });
        if (res.ok) {
          const data = await res.json() as any;
          return data.content?.[0]?.text || null;
        }
      } catch (exc: any) {
        return `[MODEL_ROUTER_ERROR: ${exc.message || exc}]`;
      }
    }
  }
  return `[MOCK-${modelName}] Simulated response for: ${(prompt || '').slice(0, 120)}`;
}
