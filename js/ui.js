// ============================================================================
//  ui.js — DOM layer: the loader (fireflies fly in + coalesce into the signature,
//  then it reveals) + Enter gate that starts the audio on first tap (§8); the nav
//  bar (logo / whistle rope / links / mute); and the HUD toggle.
// ============================================================================

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CREAM = '#F5EBDC';

export function initUI({ audio, goTo, onWhistle }) {
  const loader = document.getElementById('loader');
  const sigBox = document.getElementById('loader-sig');
  const enterBtn = document.getElementById('enter-btn');
  const nav = document.getElementById('nav');
  const scrollHint = document.getElementById('scroll-hint');

  // Lock scrolling until the viewer enters (keeps the camera at t=0).
  document.documentElement.style.overflow = 'hidden';

  let entered = false;
  let canEnter = false;

  loadSignature(sigBox).then(() => {
    setTimeout(() => {
      canEnter = true;
      enterBtn.classList.remove('enter-hidden');
      requestAnimationFrame(() => enterBtn.classList.add('enter-show'));
    }, REDUCED ? 200 : 450);
  });

  function enter() {
    if (entered || !canEnter) return;
    entered = true;
    audio.start();                       // first gesture → ambient bed + rumble
    document.documentElement.style.overflow = '';
    loader.classList.add('loader-gone');
    setTimeout(() => { loader.style.display = 'none'; }, 1200);
    nav.classList.remove('nav-hidden');
    setTimeout(() => scrollHint.classList.add('show'), 600);
  }

  enterBtn.addEventListener('click', enter);
  loader.addEventListener('click', enter); // tapping anywhere on the gate works
  window.addEventListener('keydown', (e) => {
    if (!entered && canEnter && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); enter(); }
  });

  // ---- nav wiring ----------------------------------------------------------
  document.getElementById('nav-logo').addEventListener('click', (e) => { e.preventDefault(); goTo(0); });
  document.querySelectorAll('.nav-jump').forEach((b) =>
    b.addEventListener('click', () => goTo(parseFloat(b.dataset.t)))
  );
  document.getElementById('whistle-rope').addEventListener('click', () => {
    audio.whistle();
    if (onWhistle) onWhistle();
  });

  // ---- mute control --------------------------------------------------------
  const muteBtn = document.getElementById('mute-btn');
  const syncMute = () => {
    const m = audio.isMuted();
    muteBtn.classList.toggle('is-muted', m);
    muteBtn.setAttribute('aria-pressed', m ? 'true' : 'false');
    muteBtn.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
  };
  syncMute();
  muteBtn.addEventListener('click', () => { audio.toggleMute(); syncMute(); });

  // ---- HUD toggle (debug) --------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') document.getElementById('hud').classList.toggle('hud-hidden');
  });
}

// ---- Loader: fireflies coalesce into the signature, then it reveals ---------
async function loadSignature(container) {
  try {
    const res = await fetch('assets/img/Poonno%20Signature.svg');
    if (!res.ok) throw new Error('fetch failed');
    const svgText = await res.text();

    const W = 300;
    const H = Math.round(W * 71 / 125);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    container.style.position = 'relative';
    container.style.width = W + 'px';
    container.style.height = H + 'px';

    // The signature itself, revealed at the end (hidden, cream-filled).
    const holder = document.createElement('div');
    holder.innerHTML = svgText;
    const svg = holder.querySelector('svg');
    Object.assign(svg.style, {
      position: 'absolute', left: '0', top: '0', width: W + 'px', height: H + 'px',
      opacity: '0', transition: 'opacity 0.9s ease',
    });
    const path = svg.querySelector('path');
    if (path) path.style.fill = CREAM;

    // Canvas the fireflies fly across.
    const cv = document.createElement('canvas');
    cv.width = W * dpr; cv.height = H * dpr;
    Object.assign(cv.style, { width: W + 'px', height: H + 'px', display: 'block' });
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);

    container.appendChild(cv);
    container.appendChild(svg);

    if (REDUCED) { svg.style.opacity = '1'; return true; }

    const targets = await sampleSvgPoints(svgText, W, H, 520);
    const parts = targets.map((tp) => ({
      x: (Math.random() * 1.7 - 0.35) * W,
      y: (Math.random() < 0.5 ? -0.35 : 1.35) * H + (Math.random() - 0.5) * 0.4 * H,
      tx: tp.x, ty: tp.y,
      delay: Math.random() * 0.45,
      sz: 1.0 + Math.random() * 1.6,
    }));

    const DUR = 1700;
    const start = performance.now();
    await new Promise((resolve) => {
      function frame(now) {
        const el = now - start;
        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        for (const p of parts) {
          const local = clamp01((el / DUR - p.delay) / (1 - p.delay));
          const e = easeOutCubic(local);
          const jit = (1 - e) * 2.2;
          const px = p.x + (p.tx - p.x) * e + (Math.random() - 0.5) * jit;
          const py = p.y + (p.ty - p.y) * e + (Math.random() - 0.5) * jit;
          const r = p.sz * (0.6 + 0.7 * e);
          const g = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
          g.addColorStop(0, 'rgba(255,240,205,' + (0.85 * e + 0.12) + ')');
          g.addColorStop(0.4, 'rgba(255,211,122,' + (0.5 * e) + ')');
          g.addColorStop(1, 'rgba(255,200,120,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(px, py, r * 3, 0, 6.2832); ctx.fill();
        }
        if (el < DUR + 180) requestAnimationFrame(frame);
        else {
          svg.style.opacity = '1';           // reveal the crisp signature
          cv.style.transition = 'opacity 1.1s ease';
          cv.style.opacity = '0';            // fade the motes away
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
    return true;
  } catch (e) {
    container.innerHTML = '<div style="font-family:Sacramento,cursive;font-size:64px;color:' + CREAM + '">Poonno</div>';
    return false;
  }
}

// Rasterise the SVG and sample N random "ink" pixels as firefly targets.
function sampleSvgPoints(svgText, W, H, n) {
  return new Promise((resolve) => {
    const img = new Image();
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const oc = document.createElement('canvas');
      oc.width = W; oc.height = H;
      const c = oc.getContext('2d');
      c.drawImage(img, 0, 0, W, H);
      let data;
      try { data = c.getImageData(0, 0, W, H).data; }
      catch (e) { URL.revokeObjectURL(url); resolve(fallbackLine(W, H, n)); return; }
      const cand = [];
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          if (data[(y * W + x) * 4 + 3] > 90) cand.push([x, y]);
        }
      }
      URL.revokeObjectURL(url);
      if (!cand.length) { resolve(fallbackLine(W, H, n)); return; }
      const pts = [];
      for (let i = 0; i < n; i++) {
        const p = cand[(Math.random() * cand.length) | 0];
        pts.push({ x: p[0], y: p[1] });
      }
      resolve(pts);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(fallbackLine(W, H, n)); };
    img.src = url;
  });
}

function fallbackLine(W, H, n) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push({ x: Math.random() * W, y: H * 0.5 + (Math.random() - 0.5) * 26 });
  return pts;
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
