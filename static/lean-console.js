(() => {
  'use strict';

  function boot() {
    // Make core actions reliably available to inline handlers and lightweight UI controls.
    if (typeof navigateTo === 'function') window.navigateTo = navigateTo;
    if (typeof refreshAllData === 'function') window.refreshAllData = refreshAllData;
    if (typeof toggleLandingView === 'function') window.toggleLandingView = toggleLandingView;
    if (typeof setupNavigation === 'function') window.setupNavigation = setupNavigation;

    document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
      if (item.dataset.leanBound) return;
      item.dataset.leanBound = '1';
      item.addEventListener('click', (event) => {
        const view = item.dataset.view;
        if (!view || typeof navigateTo !== 'function') return;
        event.preventDefault();
        navigateTo(view);
      });
    });

    document.querySelector('.brand-cluster')?.addEventListener('click', () => {
      if (typeof navigateTo === 'function') navigateTo('overview');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
