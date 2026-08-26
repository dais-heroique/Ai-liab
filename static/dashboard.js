/* Conforva dashboard entrypoint — intentionally small. */
(() => {
  const load = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

  const init = async () => {
    try {
      await load('/static/dashboard-core.js');
    } catch (error) {
      console.error('Conforva failed to load dashboard core', error);
      const app = document.getElementById('app');
      if (app) app.innerHTML = '<main style="padding:32px;font:15px system-ui">Unable to load the control plane. Refresh and try again.</main>';
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
