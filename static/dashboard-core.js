/* Conforva Control Plane — lean core */
const state = window.conforvaState || {
  currentView: 'overview', overview: {}, agents: [], policies: [], actions: [],
  escalations: [], incidents: [], apiKeys: [], integrations: [], usage: null
};
window.conforvaState = state;
window.state = state;

function $(id) { return document.getElementById(id); }
function safeArray(value) { return Array.isArray(value) ? value : []; }
function json(res) { return res && res.ok ? res.json() : null; }

function initDashboard() {
  setupNavigation();
  setupSidebarToggle();
  refreshAllData(false);
}

function setupNavigation() {
  const apply = () => {
    const view = location.hash.slice(1) || 'overview';
    navigateTo($(`view-${view}`) ? view : 'overview', false);
  };
  document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => {
    navigateTo(item.dataset.view);
  }));
  window.addEventListener('hashchange', apply);
  apply();
}

function navigateTo(viewId, updateHash = true) {
  if (!$(`view-${viewId}`)) return;
  state.currentView = viewId;
  if (updateHash && location.hash.slice(1) !== viewId) history.pushState(null, '', `#${viewId}`);
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === viewId));
  document.querySelectorAll('.view-panel').forEach(panel => panel.classList.toggle('hidden', panel.id !== `view-${viewId}`));
  $('sidebar')?.classList.remove('mobile-open');
}
window.navigateTo = navigateTo;

function setupSidebarToggle() {
  $('sidebarToggleBtn')?.addEventListener('click', () => $('sidebar')?.classList.toggle('mobile-open'));
}

async function refreshAllData(showNotification = false) {
  const spinner = $('refreshSpinner');
  $('refreshDataBtn')?.setAttribute('aria-busy', 'true');
  spinner?.classList.add('spinning');
  try {
    const endpoints = {
      overview: '/v1/overview', agents: '/v1/agents', policies: '/v1/policies',
      actions: '/v1/audit?limit=25', escalations: '/v1/escalations?status=all',
      incidents: '/v1/incidents'
    };
    const entries = await Promise.all(Object.entries(endpoints).map(async ([key, url]) => {
      try { return [key, await json(await fetch(url, { headers: { Accept: 'application/json' } }))]; }
      catch { return [key, null]; }
    }));
    for (const [key, value] of entries) if (value !== null) state[key] = key === 'overview' ? (value || {}) : safeArray(value);
    renderOverview(); renderAgents(); renderPolicies(); renderActions(); renderEscalations(); renderIncidents(); renderAuditLedger();
    if (showNotification && typeof showToast === 'function') showToast('Control plane refreshed', 'info');
  } catch (error) {
    console.error(error);
    if (showNotification && typeof showToast === 'function') showToast('Unable to refresh control plane', 'error');
  } finally {
    spinner?.classList.remove('spinning');
    $('refreshDataBtn')?.removeAttribute('aria-busy');
  }
}
window.refreshAllData = refreshAllData;

function renderOverview() {
  const o = state.overview || {};
  const active = o.total_agents ?? state.agents.length;
  const incidents = o.open_incidents ?? state.incidents.filter(i => ['open','active'].includes(String(i.status).toLowerCase())).length;
  if ($('metricActiveAgents')) $('metricActiveAgents').textContent = Number(active).toLocaleString();
  if ($('metricOpenIncidents')) $('metricOpenIncidents').textContent = Number(incidents).toLocaleString();
  if ($('navAgentCount')) $('navAgentCount').textContent = state.agents.length;
  if ($('navPolicyCount')) $('navPolicyCount').textContent = state.policies.length;
  const pending = state.escalations.filter(e => String(e.status || 'pending').toLowerCase() === 'pending').length;
  if ($('navEscalationCount')) $('navEscalationCount').textContent = pending;
  if ($('navIncidentCount')) $('navIncidentCount').textContent = state.incidents.length;
  const body = $('overviewDecisionsTbody');
  if (!body) return;
  const rows = state.actions.slice(0, 8);
  body.innerHTML = rows.length ? rows.map(decisionRow).join('') : '<tr><td class="empty-state">No decisions yet.</td></tr>';
}

function decisionRow(a) {
  const action = a.action_type || a.action || a.type || 'Action';
  const decision = a.decision || a.outcome || a.status || '—';
  const agent = a.agent_id || a.agent || 'Unknown agent';
  const time = a.timestamp || a.created_at || a.createdAt;
  return `<tr><td><strong>${escapeHtml(action)}</strong><div class="muted">${escapeHtml(agent)}</div></td><td><span class="decision decision-${String(decision).toLowerCase().replace(/[^a-z]/g,'')}">${escapeHtml(decision)}</span></td><td class="muted">${formatTime(time)}</td></tr>`;
}

function renderAgents() {
  const el = $('agentsGrid'); if (!el) return;
  el.innerHTML = state.agents.length ? state.agents.map(a => `<article class="resource-row"><div><strong>${escapeHtml(a.name || a.id || 'Unnamed agent')}</strong><div class="muted">${escapeHtml(a.description || a.id || '')}</div></div><span class="status-dot-label">${escapeHtml(a.status || 'active')}</span></article>`).join('') : '<div class="empty-state">No agents connected.</div>';
}
function renderPolicies() {
  const el = $('policiesList'); if (!el) return;
  el.innerHTML = state.policies.length ? state.policies.map(p => `<article class="resource-row"><div><strong>${escapeHtml(p.name || p.id || 'Policy')}</strong><div class="muted">${escapeHtml(p.description || p.action || 'Control rule')}</div></div><span>${escapeHtml(p.status || (p.enabled === false ? 'disabled' : 'active'))}</span></article>`).join('') : '<div class="empty-state">No policies configured.</div>';
}
function renderActions() { const el = $('actionsTableBody'); if (el) el.innerHTML = state.actions.length ? state.actions.map(decisionRow).join('') : '<tr><td class="empty-state">No activity yet.</td></tr>'; }
function renderEscalations() { const el = $('escalationsStream'); if (el) el.innerHTML = state.escalations.length ? state.escalations.slice(0,20).map(e => `<article class="resource-row"><div><strong>${escapeHtml(e.action_type || e.action || 'Review')}</strong><div class="muted">${escapeHtml(e.agent_id || e.agent || '')}</div></div><button class="btn-ghost btn-sm" type="button">Review</button></article>`).join('') : '<div class="empty-state">No reviews waiting.</div>'; }
function renderIncidents() { const el = $('incidentsList'); if (el) el.innerHTML = state.incidents.length ? state.incidents.map(i => `<article class="resource-row"><div><strong>${escapeHtml(i.title || i.name || i.id || 'Incident')}</strong><div class="muted">${escapeHtml(i.description || '')}</div></div><span>${escapeHtml(i.status || 'open')}</span></article>`).join('') : '<div class="empty-state">No open incidents.</div>'; }
function renderAuditLedger() { const el = $('auditLedgerTableBody'); if (el) el.innerHTML = state.actions.length ? state.actions.map(decisionRow).join('') : '<tr><td class="empty-state">No audit events.</td></tr>'; }

function formatTime(value) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? escapeHtml(String(value)) : d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDashboard, { once: true }); else initDashboard();
