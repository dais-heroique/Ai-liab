/* Conforva dashboard entrypoint. Keep the shell light and load the core once. */
(() => {
  const init = () => {
    if (window.__conforvaCoreLoaded) return;
    window.__conforvaCoreLoaded = true;
    const script = document.createElement('script');
    script.src = '/static/dashboard-core.js';
    script.async = false;
    script.onerror = () => {
      console.error('Conforva dashboard core failed to load');
      const app = document.getElementById('app');
      if (app) app.innerHTML = '<main style="padding:40px;font:15px system-ui">Control plane unavailable. Please refresh.</main>';
    };
    document.body.appendChild(script);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
