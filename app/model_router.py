"""
Model Router
------------
Decides which underlying model handles a task, and calls it. Only Claude is
wired to a real API here (set ANTHROPIC_API_KEY) — every other provider is a
clearly-labelled mock so the routing/fallback logic is demonstrable without
needing every vendor's key. Swapping in a real OpenAI/Gemini/local client
later is a matter of filling in one function per provider; the rest of the
gateway (risk, policy, audit) never needs to know which model actually ran.
"""

import os
from typing import Any, Dict

_ANTHROPIC_MODEL = "claude-sonnet-5"


def classify_task(action_type: str) -> str:
    """What kind of work does this action require from a model, if any."""
    if action_type in ("chat_response", "draft_email"):
        return "generation"
    return "none"


def select_model(agent_cfg: Dict[str, Any], task_type: str) -> str:
    if task_type == "none":
        return None
    return agent_cfg.get("model", "mock-model")


def call_model(model_name: str, prompt: str) -> str:
    if model_name is None:
        return None

    if model_name.startswith("claude"):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if api_key:
            try:
                import anthropic

                client = anthropic.Anthropic(api_key=api_key)
                resp = client.messages.create(
                    model=_ANTHROPIC_MODEL,
                    max_tokens=300,
                    messages=[{"role": "user", "content": prompt or "(pas de prompt fourni)"}],
                )
                return resp.content[0].text
            except Exception as exc:  # network/quota/etc — degrade to fallback, never crash the gateway
                return f"[ERREUR MODEL_ROUTER: {exc}] — repli sur réponse simulée."

    # Mock path — no key configured, or a provider not yet wired up.
    return f"[MOCK-{model_name}] Réponse simulée pour : {(prompt or '')[:120]}"
