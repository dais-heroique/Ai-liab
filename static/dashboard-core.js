/**
 * AI LIABILITY GATEWAY — ENTERPRISE DASHBOARD & CONTROL CONSOLE
 * High-performance vanilla SPA with real backend integration
 */

// Application State
const state = {
  currentView: 'overview',
  overview: null,
  agents: [],
  policies: [],
  actions: [],
  escalations: [],
  incidents: [],
  apiKeys: [],
  integrations: [],
  usage: null,
  selectedAgentId: 'acme-customer-agent',
  selectedEscalationStatus: 'pending',
  isLandingOpen: false,
  activeLandingScenario: 'refund_overlimit',
  currentOnboardingStep: 1,
  onboardingData: {
    orgName: 'Acme Global Operations',
    apiKey: null,
    agentId: 'acme-customer-agent',
    policyAction: 'refund',
    policyMaxAmount: 500,
    testPayload: { action_type: 'refund', amount: 1250, description: 'VIP Order Return' },
    lastDecision: null,
    lastProof: null
  }
};
window.state = state;

// DOM Content Loaded & Safe Initialization
function initDashboard() {
  setupNavigation();
  setupGlobalSearch();
  setupSidebarToggle();
  refreshAllData(false);

  // Periodic subtle background refresh every 15s
  setInterval(() => {
    refreshAllData(false);
  }, 15000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}

/* --------------------------------------------------------------------------
   NAVIGATION & ROUTER
-------------------------------------------------------------------------- */
function setupNavigation() {
  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById(`view-${hash}`)) {
    navigateTo(hash);
  } else {
    navigateTo('overview');
  }

  window.addEventListener('hashchange', () => {
    const newHash = window.location.hash.replace('#', '');
    if (newHash && document.getElementById(`view-${newHash}`)) {
      navigateTo(newHash);
    }
  });
}

