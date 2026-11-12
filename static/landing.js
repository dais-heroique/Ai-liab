/* Conforva — landing page behaviour.
   The mobile menu lives in site-nav.js (shared by every page). */
(() => {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  /* Reveal sections */
  const reveals = document.querySelectorAll('.reveal');
  reveals.forEach((el) => el.classList.add('in-view'));
  document.body.classList.add('loaded');

  /* "How it works" flow: cycle the active node */
  const flow = document.querySelector('[data-flow]');
  if (flow && !reduce) {
    const nodes = [...flow.querySelectorAll('.node')];
    let i = 1;
    setInterval(() => {
      nodes.forEach((n) => n.classList.remove('active'));
      nodes[i % nodes.length].classList.add('active');
      i++;
    }, 2200);
  }

  /* Magnetic buttons (pointer devices only) */
  if (!reduce && window.matchMedia?.('(hover: hover)').matches) {
    document.querySelectorAll('.magnetic').forEach((el) => {
      let raf = 0;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.07;
        const y = (e.clientY - r.top - r.height / 2) * 0.07;
        if (!raf) raf = requestAnimationFrame(() => {
          el.style.transform = `translate3d(${x}px,${y}px,0)`;
          raf = 0;
        });
      });
      el.addEventListener('pointerleave', () => {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        el.style.transform = '';
      });
    });
  }

  /* FAQ: only one answer open at a time */
  const faqItems = document.querySelectorAll('.faq details');
  faqItems.forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) faqItems.forEach((o) => { if (o !== d) o.open = false; });
  }));

  /* Verification demo (simulation only — nothing is sent) */
  const demo = document.querySelector('[data-verification-demo]');
  const run = demo?.querySelector('[data-run-demo]');
  if (demo && run) {
    const $ = (sel) => demo.querySelector(sel);
    const node = (name) => demo.querySelector(`[data-demo-node="${name}"]`);
    const runLabel = $('[data-run-label]');
    const step1 = $('[data-demo-step1]');
    const step2 = $('[data-demo-step2]');
    const result = $('[data-demo-result]');
    const status = $('[data-demo-status]');
    const log = $('[data-demo-log]');
    const progress = $('[data-demo-progress]');
    const decision = node('decision');
    const decisionLabel = $('[data-demo-decision]');
    const explain = $('[data-demo-explain]');
    const limit = $('[data-demo-limit]');

    const initial = {
      step1: step1.textContent,
      step2: step2.textContent,
      explain: explain.textContent,
      status: status.textContent,
    };

    let timers = [];
    let startedAt = 0;
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

    const narrow = () => window.innerWidth <= 800;
    const keepVisible = (el) => {
      if (!el || !narrow()) return;
      const r = el.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight - 20) {
        el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      }
    };
    const focus = (el) => {
      demo.querySelectorAll('.demo-focus').forEach((n) => n.classList.remove('demo-focus'));
      el?.classList.add('demo-focus');
      keepVisible(el);
    };
    const addLog = (text, kind = '') => {
      const li = document.createElement('li');
      if (kind) li.className = kind;
      const t = ((performance.now() - startedAt) / 1000).toFixed(2).replace('.', ',');
      li.innerHTML = `<time>+${t} s</time><span></span>`;
      li.querySelector('span').textContent = text;
      log.appendChild(li);
    };
    const setProgress = (pct) => { progress.style.width = `${pct}%`; };

    const reset = () => {
      clearTimers();
      demo.classList.remove('running', 'done');
      demo.querySelectorAll('.demo-focus,.demo-answer').forEach((n) => n.classList.remove('demo-focus', 'demo-answer'));
      decision.classList.remove('is-blocked');
      limit.classList.remove('context-hit');
      result.classList.remove('is-yes');
      step1.textContent = initial.step1;
      step2.textContent = initial.step2;
      result.textContent = 'EN ATTENTE';
      decisionLabel.textContent = 'EN ATTENTE';
      explain.textContent = initial.explain;
      log.replaceChildren();
      setProgress(0);
    };

    const steps = [
      { at: 0, run: () => {
        focus(node('input'));
        status.textContent = 'Lecture de la demande…';
        addLog('Demande reçue de l’application SAV');
        setProgress(8);
      } },
      { at: 600, run: () => {
        focus(node('step1'));
        step1.textContent = 'Remboursement · 750 €';
        status.textContent = '01 · Action identifiée';
        addLog('Action identifiée : remboursement de 750 € sur carte');
        setProgress(25);
      } },
      { at: 1300, run: () => {
        focus(node('step2'));
        step2.textContent = '…';
        status.textContent = '02 · L’IA principale reformule la demande…';
        setProgress(40);
      } },
      { at: 1800, run: () => {
        step2.textContent = '« Rembourser 750 € au client, sur sa carte »';
        addLog('Reformulation produite par l’IA principale');
        setProgress(52);
      } },
      { at: 2400, run: () => {
        focus(node('step3'));
        result.textContent = '…';
        status.textContent = '03 · Une IA indépendante compare la demande et la reformulation…';
        setProgress(64);
      } },
      { at: 2950, run: () => {
        result.textContent = 'YES ✓';
        result.classList.add('is-yes');
        addLog('Compréhension validée par l’IA indépendante (YES)', 'ok');
        setProgress(76);
      } },
      { at: 3500, run: () => {
        focus(node('context'));
        limit.classList.add('context-hit');
        status.textContent = 'Règles déterministes — limite de remboursement de l’agent…';
        addLog('Règle refund_limit : 750 € > 500 € autorisés', 'ko');
        setProgress(90);
      } },
      { at: 4200, run: () => finish() },
    ];

    const finish = () => {
      clearTimers();
      demo.querySelectorAll('.demo-focus').forEach((n) => n.classList.remove('demo-focus'));
      decision.classList.add('demo-answer', 'is-blocked');
      decisionLabel.textContent = 'ACTION BLOQUÉE';
      explain.textContent = 'La demande est bien comprise, mais 750 € dépasse l’autorisation de support-agent (500 €). La règle déterministe reste prioritaire : le remboursement n’est pas exécuté et la décision est enregistrée dans l’historique.';
      status.textContent = 'Simulation terminée — compréhension validée, action bloquée par la règle refund_limit.';
      if (!log.querySelector('.final')) addLog('Décision : BLOCK — enregistrée dans l’historique', 'ko final');
      setProgress(100);
      demo.classList.remove('running');
      demo.classList.add('done');
      run.disabled = false;
      run.removeAttribute('aria-busy');
      runLabel.textContent = 'Relancer la simulation';
      if (!reduce) keepVisible(decision);
    };

    run.addEventListener('click', () => {
      reset();
      startedAt = performance.now();
      run.disabled = true;
      run.setAttribute('aria-busy', 'true');
      runLabel.textContent = 'Vérification en cours…';
      demo.classList.add('running');
      if (reduce) {
        steps.slice(0, -1).forEach((s) => s.run());
        finish();
        return;
      }
      steps.forEach((s) => timers.push(setTimeout(s.run, s.at)));
    });

    status.textContent = initial.status;
  }

  /* Cookie consent */
  const consent = document.createElement('script');
  consent.src = '/static/cookie-consent.js';
  consent.defer = true;
  document.body.appendChild(consent);
})();
