import { AgentConfig, RiskResult, PolicyRule } from './types.js';

export function checkHardConstraints(
  hardConstraints: Record<string, number> = {},
  parameters?: Record<string, any> | null
): string[] {
  const violations: string[] = [];
  const params = parameters || {};
  for (const [key, maxVal] of Object.entries(hardConstraints || {})) {
    if (key in params) {
      const val = params[key];
      const parsedVal = Number(val);
      const parsedMax = Number(maxVal);
      if (!isNaN(parsedVal) && !isNaN(parsedMax)) {
        if (parsedVal > parsedMax) {
          violations.push(`${key}=${val} exceeds safety limit (${maxVal})`);
        }
      }
    }
  }
  return violations;
}

function evaluateCondition(
  condition: PolicyRule['conditions'][0],
  context: {
    amount: number | null | undefined;
    action_type: string;
    risk_score: number;
    parameters: Record<string, any>;
  }
): boolean {
  let targetVal: any = undefined;

  if (condition.field === 'amount' || condition.field === 'refund_amount' || condition.field === 'wire_amount') {
    targetVal = context.amount ?? (context.parameters[condition.field] != null ? Number(context.parameters[condition.field]) : undefined);
  } else if (condition.field === 'action_type') {
    targetVal = context.action_type;
  } else if (condition.field === 'risk_score') {
    targetVal = context.risk_score;
  } else if (condition.field in context.parameters) {
    targetVal = context.parameters[condition.field];
  }

  if (targetVal === undefined || targetVal === null) {
    return false;
  }

  const expectedNum = Number(condition.value);
  const targetNum = Number(targetVal);
  const isNumeric = !isNaN(expectedNum) && !isNaN(targetNum);

  switch (condition.operator) {
    case '<=':
      return isNumeric ? targetNum <= expectedNum : false;
    case '>=':
      return isNumeric ? targetNum >= expectedNum : false;
    case '<':
      return isNumeric ? targetNum < expectedNum : false;
    case '>':
      return isNumeric ? targetNum > expectedNum : false;
    case '==':
      return isNumeric ? targetNum === expectedNum : String(targetVal).toLowerCase() === String(condition.value).toLowerCase();
    case '!=':
      return isNumeric ? targetNum !== expectedNum : String(targetVal).toLowerCase() !== String(condition.value).toLowerCase();
    case 'in':
      return String(condition.value).split(',').map((s) => s.trim().toLowerCase()).includes(String(targetVal).toLowerCase());
    case 'contains':
      return String(targetVal).toLowerCase().includes(String(condition.value).toLowerCase());
    default:
      return false;
  }
}

/**
 * POLICY PRECEDENCE HIERARCHY (Fail-Closed Architecture):
 * 
 * 1. AGENT_STATUS_CHECK: If agent is 'revoked', 'disabled', or 'quarantined' -> HARD BLOCK
 * 2. HARDWARE_SAFETY_LIMITS: Physical / kinematic safety bounds (e.g. max RPM, max pressure) -> HARD BLOCK
 * 3. AGENT_TIER_BOUNDARIES: Blocked action types in agent specification -> HARD BLOCK
 * 4. DYNAMIC_BLOCK_POLICIES: Active policy rules with action='BLOCK' -> BLOCK
 * 5. AUTONOMOUS_FINANCIAL_CEILING: Amount exceeding agent max_autonomous_amount -> HUMAN_REVIEW
 * 6. DYNAMIC_HUMAN_REVIEW_POLICIES: Active policy rules with action='HUMAN_REVIEW' -> HUMAN_REVIEW
 * 7. RISK_SCORE_OVERSIGHT_THRESHOLD: Risk score exceeding required_human_approval_above -> HUMAN_REVIEW
 * 8. DYNAMIC_ALLOW_POLICIES: Matching explicit ALLOW policy rules -> ALLOW
 * 9. DEFAULT_CONTRACT: Approved within agent baseline bounds -> ALLOW
 * 
 * CRITICAL INVARIANT: An explicit ALLOW policy CAN NEVER override Level 1 (Hardware Limits),
 * Level 2 (Tier Blocks), or Level 3 (Explicit Deny Blocks).
 */

