const API = "";

async function jget(url) {
  const r = await fetch(API + url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function jpost(url, body) {
  const r = await fetch(API + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const CATS = ["finance", "legal", "privacy", "cyber", "autonomy", "physical"];
const CAT_LABELS = { finance: "Finance", legal: "Juridique", privacy: "Privacy", cyber: "Cyber", autonomy: "Autonomie", physical: "Physique" };

function stampClass(decision) {
  return "stamp stamp-" + decision;
}
function fmtTime(iso) {
  return (iso || "").replace("T", " ").replace("Z", "").slice(0, 19);
}

async function loadAgentsAndPassports() {
  const agents = await jget("/v1/agents");
  const select = document.getElementById("agentSelect");
  select.innerHTML = agents.map(a => `<option value="${a.agent_id}">${a.name} — ${a.tier}</option>`).join("");

  const passportList = document.getElementById("passportList");
  const passports = await Promise.all(agents.map(a => jget(`/v1/agents/${a.agent_id}/passport`)));
  passportList.innerHTML = passports.map(p => `
    <div class="passport-card">
      <div class="passport-head">
        <span class="passport-name">${p.name}</span>
        <span class="passport-tier">${p.tier}</span>
      </div>
      <div class="passport-grid-inner">
        <div><span class="passport-field-label">Modèle</span>${p.model}</div>
        <div><span class="passport-field-label">Repli</span>${p.fallback_model}</div>
        <div><span class="passport-field-label">Opérateur</span>${p.human_operator}</div>
        <div><span class="passport-field-label">Seuil autonome</span>${p.max_autonomous_amount} €</div>
        <div><span class="passport-field-label">Seuil validation</span>risque > ${p.required_human_approval_above}</div>
        <div><span class="passport-field-label">Assurance</span>${(p.insurance_coverage_eur || 0).toLocaleString("fr-FR")} €</div>
        <div><span class="passport-field-label">Actions loggées</span>${p.stats.total_actions}</div>
        <div><span class="passport-field-label">Bloquées</span>${p.stats.blocked}</div>
        <div><span class="passport-field-label">Risque moyen</span>${p.stats.avg_risk_score}</div>
      </div>
    </div>
  `).join("");
}

async function loadEscalations() {
  const list = await jget("/v1/escalations?status=pending");
  const container = document.getElementById("escalationList");
  document.getElementById("statPending").textContent = list.length;

  if (list.length === 0) {
    container.innerHTML = `<p class="empty-state">Aucune escalade en attente.</p>`;
    return;
  }
  container.innerHTML = list.map(e => `
    <div class="escalation-card" data-id="${e.id}">
      <div class="escalation-head">
        <span class="escalation-agent">${e.agent_id} · ${e.action_type}</span>
        <span class="stamp stamp-pending_approval">En attente</span>
      </div>
      <div class="escalation-reason">${e.reason} ${e.amount ? `(montant : ${e.amount} €)` : ""} — risque ${e.risk_score}</div>
      <div class="escalation-actions">
        <input type="text" placeholder="Nom de l'opérateur" class="operator-input" value="Thi" />
        <button class="btn-approve" onclick="resolveEscalation(${e.id}, true)">Approuver</button>
        <button class="btn-reject" onclick="resolveEscalation(${e.id}, false)">Rejeter</button>
      </div>
    </div>
  `).join("");
}

window.resolveEscalation = async function (id, approve) {
  const card = document.querySelector(`.escalation-card[data-id="${id}"]`);
  const operator = card.querySelector(".operator-input").value || "opérateur";
  await jpost(`/v1/escalations/${id}/resolve`, { approve, operator, note: approve ? "Approuvé depuis la console" : "Rejeté depuis la console" });
  await refreshAll();
};

async function loadAuditLog() {
  const rows = await jget("/v1/audit?limit=50");
  const body = document.getElementById("auditBody");
  document.getElementById("statTotal").textContent = rows.length;
  document.getElementById("statBlocked").textContent = rows.filter(r => r.decision === "blocked").length;

  body.innerHTML = rows.map(r => `
    <tr>
      <td>${fmtTime(r.timestamp)}</td>
      <td>${r.agent_id}</td>
      <td>${r.action_type}</td>
      <td>${r.amount ? r.amount + " €" : "—"}</td>
      <td>${r.risk_score}</td>
      <td><span class="${stampClass(r.decision)}">${r.decision.replace(/_/g, " ")}</span></td>
      <td>${r.model_used || "—"}</td>
      <td>${r.reason}</td>
    </tr>
  `).join("");
}

function renderRiskBars(breakdown) {
  return `<div class="risk-bars">` + CATS.map(c => `
    <div class="risk-bar-row">
      <span>${CAT_LABELS[c]}</span>
      <div class="risk-bar-track"><div class="risk-bar-fill" style="width:${Math.min(100, breakdown[c])}%"></div></div>
      <span>${breakdown[c]}</span>
    </div>
  `).join("") + `</div>`;
}

document.getElementById("actionForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const agentId = document.getElementById("agentSelect").value;
  const amountRaw = document.getElementById("amountInput").value;
  const paramsRaw = document.getElementById("paramsInput").value.trim();

  let parameters = null;
  if (paramsRaw) {
    try { parameters = JSON.parse(paramsRaw); }
    catch { alert("Paramètres JSON invalides."); return; }
  }

  const body = {
    action_type: document.getElementById("actionTypeSelect").value,
    description: document.getElementById("descInput").value,
    amount: amountRaw ? parseFloat(amountRaw) : null,
    parameters,
  };

  const resultBox = document.getElementById("actionResult");
  try {
    const res = await jpost(`/v1/agents/${agentId}/action`, body);
    resultBox.classList.remove("hidden");
    resultBox.innerHTML = `
      <div class="result-row"><span>Décision</span><span class="${stampClass(res.decision)}">${res.decision.replace(/_/g, " ")}</span></div>
      <div class="result-row"><span>Score de risque</span><span>${res.risk_score} / 100</span></div>
      <div class="result-row"><span>Motif</span><span>${res.reason}</span></div>
      ${res.model_used ? `<div class="result-row"><span>Modèle</span><span>${res.model_used}</span></div>` : ""}
      ${res.response ? `<div class="result-row"><span>Réponse</span><span>${res.response}</span></div>` : ""}
      ${renderRiskBars(res.risk_breakdown)}
    `;
  } catch (err) {
    resultBox.classList.remove("hidden");
    resultBox.innerHTML = `<div class="result-row"><span>Erreur</span><span>${err.message}</span></div>`;
  }
  await refreshAll();
});

document.getElementById("refreshBtn").addEventListener("click", refreshAll);

async function refreshAll() {
  await Promise.all([loadAgentsAndPassports(), loadEscalations(), loadAuditLog()]);
}

refreshAll();
