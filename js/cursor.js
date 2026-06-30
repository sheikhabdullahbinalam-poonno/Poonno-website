// ============================================================================
//  cursor.js — a minimal Noomo-style cursor: a small dot that tracks exactly and
//  a thin ring that follows with lag and grows softly over interactive elements.
//  No glow. Disabled on touch / reduced motion so there's always a usable pointer.
// ============================================================================

const HOT = 'a, button, .at-card, .nav-jump, #whistle-rope, .car-prev, .car-next, .case-link, .case-close, .cd-close, #mute-btn, #enter-btn, #nav-logo, #read-next';

export function initCursor() {
  const ring = document.getElementById('cursor');
  const dot = document.getElementById('cursor-dot');
  if (!ring || !dot) return;
  if (matchMedia('(hover: none)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    ring.style.display = 'none'; dot.style.display = 'none'; return;
  }

  let mx = window.innerWidth / 2, my = window.innerHeight / 2, rx = mx, ry = my;
  let _prev = 0;

  window.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px)`;
    const el = e.target;
    ring.classList.toggle('hot', !!(el && el.closest && el.closest(HOT)));
  });
  window.addEventListener('mousedown', () => ring.classList.add('down'));
  window.addEventListener('mouseup', () => ring.classList.remove('down'));

  (function loop(ts) {
    requestAnimationFrame(loop);
    // Frame-rate-independent lag: ring reaches cursor in ~4 frames at 60 fps
    const dt = Math.min(0.05, (_prev ? (ts - _prev) / 1000 : 0.016));
    _prev = ts;
    const f = Math.min(1, dt * 26);
    rx += (mx - rx) * f; ry += (my - ry) * f;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
  })(0);

  document.documentElement.classList.add('has-cursor');
}
