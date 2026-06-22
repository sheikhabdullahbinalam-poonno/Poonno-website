// ============================================================================
//  finale.js — reveals the "Let's cross paths. Horizons Crossing" contact panel
//  + footer once the journey reaches the tree (§5 t≈0.92→1.0). Rows stagger in
//  via CSS; links are LinkedIn / WhatsApp / Email (§7). Download CV stays in nav.
// ============================================================================

let el = null;

export function initFinale() {
  el = document.getElementById('contact');
}

export function updateFinale(t) {
  if (el) el.classList.toggle('show', t > 0.92);
}
