// ============================================================================
//  ui.js — DOM layer: the loader (signature + a simple left-to-right progress
//  bar that doubles as the load indicator) + Enter gate that starts the audio on
//  first tap (§8); the nav bar (logo / whistle rope / links / mute); HUD toggle.
// ============================================================================

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CREAM = '#F5EBDC';

export function initUI({ audio, goTo, onWhistle }) {
  const loader = document.getElementById('loader');
  const sigBox = document.getElementById('loader-sig');
  const bar = document.getElementById('loader-bar');
  const barFill = document.getElementById('loader-bar-fill');
  const enterBtn = document.getElementById('enter-btn');
  const nav = document.getElementById('nav');
  const scrollHint = document.getElementById('scroll-hint');

  // Lock scrolling until the viewer enters (keeps the camera at t=0).
  document.documentElement.style.overflow = 'hidden';

  let entered = false;
  let canEnter = false;

  runLoader(sigBox, barFill).then(() => {
    bar.classList.add('bar-done');
    setTimeout(() => {
      canEnter = true;
      enterBtn.classList.remove('enter-hidden');
      requestAnimationFrame(() => enterBtn.classList.add('enter-show'));
    }, 200);
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

// Show the signature, then fill a progress bar left→right; it tops out only once
// the scene is actually ready (window.__poonno), so it's a real load indicator.
async function runLoader(sigBox, barFill) {
  await injectSignature(sigBox);
  if (REDUCED) { barFill.style.width = '100%'; return; }

  let ready = false;
  (function poll() { if (window.__poonno) ready = true; else setTimeout(poll, 80); })();

  const start = performance.now();
  await new Promise((resolve) => {
    function frame(now) {
      const timed = easeOutCubic(Math.min(1, (now - start) / 1300));
      const cap = ready ? 1 : 0.92;          // hold at 92% until the scene is ready
      const fill = Math.min(cap, timed);
      barFill.style.width = (fill * 100).toFixed(1) + '%';
      if (fill >= 0.999 && ready) resolve();
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

async function injectSignature(container) {
  try {
    const res = await fetch('assets/img/Poonno%20Signature.svg');
    if (!res.ok) throw new Error('fetch failed');
    container.innerHTML = await res.text();
    const svg = container.querySelector('svg');
    const path = container.querySelector('path');
    if (path) path.style.fill = CREAM;
    if (svg) {
      svg.style.opacity = '0';
      svg.style.transition = 'opacity 0.8s ease';
      requestAnimationFrame(() => { svg.style.opacity = '1'; });
    }
  } catch (e) {
    container.innerHTML = '<div style="font-family:Sacramento,cursive;font-size:64px;color:' + CREAM + '">Poonno</div>';
  }
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
