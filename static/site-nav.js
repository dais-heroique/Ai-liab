/* Conforva — shared mobile navigation.
   Works on every page that has <header class="nav">. If the header has no
   hamburger button, one is created. The mobile menu is built from the
   header's own links, so each page keeps its own navigation. */
(() => {
  const BREAKPOINT = 800;

  document.querySelectorAll('header.nav').forEach((header, index) => {
    if (header.dataset.navReady) return;
    header.dataset.navReady = '1';

    let menu = header.querySelector('.menu');
    if (!menu) {
      menu = document.createElement('button');
      menu.className = 'menu';
      header.appendChild(menu);
    }
    menu.type = 'button';
    menu.setAttribute('aria-label', 'Ouvrir le menu');
    menu.setAttribute('aria-expanded', 'false');
    menu.innerHTML = '<span class="menu-icon" aria-hidden="true"><i></i><i></i><i></i></span>';

    const panel = document.createElement('div');
    panel.className = 'mobile-nav';
    panel.id = `mobile-nav-${index}`;
    panel.hidden = true;
    header.appendChild(panel);
    menu.setAttribute('aria-controls', panel.id);

    // Built at each opening so links added later by other scripts are included.
    const build = () => {
      const seen = new Set();
      const items = [];
      header.querySelectorAll('nav a, .nav-actions a').forEach((link) => {
        const href = link.getAttribute('href');
        const label = link.textContent.replace(/[↗→↓]/g, '').trim();
        if (!href || !label || seen.has(href)) return;
        seen.add(href);
        const item = document.createElement('a');
        item.href = href;
        item.textContent = label;
        if (link.classList.contains('button')) item.className = 'mobile-cta';
        items.push(item);
      });
      // Keep the call-to-action at the bottom.
      items.sort((a, b) => a.classList.contains('mobile-cta') - b.classList.contains('mobile-cta'));
      panel.replaceChildren(...items);
    };

    const setOpen = (open) => {
      if (open) build();
      header.classList.toggle('open', open);
      panel.hidden = !open;
      menu.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    };

    menu.addEventListener('click', (event) => {
      event.stopPropagation();
      setOpen(panel.hidden);
    });
    panel.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('click', (event) => {
      if (!panel.hidden && !header.contains(event.target)) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) {
        setOpen(false);
        menu.focus();
      }
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > BREAKPOINT && !panel.hidden) setOpen(false);
    });
  });
})();
