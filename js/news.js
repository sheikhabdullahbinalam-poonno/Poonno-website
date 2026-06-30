// ============================================================================
//  news.js — the crisp HTML article overlay that the flying 3-D newspaper
//  cross-fades into (Scenes 2–3). Two pages, aged-print styling, a 3-D page-turn
//  from "Who is Poonno?" to "The Game Is Never Truly Over", then a flutter-out.
//  Scroll-driven via updateNews(t); blur masks the cross-fade (per Emil Kowalski).
// ============================================================================

import { BIO, BASKETBALL } from './data.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };

// scroll-t schedule (lines up with NEWS in newspaper.js: paper fills ~0.135)
const U = {
  in0: 0.135, in1: 0.190,   // cross-fade in (blur → sharp) — overlaps the paper turning to face you
  read1: 0.280,             // article 1 holds until here (unhurried reading)
  turn1: 0.330,             // page-turn completes
  read2: 0.400,             // article 2 holds until here
  out1: 0.430,              // flutter out completes
};

let overlay, wrap, page1, vignette, board, guide, guideLabel, whistleHint, whistleRope, built = false;
let _turnStartMs = null;  // auto-play timer for page flip
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

function masthead() {
  return `<header class="nm-head">
      <div class="nm-rule"></div>
      <div class="nm-top"><span>EST. CURIOSITY</span><span>NIGHT EDITION</span><span>No. 01</span></div>
      <h1 class="nm-name">The Daily Adroit</h1>
      <div class="nm-rule thin"></div>
    </header>`;
}

function articleWho() {
  const p = BIO.paragraphs;
  // Full article, verbatim, flowed through responsive newspaper columns.
  const body = p.map((para, i) => `<p${i === 0 ? ' class="drop"' : ''}>${para}</p>`).join('');
  return `<article class="news-page page-top" id="news-page-1">
    ${masthead()}
    <div class="np-cols">
      <div class="na-kicker">${BIO.kicker}</div>
      <h2 class="na-headline">Who is Poonno?</h2>
      <div class="na-byline">A Special Report &middot; By the Editorial Desk</div>
      <div class="na-hr"></div>
      <figure class="na-figure bw">
        <img src="References/Poonno%20Bio.jpg" alt="Poonno" loading="eager" />
        <figcaption>The man behind the journey &mdash; somewhere between stations.</figcaption>
      </figure>
      ${body}
    </div>
  </article>`;
}

function articleGame() {
  const b = BASKETBALL.blocks;
  const quote = b.find((x) => x.icon === 'quote');
  const list = (label) => {
    const blk = b.find((x) => x.label === label);
    return blk ? `<div class="sidebar"><div class="side-kick">${label}</div><ul class="na-list">${blk.items.map((i) => `<li>${i}</li>`).join('')}</ul></div>` : '';
  };
  return `<article class="news-page page-under" id="news-page-2">
    ${masthead()}
    <div class="np-cols">
      <div class="na-kicker">${BASKETBALL.kicker}</div>
      <h2 class="na-headline">The Game Is Never Truly Over</h2>
      <div class="na-byline">Sports Desk &middot; A Life in Motion</div>
      <div class="na-hr"></div>
      <figure class="na-figure bw">
        <img src="References/Poonno%20Basketball.jpg" alt="Poonno on the court" loading="eager" />
        <figcaption>On the court for the Bangladesh National Team.</figcaption>
      </figure>
      <p class="drop">${quote.text}</p>
      <p>From the U18 national side to the 3x3 arena, the through-line was never the trophy &mdash; it was the refusal to believe the final whistle had blown.</p>
      ${list('Milestones')}${list('National Team')}${list('Memorable Games')}
    </div>
  </article>`;
}

export function initNews() {
  overlay = document.getElementById('news-overlay');
  if (!overlay) return;
  // page-2 first (sits underneath), page-1 last (on top, the one that turns)
  overlay.innerHTML = `<div class="news-vignette"></div>
    <div class="news-wrap">${articleGame()}${articleWho()}</div>`;
  wrap = overlay.querySelector('.news-wrap');
  page1 = overlay.querySelector('#news-page-1');
  vignette = overlay.querySelector('.news-vignette');
  board = document.getElementById('board-prompt');
  whistleHint = document.getElementById('whistle-hint');
  whistleRope = document.getElementById('whistle-rope');
  guide = document.getElementById('read-guide');
  guideLabel = guide && guide.querySelector('.rg-label');
  const next = document.getElementById('read-next');
  if (next) next.addEventListener('click', () => window.scrollBy({ top: window.innerHeight * 1.5, behavior: 'smooth' }));
  built = true;
}

