import { AgentConfig } from './types.js';

const ANTHROPIC_MODEL = 'claude-sonnet-5';

export function classifyTask(actionType: string): string {
  if (actionType === 'chat_response' || actionType === 'draft_email') {
    return 'generation';
  }
  return 'none';
}

export function selectModel(agentCfg: AgentConfig, taskType: string): string | null {
  if (taskType === 'none') {
    return null;
  }
  return agentCfg.model || 'mock-model';
}

export async function callModel(modelName: string | null, prompt?: string | null): Promise<string | null> {
  if (!modelName) {
    return null;
  }

  if (modelName.startsWith('claude')) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: ANTHROPIC_MODEL,
            max_tokens: 300,
            messages: [{ role: 'user', content: prompt || '(pas de prompt fourni)' }],
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data.content && data.content[0] && data.content[0].text) {
            return data.content[0].text;
          }
        }
      } catch (exc: any) {
        return `[ERREUR MODEL_ROUTER: ${exc.message || exc}] — repli sur réponse simulée.`;
      }
    }
  }

  // Mock path — no key configured, or a provider not yet wired up.
  return `[MOCK-${modelName}] Réponse simulée pour : ${(prompt || '').slice(0, 120)}`;
}
