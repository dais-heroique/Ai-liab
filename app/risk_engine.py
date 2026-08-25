"""
Risk Engine
-----------
Scores a proposed agent action across six risk categories (finance, legal,
privacy, cyber, autonomy, physical impact), the same breakdown used in the
agent's "AI Passport". This is intentionally simple and fully transparent —
every score traces back to a rule in ACTION_CATALOG, not a black-box model.
Swap in a learned model later without changing the interface.
"""

from typing import Any, Dict, Optional

CATEGORIES = ["finance", "legal", "privacy", "cyber", "autonomy", "physical"]

# Base risk contribution (0-100 scale) per category, per action type.
ACTION_CATALOG: Dict[str, Dict[str, Any]] = {
    "chat_response":   {"finance": 0,  "legal": 2,  "privacy": 5,  "cyber": 2,  "autonomy": 5,  "physical": 0, "needs_model": True},
    "draft_email":     {"finance": 0,  "legal": 8,  "privacy": 8,  "cyber": 5,  "autonomy": 10, "physical": 0, "needs_model": True},
    "read_crm":        {"finance": 0,  "legal": 5,  "privacy": 15, "cyber": 10, "autonomy": 8,  "physical": 0, "needs_model": False},
    "create_ticket":   {"finance": 0,  "legal": 5,  "privacy": 10, "cyber": 5,  "autonomy": 10, "physical": 0, "needs_model": False},
    "modify_crm":      {"finance": 5,  "legal": 10, "privacy": 15, "cyber": 15, "autonomy": 15, "physical": 0, "needs_model": False},
    "refund":          {"finance": 10, "legal": 15, "privacy": 5,  "cyber": 10, "autonomy": 20, "physical": 0, "needs_model": False, "financial": True},
    "wire_transfer":   {"finance": 20, "legal": 25, "privacy": 10, "cyber": 20, "autonomy": 25, "physical": 0, "needs_model": False, "financial": True},
    "delete_data":     {"finance": 5,  "legal": 30, "privacy": 35, "cyber": 25, "autonomy": 20, "physical": 0, "needs_model": False},
    "machine_control": {"finance": 10, "legal": 20, "privacy": 0,  "cyber": 15, "autonomy": 30, "physical": 50, "needs_model": False},
    "vehicle_control": {"finance": 10, "legal": 30, "privacy": 0,  "cyber": 20, "autonomy": 35, "physical": 70, "needs_model": False},
}

# Extra "finance" points added on top of the base, scaled by amount (EUR).
AMOUNT_TIERS = [(100, 5), (1000, 15), (10000, 30), (100000, 50), (float("inf"), 75)]


class UnknownActionType(ValueError):
    pass


def _amount_risk(amount: float) -> float:
    for threshold, score in AMOUNT_TIERS:
        if amount <= threshold:
            return score
    return AMOUNT_TIERS[-1][1]


def compute_risk(
    action_type: str,
    amount: Optional[float],
    weights: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    base = ACTION_CATALOG.get(action_type)
    if base is None:
        raise UnknownActionType(f"Type d'action inconnu du Risk Engine : '{action_type}'")

    breakdown = {cat: float(base.get(cat, 0)) for cat in CATEGORIES}

    if base.get("financial") and amount:
        breakdown["finance"] += _amount_risk(amount)

    weights = weights or {cat: 1.0 for cat in CATEGORIES}
    total_weight = sum(weights.get(cat, 1.0) for cat in CATEGORIES) or 1.0
    weighted = sum(breakdown[cat] * weights.get(cat, 1.0) for cat in CATEGORIES) / total_weight

    return {
        "breakdown": {cat: round(v, 1) for cat, v in breakdown.items()},
        "risk_score": round(min(100.0, weighted), 1),
        "needs_model": bool(base.get("needs_model")),
    }
