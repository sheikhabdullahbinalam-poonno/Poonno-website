// ============================================================================
//  cards.js — the Active-Theory-style project carousel (§8.1), skinned in our
//  warm dusk/firefly palette. A 3D glass coverflow that appears while the camera
//  HOLDS at a station: one big active card (notched glass, brand + title over a
//  drifting accent hero), side cards angled and receding. Hover tilts the active
//  card toward the cursor with a light-sheen; prev/next (or arrows/keys/click)
//  flip projects with a fireflies-dissolve; click the active card to expand the
//  case detail (uppercase letter-spaced mono) with the Behance links.
// ============================================================================

import { CREATIVE, UNILEVER } from './data.js';

const ACCENT = { ember: '#F4A259', steel: '#7FA8CF' };

let root, carousel, nameEl, detailEl, audioRef, onLock, onUnlock;
let station = null, data = null, active = 0, cards = [], detailOpen = false;
let mouseX = 0, mouseY = 0, tx = 0, ty = 0;

export function initCards(opts) {
  audioRef = opts.audio; onLock = opts.onLock; onUnlock = opts.onUnlock;
  root = document.getElementById('cards-root');
  root.innerHTML = `
    <div class="carousel"></div>
    <div class="carousel-nav">
      <button class="car-prev" type="button" aria-label="Previous project">&#8249;</button>
      <span class="car-name"></span>
      <button class="car-next" type="button" aria-label="Next project">&#8250;</button>
    </div>
    <div class="case-detail" aria-hidden="true"></div>`;
  carousel = root.querySelector('.carousel');
  nameEl = root.querySelector('.car-name');
  detailEl = root.querySelector('.case-detail');
  root.querySelector('.car-prev').addEventListener('click', () => flip(-1));
  root.querySelector('.car-next').addEventListener('click', () => flip(1));
  window.addEventListener('keydown', onKey);
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  });
  requestAnimationFrame(tiltLoop);
}

function onKey(e) {
  if (detailOpen) { if (e.key === 'Escape') closeDetail(); return; }
  if (!station) return;
  if (e.key === 'ArrowLeft') flip(-1);
  else if (e.key === 'ArrowRight') flip(1);
  else if (e.key === 'Enter') openDetail(active);
}

// Called each frame from main: show the right station's carousel during its hold.
export function updateCards(t) {
  const s = (t >= 0.548 && t <= 0.638) ? 'creative'
    : (t >= 0.804 && t <= 0.880) ? 'unilever' : null;
  if (s !== station) setStation(s);
}

function setStation(s) {
  if (detailOpen) closeDetail(true);
  station = s;
  if (!s) { root.classList.remove('show'); return; }
  data = s === 'creative' ? CREATIVE : UNILEVER;
  root.style.setProperty('--accent', ACCENT[data.accent]);
  active = 0;
  buildCards();
  render(true);
  root.classList.add('show');
}

function buildCards() {
  carousel.innerHTML = '';
  cards = data.projects.map((p, i) => {
    const el = document.createElement('div');
    el.className = 'at-card';
    el.innerHTML = `
      <div class="at-card-inner">
        <div class="card-hero"></div>
        <div class="card-sheen"></div>
        <div class="card-edge"></div>
        <div class="card-body">
          <div class="card-brand">${p.brand}</div>
          <div class="card-title">${p.title}</div>
          <div class="card-cue">View case &#8594;</div>
        </div>
      </div>`;
    el.addEventListener('click', () => { i === active ? openDetail(i) : setActive(i); });
    carousel.appendChild(el);
    return el;
  });
}

function flip(d) { setActive((active + d + cards.length) % cards.length); }

function setActive(i) {
  if (i === active) return;
  active = i;
  fireflyBurst();
  render();
}

function render(instant) {
  nameEl.textContent = data.projects[active].brand.toUpperCase();
  cards.forEach((el, i) => {
    const off = i - active, abs = Math.abs(off);
    if (instant) { el.style.transition = 'none'; requestAnimationFrame(() => (el.style.transition = '')); }
    el.style.transform =
      `translate(-50%,-50%) translateX(${off * 46}%) translateZ(${-abs * 240}px) rotateY(${off * -26}deg) scale(${off === 0 ? 1 : 0.84})`;
    el.style.opacity = abs > 2 ? '0' : (off === 0 ? '1' : '0.5');
    el.style.zIndex = String(20 - abs);
    el.style.pointerEvents = abs > 2 ? 'none' : 'auto';
    el.classList.toggle('is-active', off === 0);
  });
}

// Hover tilt of the active card toward the cursor + a sheen that tracks it.
function tiltLoop() {
  requestAnimationFrame(tiltLoop);
  tx += (mouseX - tx) * 0.08; ty += (mouseY - ty) * 0.08;
  if (!station || detailOpen) return;
  const inner = cards[active] && cards[active].querySelector('.at-card-inner');
  if (!inner) return;
  inner.style.transform = `rotateY(${tx * 9}deg) rotateX(${-ty * 7}deg)`;
  const sheen = inner.querySelector('.card-sheen');
  if (sheen) sheen.style.transform = `translateX(${tx * 60}%) translateY(${ty * 40}%)`;
}

// Fireflies-dissolve: a burst of glowing motes when switching cards.
function fireflyBurst() {
  for (let i = 0; i < 18; i++) {
    const m = document.createElement('span');
    m.className = 'card-mote';
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 180;
    m.style.setProperty('--dx', Math.cos(a) * d + 'px');
    m.style.setProperty('--dy', Math.sin(a) * d + 'px');
    root.appendChild(m);
    setTimeout(() => m.remove(), 700);
  }
}

// ---- case detail (bottom-left panel, uppercase mono) ------------------------
function openDetail(i) {
  if (detailOpen) return;
  detailOpen = true;
  const p = data.projects[i];
  const blocks = [];
  if (p.challenge) blocks.push(block('Challenge', p.challenge));
  if (p.approach) blocks.push(block('Approach', p.approach));
  if (p.impact) blocks.push(block('Impact', p.impact));
  if (p.tools) blocks.push(block('Tools', p.tools.join(' · ')));
  if (p.learning) blocks.push(block('Key Learning', p.learning));
  const links = (p.links || []).map((l) =>
    `<a class="case-link" href="${l.url}" target="_blank" rel="noopener">${l.label} &#8594;</a>`).join('');
  detailEl.innerHTML = `
    <button class="case-close" type="button" aria-label="Close">&#8249; CLOSE</button>
    <div class="case-meta">${p.meta}</div>
    <h3 class="case-title">${p.brand}</h3>
    <div class="case-sub">${p.title}</div>
    <div class="case-blocks">${blocks.join('')}</div>
    <div class="case-links">${links}</div>`;
  detailEl.querySelector('.case-close').addEventListener('click', () => closeDetail());
  detailEl.setAttribute('aria-hidden', 'false');
  root.classList.add('detail-open');
  requestAnimationFrame(() => detailEl.classList.add('in'));
  fireflyBurst();
  if (onLock) onLock();
  if (audioRef) audioRef.playChime();
}

function closeDetail(silent) {
  if (!detailOpen) return;
  detailOpen = false;
  detailEl.classList.remove('in');
  detailEl.setAttribute('aria-hidden', 'true');
  root.classList.remove('detail-open');
  if (onUnlock) onUnlock();
  if (!silent) fireflyBurst();
}

function block(label, text) {
  return `<div class="case-block"><div class="case-block-h">${label}</div><div class="case-block-b">${text}</div></div>`;
}

export function isDetailOpen() { return detailOpen; }
