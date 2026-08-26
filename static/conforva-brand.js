(() => {
  'use strict';
  const replacements = new Map([
    ['AI Liability Gateway', 'Conforva'],
    ['AI Liability & Deterministic Gateway', 'Conforva Control Plane'],
    ['AILG', 'CONFORVA'],
    ['Gateway Active · 99.99%', 'Control plane active'],
    ['Pending Human Escalations', 'Pending automated reviews'],
    ['Human Review', 'AI Review'],
    ['Human Escalations', 'AI Reviews'],
    ['escalations', 'reviews']
  ]);

  const replaceText = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      let value = node.nodeValue;
      for (const [from, to] of replacements) value = value.split(from).join(to);
      if (value !== node.nodeValue) node.nodeValue = value;
    }
  };

  const cleanLabels = () => {
    document.title = 'Conforva Control Plane';
    document.querySelectorAll('[title], [aria-label], input[placeholder]').forEach(el => {
      for (const attr of ['title', 'aria-label', 'placeholder']) {
        if (!el.hasAttribute(attr)) continue;
        let value = el.getAttribute(attr);
        for (const [from, to] of replacements) value = value.split(from).join(to);
        el.setAttribute(attr, value);
      }
    });
    replaceText(document.body);
  };

  const installProductIdentity = () => {
    document.documentElement.dataset.product = 'conforva';
    const brand = document.querySelector('.brand-name');
    if (brand) brand.innerHTML = 'CONFORVA <span class="brand-badge">CONTROL PLANE</span>';
    const sub = document.querySelector('.brand-sub');
    if (sub) sub.textContent = 'Autonomous AI control infrastructure';

    const nav = document.querySelector('.sidebar-nav');
    if (nav && !document.getElementById('navControlProfiles')) {
      const item = document.createElement('a');
      item.id = 'navControlProfiles';
      item.href = '#agents';
      item.className = 'nav-item conforva-product-link';
      item.innerHTML = '<span class="conforva-nav-mark">◆</span><span>Control Profiles</span><span class="nav-counter">v1</span>';
      item.addEventListener('click', () => {
        const agents = document.querySelector('[data-view="agents"]');
        if (agents) agents.click();
      });
      nav.appendChild(item);
    }

    if (!document.getElementById('conforvaIdentityStyle')) {
      const style = document.createElement('style');
      style.id = 'conforvaIdentityStyle';
      style.textContent = `
        [data-product="conforva"] .conforva-product-link { margin-top: 8px; border-top: 1px solid rgba(255,255,255,.07); padding-top: 11px; }
        [data-product="conforva"] .conforva-nav-mark { width:16px; display:inline-flex; justify-content:center; font-size:9px; color:#9aa9ff; }
        [data-product="conforva"] .brand-name { letter-spacing:.12em; }
      `;
      document.head.appendChild(style);
    }
  };

  const boot = () => { cleanLabels(); installProductIdentity(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
  new MutationObserver(() => { cleanLabels(); installProductIdentity(); }).observe(document.documentElement, { childList: true, subtree: true });
})();