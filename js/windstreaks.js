// ============================================================================
//  windstreaks.js — cinematic wind streaks for the newspaper fly-in. A full-
//  screen canvas of thin, motion-blurred streaks rushing past, their count /
//  speed / opacity driven by setWindStreaks(level) (the same fly envelope that
//  drives the wind sound). Sits above the scene, below the article overlay.
// ============================================================================

let canvas, ctx, streaks = [], level = 0, W = 0, H = 0, last = 0, running = false;
const N = 130;

function mk(spread) {
  return {
    x: spread ? Math.random() * W : -Math.random() * 240,
    y: Math.random() * H,
    len: 50 + Math.random() * 230,
    spd: 700 + Math.random() * 1700,
    vy: (Math.random() - 0.5) * 60,
    op: 0.10 + Math.random() * 0.42,
    w: 0.7 + Math.random() * 2.0,
  };
}

function resize() {
  if (!canvas) return;
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}

export function initWindStreaks() {
  canvas = document.getElementById('wind-streaks');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resize();
  addEventListener('resize', resize);
  streaks = Array.from({ length: N }, () => mk(true));
  last = performance.now();
  running = true;
  requestAnimationFrame(loop);
}

// 0..1 — overall intensity of the streaks.
export function setWindStreaks(v) { level = Math.max(0, Math.min(1, v)); }

function loop(now) {
  if (!running) return;
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05); last = now;

  if (level < 0.01) {
    if (canvas.style.opacity !== '0') { canvas.style.opacity = '0'; ctx.clearRect(0, 0, W, H); }
    return;
  }
  canvas.style.opacity = '1';
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';

  for (const s of streaks) {
    s.x += s.spd * (0.25 + level) * dt;
    s.y += s.vy * dt;
    if (s.x - s.len > W) Object.assign(s, mk(false));     // recycle off the right edge

    const x0 = s.x - s.len, y0 = s.y - s.len * 0.1, x1 = s.x, y1 = s.y;
    const a = s.op * level;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(255,248,232,0)');
    g.addColorStop(0.7, `rgba(255,248,232,${(a * 0.9).toFixed(3)})`);
    g.addColorStop(1, `rgba(255,252,242,${a.toFixed(3)})`);
    ctx.strokeStyle = g;
    ctx.lineWidth = s.w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}
