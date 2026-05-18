/* ════════════════════════════════════════════════════════════
   Juice — micro-interactions, confetti, ripples, count-ups
   ════════════════════════════════════════════════════════════ */

const Juice = (function() {

  // ── Confetti ──────────────────────────────────────────────
  const CONFETTI_COLORS = ['#1E6B4B','#2E8B57','#A7D7B7','#FFC1C1','#F2B23A','#FFFFFF'];
  function confetti(count = 60) {
    const host = document.getElementById('confetti-host');
    if (!host) return;
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('span');
      const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      const startX = (Math.random() * w);
      const startY = -20 - Math.random() * 80;
      const cx = (Math.random() - 0.5) * w * 0.7;
      const dur = 1200 + Math.random() * 1200;
      const delay = Math.random() * 200;
      const size = 8 + Math.random() * 8;
      piece.style.left = startX + 'px';
      piece.style.top = startY + 'px';
      piece.style.width = size + 'px';
      piece.style.height = (size * 1.4) + 'px';
      piece.style.background = color;
      piece.style.setProperty('--cx', cx + 'px');
      piece.style.animationDuration = dur + 'ms';
      piece.style.animationDelay = delay + 'ms';
      piece.style.borderRadius = (i % 3 === 0) ? '50%' : '2px';
      host.appendChild(piece);
      setTimeout(() => piece.remove(), dur + delay + 100);
    }
  }

  // ── Ripple ────────────────────────────────────────────────
  function attachRipple(el) {
    if (!el || el.dataset.rippleAttached === '1') return;
    el.dataset.rippleAttached = '1';
    el.classList.add('ripple-host');
    el.addEventListener('click', (e) => {
      const rect = el.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      const x = (e.clientX - rect.left) - size / 2;
      const y = (e.clientY - rect.top) - size / 2;
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      el.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    });
  }

  // ── Count up ──────────────────────────────────────────────
  function countTo(el, target, opts = {}) {
    if (!el) return;
    const { duration = 700, decimals = 0, suffix = '' } = opts;
    const start = parseFloat(el.dataset.cur || el.textContent) || 0;
    const numTarget = parseFloat(target);
    if (isNaN(numTarget)) { el.textContent = target; return; }
    const startTs = performance.now();
    function step(ts) {
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = start + (numTarget - start) * eased;
      el.textContent = v.toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(step);
      else { el.dataset.cur = numTarget; }
    }
    requestAnimationFrame(step);
  }

  // ── Pop (one-shot bump) ───────────────────────────────────
  function pop(el, scale = 1.12) {
    if (!el) return;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = `pop-bump .35s cubic-bezier(0.34,1.56,0.64,1)`;
    setTimeout(() => { el.style.animation = ''; }, 360);
  }

  // ── Initialize page-wide ripples & micro-fx ───────────────
  function init() {
    // Add ripple to primary action buttons
    const rippleSelectors = ['.btn-search','.locate-btn','.btn-auth-submit','.ptab-add-btn','.upsell-cta','.verify-btn'];
    rippleSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(attachRipple);
    });

    // Re-scan when DOM mutates (new cards etc)
    const obs = new MutationObserver(() => {
      rippleSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(attachRipple);
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // Pepe wiggle on hover
    const pepe = document.getElementById('pepe-char');
    if (pepe) {
      pepe.addEventListener('mouseenter', () => {
        const inner = pepe.querySelector('.pepe-char-inner');
        if (inner) {
          inner.style.animation = 'none';
          void inner.offsetWidth;
          inner.style.animation = 'wiggle .6s ease-in-out, pepe-bob 3.6s ease-in-out 0.6s infinite';
        }
      });
    }

    // Pop the header logo on click
    const logo = document.querySelector('.logo-mark');
    if (logo) {
      logo.style.cursor = 'pointer';
      logo.addEventListener('click', () => { pop(logo); window.Pepe && Pepe.tip && Pepe.tip(); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

  return { confetti, attachRipple, countTo, pop };
})();

window.Juice = Juice;
