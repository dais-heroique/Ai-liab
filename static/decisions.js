const conforvaOriginalShow = window.show;
let conforvaDecisions = [];

async function loadConforvaDecisions() {
  try {
    const data = await api('/v1/audit?limit=100');
    conforvaDecisions = Array.isArray(data) ? data : (data.events || data.audit || []);
  } catch (e) {
    conforvaDecisions = [];
  }
}

function decisionClass(v) {
  return String(v || '').toLowerCase().replace(/[^a-z]/g, '');
}

function decisions(m) {
  const fr = lang === 'fr';
  m.innerHTML = head(
    fr ? 'Décisions' : 'Decisions',
    fr ? 'Chaque action évaluée par Conforva, avec son contexte et sa justification.' : 'Every action evaluated by Conforva, with its context and justification.',
    `<button class="secondary" onclick="refreshDecisions()">${fr ? 'Actualiser' : 'Refresh'}</button>`
  ) + `<section class="panel"><div class="panel-head"><div><strong>${fr ? 'Décisions enregistrées' : 'Recorded decisions'}</strong><p>${fr ? 'Cliquez sur une décision pour voir le détail.' : 'Click a decision to view details.'}</p></div></div><div class="section-list">${conforvaDecisions.map((x, i) => `<article class="item" style="cursor:pointer" onclick="openDecision(${i})"><div><strong>${esc(x.action_type || 'Action')}</strong><div class="muted">${esc(x.agent_id || 'Agent')} · ${fmtDate(x.created_at || x.timestamp)}</div></div><div style="text-align:right"><span class="status ${decisionClass(x.decision)}">${esc(x.decision || '—')}</span><div class="muted">${fr ? 'Risque' : 'Risk'} ${esc(x.risk_score ?? '—')}</div></div></article>`).join('') || `<div class="empty">${fr ? 'Aucune décision enregistrée pour le moment.' : 'No decisions recorded yet.'}</div>`}</div></section>`;
}

async function refreshDecisions() {
  await loadConforvaDecisions();
  decisions(document.getElementById('main'));
}

function openDecision(i) {
  const x = conforvaDecisions[i];
  if (!x) return;
  const fr = lang === 'fr';
  const overlay = document.createElement('div');
  overlay.id = 'decisionOverlay';
  overlay.style = 'position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.72)';
  overlay.innerHTML = `<section class="panel" style="width:min(760px,100%);max-height:90vh;overflow:auto;padding:28px"><button class="icon" style="float:right" onclick="document.getElementById('decisionOverlay')?.remove()">×</button><span class="status ${decisionClass(x.decision)}">${esc(x.decision || '—')}</span><h2>${esc(x.action_type || 'Action')}</h2><p class="muted">${esc(x.id || '')} · ${fmtDate(x.created_at || x.timestamp)}</p><div class="overview-strip"><div><span>AGENT</span><strong>${esc(x.agent_id || '—')}</strong></div><div class="strip-divider"></div><div><span>${fr ? 'RISQUE' : 'RISK'}</span><strong>${esc(x.risk_score ?? '—')} / 100</strong></div><div class="strip-divider"></div><div><span>${fr ? 'MONTANT' : 'AMOUNT'}</span><strong>${x.amount == null ? '—' : esc(x.amount) + ' €'}</strong></div></div><div style="margin-top:24px"><strong>${fr ? 'Justification' : 'Reason'}</strong><p class="muted" style="line-height:1.7">${esc(x.reason || x.summary || 'Aucune justification enregistrée.')}</p></div><div style="margin-top:24px"><strong>${fr ? 'Contexte enregistré' : 'Recorded context'}</strong><pre class="muted" style="white-space:pre-wrap;line-height:1.5">${esc(JSON.stringify(x, null, 2))}</pre></div></section>`;
  document.body.appendChild(overlay);
}

window.refreshDecisions = refreshDecisions;
window.decisions = decisions;
window.openDecision = openDecision;

if (typeof conforvaOriginalShow === 'function') {
  window.show = function(view) {
    if (view !== 'decisions') return conforvaOriginalShow(view);
    location.hash = 'decisions';
    document.querySelectorAll('aside button[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === 'decisions'));
    closeMenu();
    refreshDecisions();
  };
}

if (location.hash.slice(1) === 'decisions') {
  loadConforvaDecisions().then(() => {
    const main = document.getElementById('main');
    if (main) decisions(main);
  });
}