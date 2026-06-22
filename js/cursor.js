// ============================================================================
//  cursor.js — an Active-Theory-style custom cursor: a dot that tracks exactly
//  and a ring that follows with lag and grows over interactive elements. The
//  native cursor is hidden only once this is active, and never on touch / reduced
//  motion (so there's always a usable pointer).
// ============================================================================

const HOT = 'a, button, .at-card, .nav-jump, #whistle-rope, .car-prev, .car-next, .case-link, .case-close, #mute-btn, #enter-btn, #nav-logo';

export function initCursor() {
  const ring = document.getElementById('cursor');
  const dot = document.getElementById('cursor-dot');
  if (!ring || !dot) return;
  if (matchMedia('(hover: none)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let mx = window.innerWidth / 2, my = window.innerHeight / 2, rx = mx, ry = my;

  window.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px)`;
    const el = e.target;
    ring.classList.toggle('hot', !!(el && el.closest && el.closest(HOT)));
  });
  window.addEventListener('mousedown', () => ring.classList.add('down'));
  window.addEventListener('mouseup', () => ring.classList.remove('down'));

  (function loop() {
    requestAnimationFrame(loop);
    rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
  })();

  document.documentElement.classList.add('has-cursor');
}