export function evaluate(
  agentCfg: AgentConfig,
  actionType: string,
  amount: number | null | undefined,
  riskResult: RiskResult,
  parameters?: Record<string, any> | null,
  activePolicies: PolicyRule[] = [],
  agentId?: string
): [decision: 'blocked' | 'pending_approval' | 'approved', reason: string, policyTriggered: string] {
  // Precedence 1: Agent Status Check (Revoked / Quarantined / Disabled)
  if (agentCfg.status && agentCfg.status !== 'active') {
    return [
      'blocked',
      `Agent status is '${agentCfg.status.toUpperCase()}'. All actions are strictly quarantined and blocked.`,
      'Agent Lifecycle Security Gate'
    ];
  }

  // Precedence 2: Physical / Hardware Safety Limits
  const violations = checkHardConstraints(agentCfg.hard_constraints, parameters);
  if (violations.length > 0) {
    return [
      'blocked',
      `Hardware safety limit exceeded: ${violations.join('; ')}`,
      'Physical Hard Limits (POL-PHYS-03)'
    ];
  }

  // Precedence 3: Agent Tier Boundaries (Blocked Action Types)
  if (agentCfg.blocked_action_types && agentCfg.blocked_action_types.includes(actionType)) {
    return [
      'blocked',
      `Action type '${actionType}' is forbidden for this agent tier specification.`,
      'Agent Tier Boundary Policy'
    ];
  }

  const context = {
    amount,
    action_type: actionType,
    risk_score: riskResult.risk_score,
    parameters: parameters || {}
  };

  // Filter policies matching this agent
  const matchingPolicies = activePolicies.filter((p) => {
    if (p.status !== 'active') return false;
    if (p.targetAgents.includes('*')) return true;
    if (agentId && p.targetAgents.includes(agentId)) return true;
    return false;
  });

  // Precedence 4: Dynamic BLOCK Policy Rules (Fail-Closed Deny has priority over Allow)
  for (const pol of matchingPolicies) {
    for (const cond of pol.conditions) {
      if (cond.action === 'BLOCK' && evaluateCondition(cond, context)) {
        return [
          'blocked',
          `Violated rule: ${cond.field} ${cond.operator} ${cond.value} under policy '${pol.name}'`,
          pol.name
        ];
      }
    }
  }

  // Precedence 5: Autonomous Financial Ceiling
  const maxAutonomous = agentCfg.max_autonomous_amount;
  if (amount != null && maxAutonomous !== undefined && maxAutonomous !== null && amount > maxAutonomous) {
    return [
      'pending_approval',
      `Amount €${amount.toLocaleString()} exceeds agent autonomous limit of €${maxAutonomous.toLocaleString()}. Requires human sign-off.`,
      'Financial Threshold Safeguard (POL-FIN-01)'
    ];
  }

  // Precedence 6: Dynamic HUMAN_REVIEW Policy Rules
  for (const pol of matchingPolicies) {
    for (const cond of pol.conditions) {
      if (cond.action === 'HUMAN_REVIEW' && evaluateCondition(cond, context)) {
        return [
          'pending_approval',
          `Requires human approval: ${cond.field} ${cond.operator} ${cond.value} under policy '${pol.name}'`,
          pol.name
        ];
      }
    }
  }

  // Precedence 7: Risk Score Oversight Threshold
  const threshold = agentCfg.required_human_approval_above ?? 100;
  if (riskResult.risk_score > threshold) {
    return [
      'pending_approval',
      `Composite risk score ${riskResult.risk_score} exceeds agent oversight threshold of ${threshold}. Routed to designated operator (${agentCfg.human_operator || 'Operations'}).`,
      'Risk Engine Escalation Policy'
    ];
  }

  // Precedence 8: Dynamic Explicit ALLOW Policy Rules
  for (const pol of matchingPolicies) {
    for (const cond of pol.conditions) {
      if (cond.action === 'ALLOW' && evaluateCondition(cond, context)) {
        return [
          'approved',
          `Explicitly authorized by policy condition: ${cond.field} ${cond.operator} ${cond.value} under policy '${pol.name}'`,
          pol.name
        ];
      }
    }
  }

  // Precedence 9: Autonomous Contract Baseline
  return ['approved', 'Action verified within agent operational parameters.', 'Autonomous Policy Matrix'];
}

/**
 * Interactive Policy Tester (Workbench):
 * Evaluates an uncommitted or candidate policy against hypothetical action parameters
 * using the real deterministic policy evaluation logic.
 */
export function testPolicyRule(
  policy: PolicyRule,
  testPayload: {
    action_type: string;
    amount?: number | null;
    parameters?: Record<string, any> | null;
    risk_score?: number;
  }
): {
  matched: boolean;
  matched_condition?: PolicyRule['conditions'][0];
  simulated_decision: 'ALLOW' | 'BLOCK' | 'HUMAN_REVIEW' | 'NO_MATCH';
  reason: string;
} {
  const context = {
    amount: testPayload.amount ?? (testPayload.parameters?.amount ? Number(testPayload.parameters.amount) : undefined),
    action_type: testPayload.action_type,
    risk_score: testPayload.risk_score ?? 15,
    parameters: testPayload.parameters || {}
  };

  // Evaluate conditions in order
  for (const cond of policy.conditions) {
    if (evaluateCondition(cond, context)) {
      return {
        matched: true,
        matched_condition: cond,
        simulated_decision: cond.action,
        reason: `Matched condition: ${cond.field} ${cond.operator} ${cond.value} => ${cond.action}`
      };
    }
  }

  return {
    matched: false,
    simulated_decision: 'NO_MATCH',
    reason: 'None of the candidate policy conditions matched the test payload.'
  };
}

