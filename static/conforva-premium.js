(() => {
  'use strict';

  const PRODUCT = 'Conforva';

  const css = `
    :root {
      --cf-ink: #171a1f;
      --cf-muted: #727b88;
      --cf-line: #e5e8ed;
      --cf-blue: #2457d6;
      --cf-blue-soft: #eef3ff;
    }

    [data-product="conforva"] .app-container { background: #f7f8fa; }
    [data-product="conforva"] .topbar { height: 60px; flex-basis: 60px; }
    [data-product="conforva"] .main-content { padding-top: 34px; }
    [data-product="conforva"] .page-title { font-size: 27px; letter-spacing: -.05em; }
    [data-product="conforva"] .page-subtitle { max-width: 700px; line-height: 1.65; }
    [data-product="conforva"] .metric-card { min-height: 96px; }
    [data-product="conforva"] .metric-val { font-size: 25px; }

    [data-product="conforva"] .status-pill {
      border-color: #dfe5ea;
      background: #fff;
      color: #4d5865;
    }
    [data-product="conforva"] .status-pill .pulse-dot { background: #2d8b61; }

    [data-product="conforva"] .nav-item.active {
      background: #eef3fb;
      color: #1d4ed8;
      box-shadow: inset 2px 0 0 #2457d6;
    }
    [data-product="conforva"] .nav-item.highlight-nav {
      background: #f3f6fb !important;
      color: #1d4ed8 !important;
      border: 1px solid #e0e6f0;
    }

    .cf-attention {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 18px;
      padding: 15px 17px;
      border: 1px solid var(--cf-line);
      border-radius: 10px;
      background: #fff;
    }
    .cf-attention-copy { min-width: 0; }
    .cf-attention-eyebrow {
      font-size: 8px;
      font-weight: 750;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: #8a929d;
    }
    .cf-attention-title {
      margin-top: 3px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: -.015em;
    }
    .cf-attention-sub { margin-top: 3px; font-size: 10px; color: var(--cf-muted); }
    .cf-attention-actions { display: flex; gap: 7px; flex-wrap: wrap; justify-content: flex-end; }
    .cf-attention-actions button {
      min-height: 32px;
      padding: 6px 10px;
      border: 1px solid #d9dee6;
      border-radius: 7px;
      background: #fff;
      color: #3f4752;
      font-size: 10px;
      font-weight: 650;
    }
    .cf-attention-actions button:hover { background: #f7f9fb; border-color: #c7ced8; }
    .cf-attention-actions button.cf-primary { background: #20242b; border-color: #20242b; color: #fff; }

    .cf-posture {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      margin-top: 10px;
      padding: 5px 8px;
      border: 1px solid #e1e5ea;
      border-radius: 999px;
      background: #fff;
      color: #5f6976;
      font-size: 9px;
    }
    .cf-posture-dot { width: 6px; height: 6px; border-radius: 50%; background: #2d8b61; }

    [data-product="conforva"] :focus-visible {
      outline: 2px solid #2457d6;
      outline-offset: 2px;
    }
    [data-product="conforva"] button:disabled,
    [data-product="conforva"] input:disabled,
    [data-product="conforva"] select:disabled,
    [data-product="conforva"] textarea:disabled {
      cursor: not-allowed;
      opacity: .52;
    }

    @media (max-width: 800px) {
      .cf-attention { grid-template-columns: 1fr; }
      .cf-attention-actions { justify-content: flex-start; }
      [data-product="conforva"] .main-content { padding-top: 22px; }
    }

    @media (prefers-reduced-motion: reduce) {
      [data-product="conforva"] *, [data-product="conforva"] *::before, [data-product="conforva"] *::after {
        animation-duration: .01ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: .01ms !important;
      }
    }
  `;

  function installStyle() {
    if (document.getElementById('conforvaPremiumStyle')) return;
    const style = document.createElement('style');
    style.id = 'conforvaPremiumStyle';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function text(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  function simplifyNavigation() {
    const labels = {
      overview: 'Overview',
      agents: 'Agents',
      policies: 'Policies',
      actions: 'Activity',
      risk: 'Risk',
      escalations: 'Reviews',
      incidents: 'Incidents',
      passport: 'Passports',
      audit: 'Audit',
      sandbox: 'Sandbox',
      quickstart: 'Quickstart',
      usage: 'Usage',
      integrations: 'Integrations',
      'api-keys': 'API keys',
      settings: 'Settings'
    };

    Object.entries(labels).forEach(([view, label]) => {
      const item = document.querySelector(`.nav-item[data-view="${view}"]`);
      if (!item) return;
      const span = item.querySelector('span:not(.nav-counter)');
      if (span) span.textContent = label;
    });

    document.querySelectorAll('.sidebar-section-title').forEach((el, index) => {
      el.textContent = index === 0 ? 'CONTROL' : 'PLATFORM';
    });

    const oldProductLink = document.getElementById('navControlProfiles');
    if (oldProductLink) oldProductLink.remove();

    const sandbox = document.querySelector('.nav-item[data-view="sandbox"]');
    if (sandbox) sandbox.classList.add('highlight-nav');
  }

  function cleanClaims() {
    document.querySelectorAll('.status-text').forEach((el) => {
      if (/99\.99%|SLA|zero-latency/i.test(el.textContent || '')) el.textContent = 'Control plane operational';
    });

    document.querySelectorAll('*').forEach((el) => {
      if (el.children.length !== 0) return;
      const value = el.textContent || '';
      if (/Underwriting Insurance Coverage|Active Liability Pool/i.test(value)) {
        el.textContent = 'Execution boundary';
      }
      if (/guarantee|never be liable|eliminate liability|zero liability/i.test(value)) {
        el.textContent = value.replace(/guarantee/gi, 'control').replace(/never be liable/gi, 'reduce uncontrolled execution risk').replace(/eliminate liability/gi, 'reduce uncontrolled execution risk').replace(/zero liability/gi, 'controlled execution');
      }
    });
  }

  function installAttentionRail() {
    const overview = document.getElementById('view-overview');
    if (!overview || document.getElementById('cfAttention')) return;

    const metrics = document.getElementById('metricActiveAgents')?.closest('.metrics-strip, .metrics-grid, .metric-grid');
    if (!metrics) return;

    const rail = document.createElement('section');
    rail.id = 'cfAttention';
    rail.className = 'cf-attention';
    rail.setAttribute('aria-live', 'polite');
    rail.innerHTML = `
      <div class="cf-attention-copy">
        <div class="cf-attention-eyebrow">Control posture</div>
        <div class="cf-attention-title" id="cfAttentionTitle">Loading current posture…</div>
        <div class="cf-attention-sub" id="cfAttentionSub">Checking reviews and incidents from the control plane.</div>
        <span class="cf-posture"><span class="cf-posture-dot"></span><span id="cfPostureText">Operational</span></span>
      </div>
      <div class="cf-attention-actions">
        <button id="cfReviewBtn" type="button">Open reviews</button>
        <button id="cfIncidentBtn" type="button">View incidents</button>
      </div>`;

    metrics.parentNode.insertBefore(rail, metrics);
    document.getElementById('cfReviewBtn')?.addEventListener('click', () => window.navigateTo?.('escalations'));
    document.getElementById('cfIncidentBtn')?.addEventListener('click', () => window.navigateTo?.('incidents'));
  }

  function updateAttentionRail() {
    const rail = document.getElementById('cfAttention');
    if (!rail) return;

    const data = (window.state && window.state.overview) ? window.state.overview : {};
    const pending = Number(data?.pending_escalations || 0);
    const incidents = Number(data?.open_incidents || 0);

    const title = document.getElementById('cfAttentionTitle');
    const sub = document.getElementById('cfAttentionSub');
    const posture = document.getElementById('cfPostureText');
    const reviewBtn = document.getElementById('cfReviewBtn');
    const incidentBtn = document.getElementById('cfIncidentBtn');

    if (title) {
      if (pending > 0) title.textContent = `${pending} action${pending === 1 ? '' : 's'} require human authorization`;
      else if (incidents > 0) title.textContent = `${incidents} incident${incidents === 1 ? '' : 's'} require investigation`;
      else title.textContent = 'No immediate control action required';
    }
    if (sub) sub.textContent = incidents > 0 ? 'Review active incidents and preserve the decision trail.' : 'Recent decisions are being evaluated against active policy controls.';
    if (posture) posture.textContent = pending > 0 || incidents > 0 ? 'Attention required' : 'Operational';
    if (reviewBtn) reviewBtn.classList.toggle('cf-primary', pending > 0);
    if (incidentBtn) incidentBtn.classList.toggle('cf-primary', incidents > 0 && pending === 0);
    if (reviewBtn) reviewBtn.textContent = pending > 0 ? `Review ${pending}` : 'Open reviews';
    if (incidentBtn) incidentBtn.textContent = incidents > 0 ? `Incidents ${incidents}` : 'View incidents';
  }

  function simplifyOverview() {
    const totalActions = document.getElementById('metricTotalActions');
    const card = totalActions?.closest('.metric-card, .stat-card');
    if (card) card.setAttribute('hidden', 'hidden');

    text('#view-overview .page-title', 'Overview');
    text('#view-overview .page-subtitle', 'A concise view of agent health, control decisions and issues that need operator attention.');
  }

  function improveForms() {
    document.querySelectorAll('select').forEach((select) => {
      if (!select.getAttribute('aria-label')) {
        const label = select.closest('.form-group')?.querySelector('label');
        if (label?.textContent) select.setAttribute('aria-label', label.textContent.trim());
      }
    });
    document.querySelectorAll('input, textarea').forEach((field) => {
      if (field.hasAttribute('required')) field.setAttribute('aria-required', 'true');
    });
  }

  function boot() {
    document.documentElement.dataset.product = 'conforva';
    document.title = 'Conforva — Control Plane';
    installStyle();
    simplifyNavigation();
    cleanClaims();
    simplifyOverview();
    installAttentionRail();
    improveForms();
    updateAttentionRail();

    setInterval(() => {
      simplifyNavigation();
      cleanClaims();
      installAttentionRail();
      updateAttentionRail();
      improveForms();
    }, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