export function updateNews(t) {
  if (!built) return;
  // Board-the-train prompt (Scene 4) — dissolves in as the article leaves frame,
  // and stays until the train is ~⅓ of the way to Creative Origins (#11).
  if (board) {
    // Scroll-driven (NOT a time transition) so it's gone exactly as the train
    // departs (~t0.482), regardless of scroll speed — no lag into the next overlay.
    const inK = clamp((t - 0.430) / 0.016, 0, 1);
    const outK = clamp((0.482 - t) / 0.014, 0, 1);
    const op = Math.max(0, Math.min(inK, outK));
    board.style.opacity = op.toFixed(3);
    board.style.filter = op < 0.98 ? `blur(${((1 - op) * 8).toFixed(1)}px)` : 'none';
    board.classList.toggle('show', op > 0.5);   // underline accent
  }

  // Pull-the-whistle invitation — lives in the gap AFTER "Board the Train" has
  // fully faded (~0.482) and BEFORE the first "Next Station" overlay (~0.505).
  // Scroll-driven; once the viewer actually pulls the cord it dismisses for good.
  if (whistleHint) {
    const wIn = clamp((t - 0.482) / 0.006, 0, 1);
    const wOut = clamp((0.503 - t) / 0.005, 0, 1);
    let wop = Math.max(0, Math.min(wIn, wOut));
    if (window.__whistled) wop = 0;             // already sounded — no need to ask
    whistleHint.style.opacity = wop.toFixed(3);
    whistleHint.style.transform = `translateX(-50%) translateY(${((1 - wop) * -6).toFixed(1)}px)`;
    whistleHint.setAttribute('aria-hidden', wop > 0.5 ? 'false' : 'true');
    // make the rope gently sway to draw the eye while the hint is up
    if (whistleRope) whistleRope.classList.toggle('invite', wop > 0.25 && !window.__whistled);
  }

  // Reading guide (next + scroll hint) — visible while a page is settled to read,
  // hidden during the cross-fade and the page-turn.
  if (guide) {
    const onGuide = (t > U.in1 + 0.008 && t < U.read1 - 0.004) || (t > U.turn1 + 0.004 && t < U.read2 - 0.004);
    guide.classList.toggle('show', onGuide);
    if (onGuide && guideLabel) {
      const lbl = t < U.read1 ? 'Scroll · turn the page' : 'Scroll · board the train';
      if (guideLabel.textContent !== lbl) guideLabel.textContent = lbl;
    }
  }

  if (t < 0.04 || t > 0.45) { if (overlay.style.display !== 'none') overlay.style.display = 'none'; return; }
  overlay.style.display = 'block';

  const fadeIn = clamp((t - U.in0) / (U.in1 - U.in0), 0, 1);
  const out = clamp((t - U.read2) / (U.out1 - U.read2), 0, 1);
  const opacity = fadeIn * (1 - out);
  const blur = (1 - fadeIn) * 9 + out * 12;           // blur masks both transitions
  overlay.style.opacity = opacity.toFixed(3);
  overlay.style.filter = blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : 'none';

  // flutter / lift out (keep the centring translate that the CSS sets)
  const sc = 1 + out * 0.14, ty = out * -5;
  wrap.style.transform = `translate(-50%, -50%) translateY(${ty.toFixed(1)}vh) scale(${sc.toFixed(3)})`;

  // page-turn: one scroll past read1 triggers the whole flip (~0.85 s, scroll-independent)
  if (t < U.read1) { _turnStartMs = null; }
  else if (_turnStartMs === null) { _turnStartMs = performance.now(); }
  const _turnK = _turnStartMs ? Math.min(1, (performance.now() - _turnStartMs) / 850) : 0;
  const turn = smooth(REDUCED ? clamp((t - U.read1) / (U.turn1 - U.read1), 0, 1) : _turnK);
  const ang = REDUCED ? (turn > 0.5 ? -180 : 0) : -180 * turn;
  const arc = Math.sin(turn * Math.PI);               // 0 → 1 → 0 across the turn
  page1.style.transform = REDUCED ? `rotateY(${ang}deg)`
    : `translateZ(${(arc * 70).toFixed(1)}px) rotateY(${ang}deg)`;
  page1.style.filter = `brightness(${(1 - arc * 0.28).toFixed(3)})`;
  page1.style.boxShadow = arc > 0.02 ? `${(arc * 40).toFixed(0)}px 0 ${(arc * 80).toFixed(0)}px rgba(0,0,0,0.4)` : 'none';
}
