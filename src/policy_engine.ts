import { AgentConfig, RiskResult, PolicyRule } from './types.js';

export function checkHardConstraints(hardConstraints: Record<string, number> = {}, parameters?: Record<string, any> | null): string[] {
  const violations: string[] = [];
  const params = parameters || {};
  for (const [key, maxVal] of Object.entries(hardConstraints || {})) {
    if (key in params) {
      const parsedVal = Number(params[key]); const parsedMax = Number(maxVal);
      if (!isNaN(parsedVal) && !isNaN(parsedMax) && parsedVal > parsedMax) violations.push(`${key}=${params[key]} exceeds safety limit (${maxVal})`);
    }
  }
  return violations;
}

function evaluateCondition(condition: PolicyRule['conditions'][0], context: { amount: number | null | undefined; action_type: string; risk_score: number; parameters: Record<string, any> }): boolean {
  let targetVal: any;
  if (condition.field === 'amount' || condition.field === 'refund_amount' || condition.field === 'wire_amount') targetVal = context.amount ?? (context.parameters[condition.field] != null ? Number(context.parameters[condition.field]) : undefined);
  else if (condition.field === 'action_type') targetVal = context.action_type;
  else if (condition.field === 'risk_score') targetVal = context.risk_score;
  else if (condition.field in context.parameters) targetVal = context.parameters[condition.field];
  if (targetVal === undefined || targetVal === null) return false;
  const expectedNum = Number(condition.value), targetNum = Number(targetVal), isNumeric = !isNaN(expectedNum) && !isNaN(targetNum);
  switch (condition.operator) {
    case '<=': return isNumeric && targetNum <= expectedNum;
    case '>=': return isNumeric && targetNum >= expectedNum;
    case '<': return isNumeric && targetNum < expectedNum;
    case '>': return isNumeric && targetNum > expectedNum;
    case '==': return isNumeric ? targetNum === expectedNum : String(targetVal).toLowerCase() === String(condition.value).toLowerCase();
    case '!=': return isNumeric ? targetNum !== expectedNum : String(targetVal).toLowerCase() !== String(condition.value).toLowerCase();
    case 'in': return String(condition.value).split(',').map(s => s.trim().toLowerCase()).includes(String(targetVal).toLowerCase());
    case 'contains': return String(targetVal).toLowerCase().includes(String(condition.value).toLowerCase());
    default: return false;
  }
}

/** Fail-closed autonomous control: actions are either approved or blocked. There is no human approval queue. */
export function evaluate(agentCfg: AgentConfig, actionType: string, amount: number | null | undefined, riskResult: RiskResult, parameters?: Record<string, any> | null, activePolicies: PolicyRule[] = [], agentId?: string): [decision: 'blocked' | 'pending_approval' | 'approved', reason: string, policyTriggered: string] {
  if (agentCfg.status && agentCfg.status !== 'active') return ['blocked', `Agent status is '${agentCfg.status.toUpperCase()}'. All actions are quarantined and blocked.`, 'Agent Lifecycle Security Gate'];
  const violations = checkHardConstraints(agentCfg.hard_constraints, parameters);
  if (violations.length) return ['blocked', `Hardware safety limit exceeded: ${violations.join('; ')}`, 'Physical Hard Limits'];
  if (agentCfg.blocked_action_types?.includes(actionType)) return ['blocked', `Action type '${actionType}' is forbidden for this agent.`, 'Agent Tier Boundary Policy'];

  const context = { amount, action_type: actionType, risk_score: riskResult.risk_score, parameters: parameters || {} };
  const matchingPolicies = activePolicies.filter(p => p.status === 'active' && (p.targetAgents.includes('*') || (!!agentId && p.targetAgents.includes(agentId))));

  for (const pol of matchingPolicies) for (const cond of pol.conditions) {
    if ((cond.action === 'BLOCK' || cond.action === 'HUMAN_REVIEW') && evaluateCondition(cond, context)) {
      return ['blocked', cond.action === 'HUMAN_REVIEW' ? `Action exceeds the policy boundary: ${cond.field} ${cond.operator} ${cond.value}. Human approval is not available.` : `Violated rule: ${cond.field} ${cond.operator} ${cond.value} under policy '${pol.name}'`, pol.name];
    }
  }

  const maxAutonomous = agentCfg.max_autonomous_amount;
  if (amount != null && maxAutonomous != null && amount > maxAutonomous) return ['blocked', `Amount €${amount.toLocaleString()} exceeds the agent autonomous limit of €${maxAutonomous.toLocaleString()}.`, 'Financial Threshold Safeguard'];

  const threshold = agentCfg.required_human_approval_above;
  if (threshold != null && riskResult.risk_score > threshold) return ['blocked', `Composite risk score ${riskResult.risk_score} exceeds the configured risk boundary of ${threshold}.`, 'Risk Boundary Policy'];

  for (const pol of matchingPolicies) for (const cond of pol.conditions) if (cond.action === 'ALLOW' && evaluateCondition(cond, context)) return ['approved', `Explicitly authorized by policy condition under '${pol.name}'.`, pol.name];
  return ['approved', 'Action verified within agent operational parameters.', 'Autonomous Policy Matrix'];
}

export function testPolicyRule(policy: PolicyRule, testPayload: { action_type: string; amount?: number | null; parameters?: Record<string, any> | null; risk_score?: number }): { matched: boolean; matched_condition?: PolicyRule['conditions'][0]; simulated_decision: 'ALLOW' | 'BLOCK' | 'HUMAN_REVIEW' | 'NO_MATCH'; reason: string } {
  const context = { amount: testPayload.amount ?? (testPayload.parameters?.amount ? Number(testPayload.parameters.amount) : undefined), action_type: testPayload.action_type, risk_score: testPayload.risk_score ?? 15, parameters: testPayload.parameters || {} };
  for (const cond of policy.conditions) if (evaluateCondition(cond, context)) return { matched: true, matched_condition: cond, simulated_decision: cond.action, reason: `Matched condition: ${cond.field} ${cond.operator} ${cond.value} => ${cond.action}` };
  return { matched: false, simulated_decision: 'NO_MATCH', reason: 'None of the candidate policy conditions matched the test payload.' };
}
