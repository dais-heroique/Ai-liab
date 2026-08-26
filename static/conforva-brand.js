(() => {
  'use strict';

  const boot = () => {
    document.documentElement.dataset.product = 'conforva';
    document.title = 'Conforva — Control Plane';

    const brand = document.querySelector('.brand-name');
    if (brand) brand.innerHTML = 'CONFORVA <span class="brand-badge">CONTROL PLANE</span>';

    const sub = document.querySelector('.brand-sub');
    if (sub) sub.textContent = 'Autonomous AI control infrastructure';

    const health = document.querySelector('.status-pill .status-text');
    if (health) health.textContent = 'Control plane operational';

    document.querySelectorAll('[title], [aria-label], input[placeholder]').forEach((el) => {
      for (const attr of ['title', 'aria-label', 'placeholder']) {
        if (!el.hasAttribute(attr)) continue;
        const value = el.getAttribute(attr) || '';
        el.setAttribute(attr, value
          .replaceAll('AI Liability Gateway', 'Conforva')
          .replaceAll('AI Liability & Deterministic Gateway', 'Conforva Control Plane')
          .replaceAll('AILG', 'CONFORVA'));
      }
    });

    document.querySelectorAll('.brand-cluster').forEach((el) => {
      el.setAttribute('aria-label', 'Open Conforva overview');
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      if (!el.dataset.cfKeyboard) {
        el.dataset.cfKeyboard = '1';
        el.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            window.navigateTo?.('overview');
          }
        });
      }
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
