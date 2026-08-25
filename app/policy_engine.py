"""
Policy Engine
-------------
Turns a risk score into a decision, given one agent's contract (its config
in config/agents.json). Two things are deterministic and NEVER overridden by
a risk score:
  1. blocked_action_types - a hard no for this agent, regardless of context.
  2. hard_constraints - physical/technical limits checked against the
     action's own parameters (e.g. rpm, temperature_c). This is the
     "Safety Engine" layer: the LLM can ask for anything, but a request
     that violates a wired-in limit is refused before it ever reaches
     the machine.

Everything else is risk-based: amount above the agent's autonomous ceiling,
or total risk score above its human-approval threshold, routes to a human
via an escalation instead of a hard block.
"""

from typing import Any, Dict, Optional, Tuple


def check_hard_constraints(hard_constraints: Dict[str, float], parameters: Optional[Dict[str, Any]]) -> list:
    violations = []
    parameters = parameters or {}
    for key, max_val in (hard_constraints or {}).items():
        if key in parameters:
            val = parameters[key]
            try:
                if float(val) > float(max_val):
                    violations.append(f"{key}={val} dépasse la limite câblée ({max_val})")
            except (TypeError, ValueError):
                continue
    return violations


def evaluate(
    agent_cfg: Dict[str, Any],
    action_type: str,
    amount: Optional[float],
    risk_result: Dict[str, Any],
    parameters: Optional[Dict[str, Any]],
) -> Tuple[str, str]:
    """Returns (decision, reason). decision is one of:
    'blocked' | 'pending_approval' | 'approved'
    """

    if action_type in agent_cfg.get("blocked_action_types", []):
        return "blocked", f"Type d'action '{action_type}' interdit pour cet agent (politique)."

    violations = check_hard_constraints(agent_cfg.get("hard_constraints", {}), parameters)
    if violations:
        return "blocked", "Contrainte physique/technique violée : " + "; ".join(violations)

    max_autonomous = agent_cfg.get("max_autonomous_amount")
    if amount is not None and max_autonomous is not None and amount > max_autonomous:
        return (
            "pending_approval",
            f"Montant {amount:g} € au-dessus du seuil autonome de cet agent ({max_autonomous:g} €).",
        )

    threshold = agent_cfg.get("required_human_approval_above", 100)
    if risk_result["risk_score"] > threshold:
        return (
            "pending_approval",
            f"Score de risque {risk_result['risk_score']} au-dessus du seuil de validation humaine ({threshold}).",
        )

    return "approved", "Action dans les limites du contrat de cet agent."
