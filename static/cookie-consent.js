(() => {
  const KEY = 'conforva_cookie_consent_v1';
  const store = {
    get() { try { return localStorage.getItem(KEY); } catch { return null; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch { /* storage blocked */ } },
  };

  const nav = document.querySelector('.nav nav');
  if (nav && !nav.querySelector('a[href="/chat"]')) nav.insertAdjacentHTML('beforeend', '<a href="/chat">Chat privé</a>');
  const footerNav = document.querySelector('footer nav');
  if (footerNav && !footerNav.querySelector('a[href="/faq"]')) {
    footerNav.insertAdjacentHTML('beforeend', '<a href="/faq">FAQ</a><a href="/privacy">Confidentialité</a><a href="/terms">Conditions</a>');
  }

  function analytics() {
    if (window.__conforvaAnalyticsLoaded) return;
    window.__conforvaAnalyticsLoaded = true;
    const s = document.createElement('script');
    s.src = '/_vercel/insights/script.js';
    s.defer = true;
    document.head.appendChild(s);
  }

  const choice = store.get();
  if (choice === 'accepted') analytics();
  if (choice || document.querySelector('[data-cookie-banner]')) return;

  const banner = document.createElement('aside');
  banner.dataset.cookieBanner = '';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Préférences de cookies');
  banner.innerHTML = '<strong>Votre confidentialité compte.</strong><p>Les mesures non essentielles restent désactivées par défaut.</p><div><button type="button" data-v="refused">Continuer sans</button><button type="button" data-v="accepted">Accepter les statistiques</button><a href="/privacy">Politique de confidentialité</a></div>';
  Object.assign(banner.style, {
    position: 'fixed', left: '16px', right: '16px', bottom: '16px', zIndex: 9999,
    maxWidth: '560px', margin: '0 auto', padding: '16px', background: '#0b0d10', color: '#fff',
    border: '1px solid #30353d', borderRadius: '12px', boxShadow: '0 20px 60px #0005',
    font: '12px Inter,system-ui,sans-serif',
  });
  banner.querySelector('p').style.cssText = 'margin:6px 0 12px;color:#aeb4bc';
  banner.querySelector('div').style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px';
  banner.querySelector('a').style.cssText = 'color:#aeb4bc;font-size:11px;text-underline-offset:3px';
  banner.querySelectorAll('button').forEach((btn) => {
    btn.style.cssText = 'padding:9px 12px;border-radius:7px;border:1px solid #4a515b;background:#161a20;color:#fff;cursor:pointer;font:inherit';
    btn.addEventListener('click', () => {
      store.set(btn.dataset.v);
      banner.remove();
      if (btn.dataset.v === 'accepted') analytics();
    });
  });
  document.body.appendChild(banner);
})();
