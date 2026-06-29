// ============================================================================
//  station-overlay.js — the "Next Station" announcement that dissolves in as the
//  train approaches each stop, over a darkened world (a deliberate, slowed beat).
//  Scroll-driven via updateStationOverlay(t). Soft Noomo-style blur dissolve.
// ============================================================================

// Each window sits AFTER its lead-in beat and ends BEFORE the station arrives:
//  - Creative: after the board prompt (gone ~0.482) and before arrival (~0.548)
//  - Unilever: after the moon-gaze (gone ~0.752) and before arrival (~0.804)
const STATIONS = [
  { t0: 0.495, t1: 0.545, name: 'Creative Origins', tag: 'The beginnings of a creative pursuit' },
  { t0: 0.738, t1: 0.782, name: 'Unilever Years',   tag: 'Projects, problems, and the pursuit of better solutions' },
];

let el, nameEl, tagEl, built = false;

export function initStationOverlay() {
  el = document.getElementById('station-overlay');
  if (!el) return;
  el.innerHTML = `<div class="so-inner">
      <div class="so-kick">Next Station</div>
      <h2 class="so-name"></h2>
      <p class="so-tag"></p>
      <div class="so-explore"><span>Explore</span></div>
    </div>`;
  nameEl = el.querySelector('.so-name');
  tagEl = el.querySelector('.so-tag');
  built = true;
}

export function updateStationOverlay(t) {
  if (!built) return;
  let active = null;
  for (const s of STATIONS) { if (t >= s.t0 - 0.03 && t <= s.t1 + 0.02) { active = s; break; } }
  if (!active) { if (el.style.display !== 'none') { el.style.display = 'none'; el.classList.remove('show'); } return; }

  if (nameEl.textContent !== active.name) { nameEl.textContent = active.name; tagEl.textContent = active.tag; }
  // soft dissolve at the edges only, with a long SHARP hold in the middle to read
  const inK = Math.min((t - active.t0) / 0.013, 1);
  const outK = Math.min((active.t1 - t) / 0.013, 1);
  const op = Math.max(0, Math.min(inK, outK));
  const blur = (1 - op) * 7;
  el.style.display = op > 0.002 ? 'flex' : 'none';
  el.style.opacity = op.toFixed(3);
  el.style.filter = blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : 'none';
  el.classList.toggle('show', op > 0.5);
}
