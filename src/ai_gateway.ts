import { generateText } from 'ai';

export const AI_MODELS = {
  minimaxM3Free: 'minimax/minimax-m3-free',
  minimaxM27Free: 'minimax/minimax-m2.7-free',
  minimaxM3: 'minimax/minimax-m3',
  minimaxM27: 'minimax/minimax-m2.7',
} as const;

export type AIModel = typeof AI_MODELS[keyof typeof AI_MODELS];

export async function analyzeWithAI(prompt: string, model: AIModel = AI_MODELS.minimaxM3Free) {
  const result = await generateText({ model, prompt });
  return { model, text: result.text };
}
