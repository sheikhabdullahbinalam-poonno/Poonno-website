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
  const enterBtn = document.getElementById('enter-btn');
  const nav = document.getElementById('nav');
  const scrollHint = document.getElementById('scroll-hint');

  // Lock scrolling until the viewer enters (keeps the camera at t=0).
  document.documentElement.style.overflow = 'hidden';

  let entered = false;
  let canEnter = false;

  runLoader(sigBox).then(() => {
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

  // ---- mobile hamburger ----------------------------------------------------
  const burger = document.getElementById('nav-burger');
  const navLinks = document.getElementById('nav-links');
  if (burger && navLinks) {
    burger.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navLinks.querySelectorAll('a, button').forEach((b) =>
      b.addEventListener('click', () => { navLinks.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }));
  }

  // ---- HUD toggle (debug) --------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') document.getElementById('hud').classList.toggle('hud-hidden');
  });
}

// The signature "writes" itself left→right (a soft glowing pen tip leads the
// reveal). It holds near the end until the scene is ready, so the writing also
// serves as the load-progress indicator.
async function runLoader(sigBox) {
  const svg = await injectSignature(sigBox);

  const tip = document.createElement('div');
  tip.className = 'sig-tip';
  sigBox.appendChild(tip);

  if (!svg || REDUCED) { if (svg) svg.style.clipPath = 'none'; tip.remove(); return; }

  svg.style.clipPath = 'inset(0 100% 0 0)'; // fully hidden, revealed from the left

  let ready = false;
  (function poll() { if (window.__poonno) ready = true; else setTimeout(poll, 80); })();

  const DUR = 1800;
  const start = performance.now();
  await new Promise((resolve) => {
    function frame(now) {
      const timed = easeInOut(Math.min(1, (now - start) / DUR));
      const cap = ready ? 1 : 0.9;            // hold near the end until ready
      const r = Math.min(cap, timed);
      svg.style.clipPath = `inset(0 ${((1 - r) * 100).toFixed(2)}% 0 0)`;
      tip.style.left = (r * sigBox.clientWidth).toFixed(1) + 'px';
      tip.style.opacity = (r > 0.02 && r < 0.985) ? '1' : '0';
      if (r >= 0.999 && ready) { tip.style.opacity = '0'; setTimeout(() => tip.remove(), 300); resolve(); }
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

async function injectSignature(sigBox) {
  try {
    const res = await fetch('assets/img/Poonno%20Signature.svg');
    if (!res.ok) throw new Error('fetch failed');
    sigBox.innerHTML = await res.text();
    const svg = sigBox.querySelector('svg');
    const path = sigBox.querySelector('path');
    if (path) path.style.fill = CREAM;
    return svg;
  } catch (e) {
    sigBox.innerHTML = '<div style="font-family:Sacramento,cursive;font-size:64px;color:' + CREAM + '">Poonno</div>';
    return null;
  }
}

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
