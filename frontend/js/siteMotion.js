/* Hisab presentation only. Ledger values, navigation and the rupee canvas are untouched. */
(() => {
  'use strict';
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const running = new Set();
  const seen = new WeakSet();
  let disabled = false;

  function reveal(element, delay = 0) {
    if (disabled || preference.matches || !window.anime?.animate || !element.getClientRects().length) return;
    const opacity = element.style.opacity;
    let animation, timeout;
    const restore = () => {
      clearTimeout(timeout);
      element.style.opacity = opacity;
      running.delete(stop);
    };
    const stop = () => { try { animation?.cancel(); } finally { restore(); } };
    try {
      running.add(stop);
      // Opacity alone avoids fighting existing transforms, charts or the original 3D scene.
      animation = window.anime.animate(element, {
        opacity: [0.35, 1], duration: 320, delay, ease: 'outQuad',
        onComplete: restore
      });
      timeout = setTimeout(stop, 1200); // Content always recovers if an animation stalls.
    } catch {
      disabled = true;
      stop();
    }
  }

  function scan() {
    if (disabled || preference.matches) return;
    document.querySelectorAll('.hero-overline,.hero-title,.hero-subtext,.hero-actions,.legal-main,.app-view.active .kpi-card,.app-view.active .paper-panel').forEach((el, index) => {
      if (seen.has(el) || !el.getClientRects().length) return;
      seen.add(el);
      reveal(el, Math.min(index * 35, 175));
    });
  }

  function start() {
    scan();
    const observer = new MutationObserver(records => {
      scan();
      for (const record of records) {
        if (record.type === 'attributes' && record.attributeName === 'open' && record.target.matches('dialog[open]')) reveal(record.target);
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches('dialog[open],.form-feedback')) reveal(node);
          node.querySelectorAll('dialog[open],.form-feedback').forEach(el => reveal(el));
        }
      }
    });
    observer.observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['class','open']});
    const stopAll = () => { for (const stop of [...running]) stop(); };
    preference.addEventListener?.('change', () => { if (preference.matches) stopAll(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(); });
    window.addEventListener('pagehide', () => { stopAll(); observer.disconnect(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