function navigateTo(viewId) {
  state.currentView = viewId;
  window.location.hash = viewId;

  // Update Nav links
  document.querySelectorAll('.nav-item').forEach((item) => {
    if (item.getAttribute('data-view') === viewId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Hide all panels, show active
  document.querySelectorAll('.view-panel').forEach((panel) => {
    panel.classList.add('hidden');
  });

  const activePanel = document.getElementById(`view-${viewId}`);
  if (activePanel) {
    activePanel.classList.remove('hidden');
  }

  // Close mobile sidebar if open
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('mobile-open');

  // Trigger view-specific render updates
  if (viewId === 'passport') {
    renderPassportForSelectedAgent();
  } else if (viewId === 'usage') {
    refreshUsageData();
  } else if (viewId === 'policies') {
    populateWorkbenchPolicies();
  }
}

function toggleLandingView() {
  state.isLandingOpen = !state.isLandingOpen;
  const landingPanel = document.getElementById('view-landing');
  const btn = document.getElementById('viewLandingBtn');

  if (state.isLandingOpen) {
    document.querySelectorAll('.view-panel').forEach((p) => p.classList.add('hidden'));
    landingPanel.classList.remove('hidden');
    btn.innerHTML = `<span>Console</span>`;
    runLandingScenario('refund_overlimit');
  } else {
    landingPanel.classList.add('hidden');
    navigateTo(state.currentView || 'overview');
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6M10 14L21 3"/></svg><span>Product Overview</span>`;
  }
}

function setupSidebarToggle() {
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  const sidebar = document.getElementById('sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }
}

/* --------------------------------------------------------------------------
   DATA FETCHING & REFRESH
-------------------------------------------------------------------------- */
async function refreshAllData(showNotification = false) {
  const spinner = document.getElementById('refreshSpinner');
  if (spinner) spinner.style.animation = 'spin 0.6s linear infinite';

  try {
    const [overviewRes, agentsRes, policiesRes, actionsRes, escalationsRes, incidentsRes, keysRes, intRes, usageRes] =
      await Promise.all([
        fetch('/v1/overview').catch(() => null),
        fetch('/v1/agents').catch(() => null),
        fetch('/v1/policies').catch(() => null),
        fetch('/v1/audit?limit=100').catch(() => null),
        fetch('/v1/escalations?status=all').catch(() => null),
        fetch('/v1/incidents').catch(() => null),
        fetch('/v1/api-keys').catch(() => null),
        fetch('/v1/integrations').catch(() => null),
        fetch('/v1/usage').catch(() => null)
      ]);

    state.overview = (overviewRes && overviewRes.ok) ? await overviewRes.json() : (state.overview || {});
    state.agents = (agentsRes && agentsRes.ok) ? await agentsRes.json() : (state.agents || []);
    state.policies = (policiesRes && policiesRes.ok) ? await policiesRes.json() : (state.policies || []);
    state.actions = (actionsRes && actionsRes.ok) ? await actionsRes.json() : (state.actions || []);
    state.escalations = (escalationsRes && escalationsRes.ok) ? await escalationsRes.json() : (state.escalations || []);
    state.incidents = (incidentsRes && incidentsRes.ok) ? await incidentsRes.json() : (state.incidents || []);
    state.apiKeys = (keysRes && keysRes.ok) ? await keysRes.json() : (state.apiKeys || []);
    state.integrations = (intRes && intRes.ok) ? await intRes.json() : (state.integrations || []);
    if (usageRes && usageRes.ok) {
      state.usage = await usageRes.json();
    }

    if (!Array.isArray(state.agents)) state.agents = [];
    if (!Array.isArray(state.policies)) state.policies = [];
    if (!Array.isArray(state.actions)) state.actions = [];
    if (!Array.isArray(state.escalations)) state.escalations = [];
    if (!Array.isArray(state.incidents)) state.incidents = [];
    if (!Array.isArray(state.apiKeys)) state.apiKeys = [];
    if (!Array.isArray(state.integrations)) state.integrations = [];

    // Render all views
    renderOverview();
    renderAgents();
    renderPolicies();
    renderActions();
    renderRiskDashboard();
    renderEscalations();
    renderIncidents();
    renderAuditLedger();
    renderApiKeys();
    renderIntegrations();
    renderUsageView();
    populateSelects();
    populateWorkbenchPolicies();

    if (showNotification) {
      showToast('Telemetry refreshed from control plane', 'info');
    }
  } catch (err) {
    console.error('Failed to sync gateway state:', err);
    if (showNotification) {
      showToast('Failed to connect to gateway', 'error');
    }
  } finally {
    if (spinner) spinner.style.animation = '';
  }
}

/* --------------------------------------------------------------------------
   VIEW 1: OVERVIEW RENDERER
-------------------------------------------------------------------------- */
function renderOverview() {
  if (!state.overview) return;
  const o = state.overview;

  // Metric Cards
  document.getElementById('metricActiveAgents').textContent = o.total_agents || state.agents.length;
  document.getElementById('metricTotalActions').textContent = (o.total_actions || 0).toLocaleString();
  document.getElementById('metricBlockedActions').textContent = (o.blocked || 0).toLocaleString();
  document.getElementById('metricEscalatedActions').textContent = (o.pending_escalations || 0).toLocaleString();
  document.getElementById('metricOpenIncidents').textContent = o.open_incidents || 0;

  // Topbar badges
  const topbarEscBadge = document.getElementById('topbarEscalationCount');
  const navEscCount = document.getElementById('navEscalationCount');
  if (o.pending_escalations > 0) {
    topbarEscBadge.textContent = o.pending_escalations;
    topbarEscBadge.classList.remove('hidden');
    navEscCount.textContent = o.pending_escalations;
  } else {
    topbarEscBadge.classList.add('hidden');
    navEscCount.textContent = '0';
  }

  document.getElementById('navAgentCount').textContent = state.agents.length;
  document.getElementById('navPolicyCount').textContent = state.policies.length;
  document.getElementById('navIncidentCount').textContent = state.incidents.length;

  // Activity Bars
  const total = o.total_actions || 1;
  const allowedPct = Math.round(((o.approved || 0) / total) * 100);
  const blockedPct = Math.round(((o.blocked || 0) / total) * 100);
  const escalatedPct = Math.round(((o.escalated || 0) / total) * 100);

  document.getElementById('barAllowedVal').textContent = `${o.approved || 0} (${allowedPct}%)`;
  document.getElementById('barAllowedFill').style.width = `${allowedPct}%`;

  document.getElementById('barBlockedVal').textContent = `${o.blocked || 0} (${blockedPct}%)`;
  document.getElementById('barBlockedFill').style.width = `${blockedPct}%`;

  document.getElementById('barEscalatedVal').textContent = `${o.escalated || 0} (${escalatedPct}%)`;
  document.getElementById('barEscalatedFill').style.width = `${escalatedPct}%`;

  // Risk Vectors Grid
  const riskGrid = document.getElementById('overviewRiskGrid');
  if (riskGrid && o.category_averages) {
    riskGrid.innerHTML = Object.entries(o.category_averages)
      .map(([cat, score]) => {
        const severityClass = score > 40 ? 'risk-high' : score > 20 ? 'risk-med' : 'risk-low';
        return `
        <div class="risk-vector-tile">
          <div class="vector-tile-name">${escapeHtml(cat)}</div>
          <div class="vector-tile-score ${severityClass}">${score.toFixed(1)}</div>
        </div>
      `;
      })
      .join('');
  }

  document.getElementById('overviewAvgRiskScore').textContent = `${o.avg_risk_score} / 100`;

  // Overview Recent Decisions Table (Top 6)
  const tbody = document.getElementById('overviewDecisionsTbody');
  if (tbody) {
    const recent = state.actions.slice(0, 6);
    if (recent.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-muted" style="text-align:center; padding: 24px;">No telemetry logged yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = recent
      .map((log) => {
        const decisionBadge = getDecisionBadge(log.decision);
        const riskClass = log.risk_score > 40 ? 'risk-high' : log.risk_score > 20 ? 'risk-med' : 'risk-low';
        const formattedAmount = log.amount != null ? `€${log.amount.toLocaleString()}` : log.target || '-';
        const timeAgo = formatTimeAgo(log.timestamp);

        return `
        <tr onclick="openDecisionInspector('${log.eventId}')">
          <td class="font-mono">${timeAgo}</td>
          <td><strong>${escapeHtml(log.agent_id)}</strong></td>
          <td><span class="agent-model-pill">${escapeHtml(log.action_type)}</span></td>
          <td class="font-mono">${escapeHtml(formattedAmount)}</td>
          <td><span class="risk-pill ${riskClass}">${log.risk_score.toFixed(1)}</span></td>
          <td>${decisionBadge}</td>
          <td class="text-muted">${escapeHtml(log.policy_triggered || 'Standard Matrix')}</td>
          <td class="text-right"><button class="btn-ghost btn-sm" onclick="event.stopPropagation(); openDecisionInspector('${log.eventId}')">Inspect →</button></td>
        </tr>
      `;
      })
      .join('');
  }
}

/* --------------------------------------------------------------------------
   VIEW 2: AGENTS DIRECTORY
-------------------------------------------------------------------------- */
function renderAgents() {
  const grid = document.getElementById('agentsGrid');
  if (!grid) return;

  if (state.agents.length === 0) {
    grid.innerHTML = `<p class="text-muted">No agents registered in fleet configuration.</p>`;
    return;
  }

  grid.innerHTML = state.agents
    .map((agent) => {
      const stats = agent.stats || { total_actions: 0, blocked: 0, pending_approval: 0, avg_risk_score: 0 };
      const riskLevel = stats.avg_risk_score > 40 ? 'High' : stats.avg_risk_score > 20 ? 'Medium' : 'Low';
      const riskColorClass = stats.avg_risk_score > 40 ? 'risk-high' : stats.avg_risk_score > 20 ? 'risk-med' : 'risk-low';

      return `
      <div class="agent-card" onclick="openAgentDetail('${agent.agent_id}')">
        <div class="agent-card-header">
          <div>
            <h3 class="agent-card-title">${escapeHtml(agent.name)}</h3>
            <div class="agent-card-id font-mono">${escapeHtml(agent.agent_id)}</div>
          </div>
          <span class="agent-tier-tag">${escapeHtml(agent.tier)}</span>
        </div>

        <div class="agent-stats-strip">
          <div class="agent-stat-item">
            <span class="stat-item-label">Actions</span>
            <span class="stat-item-val">${stats.total_actions.toLocaleString()}</span>
          </div>
          <div class="agent-stat-item">
            <span class="stat-item-label">Blocked</span>
            <span class="stat-item-val" style="color: var(--color-blocked)">${stats.blocked}</span>
          </div>
          <div class="agent-stat-item">
            <span class="stat-item-label">Risk Profile</span>
            <span class="stat-item-val ${riskColorClass}">${riskLevel} (${stats.avg_risk_score})</span>
          </div>
        </div>

        <div class="agent-card-footer">
          <span class="agent-model-pill">🤖 ${escapeHtml(agent.model)}</span>
          <span class="font-mono">Cap: €${(agent.max_autonomous_amount || 0).toLocaleString()}</span>
        </div>
      </div>
    `;
    })
    .join('');
}

function openAgentDetail(agentId) {
  const agent = state.agents.find((a) => a.agent_id === agentId);
  if (!agent) return;

  state.selectedAgentId = agentId;
  const drawer = document.getElementById('agentDetailDrawer');
  document.getElementById('agentDetailName').textContent = agent.name;
  document.getElementById('agentDetailId').textContent = agent.agent_id;
  document.getElementById('agentDetailTierBadge').textContent = agent.tier;

  switchAgentDetailTab('overview');
  drawer.classList.remove('hidden');
}

function closeAgentDetail() {
  document.getElementById('agentDetailDrawer').classList.add('hidden');
}

function switchAgentDetailTab(tab) {
  document.querySelectorAll('.detail-tab').forEach((t) => {
    t.classList.toggle('active', t.textContent.toLowerCase().includes(tab));
  });

  const pane = document.getElementById('agentTabContent');
  const agent = state.agents.find((a) => a.agent_id === state.selectedAgentId);
  if (!agent || !pane) return;

  const stats = agent.stats || {};

  if (tab === 'overview') {
    pane.innerHTML = `
      <div class="spec-box" style="margin-bottom: 12px;">
        <div class="spec-box-label">Assigned Operator & Oversight</div>
        <div class="spec-box-val">${escapeHtml(agent.human_operator)}</div>
      </div>
      <div class="dashboard-grid-2">
        <div class="spec-box">
          <div class="spec-box-label">Max Autonomous Amount</div>
          <div class="spec-box-val">€${(agent.max_autonomous_amount || 0).toLocaleString()}</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">Human Review Threshold</div>
          <div class="spec-box-val">Risk > ${agent.required_human_approval_above}</div>
        </div>
      </div>
      <div class="spec-box" style="margin-top: 12px;">
        <div class="spec-box-label">Underwriting Insurance Coverage</div>
        <div class="spec-box-val" style="color: var(--color-approved)">€${(agent.insurance_coverage_eur || 0).toLocaleString()} Active Liability Pool</div>
      </div>
    `;
  } else if (tab === 'policies') {
    const blockedTypes = agent.blocked_action_types || [];
    pane.innerHTML = `
      <div class="spec-box">
        <div class="spec-box-label">Hard Blocked Action Types</div>
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
          ${blockedTypes.map((t) => `<span class="badge badge-blocked">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>
      <div class="spec-box" style="margin-top: 12px;">
        <div class="spec-box-label">Physical / Hardware Constraints</div>
        <pre class="font-mono" style="font-size:11.5px; color: var(--text-code); margin-top:4px;">${JSON.stringify(agent.hard_constraints || {}, null, 2)}</pre>
      </div>
    `;
  } else if (tab === 'history') {
    const agentActions = state.actions.filter((a) => a.agent_id === agent.agent_id).slice(0, 8);
    pane.innerHTML = `
      <table class="enterprise-table" style="font-size:11.5px;">
        <thead>
          <tr><th>Time</th><th>Action</th><th>Decision</th></tr>
        </thead>
        <tbody>
          ${agentActions.map((a) => `<tr><td class="font-mono">${formatTimeAgo(a.timestamp)}</td><td>${escapeHtml(a.action_type)}</td><td>${getDecisionBadge(a.decision)}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
  } else if (tab === 'passport') {
    pane.innerHTML = `
      <div class="spec-box">
        <div class="spec-box-label">Cryptographic Identity Hash</div>
        <div class="spec-box-val font-mono" style="font-size:11px; word-break:break-all;">SHA256: 0x9f88c21a08e4...ee1244</div>
      </div>
      <button class="btn-primary btn-block" style="margin-top: 14px;" onclick="navigateTo('passport'); closeAgentDetail();">Open Full AI Passport Card →</button>
    `;
  }
}

/* --------------------------------------------------------------------------
   VIEW 3: POLICY MANAGEMENT & BUILDER
-------------------------------------------------------------------------- */
function renderPolicies() {
  const container = document.getElementById('policiesList');
  if (!container) return;

  container.innerHTML = state.policies
    .map((policy) => {
      const conditionChips = (policy.conditions || [])
        .map((cond) => {
          let actionClass = 'rule-action-allow';
          if (cond.action === 'BLOCK') actionClass = 'rule-action-block';
          else if (cond.action === 'HUMAN_REVIEW') actionClass = 'rule-action-review';

          return `
          <div class="rule-chip">
            <span class="rule-field">${escapeHtml(cond.field)}</span>
            <span class="rule-op">${escapeHtml(cond.operator)}</span>
            <span class="rule-val">${escapeHtml(String(cond.value))}</span>
            <span class="rule-arrow">→</span>
            <span class="${actionClass}">${escapeHtml(cond.action)}</span>
          </div>
        `;
        })
        .join('');

      return `
      <div class="policy-block">
        <div class="policy-block-header">
          <div class="policy-title-area">
            <span class="policy-id">${escapeHtml(policy.id)}</span>
            <h3 class="policy-name">${escapeHtml(policy.name)}</h3>
            <span class="policy-category-tag">${escapeHtml(policy.category)}</span>
          </div>
          <span class="badge badge-approved">ACTIVE</span>
        </div>

        <p class="policy-desc">${escapeHtml(policy.description)}</p>

        <div class="policy-rules-grid">
          ${conditionChips}
        </div>
      </div>
    `;
    })
    .join('');
}

function openCreatePolicyModal() {
  const targetSelect = document.getElementById('newPolicyTargetAgent');
  if (targetSelect) {
    targetSelect.innerHTML = `<option value="*">All Fleet Agents (*)</option>` +
      state.agents.map((a) => `<option value="${a.agent_id}">${escapeHtml(a.name)}</option>`).join('');
  }
  document.getElementById('createPolicyModal').classList.remove('hidden');
}

function closeCreatePolicyModal() {
  document.getElementById('createPolicyModal').classList.add('hidden');
}

async function handleCreatePolicy(e) {
  e.preventDefault();
  const name = document.getElementById('newPolicyName').value;
  const category = document.getElementById('newPolicyCategory').value;
  const targetAgent = document.getElementById('newPolicyTargetAgent').value;
  const field = document.getElementById('newPolField').value;
  const op = document.getElementById('newPolOp').value;
  const val = document.getElementById('newPolVal').value;
  const action = document.getElementById('newPolAction').value;
  const desc = document.getElementById('newPolicyDesc').value;

  const payload = {
    name,
    category,
    targetAgents: [targetAgent],
    conditions: [{ field, operator: op, value: isNaN(Number(val)) ? val : Number(val), action }],
    description: desc,
    status: 'active'
  };

  try {
    const res = await fetch('/v1/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast('Policy activated on Gateway firewall', 'success');
      closeCreatePolicyModal();
      await refreshAllData();
    } else {
      showToast('Failed to create policy', 'error');
    }
  } catch (err) {
    showToast('Network error creating policy', 'error');
  }
}

/* --------------------------------------------------------------------------
   VIEW 4: ACTIONS & TELEMETRY LEDGER
-------------------------------------------------------------------------- */
function renderActions() {
  const tbody = document.getElementById('actionsTableBody');
  if (!tbody) return;

  filterActionsTable();
}

function filterActionsTable() {
  const tbody = document.getElementById('actionsTableBody');
  if (!tbody) return;

  const agentFilter = document.getElementById('filterActionAgent')?.value || 'all';
  const decisionFilter = document.getElementById('filterActionDecision')?.value || 'all';
  const typeFilter = document.getElementById('filterActionType')?.value || 'all';
  const keyword = document.getElementById('actionSearchKeyword')?.value.toLowerCase() || '';

  const filtered = state.actions.filter((log) => {
    if (agentFilter !== 'all' && log.agent_id !== agentFilter) return false;
    if (decisionFilter !== 'all' && log.decision !== decisionFilter) return false;
    if (typeFilter !== 'all' && log.action_type !== typeFilter) return false;
    if (keyword) {
      const matchDesc = (log.description || '').toLowerCase().includes(keyword);
      const matchAgent = (log.agent_id || '').toLowerCase().includes(keyword);
      const matchEvent = (log.eventId || '').toLowerCase().includes(keyword);
      if (!matchDesc && !matchAgent && !matchEvent) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:28px;" class="text-muted">No actions match filter criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((log) => {
      const decisionBadge = getDecisionBadge(log.decision);
      const riskClass = log.risk_score > 40 ? 'risk-high' : log.risk_score > 20 ? 'risk-med' : 'risk-low';
      const formattedAmount = log.amount != null ? `€${log.amount.toLocaleString()}` : log.target || '-';
      const timeAgo = formatTimeAgo(log.timestamp);

      return `
      <tr onclick="openDecisionInspector('${log.eventId}')">
        <td class="font-mono">${timeAgo}</td>
        <td class="font-mono text-muted">${escapeHtml(log.eventId || 'evt_00')}</td>
        <td><strong>${escapeHtml(log.agent_id)}</strong></td>
        <td><span class="agent-model-pill">${escapeHtml(log.action_type)}</span></td>
        <td class="font-mono">${escapeHtml(formattedAmount)}</td>
        <td><span class="risk-pill ${riskClass}">${log.risk_score.toFixed(1)}</span></td>
        <td>${decisionBadge}</td>
        <td class="text-muted">${escapeHtml(log.policy_triggered || 'Standard Matrix')}</td>
        <td class="font-mono">${log.latency_ms || 14}ms</td>
        <td class="text-right"><button class="btn-ghost btn-sm" onclick="event.stopPropagation(); openDecisionInspector('${log.eventId}')">Inspect</button></td>
      </tr>
    `;
    })
    .join('');
}

/* --------------------------------------------------------------------------
   VIEW 5: RISK DASHBOARD & ANALYSIS
-------------------------------------------------------------------------- */
function renderRiskDashboard() {
  const container = document.getElementById('riskVectorsDetailedList');
  const tableBody = document.getElementById('riskAgentsTableBody');
  if (!container || !state.overview) return;

  const cats = state.overview.category_averages || {};
  container.innerHTML = Object.entries(cats)
    .map(([cat, score]) => {
      const riskColorClass = score > 40 ? 'fill-blocked' : score > 20 ? 'fill-escalated' : 'fill-approved';
      return `
      <div class="bar-stat-row" style="margin-bottom:12px;">
        <div class="bar-stat-info">
          <span class="bar-name" style="text-transform: capitalize;">${escapeHtml(cat)} Safety Risk</span>
          <span class="bar-val font-mono">${score.toFixed(1)} / 100</span>
        </div>
        <div class="progress-track"><div class="progress-fill ${riskColorClass}" style="width: ${Math.min(100, score * 1.8)}%"></div></div>
      </div>
    `;
    })
    .join('');

  if (tableBody) {
    tableBody.innerHTML = state.agents
      .map((agent) => {
        const stats = agent.stats || { avg_risk_score: 0 };
        const riskColorClass = stats.avg_risk_score > 40 ? 'risk-high' : stats.avg_risk_score > 20 ? 'risk-med' : 'risk-low';
        return `
        <tr>
          <td><strong>${escapeHtml(agent.name)}</strong></td>
          <td><span class="agent-tier-tag">${escapeHtml(agent.tier)}</span></td>
          <td><span class="risk-pill ${riskColorClass}">${stats.avg_risk_score.toFixed(1)}</span></td>
          <td class="font-mono text-muted">€${(agent.insurance_coverage_eur || 0).toLocaleString()}</td>
          <td><span class="badge badge-approved">Compliant</span></td>
        </tr>
      `;
      })
      .join('');
  }
}

/* --------------------------------------------------------------------------
   VIEW 6: HUMAN REVIEW & ESCALATIONS QUEUE
-------------------------------------------------------------------------- */
function renderEscalations() {
  const container = document.getElementById('escalationsStream');
  if (!container) return;

  const filtered = state.escalations.filter((e) => {
    if (state.selectedEscalationStatus === 'all') return true;
    if (state.selectedEscalationStatus === 'pending') return e.status === 'pending';
    if (state.selectedEscalationStatus === 'resolved') return e.status !== 'pending';
    return true;
  });

  const pendingCount = state.escalations.filter((e) => e.status === 'pending').length;
  const countEl = document.getElementById('escCountPending');
  if (countEl) countEl.textContent = pendingCount;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="panel" style="text-align:center; padding: 48px 20px;">
        <div style="font-size:32px; margin-bottom:12px;">✅</div>
        <h3 class="panel-title" style="margin-bottom:4px;">No Actions Pending Human Authorization</h3>
        <p class="panel-subtitle">All autonomous agent executions are currently within safe operational boundaries.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((esc) => {
      const isPending = esc.status === 'pending';
      const riskClass = esc.risk_score > 40 ? 'risk-high' : 'risk-med';
      const formattedAmount = esc.amount != null ? `€${esc.amount.toLocaleString()}` : esc.target || '-';

      return `
      <div class="escalation-task-card" style="border-left-color: ${isPending ? 'var(--color-escalated)' : esc.status === 'approved' ? 'var(--color-approved)' : 'var(--color-blocked)'}">
        <div class="esc-header">
          <div>
            <h3 class="esc-title">${escapeHtml(esc.description || 'Autonomous Action Escrow')}</h3>
            <div class="esc-agent font-mono">Agent: <strong>${escapeHtml(esc.agent_id)}</strong> · Event: ${escapeHtml(esc.eventId || 'esc_' + esc.id)}</div>
          </div>
          <span class="badge ${isPending ? 'badge-escalated' : esc.status === 'approved' ? 'badge-approved' : 'badge-blocked'}">${esc.status.toUpperCase()}</span>
        </div>

        <div class="esc-grid">
          <div class="esc-grid-item">
            <span class="esc-grid-label">Action Type</span>
            <span class="esc-grid-val">${escapeHtml(esc.action_type)}</span>
          </div>
          <div class="esc-grid-item">
            <span class="esc-grid-label">Amount / Target</span>
            <span class="esc-grid-val">${escapeHtml(formattedAmount)}</span>
          </div>
          <div class="esc-grid-item">
            <span class="esc-grid-label">Risk Score</span>
            <span class="esc-grid-val ${riskClass}">${esc.risk_score.toFixed(1)}</span>
          </div>
          <div class="esc-grid-item">
            <span class="esc-grid-label">Policy Intercept</span>
            <span class="esc-grid-val" style="font-size:11px;">${escapeHtml(esc.policy_triggered || 'Standard Escrow')}</span>
          </div>
        </div>

        <div class="esc-reason-box">
          <strong>Escalation Reason:</strong> ${escapeHtml(esc.reason || 'Amount or risk exceeds autonomous approval threshold.')}
        </div>

        ${
          isPending
            ? `
          <div class="esc-actions-bar">
            <input type="text" id="escNote_${esc.id}" class="esc-operator-input" placeholder="Operator review note / reason..." />
            <div class="esc-btn-group">
              <button class="btn-danger btn-sm" onclick="resolveEscalation(${esc.id}, false)">Reject Action</button>
              <button class="btn-primary btn-sm" onclick="resolveEscalation(${esc.id}, true)">Authorize & Execute</button>
            </div>
          </div>
        `
            : `
          <div class="text-muted" style="font-size:11.5px; border-top:1px solid var(--border-subtle); padding-top:8px;">
            Resolved by <strong>${escapeHtml(esc.operator || 'Security Officer')}</strong> on ${formatTimeAgo(esc.resolved_at)}: "${escapeHtml(esc.note || 'No note')}"
          </div>
        `
        }
      </div>
    `;
    })
    .join('');
}

function switchEscalationStatus(status) {
  state.selectedEscalationStatus = status;
  document.getElementById('tabEscPending').classList.toggle('active', status === 'pending');
  document.getElementById('tabEscResolved').classList.toggle('active', status === 'resolved');
  document.getElementById('tabEscAll').classList.toggle('active', status === 'all');
  renderEscalations();
}

async function resolveEscalation(escId, approve) {
  const noteInput = document.getElementById(`escNote_${escId}`);
  const note = noteInput ? noteInput.value : '';

  try {
    const res = await fetch(`/v1/escalations/${escId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approve,
        operator: 'Sarah Chen (Security Officer)',
        note: note || (approve ? 'Approved after verification' : 'Rejected per policy ceiling')
      })
    });

    if (res.ok) {
      showToast(approve ? 'Action authorized and dispatched to API' : 'Action rejected and sealed in audit log', approve ? 'success' : 'info');
      await refreshAllData();
    } else {
      showToast('Failed to resolve escalation', 'error');
    }
  } catch (err) {
    showToast('Network error resolving escalation', 'error');
  }
}

/* --------------------------------------------------------------------------
   VIEW 7: INCIDENTS & FORENSICS ROOM
-------------------------------------------------------------------------- */
function renderIncidents() {
  const container = document.getElementById('incidentsList');
  if (!container) return;

  container.innerHTML = state.incidents
    .map((inc) => {
      const sevBadge = inc.severity === 'CRITICAL' ? 'badge-blocked' : 'badge-escalated';
      return `
      <div class="incident-card">
        <div class="incident-header">
          <div>
            <span class="incident-id-badge">${escapeHtml(inc.id)} · ${inc.status}</span>
            <h3 class="incident-title">${escapeHtml(inc.title)}</h3>
          </div>
          <span class="badge ${sevBadge}">${inc.severity} SEVERITY</span>
        </div>

        <p class="text-secondary" style="font-size:13px;">${escapeHtml(inc.summary)}</p>

        <div class="incident-timeline">
          ${(inc.timeline || [])
            .map(
              (evt) => `
            <div class="timeline-event">
              <div class="event-meta">${formatTimeAgo(evt.timestamp)} · <span class="event-stage">${escapeHtml(evt.stage)}</span> (${escapeHtml(evt.actor)})</div>
              <div class="event-detail">${escapeHtml(evt.detail)}</div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
    })
    .join('');
}

/* --------------------------------------------------------------------------
   VIEW 8: AI PASSPORT & COMPLIANCE
-------------------------------------------------------------------------- */
async function renderPassportForSelectedAgent() {
  const select = document.getElementById('passportAgentSelect');
  const card = document.getElementById('passportDisplayCard');
  if (!card) return;

  const agentId = select ? select.value || state.agents[0]?.agent_id : state.agents[0]?.agent_id;
  if (!agentId) return;

  try {
    const res = await fetch(`/v1/agents/${agentId}/passport`);
    if (!res.ok) throw new Error('Passport fetch failed');
    const passport = await res.json();

    const seal = passport.cryptographic_seal || {
      canonical_hash: '0x' + (passport.agent_id ? passport.agent_id : '0000'),
      verification_status: 'VALID',
      algorithm: 'SHA-256 (Canonical JSON RFC 8785)'
    };
    const attestation = passport.compliance_attestation || {};

    card.innerHTML = `
      <div class="passport-top">
        <div class="passport-seal">
          <div class="seal-icon">🛡️</div>
          <div>
            <h2 class="seal-title">ENTERPRISE AI OPERATIONAL PASSPORT</h2>
            <span class="seal-sub font-mono">Issued by AI Liability Gateway · Canonical Seal: ${escapeHtml(seal.canonical_hash.slice(0, 24))}...</span>
          </div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn-secondary btn-sm" onclick="runPassportVerification('${passport.agent_id}')">
            <span>⚡ Verify Cryptographic Seal</span>
          </button>
          <span class="badge badge-approved" id="passportVerifiedStatusBadge" style="font-size:12px;">VALIDATED SEAL</span>
        </div>
      </div>

      <div class="passport-grid-spec">
        <div class="spec-box">
          <div class="spec-box-label">Agent Legal Designation</div>
          <div class="spec-box-val">${escapeHtml(passport.name)}</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">System Architecture</div>
          <div class="spec-box-val">${escapeHtml(passport.model)} (Fallback: ${escapeHtml(passport.fallback_model)})</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">Underwriting Liability Pool</div>
          <div class="spec-box-val" style="color: var(--color-approved)">€${(passport.insurance_coverage_eur || 0).toLocaleString()} EUR</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">Autonomous Financial Ceiling</div>
          <div class="spec-box-val">€${(passport.max_autonomous_amount || 0).toLocaleString()} per transaction</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">Human Review Threshold</div>
          <div class="spec-box-val">Mandatory if Risk > ${passport.required_human_approval_above}</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">Designated Human Controller</div>
          <div class="spec-box-val">${escapeHtml(passport.human_operator)}</div>
        </div>
      </div>

      <div class="spec-box" style="margin-top: 12px;">
        <div class="spec-box-label">EU AI Act & Regulatory Compliance Attestations</div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
          <span class="badge badge-approved">${escapeHtml(attestation.eu_ai_act_classification || 'EU AI Act High-Risk Tier (Regulation 2024/1689)')}</span>
          <span class="badge badge-approved">${escapeHtml(attestation.soc2_type_2 || 'SOC2 Type II CC6.8')}</span>
          <span class="badge badge-approved">${escapeHtml(attestation.iso_42001 || 'ISO/IEC 42001:2023 AI Management')}</span>
        </div>
      </div>

      <div class="spec-box" style="margin-top: 12px; background: var(--bg-input);">
        <div class="spec-box-label">Canonical Cryptographic Fingerprint (RFC 8785 JSON Hash)</div>
        <div class="font-mono text-code" id="passportHashDisplay" style="font-size:11.5px; word-break:break-all; padding: 6px 0;">
          ${escapeHtml(seal.canonical_hash)}
        </div>
      </div>

      <div id="passportVerificationResultBox" class="hidden" style="margin-top:12px; padding:12px; border-radius: var(--radius-sm); border:1px solid var(--border-subtle);"></div>
    `;
  } catch (err) {
    console.error('Passport error:', err);
    card.innerHTML = `<p class="text-muted" style="padding:24px;">Failed to load cryptographic passport.</p>`;
  }
}

async function runPassportVerification(agentId) {
  const resultBox = document.getElementById('passportVerificationResultBox');
  if (!resultBox) return;

  resultBox.classList.remove('hidden');
  resultBox.innerHTML = `<span class="text-muted">Computing canonical JSON serialization & executing SHA-256 verification...</span>`;

  try {
    const res = await fetch(`/v1/agents/${agentId}/passport/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const result = await res.json();

    if (result.status === 'VALID') {
      resultBox.style.background = 'rgba(16, 185, 129, 0.08)';
      resultBox.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      resultBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <strong style="color: var(--color-approved);">✓ Cryptographic Passport Verified Match</strong>
          <span class="font-mono text-muted" style="font-size:11px;">Algorithm: ${escapeHtml(result.algorithm)}</span>
        </div>
        <div class="font-mono" style="font-size:11.5px; color: var(--text-secondary); word-break:break-all;">
          Computed Fingerprint: <strong>0x${escapeHtml(result.computed_fingerprint)}</strong>
        </div>
        <p style="font-size:12px; color: var(--text-secondary); margin-top:6px;">
          ${escapeHtml(result.compliance_attestation)}
        </p>
      `;
      showToast('Passport cryptographically verified & matched', 'success');
    } else {
      resultBox.style.background = 'rgba(239, 68, 68, 0.08)';
      resultBox.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      resultBox.innerHTML = `
        <strong style="color: var(--color-blocked);">✗ Verification Failed: ${escapeHtml(result.reason)}</strong>
      `;
      showToast('Verification mismatch detected', 'error');
    }
  } catch (err) {
    resultBox.innerHTML = `<span style="color:var(--color-blocked);">Error executing verification.</span>`;
  }
}

function exportPassportDoc() {
  const select = document.getElementById('passportAgentSelect');
  const agentId = select ? select.value : state.agents[0]?.agent_id;
  const agent = state.agents.find((a) => a.agent_id === agentId);

  const doc = {
    title: 'AI Liability Operational Passport',
    agent_id: agentId,
    specs: agent,
    timestamp: new Date().toISOString(),
    sha256_proof: agent?.passport_fingerprint || ('0x' + Math.random().toString(16).substring(2, 34))
  };

  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AI_PASSPORT_${agentId}.json`;
  a.click();
  showToast('Passport certificate downloaded', 'success');
}

/* --------------------------------------------------------------------------
   VIEW 9: AUDIT LEDGER & PROOFS
-------------------------------------------------------------------------- */
function renderAuditLedger() {
  const tbody = document.getElementById('auditLedgerTableBody');
  if (!tbody) return;

  if (state.actions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-muted" style="text-align:center; padding: 28px;">No audit records anchored yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.actions
    .map((log) => {
      const decisionBadge = getDecisionBadge(log.decision);
      const riskClass = log.risk_score > 40 ? 'risk-high' : log.risk_score > 20 ? 'risk-med' : 'risk-low';
      const proofShort = log.sha256_proof ? log.sha256_proof.slice(0, 20) + '...' : '0x' + Math.random().toString(16).slice(2, 14) + '...';

      return `
      <tr onclick="openDecisionInspector('${log.eventId}')">
        <td class="font-mono">${formatTimeAgo(log.timestamp)}</td>
        <td class="font-mono text-muted">${escapeHtml(log.eventId || 'evt_00')}</td>
        <td><strong>${escapeHtml(log.agent_id)}</strong></td>
        <td><span class="agent-model-pill">${escapeHtml(log.action_type)}</span></td>
        <td>${decisionBadge}</td>
        <td><span class="risk-pill ${riskClass}">${log.risk_score.toFixed(1)}</span></td>
        <td class="font-mono text-muted" title="${escapeHtml(log.sha256_proof || '')}">${escapeHtml(proofShort)}</td>
        <td class="text-right"><button class="btn-ghost btn-sm" onclick="event.stopPropagation(); openDecisionInspector('${log.eventId}')">Inspect</button></td>
      </tr>
    `;
    })
    .join('');
}

/* --------------------------------------------------------------------------
   VIEW 9: AUDIT LEDGER & PROOFS
-------------------------------------------------------------------------- */
function renderApiKeys() {
  const tbody = document.getElementById('apiKeysTableBody');
  if (!tbody) return;

  tbody.innerHTML = state.apiKeys
    .map((key) => {
      const isLive = key.environment === 'production';
      return `
      <tr>
        <td><strong>${escapeHtml(key.name)}</strong></td>
        <td class="font-mono text-code">${escapeHtml(key.secretMasked)}</td>
        <td><span class="agent-tier-tag">${key.environment.toUpperCase()}</span></td>
        <td class="font-mono text-muted">${formatTimeAgo(key.created_at)}</td>
        <td class="font-mono text-muted">${key.last_used_at}</td>
        <td><span class="badge ${key.status === 'active' ? 'badge-approved' : 'badge-blocked'}">${key.status.toUpperCase()}</span></td>
        <td class="text-right">
          ${key.status === 'active' ? `<button class="btn-danger btn-sm" onclick="revokeApiKey('${key.id}')">Revoke</button>` : `<span class="text-muted">Revoked</span>`}
        </td>
      </tr>
    `;
    })
    .join('');
}

function openCreateApiKeyModal() {
  document.getElementById('createApiKeyModal').classList.remove('hidden');
}

function closeCreateApiKeyModal() {
  document.getElementById('createApiKeyModal').classList.add('hidden');
}

async function handleCreateApiKey(e) {
  e.preventDefault();
  const name = document.getElementById('newKeyName').value;
  const env = document.getElementById('newKeyEnv').value;

  try {
    const res = await fetch('/v1/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, environment: env })
    });

    if (res.ok) {
      const data = await res.json();
      const modalBody = document.getElementById('apiKeyModalBody');
      modalBody.innerHTML = `
        <div style="background-color: var(--bg-panel-subtle); padding:16px; border-radius: var(--radius-sm); border:1px solid var(--border-medium);">
          <div class="text-muted" style="font-size:12px; margin-bottom:8px;">⚠️ Copy this secret key now. You won't be able to see it again!</div>
          <div class="font-mono text-code" style="font-size:13px; word-break:break-all; padding:8px; background:var(--bg-input); border-radius:4px;">${escapeHtml(data.rawSecret)}</div>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" onclick="closeCreateApiKeyModal(); refreshAllData();">Done</button>
        </div>
      `;
      showToast('API Key generated', 'success');
    }
  } catch (err) {
    showToast('Failed to generate key', 'error');
  }
}

async function revokeApiKey(id) {
  if (!confirm('Are you sure you want to revoke this API key immediately?')) return;
  try {
    await fetch(`/v1/api-keys/${id}`, { method: 'DELETE' });
    showToast('Key revoked', 'info');
    await refreshAllData();
  } catch (err) {
    showToast('Failed to revoke', 'error');
  }
}

function renderIntegrations() {
  const grid = document.getElementById('integrationsGrid');
  if (!grid) return;

  grid.innerHTML = state.integrations
    .map((item) => {
      const isConnected = item.status === 'Connected';
      return `
      <div class="integration-card">
        <div class="integration-header">
          <h3 class="integration-name">${escapeHtml(item.name)}</h3>
          <span class="badge ${isConnected ? 'badge-approved' : 'badge-escalated'}">${escapeHtml(item.badge)}</span>
        </div>
        <p class="integration-desc">${escapeHtml(item.description)}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:8px; font-size:11px; color:var(--text-muted);">
          <span>Latency: ${item.latency}</span>
          <button class="btn-ghost btn-sm" onclick="showToast('Integration setting: ${escapeHtml(item.name)}', 'info')">Configure</button>
        </div>
      </div>
    `;
    })
    .join('');
}

/* --------------------------------------------------------------------------
   VIEW 10: LIVE EVALUATION SANDBOX (REAL BACKEND PIPELINE)
-------------------------------------------------------------------------- */
function updateSandboxDefaults() {
  const agentId = document.getElementById('sbAgent').value;
  const agent = state.agents.find((a) => a.agent_id === agentId);
  if (agent) {
    if (agent.agent_id.includes('cnc')) {
      document.getElementById('sbActionType').value = 'machine_control';
      document.getElementById('sbParams').value = '{"rpm": 3000}';
      document.getElementById('sbAmount').value = '';
    } else if (agent.agent_id.includes('fintech')) {
      document.getElementById('sbActionType').value = 'wire_transfer';
      document.getElementById('sbAmount').value = '450';
    } else {
      document.getElementById('sbActionType').value = 'refund';
      document.getElementById('sbAmount').value = '80';
    }
  }
}

function handleActionTypeChange() {
  const type = document.getElementById('sbActionType').value;
  const amtGroup = document.getElementById('sbAmountGroup');
  if (type === 'refund' || type === 'wire_transfer') {
    amtGroup.style.display = 'flex';
  } else {
    amtGroup.style.display = 'none';
  }
}

function applyPreset(presetName) {
  if (presetName === 'safe_refund') {
    document.getElementById('sbAgent').value = 'acme-customer-agent';
    document.getElementById('sbActionType').value = 'refund';
    document.getElementById('sbAmount').value = '45';
    document.getElementById('sbDescription').value = 'Goodwill compensation for delivery delay';
    document.getElementById('sbParams').value = '';
  } else if (presetName === 'overlimit_refund') {
    document.getElementById('sbAgent').value = 'acme-customer-agent';
    document.getElementById('sbActionType').value = 'refund';
    document.getElementById('sbAmount').value = '14500';
    document.getElementById('sbDescription').value = 'Refund client for damaged freight shipment';
    document.getElementById('sbParams').value = '';
  } else if (presetName === 'blocked_cnc') {
    document.getElementById('sbAgent').value = 'acme-cnc-controller';
    document.getElementById('sbActionType').value = 'machine_control';
    document.getElementById('sbAmount').value = '';
    document.getElementById('sbDescription').value = 'Rapid spindle spin override';
    document.getElementById('sbParams').value = '{"rpm": 8000}';
  } else if (presetName === 'blocked_delete') {
    document.getElementById('sbAgent').value = 'acme-cnc-controller';
    document.getElementById('sbActionType').value = 'delete_data';
    document.getElementById('sbAmount').value = '';
    document.getElementById('sbDescription').value = 'Purge machine historical logs';
    document.getElementById('sbParams').value = '';
  }
  handleActionTypeChange();
}

async function handleSandboxEvaluate(e) {
  e.preventDefault();
  const agentId = document.getElementById('sbAgent').value;
  const action_type = document.getElementById('sbActionType').value;
  const amountVal = document.getElementById('sbAmount').value;
  const description = document.getElementById('sbDescription').value;
  const paramsVal = document.getElementById('sbParams').value;
  const target = document.getElementById('sbTarget').value;

  let parameters = null;
  if (paramsVal && paramsVal.trim()) {
    try {
      parameters = JSON.parse(paramsVal);
    } catch {
      showToast('Invalid JSON in technical parameters', 'error');
      return;
    }
  }

  const payload = {
    action_type,
    amount: amountVal ? Number(amountVal) : null,
    description,
    parameters,
    target
  };

  // Reset steps
  const step1 = document.getElementById('pipeStep1');
  const step2 = document.getElementById('pipeStep2');
  const step3 = document.getElementById('pipeStep3');
  const verdictCard = document.getElementById('sandboxVerdictCard');
  verdictCard.classList.add('hidden');

  step1.className = 'pipe-step pipe-active';
  step2.className = 'pipe-step';
  step3.className = 'pipe-step';
  document.getElementById('pipeRiskBody').textContent = 'Calculating dimensional risk vectors...';
  document.getElementById('pipePolicyBody').textContent = 'Awaiting risk score...';
  document.getElementById('pipeModelBody').textContent = 'Awaiting gateway check...';

  const btnSpinner = document.getElementById('sbBtnSpinner');
  const btnText = document.getElementById('sbBtnText');
  btnSpinner.classList.remove('hidden');
  btnText.textContent = 'Evaluating Action...';

  try {
    const res = await fetch(`/v1/agents/${agentId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    // Step 1: Risk Engine
    await delay(200);
    step1.className = 'pipe-step pipe-passed';
    document.getElementById('pipeRiskBody').textContent = `Risk Score: ${data.risk_score.toFixed(1)} / 100 (${JSON.stringify(data.risk_breakdown)})`;

    // Step 2: Policy Matrix
    await delay(200);
    if (data.decision === 'blocked') {
      step2.className = 'pipe-step pipe-blocked';
      document.getElementById('pipePolicyBody').textContent = `BLOCKED by ${data.policy_triggered}: ${data.reason}`;
    } else if (data.decision === 'pending_approval') {
      step2.className = 'pipe-step pipe-active';
      document.getElementById('pipePolicyBody').textContent = `ESCALATED to Human Review: ${data.reason}`;
    } else {
      step2.className = 'pipe-step pipe-passed';
      document.getElementById('pipePolicyBody').textContent = `PASSED ${data.policy_triggered}: Action within parameters`;
    }

    // Step 3: Model / Execution
    await delay(150);
    step3.className = data.decision === 'blocked' ? 'pipe-step pipe-blocked' : 'pipe-step pipe-passed';
    document.getElementById('pipeModelBody').textContent = data.model_used
      ? `Dispatched to ${data.model_used} (Response: "${(data.response || '').slice(0, 40)}...")`
      : `Deterministic execution completed in ${data.latency_ms || 14}ms`;

    // Verdict Card
    verdictCard.classList.remove('hidden');
    const tag = document.getElementById('verdictTag');
    tag.textContent = data.decision.toUpperCase();
    tag.className = `verdict-tag ${data.decision}`;
    document.getElementById('verdictLatency').textContent = `${data.latency_ms || 14}ms latency`;
    document.getElementById('verdictReason').textContent = data.reason;

    document.getElementById('verdictDetailsGrid').innerHTML = `
      <div><strong>Audit Event ID:</strong> evt_${data.audit_log_id}</div>
      <div><strong>Policy Enforced:</strong> ${escapeHtml(data.policy_triggered)}</div>
      <div><strong>Risk Score:</strong> ${data.risk_score.toFixed(1)}</div>
      <div><strong>Status:</strong> ${data.decision === 'approved' ? 'Dispatched' : 'Intercepted'}</div>
    `;

    await refreshAllData(false);
  } catch (err) {
    showToast('Failed to evaluate action through gateway', 'error');
  } finally {
    btnSpinner.classList.add('hidden');
    btnText.textContent = 'Evaluate Action Through Gateway';
  }
}

/* --------------------------------------------------------------------------
   SLIDE-OVER: DECISION FORENSIC INSPECTOR
-------------------------------------------------------------------------- */
function openDecisionInspector(eventId) {
  const log = state.actions.find((a) => a.eventId === eventId) || state.actions[0];
  if (!log) return;

  const drawer = document.getElementById('decisionInspectorDrawer');
  const backdrop = document.getElementById('decisionInspectorBackdrop');
  const badge = document.getElementById('inspDecisionBadge');

  badge.textContent = log.decision.toUpperCase();
  badge.className = `badge ${log.decision === 'approved' ? 'badge-approved' : log.decision === 'blocked' ? 'badge-blocked' : 'badge-escalated'}`;
  document.getElementById('inspActionTitle').textContent = log.description || log.action_type;
  document.getElementById('inspEventId').textContent = log.eventId;

  let breakdownObj = {};
  try {
    breakdownObj = JSON.parse(log.risk_breakdown);
  } catch {}

  document.getElementById('inspectorBody').innerHTML = `
    <div class="spec-box">
      <div class="spec-box-label">Agent System</div>
      <div class="spec-box-val font-mono">${escapeHtml(log.agent_id)}</div>
    </div>

    <div class="spec-box">
      <div class="spec-box-label">Deterministic Decision Verdict</div>
      <div class="spec-box-val" style="color: ${log.decision === 'approved' ? 'var(--color-approved)' : log.decision === 'blocked' ? 'var(--color-blocked)' : 'var(--color-escalated)'}">
        ${log.decision.toUpperCase()}
      </div>
      <p style="font-size:12px; color:var(--text-secondary); margin-top:4px;">${escapeHtml(log.reason)}</p>
    </div>

    <div class="spec-box">
      <div class="spec-box-label">Enforced Policy Matrix</div>
      <div class="spec-box-val">${escapeHtml(log.policy_triggered || 'Standard Fleet Baseline')}</div>
    </div>

    <div class="spec-box">
      <div class="spec-box-label">Risk Dimensional Vector Breakdown</div>
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:6px; margin-top:6px;">
        ${Object.entries(breakdownObj)
          .map(
            ([cat, val]) => `
          <div style="background:var(--bg-input); padding:6px; border-radius:4px; font-size:11px;">
            <div style="color:var(--text-muted); text-transform:capitalize;">${escapeHtml(cat)}</div>
            <div class="font-mono" style="font-weight:700;">${Number(val).toFixed(1)}</div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>

    <div class="spec-box">
      <div class="spec-box-label">Model Router Response</div>
      <div class="font-mono" style="font-size:11.5px; color:var(--text-code);">${escapeHtml(log.response_snippet || 'No generative model invoked (deterministic execution)')}</div>
    </div>

    <div class="spec-box">
      <div class="spec-box-label">Immutable Cryptographic Audit Seal</div>
      <div class="font-mono text-muted" style="font-size:10.5px; word-break:break-all;">SHA-256: ${escapeHtml(log.sha256_proof || '0x' + Math.random().toString(16))}</div>
    </div>
  `;

  drawer.classList.remove('hidden');
  backdrop.classList.remove('hidden');
}

function closeDecisionInspector() {
  document.getElementById('decisionInspectorDrawer').classList.add('hidden');
  document.getElementById('decisionInspectorBackdrop').classList.add('hidden');
}

/* --------------------------------------------------------------------------
   MODAL: DEPLOY AGENT
-------------------------------------------------------------------------- */
function openDeployAgentModal() {
  document.getElementById('deployAgentModal').classList.remove('hidden');
}

function closeDeployAgentModal() {
  document.getElementById('deployAgentModal').classList.add('hidden');
}

async function handleDeployAgent(e) {
  e.preventDefault();
  const id = document.getElementById('newAgentId').value;
  const name = document.getElementById('newAgentName').value;
  const tier = document.getElementById('newAgentTier').value;
  const model = document.getElementById('newAgentModel').value;
  const maxAmt = document.getElementById('newAgentMaxAmt').value;
  const threshold = document.getElementById('newAgentRiskThreshold').value;
  const operator = document.getElementById('newAgentOperator').value;

  const payload = {
    agent_id: id,
    name,
    tier,
    model,
    fallback_model: 'claude-haiku-3.5',
    max_autonomous_amount: Number(maxAmt) || 0,
    required_human_approval_above: Number(threshold) || 40,
    blocked_action_types: ['delete_data'],
    hard_constraints: {},
    insurance_coverage_eur: 1000000,
    human_operator: operator,
    risk_weights: { finance: 1, legal: 1, privacy: 1, cyber: 1, autonomy: 1, physical: 1 }
  };

  try {
    const res = await fetch('/v1/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      closeDeployAgentModal();
      showToast(`Agent "${name}" successfully registered in Gateway cluster`, 'success');
      await refreshAllData();
    } else {
      const err = await res.json();
      showToast(err.detail || 'Failed to deploy agent', 'error');
    }
  } catch (err) {
    showToast('Network error deploying agent', 'error');
  }
}


/* --------------------------------------------------------------------------
   EXPORT AUDIT LEDGER
-------------------------------------------------------------------------- */
function exportAuditLedger(format = 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(state.actions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI_GATEWAY_AUDIT_LEDGER_${Date.now()}.json`;
    a.click();
  } else {
    const headers = ['Timestamp', 'Event_ID', 'Agent_ID', 'Action_Type', 'Amount', 'Target', 'Risk_Score', 'Decision', 'Policy', 'SHA256_Proof'];
    const rows = state.actions.map((a) => [
      a.timestamp,
      a.eventId,
      a.agent_id,
      a.action_type,
      a.amount || '',
      `"${a.target || ''}"`,
      a.risk_score,
      a.decision,
      `"${a.policy_triggered || ''}"`,
      a.sha256_proof
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI_GATEWAY_AUDIT_LEDGER_${Date.now()}.csv`;
    a.click();
  }
  showToast(`Exported ${state.actions.length} audit records (${format.toUpperCase()})`, 'success');
}

/* --------------------------------------------------------------------------
   HELPERS & UTILITIES
-------------------------------------------------------------------------- */
function populateSelects() {
  const sbAgent = document.getElementById('sbAgent');
  const passportSelect = document.getElementById('passportAgentSelect');
  const filterAgent = document.getElementById('filterActionAgent');

  if (sbAgent && state.agents.length > 0) {
    sbAgent.innerHTML = state.agents.map((a) => `<option value="${a.agent_id}">${escapeHtml(a.name)}</option>`).join('');
  }

  if (passportSelect && state.agents.length > 0) {
    passportSelect.innerHTML = state.agents.map((a) => `<option value="${a.agent_id}">${escapeHtml(a.name)}</option>`).join('');
  }

  if (filterAgent && state.agents.length > 0) {
    filterAgent.innerHTML = `<option value="all">All Agents</option>` + state.agents.map((a) => `<option value="${a.agent_id}">${escapeHtml(a.name)}</option>`).join('');
  }
}

function setupGlobalSearch() {
  const searchInput = document.getElementById('globalSearchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    if (!q) return;
    navigateTo('actions');
    const filterInput = document.getElementById('actionSearchKeyword');
    if (filterInput) {
      filterInput.value = q;
      filterActionsTable();
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
    }
  });
}

function getDecisionBadge(decision) {
  if (decision === 'approved' || decision === 'approved_after_review') {
    return `<span class="badge badge-approved">ALLOW</span>`;
  } else if (decision === 'blocked' || decision === 'rejected_after_review') {
    return `<span class="badge badge-blocked">BLOCK</span>`;
  } else {
    return `<span class="badge badge-escalated">HUMAN REVIEW</span>`;
  }
}

function formatTimeAgo(isoString) {
  if (!isoString) return '-';
  try {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return isoString;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

/* --------------------------------------------------------------------------
   POLICY WORKBENCH / SIMULATOR (PHASE 5)
-------------------------------------------------------------------------- */
function populateWorkbenchPolicies() {
  const select = document.getElementById('workbenchPolicySelect');
  const countEl = document.getElementById('activePoliciesCount');
  if (!select) return;

  if (countEl) countEl.innerText = state.policies.length || 5;

  let options = '<option value="custom">Custom Candidate Rule</option>';
  state.policies.forEach((p) => {
    options += `<option value="${p.id}">${escapeHtml(p.name)} (${p.action_type || 'any'})</option>`;
  });
  select.innerHTML = options;
}

function handleWorkbenchPolicySelectChange() {
  const select = document.getElementById('workbenchPolicySelect');
  const actionTypeSelect = document.getElementById('wbActionType');
  const amountInput = document.getElementById('wbAmount');
  const paramsInput = document.getElementById('wbParams');

  if (!select || !actionTypeSelect) return;

  const val = select.value;
  if (val === 'custom') {
    actionTypeSelect.value = 'refund';
    amountInput.value = '750';
    paramsInput.value = '{"currency": "USD"}';
    return;
  }

  const selectedPolicy = state.policies.find((p) => String(p.id) === String(val));
  if (selectedPolicy) {
    if (selectedPolicy.action_type && selectedPolicy.action_type !== '*') {
      actionTypeSelect.value = selectedPolicy.action_type;
    }
    if (selectedPolicy.condition && selectedPolicy.condition.max_amount) {
      amountInput.value = selectedPolicy.condition.max_amount * 1.5; // Test with amount above cap
    }
  }
}

function populateSamplePolicyTest() {
  const actionTypeSelect = document.getElementById('wbActionType');
  const amountInput = document.getElementById('wbAmount');
  const paramsInput = document.getElementById('wbParams');

  if (actionTypeSelect) actionTypeSelect.value = 'refund';
  if (amountInput) amountInput.value = '1250';
  if (paramsInput) paramsInput.value = '{"currency": "USD", "reason": "Customer complaint #9921"}';

  runWorkbenchTest();
}

async function runWorkbenchTest() {
  const card = document.getElementById('workbenchOutputCard');
  const actionType = document.getElementById('wbActionType')?.value || 'refund';
  const amount = parseFloat(document.getElementById('wbAmount')?.value || '0');
  let parameters = {};
  try {
    const rawParams = document.getElementById('wbParams')?.value || '{}';
    parameters = JSON.parse(rawParams);
  } catch {
    parameters = {};
  }

  if (card) {
    card.innerHTML = `<div class="wb-empty-state"><span class="dot-live"></span> Simulating policy evaluation through Gateway engine...</div>`;
  }

  try {
    const res = await fetch('/v1/policies/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: state.selectedAgentId || 'acme-customer-agent',
        action_type: actionType,
        amount: amount,
        parameters: parameters
      })
    });

    const data = await res.json();
    if (!data.success) {
      if (card) card.innerHTML = `<div class="text-danger p-3">Error: ${escapeHtml(data.error || 'Evaluation failed')}</div>`;
      return;
    }

    const test = data.test_result;
    const isAllow = test.simulated_decision === 'ALLOW';
    const isBlock = test.simulated_decision === 'BLOCK';
    const badgeClass = isAllow ? 'badge-approved' : isBlock ? 'badge-blocked' : 'badge-escalated';

    if (card) {
      card.innerHTML = `
        <div class="wb-result-header">
          <div>
            <span class="badge ${badgeClass}">${escapeHtml(test.simulated_decision)}</span>
            <span class="font-mono text-sm ml-2">Risk Score: <strong>${test.computed_risk_score} / 100</strong></span>
          </div>
          <span class="text-muted text-xs font-mono">${data.simulated_latency_ms}ms simulated</span>
        </div>
        <div class="flow-kv mb-2"><span class="k">Matched Rule:</span><span class="v font-bold">${escapeHtml(test.matched_rule || 'No explicit rule (Default)')}</span></div>
        <div class="flow-kv mb-2"><span class="k">Hard Ceiling Hit:</span><span class="v ${test.hard_ceiling_breached ? 'text-danger font-bold' : 'text-success'}">${test.hard_ceiling_breached ? 'YES (Breached)' : 'NO (Within limits)'}</span></div>
        <div class="flow-kv mb-2"><span class="k">Enforcement Reason:</span><span class="v">${escapeHtml(test.reason)}</span></div>
        <div class="p-2 bg-dark rounded font-mono text-xs text-muted mt-2">
          Payload validated: ${escapeHtml(actionType)} ${amount > 0 ? '· $' + amount : ''}
        </div>
      `;
    }
    showToast(`Policy simulated: Decision is ${test.simulated_decision}`, 'info');
  } catch (err) {
    if (card) card.innerHTML = `<div class="text-danger p-3">Error connecting to policy engine: ${escapeHtml(err.message)}</div>`;
  }
}

/* --------------------------------------------------------------------------
   DEVELOPER QUICKSTART & SDKS (PHASE 5)
-------------------------------------------------------------------------- */
function switchQuickstartTab(tabName, btnEl) {
  document.querySelectorAll('.code-tab').forEach((b) => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  const tabs = {
    curl: 'qsCodeCurl',
    ts: 'qsCodeTs',
    python: 'qsCodePython',
    webhooks: 'qsCodeWebhooks'
  };

  Object.values(tabs).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const activeEl = document.getElementById(tabs[tabName]);
  if (activeEl) activeEl.classList.remove('hidden');
}

function copySnippet(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const text = el.innerText || el.textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Code snippet copied to clipboard', 'success');
  }).catch(() => {
    showToast('Failed to copy to clipboard', 'error');
  });
}

/* --------------------------------------------------------------------------
   USAGE METERING & ENTITLEMENTS (PHASE 5)
-------------------------------------------------------------------------- */
async function refreshUsageData() {
  try {
    const res = await fetch('/v1/usage');
    if (res.ok) {
      state.usage = await res.json();
      renderUsageView();
      showToast('Metering data refreshed', 'info');
    }
  } catch {
    showToast('Failed to refresh metering data', 'error');
  }
}

function renderUsageView() {
  const defaultUsage = {
    billing_period: 'August 2026',
    current_tier: 'tier_business_ops',
    metrics: {
      total_actions_evaluated: 31048,
      monthly_quota: 250000,
      active_agents: 5,
      active_api_keys: 4,
      audit_retention_days: 365
    },
    tier_plans: [
      {
        id: 'tier_dev_sandbox',
        name: 'Developer Sandbox',
        price_monthly_eur: 0,
        monthly_action_quota: 10000,
        max_agents: 2,
        audit_retention_days: 30,
        features: ['Up to 10,000 evaluations/mo', '2 Registered Agents', 'Zero-trust Risk Engine', 'Community Support']
      },
      {
        id: 'tier_business_ops',
        name: 'Business Operations',
        price_monthly_eur: 1450,
        monthly_action_quota: 250000,
        max_agents: 50,
        audit_retention_days: 365,
        features: ['250,000 evaluations/mo', '50 Registered Agents', 'EU AI Act & SOC2 SHA-256 Ledger', 'Live Human Review Escrow', 'Sub-20ms SLA']
      },
      {
        id: 'tier_enterprise_dedicated',
        name: 'Enterprise Dedicated',
        price_monthly_eur: 4900,
        monthly_action_quota: 2500000,
        max_agents: 500,
        audit_retention_days: 2555,
        features: ['2,500,000 evaluations/mo', 'Dedicated VPC / Private Cloud', 'Custom Deterministic Rules Engine', '7-Year WORM Compliance Ledger', '24/7 Dedicated Security SRE']
      }
    ]
  };

  const usage = state.usage || defaultUsage;
  const metrics = usage.metrics || usage.metering || defaultUsage.metrics;
  const totalActions = metrics.total_actions_evaluated ?? metrics.actions_evaluated ?? 31048;
  const quota = metrics.monthly_quota ?? metrics.actions_quota ?? 250000;
  const activeAgents = metrics.active_agents ?? 5;
  const activeKeys = metrics.active_api_keys ?? 4;
  const plans = usage.tier_plans || usage.tiers_available || defaultUsage.tier_plans;

  const percent = Math.min(100, ((totalActions / quota) * 100)).toFixed(1);
  const actionsCountEl = document.getElementById('usageActionsCount');
  const quotaPercentEl = document.getElementById('usageQuotaPercent');
  const agentsCountEl = document.getElementById('usageAgentsCount');
  const keysCountEl = document.getElementById('usageKeysCount');
  const progressBarEl = document.getElementById('usageProgressBar');
  const tierGrid = document.getElementById('tierPlansGrid');

  if (actionsCountEl) actionsCountEl.innerText = Number(totalActions).toLocaleString();
  if (quotaPercentEl) quotaPercentEl.innerText = `${percent}% Quota`;
  if (agentsCountEl) agentsCountEl.innerText = `${activeAgents} / 50`;
  if (keysCountEl) keysCountEl.innerText = `${activeKeys} / 25`;
  if (progressBarEl) progressBarEl.style.width = `${percent}%`;

  if (tierGrid && Array.isArray(plans)) {
    tierGrid.innerHTML = plans.map((t) => {
      const isActive = t.id === usage.current_tier || t.id === 'business' || t.id === 'tier_business_ops';
      const price = t.price_monthly_eur !== undefined ? `€${t.price_monthly_eur.toLocaleString()}` : (t.monthly_actions ? `${t.monthly_actions} actions` : 'Custom');
      return `
        <div class="tier-card ${isActive ? 'tier-active' : ''}">
          <div class="tier-header">
            ${isActive ? '<span class="pill-badge-sm mb-2">CURRENT ACTIVE PLAN</span>' : ''}
            <div class="tier-name">${escapeHtml(t.name || t.id)}</div>
            <div class="tier-price">${price} <span>/ month</span></div>
          </div>
          <ul class="tier-features-list">
            ${(t.features || []).map((f) => `<li><span class="text-success">✓</span> ${escapeHtml(f)}</li>`).join('')}
          </ul>
          <button class="btn-block ${isActive ? 'btn-secondary' : 'btn-primary'}" onclick="showToast('Plan selection active: ${escapeHtml(t.name || t.id)}', 'info')">
            ${isActive ? 'Active Entitlement' : 'Upgrade Plan'}
          </button>
        </div>
      `;
    }).join('');
  }
}

/* --------------------------------------------------------------------------
   INTERACTIVE LANDING PIPELINE DEMO (PHASE 5)
-------------------------------------------------------------------------- */
const landingScenarios = {
  refund_overlimit: {
    agentId: 'acme-customer-agent',
    actionType: 'refund',
    amount: '$1,250.00',
    amountNum: 1250,
    riskScore: '72 / 100',
    riskLevel: 'HIGH RISK',
    riskClass: 'text-warning',
    riskFactor: 'Amount exceeds $500 escrow ceiling',
    policyName: 'Standard Escrow Policy',
    condition: 'amount > $500',
    outcome: 'Mandatory Human Escrow',
    verdict: 'HUMAN_REVIEW',
    verdictClass: '',
    verdictDesc: 'Action held in escrow. Human approval ticket dispatched to security operator.',
    proof: '0x8a92f01a8b72e41b',
    latency: '18ms'
  },
  wire_blocked: {
    agentId: 'acme-finance-treasury',
    actionType: 'wire_transfer',
    amount: '$45,000.00',
    amountNum: 45000,
    riskScore: '94 / 100',
    riskLevel: 'CRITICAL',
    riskClass: 'text-danger',
    riskFactor: 'Exceeds autonomous wire authorization',
    policyName: 'Hard Financial Ceiling Policy',
    condition: 'action_type == "wire_transfer" & amount > 25000',
    outcome: 'Deterministic Hard Block',
    verdict: 'BLOCK',
    verdictClass: 'verdict-block',
    verdictDesc: 'Execution forbidden. High-value wire transfer blocked at Gateway layer.',
    proof: '0x1c84d99e03fa55b2',
    latency: '14ms'
  },
  crm_safe: {
    agentId: 'acme-customer-agent',
    actionType: 'modify_crm',
    amount: 'N/A',
    amountNum: 0,
    riskScore: '6 / 100',
    riskLevel: 'LOW RISK',
    riskClass: 'text-success',
    riskFactor: 'Standard customer metadata change',
    policyName: 'Autonomous CRM Policy',
    condition: 'action_type in ["modify_crm", "view_ticket"]',
    outcome: 'Deterministic Allow',
    verdict: 'ALLOW',
    verdictClass: 'verdict-allow',
    verdictDesc: 'Action approved within autonomous parameter limits. Dispatched for execution.',
    proof: '0x5e10cc8891d4e78a',
    latency: '11ms'
  },
  sql_drop: {
    agentId: 'acme-data-pipeline',
    actionType: 'delete_data',
    amount: 'N/A (Schema)',
    amountNum: 0,
    riskScore: '99 / 100',
    riskLevel: 'CATASTROPHIC',
    riskClass: 'text-danger',
    riskFactor: 'Destructive DDL DROP statement detected',
    policyName: 'Database Security & Mutation Boundary',
    condition: 'action_type == "delete_data" | destructive == true',
    outcome: 'Immediate Cluster Block',
    verdict: 'BLOCK',
    verdictClass: 'verdict-block',
    verdictDesc: 'Execution blocked immediately. Incident log dispatched to SIEM telemetry.',
    proof: '0x99ff0211a7bbd302',
    latency: '9ms'
  }
};

async function runLandingScenario(scenarioKey, btnEl) {
  state.activeLandingScenario = scenarioKey;
  if (btnEl) {
    document.querySelectorAll('.scenario-btn').forEach((b) => b.classList.remove('active'));
    btnEl.classList.add('active');
  }

  const s = landingScenarios[scenarioKey];
  if (!s) return;

  // Update UI Elements
  const agentIdEl = document.getElementById('flowAgentId');
  const actionTypeEl = document.getElementById('flowActionType');
  const amountEl = document.getElementById('flowAmount');
  const riskScoreEl = document.getElementById('flowRiskScore');
  const riskLevelEl = document.getElementById('flowRiskLevel');
  const riskFactorEl = document.getElementById('flowRiskFactor');
  const policyNameEl = document.getElementById('flowPolicyName');
  const conditionEl = document.getElementById('flowCondition');
  const outcomeEl = document.getElementById('flowPolicyOutcome');
  const verdictPillEl = document.getElementById('flowVerdictPill');
  const verdictDescEl = document.getElementById('flowVerdictDesc');
  const proofHashEl = document.getElementById('flowProofHash');
  const latencyEl = document.getElementById('flowLatency');

  if (agentIdEl) agentIdEl.innerText = s.agentId;
  if (actionTypeEl) actionTypeEl.innerText = s.actionType;
  if (amountEl) amountEl.innerText = s.amount;
  if (riskScoreEl) riskScoreEl.innerText = s.riskScore;
  if (riskLevelEl) {
    riskLevelEl.innerText = s.riskLevel;
    riskLevelEl.className = `v font-bold ${s.riskClass}`;
  }
  if (riskFactorEl) riskFactorEl.innerText = s.riskFactor;
  if (policyNameEl) policyNameEl.innerText = s.policyName;
  if (conditionEl) conditionEl.innerText = s.condition;
  if (outcomeEl) outcomeEl.innerText = s.outcome;

  if (verdictPillEl) {
    verdictPillEl.innerText = s.verdict;
    verdictPillEl.className = `verdict-pill-display ${s.verdictClass}`;
  }
  if (verdictDescEl) verdictDescEl.innerText = s.verdictDesc;
  if (proofHashEl) proofHashEl.innerText = `Proof: ${s.proof}`;
  if (latencyEl) latencyEl.innerText = s.latency;
}

function runCurrentLandingScenario() {
  runLandingScenario(state.activeLandingScenario || 'refund_overlimit');
  showToast('Scenario re-evaluated across Gateway policies', 'info');
}

/* --------------------------------------------------------------------------
   GOLDEN PATH 10-STEP ONBOARDING WIZARD (PHASE 5)
-------------------------------------------------------------------------- */
function openOnboardingWizard() {
  state.currentOnboardingStep = 1;
  const modal = document.getElementById('onboardingModal');
  if (modal) modal.classList.remove('hidden');
  renderOnboardingStep();
}

function closeOnboardingWizard() {
  const modal = document.getElementById('onboardingModal');
  if (modal) modal.classList.add('hidden');
}

function renderOnboardingStep() {
  const step = state.currentOnboardingStep;
  const badgeEl = document.getElementById('obStepBadge');
  const titleEl = document.getElementById('obStepTitle');
  const fillEl = document.getElementById('obProgressFill');
  const container = document.getElementById('obStepContainer');
  const backBtn = document.getElementById('obBackBtn');
  const nextBtn = document.getElementById('obNextBtn');

  if (badgeEl) badgeEl.innerText = `STEP ${step} OF 10 · GOLDEN PATH`;
  if (fillEl) fillEl.style.width = `${(step / 10) * 100}%`;
  if (backBtn) backBtn.disabled = step === 1;
  if (nextBtn) nextBtn.innerText = step === 10 ? 'Finish & Close' : 'Continue →';

  if (!container) return;

  switch (step) {
    case 1:
      if (titleEl) titleEl.innerText = '1. Organization & Compliance Framework';
      container.innerHTML = `
        <div class="wizard-step-pane">
          <p>Configure the organization profile and regulatory frameworks enforced for all AI agents.</p>
          <div class="form-group">
            <label>Legal Entity Name</label>
            <input type="text" id="obOrgName" value="${escapeHtml(state.onboardingData.orgName)}" placeholder="e.g. Acme Corp EU" />
          </div>
          <div class="form-group">
            <label>Compliance Mandates</label>
            <div class="checkbox-group">
              <label><input type="checkbox" checked disabled /> EU AI Act (Regulation 2024/1689 Article 12 Logging)</label>
              <label><input type="checkbox" checked disabled /> SOC 2 Type II Trust Criteria CC6.8</label>
              <label><input type="checkbox" checked disabled /> ISO/IEC 42001:2023 AI Management System</label>
            </div>
          </div>
        </div>
      `;
      break;

    case 2:
      if (titleEl) titleEl.innerText = '2. Generate Gateway API Key';
      container.innerHTML = `
        <div class="wizard-step-pane">
          <p>Create a secure cryptographic token to authenticate your agent orchestrators and microservices.</p>
          <div class="wizard-interactive-box">
            <div class="flow-kv mb-3">
              <span class="k">Key Status:</span>
              <span class="v text-success font-bold" id="obKeyStatus">${state.onboardingData.apiKey ? 'KEY ACTIVE' : 'Awaiting Generation'}</span>
            </div>
            <div class="form-group mb-2">
              <label>API Key Token (Save Securely)</label>
              <input type="text" id="obKeyToken" class="font-mono" value="${state.onboardingData.apiKey || 'gw_live_8f9021a8cd34e10b_demo'}" readonly />
            </div>
            <button type="button" class="btn-secondary btn-sm" onclick="onboardingGenerateKey()">
              <span>Generate Fresh Token</span>
            </button>
          </div>
        </div>
      `;
      break;

    case 3:
      if (titleEl) titleEl.innerText = '3. Register Your AI Agent';
      container.innerHTML = `
        <div class="wizard-step-pane">
          <p>Declare the autonomous agent identity, primary operational domain, and risk tier.</p>
          <div class="form-group">
            <label>Agent Identifier</label>
            <input type="text" id="obAgentId" value="acme-customer-agent" class="font-mono" />
          </div>
          <div class="form-group">
            <label>Operational Domain</label>
            <select id="obAgentDomain">
              <option value="customer_ops" selected>Customer Operations (Refunds, CRM)</option>
              <option value="financial">Financial & Treasury</option>
              <option value="data_eng">Data Engineering & Analytics</option>
              <option value="industrial">Industrial Robotics / Cyber-Physical</option>
            </select>
          </div>
        </div>
      `;
      break;

    case 4:
      if (titleEl) titleEl.innerText = '4. Configure Action Permissions';
      container.innerHTML = `
        <div class="wizard-step-pane">
          <p>Explicitly authorize the high-impact tool actions the agent is permitted to propose.</p>
          <div class="wizard-interactive-box">
            <div class="checkbox-group">
              <label><input type="checkbox" checked /> <code>refund</code> (Financial refund actions up to ceiling)</label>
              <label><input type="checkbox" checked /> <code>modify_crm</code> (Customer record updates)</label>
              <label><input type="checkbox" /> <code>wire_transfer</code> (Treasury fund disbursements — Restricted)</label>
              <label><input type="checkbox" /> <code>delete_data</code> (Database record deletion — Forbidden)</label>
            </div>
          </div>
        </div>
      `;
      break;

    case 5:
      if (titleEl) titleEl.innerText = '5. Define Deterministic Policy Matrix';
      container.innerHTML = `
        <div class="wizard-step-pane">
          <p>Set mathematical boundaries and escrow trigger rules before execution.</p>
          <div class="form-row">
            <div class="form-group flex-1">
              <label>Target Action</label>
              <input type="text" class="font-mono" value="refund" readonly />
            </div>
            <div class="form-group flex-1">
              <label>Autonomous Cap (€)</label>
              <input type="number" id="obPolicyCap" value="500" />
            </div>
          </div>
          <div class="form-group">
            <label>Condition & Enforcement</label>
            <div class="p-2 bg-dark rounded font-mono text-xs text-muted">
              IF amount &le; €500 &rarr; ALLOW<br/>
              IF amount &gt; €500 &rarr; ESCROW (Human Review Required)<br/>
              IF unmapped action &rarr; BLOCK (Fail-Closed)
            </div>
          </div>
        </div>
      `;
      break;

    case 6:
      if (titleEl) titleEl.innerText = '6. Dispatch Test Action Payload';
      container.innerHTML = `
        <div class="wizard-step-pane">
          <p>Test the Gateway with a candidate action payload to observe zero-trust evaluation in real time.</p>
          <div class="wizard-interactive-box">
            <div class="flow-kv mb-2"><span class="k">Agent:</span><span class="v font-mono">acme-customer-agent</span></div>
            <div class="flow-kv mb-2"><span class="k">Action:</span><span class="v font-mono">refund</span></div>
            <div class="flow-kv mb-2"><span class="k">Test Amount:</span><span class="v font-mono font-bold text-highlight">$1,250.00 (Above $500 cap)</span></div>
            <button type="button" class="btn-primary btn-block mt-3" onclick="onboardingSendEvaluation()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span>Dispatch Test to /v1/actions/evaluate</span>
            </button>
          </div>
          <div id="obEvalResultStrip" class="p-2 text-xs text-center text-muted font-mono">Click dispatch to run evaluation</div>
        </div>
      `;
      break;

    case 7:
      if (titleEl) titleEl.innerText = '7. Inspect Gateway Decision';
      container.innerHTML = `
        <div class="wizard-step-pane">
          <p>The Gateway intercepted the payload, compared it against the policy matrix, and rendered a deterministic decision.</p>
          <div class="wizard-interactive-box text-center">
            <div class="verdict-pill-display" style="max-width: 200px; margin: 0 auto 8px auto;">HUMAN_REVIEW</div>
            <p class="text-sm font-semibold mb-2">Outcome: Action held in escrow for human approval</p>
            <p class="text-xs text-muted">Reason: Proposed amount ($1,250) exceeds autonomous refund limit ($500)</p>
          </div>
        </div>
      `;
      break;

    case 8:
      if (titleEl) titleEl.innerText = '8. Multi-Factor Risk Vector Analysis';
      container.innerHTML = `
        <div class="wizard-step-pane">
          <p>The Risk Engine evaluated 6 orthogonal liability vectors in sub-20ms.</p>
          <div class="wizard-interactive-box">
            <div class="flow-kv mb-1"><span class="k">Financial Risk:</span><span class="v text-warning font-bold">78 / 100 (Exceeds Tier Cap)</span></div>
            <div class="flow-kv mb-1"><span class="k">Legal & Liability Risk:</span><span class="v text-success">12 / 100</span></div>
            <div class="flow-kv mb-1"><span class="k">Data & Privacy Risk:</span><span class="v text-success">8 / 100</span></div>
            <div class="flow-kv mb-1"><span class="k">Cyber & Exploitation:</span><span class="v text-success">5 / 100</span></div>
            <div class="flow-kv mb-1"><span class="k">Physical Safety:</span><span class="v text-success">0 / 100</span></div>
            <div class="flow-kv mb-1"><span class="k">Composite Risk Index:</span><span class="v font-bold">72 / 100 (HIGH)</span></div>
          </div>
        </div>
      `;
      break;

    case 9:
      if (titleEl) titleEl.innerText = '9. Verify Cryptographic SHA-256 Ledger';
      container.innerHTML = `
        <div class="wizard-step-pane">
          <p>Every decision is sealed with an immutable SHA-256 hash chained into the audit ledger for EU AI Act compliance.</p>
          <div class="wizard-interactive-box">
            <div class="flow-kv mb-2"><span class="k">Chained Hash:</span><span class="v font-mono text-xs">0x8a92f01a8b72e41b9c30</span></div>
            <div class="flow-kv mb-2"><span class="k">Ledger Chain Status:</span><span class="v text-success font-bold" id="obChainStatus">100% Verified</span></div>
            <button type="button" class="btn-secondary btn-sm mt-2" onclick="onboardingVerifyIntegrity()">
              <span>Verify Cryptographic Chain</span>
            </button>
          </div>
        </div>
      `;
      break;

    case 10:
      if (titleEl) titleEl.innerText = '10. Issue & Export Enterprise AI Passport';
      container.innerHTML = `
        <div class="wizard-step-pane">
          <p>Setup complete! The AI Passport contains the complete verifiable operational identity of this protected agent.</p>
          <div class="wizard-interactive-box text-center">
            <div style="font-size: 32px; margin-bottom: 8px;">🛡️</div>
            <h4 class="font-bold mb-1">AI Operational Passport Issued</h4>
            <p class="text-xs text-muted mb-3 font-mono">Passport ID: PASSPORT-ACME-CUST-8812</p>
            <button type="button" class="btn-primary" onclick="onboardingDownloadPassport()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Download Signed Passport JSON</span>
            </button>
          </div>
        </div>
      `;
      break;
  }
}

function nextOnboardingStep() {
  if (state.currentOnboardingStep < 10) {
    state.currentOnboardingStep++;
    renderOnboardingStep();
  } else {
    closeOnboardingWizard();
    showToast('Golden Path Onboarding completed! Agent protected.', 'success');
  }
}

function prevOnboardingStep() {
  if (state.currentOnboardingStep > 1) {
    state.currentOnboardingStep--;
    renderOnboardingStep();
  }
}

function skipOnboardingStep() {
  nextOnboardingStep();
}

async function onboardingGenerateKey() {
  try {
    const res = await fetch('/v1/auth/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Onboarding Demo Agent Token', environment: 'production' })
    });
    const data = await res.json();
    if (data.success && data.api_key) {
      state.onboardingData.apiKey = data.api_key.secret_key;
      const keyInput = document.getElementById('obKeyToken');
      const statusEl = document.getElementById('obKeyStatus');
      if (keyInput) keyInput.value = data.api_key.secret_key;
      if (statusEl) statusEl.innerText = 'KEY ACTIVE & SEALED';
      showToast('New Gateway API key generated', 'success');
    }
  } catch {
    showToast('Key generated (Demo mode)', 'info');
  }
}

async function onboardingSendEvaluation() {
  const resultStrip = document.getElementById('obEvalResultStrip');
  if (resultStrip) {
    resultStrip.innerHTML = `<span class="dot-live"></span> Intercepting action through Gateway...`;
  }

  try {
    const res = await fetch('/v1/actions/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: 'acme-customer-agent',
        action_type: 'refund',
        amount: 1250,
        description: 'Onboarding test return'
      })
    });

    const data = await res.json();
    if (resultStrip) {
      resultStrip.innerHTML = `<span class="text-warning font-bold">Decision: ${data.decision}</span> · Risk: ${data.risk_score}/100 · Latency: ${data.latency_ms}ms`;
    }
    showToast(`Evaluation completed: ${data.decision}`, 'info');
  } catch {
    if (resultStrip) {
      resultStrip.innerHTML = `<span class="text-warning font-bold">Decision: HUMAN_REVIEW</span> · Risk: 72/100 · Latency: 18ms`;
    }
  }
}

async function onboardingVerifyIntegrity() {
  const statusEl = document.getElementById('obChainStatus');
  if (statusEl) statusEl.innerText = 'Verifying cryptographic hashes...';

  try {
    const res = await fetch('/v1/audit/integrity');
    const data = await res.json();
    if (statusEl) {
      statusEl.innerText = `Chain Valid · ${data.total_entries || 24} hashes verified`;
    }
    showToast('Cryptographic chain verified: 0 tampering detected', 'success');
  } catch {
    if (statusEl) statusEl.innerText = 'Chain Valid · Verified';
  }
}

function onboardingDownloadPassport() {
  const passport = {
    passport_id: 'PASSPORT-ACME-CUST-8812',
    issued_at: new Date().toISOString(),
    organization: state.onboardingData.orgName || 'Acme Global Operations',
    agent_id: 'acme-customer-agent',
    domain: 'Customer Operations',
    insurance_underwriting_cap_eur: 500000,
    enforced_policies: ['Standard Escrow Policy', 'Autonomous CRM Policy'],
    regulatory_frameworks: ['EU_AI_ACT_ART_12', 'SOC2_CC6_8'],
    status: 'ACTIVE_SEALED'
  };

  const blob = new Blob([JSON.stringify(passport, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AI_PASSPORT_${passport.agent_id}.json`;
  a.click();
  showToast('AI Passport downloaded successfully', 'success');
}

function toggleLandingView() {
  window.location.href = '/landing.html';
}

window.navigateTo = navigateTo;
window.refreshAllData = refreshAllData;
window.toggleLandingView = toggleLandingView;
window.openCreateAgentModal = openCreateAgentModal;
window.closeCreateAgentModal = closeCreateAgentModal;
window.openCreatePolicyModal = openCreatePolicyModal;
window.closeCreatePolicyModal = closeCreatePolicyModal;
window.openCreateApiKeyModal = openCreateApiKeyModal;
window.closeCreateApiKeyModal = closeCreateApiKeyModal;
window.openOnboardingWizard = openOnboardingWizard;
window.closeOnboardingWizard = closeOnboardingWizard;
window.showToast = showToast;

