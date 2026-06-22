// ============================================================================
//  modals.js — designed card modals (§8). Builds the Basketball card (header
//  with a #27 jersey motif, four icon-led blocks, court-pebble texture) and the
//  "Who is Poonno?" bio card. Dims the canvas, slides the card up, plays the soft
//  chime on open; Esc / outside-click / × closes. The opened object glows/scales
//  via callbacks the caller supplies.
// ============================================================================

import { BASKETBALL, BIO } from './data.js';

const ICONS = {
  trophy: '<path d="M7 3h10v3a5 5 0 0 1-10 0V3Z"/><path d="M7 4H4v2a3 3 0 0 0 3 3M17 4h3v2a3 3 0 0 1-3 3"/><path d="M12 11v4M9 19h6M10 19l.5-4h3l.5 4"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5 5c3 3 11 3 14 0M5 19c3-3 11-3 14 0"/>',
  quote: '<path d="M7 7h4v6H7zM7 13c0 2 1 3 3 3M13 7h4v6h-4zM13 13c0 2 1 3 3 3"/>',
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

let root, audioRef, onOpen, onClose, current = null;

export function initModals(opts) {
  audioRef = opts.audio;
  onOpen = opts.onOpen || (() => {});
  onClose = opts.onClose || (() => {});
  root = document.getElementById('modal-root');

  root.addEventListener('click', (e) => { if (e.target === root) closeModal(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) closeModal(); });
}

export function openModal(which) {
  if (current === which) return;
  current = which;
  root.innerHTML = which === 'shelf' ? basketballCard() : bioCard();
  const card = root.querySelector('.modal-card');
  card.scrollTop = 0;
  root.querySelector('.modal-close').addEventListener('click', closeModal);
  root.classList.add('open');
  root.setAttribute('aria-hidden', 'false');
  document.documentElement.style.overflow = 'hidden'; // hold the camera while open
  requestAnimationFrame(() => root.querySelector('.modal-card').classList.add('in'));
  if (audioRef) audioRef.playChime();
  onOpen(which);
}

export function closeModal() {
  if (!current) return;
  const card = root.querySelector('.modal-card');
  if (card) card.classList.remove('in');
  root.classList.remove('open');
  root.setAttribute('aria-hidden', 'true');
  document.documentElement.style.overflow = '';
  const was = current;
  current = null;
  setTimeout(() => { if (!current) root.innerHTML = ''; }, 320);
  onClose(was);
}

export function isOpen() { return current !== null; }

// ---- card builders ---------------------------------------------------------
function basketballCard() {
  const blocks = BASKETBALL.blocks.map((b) => {
    const body = b.text
      ? `<p class="blk-quote">${b.text}</p>`
      : `<ul>${b.items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
    return `<div class="blk"><div class="blk-h"><span class="blk-ico">${icon(b.icon)}</span>${b.label}</div>${body}</div>`;
  }).join('');
  return `
    <div class="modal-card bb" role="dialog" aria-modal="true" aria-label="${BASKETBALL.title}">
      <button class="modal-close" aria-label="Close">×</button>
      <div class="modal-head bb-head">
        <div class="jersey-motif"><span>27</span></div>
        <div class="head-text">
          <div class="kicker">${BASKETBALL.kicker}</div>
          <h2 class="modal-title">${BASKETBALL.title}</h2>
        </div>
      </div>
      <div class="modal-body bb-grid">${blocks}</div>
    </div>`;
}

function bioCard() {
  const paras = BIO.paragraphs.map((p, i) =>
    `<p${i === 1 ? ' class="lead"' : ''}>${p}</p>`).join('');
  return `
    <div class="modal-card bio" role="dialog" aria-modal="true" aria-label="${BIO.title}">
      <button class="modal-close" aria-label="Close">×</button>
      <div class="modal-head bio-head">
        <div class="kicker">${BIO.kicker}</div>
        <h2 class="modal-title">${BIO.title}</h2>
      </div>
      <div class="modal-body bio-body">${paras}</div>
    </div>`;
}
