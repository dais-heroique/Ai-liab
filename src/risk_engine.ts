import { RiskResult } from './types.js';

export const CATEGORIES = ['finance', 'legal', 'privacy', 'cyber', 'autonomy', 'physical'] as const;

export type Category = typeof CATEGORIES[number];

export const ACTION_CATALOG: Record<string, {
  finance: number;
  legal: number;
  privacy: number;
  cyber: number;
  autonomy: number;
  physical: number;
  needs_model: boolean;
  financial?: boolean;
}> = {
  chat_response:   { finance: 0,  legal: 2,  privacy: 5,  cyber: 2,  autonomy: 5,  physical: 0,  needs_model: true },
  draft_email:     { finance: 0,  legal: 8,  privacy: 8,  cyber: 5,  autonomy: 10, physical: 0,  needs_model: true },
  read_crm:        { finance: 0,  legal: 5,  privacy: 15, cyber: 10, autonomy: 8,  physical: 0,  needs_model: false },
  create_ticket:   { finance: 0,  legal: 5,  privacy: 10, cyber: 5,  autonomy: 10, physical: 0,  needs_model: false },
  modify_crm:      { finance: 5,  legal: 10, privacy: 15, cyber: 15, autonomy: 15, physical: 0,  needs_model: false },
  refund:          { finance: 10, legal: 15, privacy: 5,  cyber: 10, autonomy: 20, physical: 0,  needs_model: false, financial: true },
  wire_transfer:   { finance: 20, legal: 25, privacy: 10, cyber: 20, autonomy: 25, physical: 0,  needs_model: false, financial: true },
  delete_data:     { finance: 5,  legal: 30, privacy: 35, cyber: 25, autonomy: 20, physical: 0,  needs_model: false },
  machine_control: { finance: 10, legal: 20, privacy: 0,  cyber: 15, autonomy: 30, physical: 50, needs_model: false },
  vehicle_control: { finance: 10, legal: 30, privacy: 0,  cyber: 20, autonomy: 35, physical: 70, needs_model: false },
};

export const AMOUNT_TIERS: [number, number][] = [
  [100, 5],
  [1000, 15],
  [10000, 30],
  [100000, 50],
  [Infinity, 75],
];

export class UnknownActionType extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnknownActionType';
  }
}

function amountRisk(amount: number): number {
  const sanitized = Math.max(0, Math.min(1e12, isNaN(amount) ? 0 : amount));
  for (const [threshold, score] of AMOUNT_TIERS) {
    if (sanitized <= threshold) {
      return score;
    }
  }
  return AMOUNT_TIERS[AMOUNT_TIERS.length - 1][1];
}

export function computeRisk(
  actionType: string,
  amount?: number | null,
  weights?: Record<string, number> | null
): RiskResult {
  const sanitizedType = (actionType || '').trim().toLowerCase();
  let base = ACTION_CATALOG[sanitizedType];
  const factors: string[] = [];

  // Sanitize numeric amount
  let validAmount: number | null = null;
  if (amount !== undefined && amount !== null) {
    const parsed = Number(amount);
    if (!isNaN(parsed) && isFinite(parsed)) {
      validAmount = Math.abs(parsed); // Take magnitude to prevent negative-value bypasses
    }
  }

  // Fallback for custom or novel action types
  if (!base) {
    const isFin = sanitizedType.includes('pay') || sanitizedType.includes('refund') || sanitizedType.includes('wire') || sanitizedType.includes('invoice') || sanitizedType.includes('transfer');
    const isData = sanitizedType.includes('delete') || sanitizedType.includes('drop') || sanitizedType.includes('purge') || sanitizedType.includes('truncate');
    const isPhys = sanitizedType.includes('motor') || sanitizedType.includes('robot') || sanitizedType.includes('kinetic') || sanitizedType.includes('machine') || sanitizedType.includes('valve') || sanitizedType.includes('arm');
    
    base = {
      finance: isFin ? 20 : 5,
      legal: isData ? 25 : 10,
      privacy: isData ? 30 : 10,
      cyber: isData ? 25 : 10,
      autonomy: 20,
      physical: isPhys ? 50 : 0,
      needs_model: false,
      financial: isFin || Boolean(validAmount && validAmount > 0)
    };
    factors.push(`Action type '${actionType}' evaluated via deterministic boundary heuristics`);
  } else {
    factors.push(`Baseline classification for '${actionType}'`);
  }

  const breakdown: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    breakdown[cat] = Number(base[cat] ?? 0);
  }

  if ((base.financial || (validAmount != null && validAmount > 0)) && validAmount != null && validAmount > 0) {
    const amtDelta = amountRisk(validAmount);
    breakdown['finance'] += amtDelta;
    factors.push(`Transaction volume (€${validAmount.toLocaleString()}) added +${amtDelta} financial exposure vector`);
  }

  if (breakdown['physical'] > 0) {
    factors.push(`Kinetic / Physical impact vector (${breakdown['physical']} base)`);
  }
  if (breakdown['privacy'] >= 20 || breakdown['cyber'] >= 20) {
    factors.push(`Data mutation or perimeter exposure detected`);
  }

  const defaultWeights = {
    finance: 1.0,
    legal: 1.0,
    privacy: 1.0,
    cyber: 1.0,
    autonomy: 1.0,
    physical: 1.0,
  };

  const w = weights ? { ...defaultWeights, ...weights } : defaultWeights;

  let totalWeight = 0;
  let weightedSum = 0;
  for (const cat of CATEGORIES) {
    const catWeight = Math.max(0, Math.min(10, isNaN(Number(w[cat])) ? 1.0 : Number(w[cat])));
    totalWeight += catWeight;
    weightedSum += breakdown[cat] * catWeight;
  }
  totalWeight = totalWeight > 0 ? totalWeight : 1.0;
  const weighted = weightedSum / totalWeight;

  const roundedBreakdown: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    roundedBreakdown[cat] = Math.round(breakdown[cat] * 10) / 10;
  }

  const finalScore = Math.round(Math.min(100.0, Math.max(0.0, weighted)) * 10) / 10;

  return {
    breakdown: roundedBreakdown,
    risk_score: finalScore,
    needs_model: Boolean(base.needs_model),
    factors
  };
}

