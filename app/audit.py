"""
Audit layer
-----------
Every decision the gateway makes is written here before the caller gets a
response. This table is the "proof" the whole pitch is built on: if a
company's insurer or auditor asks "why was this action allowed", the answer
is one row away.
"""

import datetime
import json
import os
import sqlite3
from typing import Any, Dict, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "gateway.db")


def _conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = _conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT, agent_id TEXT, action_type TEXT, amount REAL,
            description TEXT, risk_score REAL, risk_breakdown TEXT,
            decision TEXT, reason TEXT, model_used TEXT, response_snippet TEXT
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS escalations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            audit_log_id INTEGER, agent_id TEXT, status TEXT,
            created_at TEXT, resolved_at TEXT, operator TEXT, note TEXT
        )"""
    )
    conn.commit()
    conn.close()


def log_decision(agent_id: str, action, risk_result: Dict[str, Any], decision: str, reason: str,
                  model_used: Optional[str], response_text: Optional[str]) -> int:
    conn = _conn()
    cur = conn.execute(
        """INSERT INTO audit_log
           (timestamp, agent_id, action_type, amount, description, risk_score, risk_breakdown,
            decision, reason, model_used, response_snippet)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (
            datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z",
            agent_id, action.action_type, action.amount, action.description,
            risk_result["risk_score"], json.dumps(risk_result["breakdown"]),
            decision, reason, model_used, (response_text or "")[:300],
        ),
    )
    conn.commit()
    log_id = cur.lastrowid
    conn.close()
    return log_id


def create_escalation(audit_log_id: int, agent_id: str) -> int:
    conn = _conn()
    cur = conn.execute(
        "INSERT INTO escalations (audit_log_id, agent_id, status, created_at) VALUES (?,?,?,?)",
        (audit_log_id, agent_id, "pending", datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z"),
    )
    conn.commit()
    esc_id = cur.lastrowid
    conn.close()
    return esc_id


def get_escalations(status: str = "pending"):
    conn = _conn()
    rows = conn.execute(
        """SELECT e.*, a.action_type, a.description, a.amount, a.risk_score, a.reason
           FROM escalations e JOIN audit_log a ON e.audit_log_id = a.id
           WHERE e.status = ? ORDER BY e.created_at DESC""",
        (status,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def resolve_escalation(escalation_id: int, approve: bool, operator: str, note: str):
    conn = _conn()
    row = conn.execute("SELECT * FROM escalations WHERE id=?", (escalation_id,)).fetchone()
    if not row:
        conn.close()
        return None
    new_status = "approved" if approve else "rejected"
    now = datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z"
    conn.execute(
        "UPDATE escalations SET status=?, resolved_at=?, operator=?, note=? WHERE id=?",
        (new_status, now, operator, note, escalation_id),
    )
    conn.execute(
        "UPDATE audit_log SET decision=?, reason=? WHERE id=?",
        (f"{new_status}_after_review", f"Revu par {operator} : {note}", row["audit_log_id"]),
    )
    conn.commit()
    conn.close()
    return {"escalation_id": escalation_id, "status": new_status}


def get_audit_log(limit: int = 50, agent_id: Optional[str] = None):
    conn = _conn()
    if agent_id:
        rows = conn.execute(
            "SELECT * FROM audit_log WHERE agent_id=? ORDER BY id DESC LIMIT ?", (agent_id, limit)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_agent_stats(agent_id: str):
    conn = _conn()
    total = conn.execute("SELECT COUNT(*) c FROM audit_log WHERE agent_id=?", (agent_id,)).fetchone()["c"]
    blocked = conn.execute(
        "SELECT COUNT(*) c FROM audit_log WHERE agent_id=? AND decision='blocked'", (agent_id,)
    ).fetchone()["c"]
    pending = conn.execute(
        "SELECT COUNT(*) c FROM escalations WHERE agent_id=? AND status='pending'", (agent_id,)
    ).fetchone()["c"]
    avg_risk = conn.execute("SELECT AVG(risk_score) a FROM audit_log WHERE agent_id=?", (agent_id,)).fetchone()["a"]
    conn.close()
    return {
        "total_actions": total,
        "blocked": blocked,
        "pending_approval": pending,
        "avg_risk_score": round(avg_risk, 1) if avg_risk else 0,
    }
