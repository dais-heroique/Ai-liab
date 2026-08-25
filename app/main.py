import json
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import audit, model_router, policy_engine, risk_engine
from .schemas import ActionRequest, ResolutionRequest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AGENTS_PATH = os.path.join(BASE_DIR, "config", "agents.json")
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = FastAPI(title="AI Liability Gateway", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def load_agents():
    with open(AGENTS_PATH, encoding="utf-8") as f:
        return json.load(f)


@app.on_event("startup")
def on_startup():
    audit.init_db()


@app.get("/")
def root():
    return FileResponse(os.path.join(STATIC_DIR, "dashboard.html"))


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/v1/agents")
def list_agents():
    agents = load_agents()
    return [{"agent_id": k, "name": v["name"], "tier": v["tier"]} for k, v in agents.items()]


@app.get("/v1/agents/{agent_id}/passport")
def get_passport(agent_id: str):
    agents = load_agents()
    cfg = agents.get(agent_id)
    if not cfg:
        raise HTTPException(404, "Agent inconnu.")
    return {"agent_id": agent_id, **cfg, "stats": audit.get_agent_stats(agent_id)}


@app.post("/v1/agents/{agent_id}/action")
def submit_action(agent_id: str, action: ActionRequest):
    agents = load_agents()
    cfg = agents.get(agent_id)
    if not cfg:
        raise HTTPException(404, "Agent inconnu.")

    try:
        risk_result = risk_engine.compute_risk(action.action_type, action.amount, cfg.get("risk_weights"))
    except risk_engine.UnknownActionType as exc:
        raise HTTPException(400, str(exc))

    decision, reason = policy_engine.evaluate(cfg, action.action_type, action.amount, risk_result, action.parameters)

    model_used = None
    response_text = None

    if decision == "approved" and risk_result.get("needs_model"):
        task_type = model_router.classify_task(action.action_type)
        model_used = model_router.select_model(cfg, task_type)
        response_text = model_router.call_model(model_used, action.description)

    log_id = audit.log_decision(agent_id, action, risk_result, decision, reason, model_used, response_text)

    escalation_id = None
    if decision == "pending_approval":
        escalation_id = audit.create_escalation(log_id, agent_id)

    return {
        "decision": decision,
        "reason": reason,
        "risk_score": risk_result["risk_score"],
        "risk_breakdown": risk_result["breakdown"],
        "model_used": model_used,
        "response": response_text,
        "escalation_id": escalation_id,
        "audit_log_id": log_id,
    }


@app.get("/v1/escalations")
def list_escalations(status: str = "pending"):
    return audit.get_escalations(status)


@app.post("/v1/escalations/{escalation_id}/resolve")
def resolve_escalation(escalation_id: int, resolution: ResolutionRequest):
    result = audit.resolve_escalation(escalation_id, resolution.approve, resolution.operator, resolution.note)
    if result is None:
        raise HTTPException(404, "Escalade introuvable.")
    return result


@app.get("/v1/audit")
def get_audit(limit: int = 50, agent_id: str = None):
    return audit.get_audit_log(limit, agent_id)
