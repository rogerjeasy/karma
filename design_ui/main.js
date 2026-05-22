/* ═══════════════════════════════════════════════════
   KARMA — Fire Protocol · main.js
═══════════════════════════════════════════════════ */

/* ─── Nav scroll state ─────────────────────────── */
const nav = document.getElementById('nav');
const onScroll = () => {
  nav.classList.toggle('scrolled', window.scrollY > 16);
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ─── Scroll reveal ─────────────────────────────── */
const revealObs = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
  { threshold: 0.1, rootMargin: '0px 0px -56px 0px' }
);
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

/* ─── Stats count-up ─────────────────────────────── */
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function runCountUp(el, target, duration = 1600) {
  let start = null;
  function step(ts) {
    if (!start) start = ts;
    const p = Math.min((ts - start) / duration, 1);
    el.textContent = Math.round(easeOutCubic(p) * target);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }
  requestAnimationFrame(step);
}

const countObs = new IntersectionObserver(
  entries => entries.forEach(e => {
    if (e.isIntersecting) {
      const el = e.target;
      runCountUp(el, parseInt(el.dataset.target, 10));
      countObs.unobserve(el);
    }
  }),
  { threshold: 0.6 }
);
document.querySelectorAll('[data-target]').forEach(el => countObs.observe(el));

/* ─── Terminal typewriter ────────────────────────── */
const LINES = [
  { t: '● KARMA v1.0  —  Ghost Detection Engine',       c: 'hdr' },
  { t: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',   c: 'sep' },
  { t: '',                                               c: 'blank' },
  { t: '► Registering:  payment-service@deprecated',    c: 'info', d: 400 },
  { t: '  Endpoint:     http://payment.internal:8080',  c: 'dim',  d: 200 },
  { t: '  Obs. window:  72h   Confidence: initializing…', c: 'dim', d: 200 },
  { t: '',                                               c: 'blank', d: 200 },
  { t: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',   c: 'sep', d: 300 },
  { t: 'CONTRACTS EXTRACTED  [14 / 14]',                c: 'info', d: 600 },
  { t: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',   c: 'sep' },
  { t: '  ✓  latency.p95        ≤ 142ms     [97%]',     c: 'ok',   d: 220 },
  { t: '  ✓  error.rate         ≤ 0.3%      [94%]',     c: 'ok',   d: 180 },
  { t: '  ✓  cache.warmup       ≤ 800ms     [91%]',     c: 'ok',   d: 180 },
  { t: '  ✓  side_effect.webhook_fire       [99%]',     c: 'ok',   d: 180 },
  { t: '  ✓  throughput.rps     ≥ 340       [88%]',     c: 'ok',   d: 180 },
  { t: '  … 9 more contracts captured',                 c: 'dim',  d: 160 },
  { t: '',                                               c: 'blank', d: 200 },
  { t: '► Ghost deployed → payment-service-v2',         c: 'info', d: 500 },
  { t: '  Status:  HAUNTING  ●',                        c: 'warn', d: 300 },
  { t: '',                                               c: 'blank', d: 400 },
  { t: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',   c: 'sep', d: 200 },
  { t: '⚠  VIOLATION DETECTED',                         c: 'fire', d: 500 },
  { t: '  Contract:  side_effect.webhook_fire',         c: 'err',  d: 200 },
  { t: '  Expected:  webhook fired within 200ms',       c: 'dim',  d: 200 },
  { t: '  Observed:  no webhook fired',                 c: 'err',  d: 200 },
  { t: '  Severity:  CRITICAL',                         c: 'err',  d: 200 },
  { t: '  Evidence:  traces/dtdt-4f2a9c8b  ↗',          c: 'dim',  d: 200 },
];

const termBody = document.getElementById('terminal-body');
let termTimer = null;

function renderTerminal() {
  termBody.innerHTML = '';
  let elapsed = 800; // initial delay

  LINES.forEach((line, i) => {
    const delay = elapsed + (line.d || 120);
    elapsed = delay;

    termTimer = setTimeout(() => {
      if (line.c === 'blank') {
        const b = document.createElement('span');
        b.className = 't-blank';
        termBody.appendChild(b);
      } else {
        const s = document.createElement('span');
        s.className = `t-line t-${line.c}`;
        s.textContent = line.t;
        termBody.appendChild(s);
      }
      termBody.scrollTop = termBody.scrollHeight;

      // Cursor on last line
      if (i === LINES.length - 1) {
        const cur = document.createElement('span');
        cur.className = 't-cursor';
        termBody.appendChild(cur);
      }
    }, delay);
  });

  // Loop the animation
  setTimeout(() => renderTerminal(), elapsed + 4000);
}

renderTerminal();

/* ─── Smooth anchor scroll ──────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
