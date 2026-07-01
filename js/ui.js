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
  const rope = document.getElementById('whistle-rope');
  rope.addEventListener('click', () => {
    audio.whistle();
    if (onWhistle) onWhistle();
    window.__whistled = true;                 // dismisses the pull-the-whistle hint
    rope.classList.remove('invite');          // stop the inviting sway once pulled
    rope.classList.add('pulled');             // brief pulled pose
    setTimeout(() => rope.classList.remove('pulled'), 240);
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

// Night-train ticket countdown (0 → 100). Holds near 100 until the scene is ready,
// then unlocks the Enter button. Simple, thematic, no external fetch needed.
async function runLoader(sigBox) {
  sigBox.innerHTML = `
    <div class="tl-wrap">
      <div class="tl-perf">
        <div class="tl-holes"></div>
        <div class="tl-body">
          <div class="tl-name">POONNO</div>
          <div class="tl-rule"></div>
          <div class="tl-row"><span class="tl-k">TRAIN</span><span class="tl-v">NIGHT EXPRESS</span></div>
          <div class="tl-row"><span class="tl-k">FROM</span><span class="tl-v">CURIOSITY</span></div>
          <div class="tl-row"><span class="tl-k">TO</span><span class="tl-v">HORIZONS CROSSING</span></div>
          <div class="tl-rule"></div>
          <div class="tl-pct-row"><span class="tl-pct" id="tl-num">00</span><span class="tl-pct-sign">%</span></div>
          <div class="tl-status" id="tl-status">BOARDING</div>
        </div>
        <div class="tl-holes"></div>
      </div>
    </div>`;

  const numEl = sigBox.querySelector('#tl-num');
  const statusEl = sigBox.querySelector('#tl-status');

  let ready = false;
  (function poll() { if (window.__poonno) ready = true; else setTimeout(poll, 80); })();

  const DUR = 2000;
  const start = performance.now();
  await new Promise((resolve) => {
    function frame(now) {
      const timed = easeInOut(Math.min(1, (now - start) / DUR));
      const cap = ready ? 1 : 0.92;
      const r = Math.min(cap, timed);
      const done = ready && r >= 0.999;             // fully loaded AND animation complete
      const n = done ? 100 : Math.floor(r * 100);   // force 100 on the final frame (floor(0.999*100)=99)
      numEl.textContent = n.toString().padStart(2, '0');
      if (statusEl) statusEl.textContent = r >= 0.92 ? (ready ? 'ALL ABOARD' : 'LOADING...') : 'BOARDING';
      if (done) resolve();
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
