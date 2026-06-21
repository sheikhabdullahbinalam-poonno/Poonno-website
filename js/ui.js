// ============================================================================
//  ui.js — DOM layer: the loader (signature stroke draw-on) + Enter gate that
//  starts the audio on first tap (§8), the nav bar (logo / whistle rope / links
//  / mute), and the HUD toggle. The signature SVG is one filled path, so the
//  "draw-on" strokes its outline then fades the fill in.
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
    const delay = REDUCED ? 250 : 2400;
    setTimeout(() => {
      canEnter = true;
      enterBtn.classList.remove('enter-hidden');
      requestAnimationFrame(() => enterBtn.classList.add('enter-show'));
    }, delay);
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

// Fetch the signature SVG, inject it, and animate the outline draw-on.
async function loadSignature(container) {
  try {
    const res = await fetch('assets/img/Poonno%20Signature.svg');
    if (!res.ok) throw new Error('fetch failed');
    container.innerHTML = await res.text();
    const path = container.querySelector('path');
    if (!path) throw new Error('no path');

    const len = path.getTotalLength();
    path.style.fill = 'transparent';
    path.style.stroke = CREAM;
    path.style.strokeWidth = '0.7';
    path.style.strokeLinejoin = 'round';
    path.style.strokeLinecap = 'round';
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;

    if (REDUCED) {
      path.style.strokeDashoffset = '0';
      path.style.fill = CREAM;
      return true;
    }

    path.getBoundingClientRect(); // force layout so the transition runs
    path.style.transition = 'stroke-dashoffset 1.9s ease';
    requestAnimationFrame(() => { path.style.strokeDashoffset = '0'; });
    setTimeout(() => {
      path.style.transition = 'fill 0.8s ease';
      path.style.fill = CREAM;
    }, 1700);
    return true;
  } catch (e) {
    // Fallback: a simple scripted wordmark if the SVG can't be loaded.
    container.innerHTML = '<div style="font-family:Sacramento,cursive;font-size:64px;color:' + CREAM + '">Poonno</div>';
    return false;
  }
}
