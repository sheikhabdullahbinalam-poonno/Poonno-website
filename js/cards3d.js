// ============================================================================
//  cards3d.js — WebGL glass project cards (Active-Theory "Work" language), shown
//  IN the 3D scene during a station hold. A SCROLL-BOUND row of glass-fronted
//  panels: the station hold's scroll-progress rides the row through the cards (no
//  dragging — exactly like activetheory.net), an active card forward + crisp,
//  neighbours receding, dimmed and angled (coverflow). Click a card → case-study
//  detail over an AT-style backdrop; scroll (overscroll) or the X button closes it.
//  Built procedurally — designed faces (accent gradient + brand / title / meta),
//  fresnel-rimmed glass that reflects the scene env, velocity distortion + DOF.
// ============================================================================

import * as THREE from 'three';
import { CREATIVE, UNILEVER } from './data.js';

const ACCENTS = { ember: '#F4A259', steel: '#7FA8CF' };
const ACCENT3 = { ember: new THREE.Color(0xF4A259), steel: new THREE.Color(0x7FA8CF) };

// per-station hold anchor (matches the camera hold keyframes in config.js)
const STATIONS = {
  creative: { t0: 0.548, t1: 0.638, data: CREATIVE, pos: new THREE.Vector3(4.6, 2.6, -337.5), look: new THREE.Vector3(10, 2.2, -342.5) },
  unilever: { t0: 0.804, t1: 0.880, data: UNILEVER, pos: new THREE.Vector3(-7, 2.6, -715.5), look: new THREE.Vector3(-11, 2, -718.5) },
};

const CARD_W = 1.45, CARD_H = 1.95, GAP = 0.6, STEP = CARD_W + GAP;
const ANCHOR_DIST = 4.4;                 // how far in front of the hold camera the row sits
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, tgt, lambda, dt) => cur + (tgt - cur) * (1 - Math.exp(-lambda * dt));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };

// The card is two stacked layers so the words can float off the glass on hover:
//   • BACK  — the lit glass panel: accent wash, grain, frame, meta kicker, view cue
//   • TEXT  — brand + title only, on a transparent sheet that lifts forward + blooms
const TEX_W = 600, TEX_H = 800, PAD = 44, MAXW = TEX_W - PAD * 2;

// ---- back glass layer (everything except the brand/title) --------------------
function backTexture(project, accentHex) {
  const c = document.createElement('canvas'); c.width = TEX_W; c.height = TEX_H;
  const g = c.getContext('2d'), w = TEX_W, h = TEX_H;
  // deep base + accent glow from the lower third (premium dusk panel)
  g.fillStyle = '#0d1219'; g.fillRect(0, 0, w, h);
  const gl = g.createRadialGradient(w * 0.5, h * 0.9, 24, w * 0.5, h * 0.64, h * 0.88);
  gl.addColorStop(0, accentHex + '99'); gl.addColorStop(0.45, accentHex + '26'); gl.addColorStop(1, 'rgba(13,18,25,0)');
  g.fillStyle = gl; g.fillRect(0, 0, w, h);
  const gt = g.createRadialGradient(w * 0.12, h * 0.06, 10, w * 0.12, h * 0.06, h * 0.5);
  gt.addColorStop(0, accentHex + '1c'); gt.addColorStop(1, 'rgba(13,18,25,0)');
  g.fillStyle = gt; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
  g.strokeStyle = 'rgba(245,235,220,0.16)'; g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44);
  // kicker (meta) — mono, letter-spaced, accent; auto-shrinks so long "PILLAR: …" fits
  g.fillStyle = accentHex; g.textBaseline = 'alphabetic';
  drawTrackedFit(g, (project.meta || '').toUpperCase(), PAD, 108, 24, 3.5, MAXW, '600', '"Space Mono", monospace');
  // project title — etched into glass, no hover glow (brand on fore handles that)
  g.fillStyle = 'rgba(245,235,220,0.55)'; g.textBaseline = 'top';
  wrapFit(g, project.title || '', PAD, h * 0.62, MAXW, 38, 1.12, '500', '"Cormorant Garamond", Georgia, serif', 3, 24);
  // view cue
  g.textBaseline = 'alphabetic';
  g.fillStyle = 'rgba(245,235,220,0.62)'; g.font = '600 19px "Space Mono", monospace';
  drawTracked(g, 'VIEW CASE →', PAD, h - 54, 2.5);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// ---- floating text layer (brand + title only; transparent elsewhere) --------
function textTexture(project) {
  const c = document.createElement('canvas'); c.width = TEX_W; c.height = TEX_H;
  const g = c.getContext('2d'), h = TEX_H;
  // brand only — this layer lifts + glows on hover; title lives on the glass panel
  g.fillStyle = '#F7EEE0'; g.textBaseline = 'top';
  wrapFit(g, project.brand || '', PAD, h * 0.27, MAXW, 76, 1.02, '600', '"Cormorant Garamond", Georgia, serif', 3, 44);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function drawTracked(g, str, x, y, tracking) {
  let cx = x; for (const ch of str) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + tracking; }
}
// tracked single line that shrinks its font until it fits maxW (so long PILLAR metas don't clip)
function trackedWidth(g, str, tracking) {
  let wsum = 0; for (const ch of str) wsum += g.measureText(ch).width + tracking;
  return Math.max(0, wsum - tracking);
}
function drawTrackedFit(g, str, x, y, size, tracking, maxW, weight, family) {
  for (; size > 11; size -= 1) { g.font = `${weight} ${size}px ${family}`; if (trackedWidth(g, str, tracking) <= maxW) break; }
  drawTracked(g, str, x, y, tracking);
}
// greedy line layout for the current font
function layoutLines(g, str, maxW) {
  const words = str.split(' '); const out = []; let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (g.measureText(test).width > maxW && line) { out.push(line); line = word; }
    else line = test;
  }
  if (line) out.push(line);
  return out;
}
// wrap that shrinks the font until the copy fits within maxLines (down to minSize)
function wrapFit(g, str, x, y, maxW, size, lhMul, weight, family, maxLines, minSize) {
  let lines;
  for (; ; size -= 2) {
    g.font = `${weight} ${size}px ${family}`;
    lines = layoutLines(g, str, maxW);
    if (lines.length <= maxLines || size <= minSize) break;
  }
  const lh = size * lhMul;
  lines.forEach((ln, i) => g.fillText(ln, x, y + i * lh));
  return y + lines.length * lh;
}

// ---- case-study detail panel (HTML — readable copy + real Behance links) ----
function buildDetailHTML(p) {
  const block = (label, text) => text ? `<div class="cd-block"><div class="cd-label">${label}</div><p>${text}</p></div>` : '';
  const tools = (p.tools || []).map((t) => `<span class="cd-tool">${t}</span>`).join('');
  const links = (p.links || []).map((l) => `<a class="cd-link" href="${l.url}" target="_blank" rel="noopener">${l.label} <span>&#8599;</span></a>`).join('');
  return `<div class="cd-kicker">${p.meta || ''}</div>
    <h2 class="cd-brand">${p.brand || ''}</h2>
    <div class="cd-titletxt">${p.title || ''}</div>
    <div class="cd-rule"></div>
    ${block('Challenge', p.challenge)}
    ${block('Approach', p.approach)}
    ${block('Impact', p.impact)}
    ${block('Key Learning', p.learning)}
    ${tools ? `<div class="cd-block"><div class="cd-label">Tools</div><div class="cd-tools">${tools}</div></div>` : ''}
    ${links ? `<div class="cd-links">${links}</div>` : ''}`;
}

// shared drag-velocity uniforms (the whole row smears together) + DOF amount
const SHARED = {
  velDistort: { value: 0 }, velAmt: { value: 0 },
  velDir: { value: new THREE.Vector2(1, 0) }, dofBlur: { value: 0.016 },
};

// ---- floating text layer: brand+title on a transparent sheet that lifts off the
// glass + blooms on hover (the existing bloom pass does the glow when color > 1) ----
function textCardMaterial(tex) {
  return new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, side: THREE.FrontSide,
    color: new THREE.Color(0.9, 0.9, 0.9), toneMapped: true,
  });
}

// ---- fresnel-rimmed glass card: env reflection + soft glow + VELOCITY DISTORTION
// (lean/stretch + motion blur on the flick) + DOF blur when receded + a warm
// LANTERN LIGHT-POOL that glides across the glass under the cursor on hover ----
function glassCardMaterial(tex, accent) {
  const mat = new THREE.MeshStandardMaterial({
    map: tex, color: 0xffffff, roughness: 0.18, metalness: 0.0,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.16,
    envMapIntensity: 1.2, transparent: true, side: THREE.FrontSide,
  });
  mat.userData.focus = { value: 1 };                    // 0 (receded/dim/blur) .. 1 (active/crisp)
  mat.userData.hover = { value: 0 };                    // eased hover amount (lantern pool strength)
  mat.userData.pointer = { value: new THREE.Vector2(0.5, 0.5) }; // cursor UV on this card
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uAccent = { value: accent };
    shader.uniforms.uFocus = mat.userData.focus;
    shader.uniforms.uHover = mat.userData.hover;
    shader.uniforms.uPointer = mat.userData.pointer;
    shader.uniforms.uVelDistort = SHARED.velDistort;
    shader.uniforms.uVelAmt = SHARED.velAmt;
    shader.uniforms.uVelDir = SHARED.velDir;
    shader.uniforms.uDofBlur = SHARED.dofBlur;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uVelDistort;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.x += uVelDistort * 0.6;                                   // lean with the drag
        transformed.x *= 1.0 + abs(uVelDistort) * 0.3;                        // stretch along the flick
        transformed.z -= abs(uVelDistort) * 0.5 * (1.0 - abs(uv.x * 2.0 - 1.0)); // gentle bow`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uAccent; uniform float uFocus,uVelAmt,uDofBlur,uHover; uniform vec2 uVelDir,uPointer;\nvec4 gCard;')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
        vec4 acc = vec4(0.0); float ws = 0.0;
        for (int s = -2; s <= 2; s++) { float fs = float(s) * 0.5;
          vec2 o = uVelDir * fs * uVelAmt * 3.0 + (1.0 - uFocus) * uDofBlur * vec2(fs, fs * 0.6); // motion + DOF blur
          float wt = 1.0 - abs(fs) * 0.3; acc += texture2D(map, vMapUv + o) * wt; ws += wt; }
        gCard = acc / ws; diffuseColor *= gCard;
      #endif`)
      .replace('#include <emissivemap_fragment>', `#ifdef USE_EMISSIVEMAP
        totalEmissiveRadiance *= gCard.rgb * (0.4 + 0.6 * uFocus);          // dim when receded
      #endif`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)),0.0,1.0), 2.6);
          totalEmissiveRadiance += uAccent * fres * (0.45 + 0.7 * uFocus); } // accent glass rim
        { // warm lantern light-pool that follows the cursor across the glass (soft, not blooming)
          float lp = smoothstep(0.42, 0.0, distance(vMapUv, uPointer));
          totalEmissiveRadiance += uAccent * lp * uHover * 0.22;
          // a soft diagonal sheen sweeping with the pool — like light catching glass
          float sheen = smoothstep(0.06, 0.0, abs((vMapUv.x - uPointer.x) - (vMapUv.y - uPointer.y) * 0.6));
          totalEmissiveRadiance += vec3(1.0) * sheen * lp * uHover * 0.10;
        }`);
  };
  mat.customProgramCacheKey = () => 'glassCard_v7';
  return mat;
}

export class Cards3D {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group);
    this.station = null; this.cards = [];
    this.offset = 0; this.targetOffset = 0; this.active = 0; this._offVel = 0;
    this.appear = 0;                                  // station entrance/exit envelope (0..1)
    this._down = false; this._px = 0; this._py = 0; this._moved = 0;
    this._tmp = new THREE.Vector3();
    this._ray = new THREE.Raycaster(); this._ndc = new THREE.Vector2(-2, -2);
    this._lastOffset = 0; this._smoothSpeed = 0;
    this._accentHex = ACCENTS.ember;
    this.detailOpen = false; this.detailT = 0;          // 0 (grid) .. 1 (case open)
    this._buildDetailDOM();
    this._bindPointer();
  }

  _buildDetailDOM() {
    const el = document.createElement('div');
    el.id = 'cards3d-detail'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<button class="cd-close" type="button" aria-label="Close case">&#215;</button>
      <div class="cd-scroll"><div class="cd-body"></div></div>
      <div class="cd-exit-hint" aria-hidden="true"><span class="cd-exit-rail"></span>scroll to exit</div>`;
    document.body.appendChild(el);
    this.detailEl = el; this.detailBody = el.querySelector('.cd-body');
    this.detailScroll = el.querySelector('.cd-scroll');
    el.querySelector('.cd-close').addEventListener('click', () => this.closeDetail());
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.detailOpen) this.closeDetail(); });
    // Scroll to close (Active-Theory) — the wheel is captured over the WHOLE overlay
    // (including the left, where the card cover sits) and manually drives the copy, so
    // the reader never has to find the right column. Overscroll past the top (or the
    // bottom) and the case eases shut. The X stays too.
    let acc = 0;
    el.addEventListener('wheel', (e) => {
      if (!this.detailOpen) return;
      e.preventDefault();                                   // we own the wheel while open
      const sc = this.detailScroll;
      const max = sc.scrollHeight - sc.clientHeight;
      const before = sc.scrollTop;
      sc.scrollTop = clamp(before + e.deltaY, 0, max);       // drive the panel from anywhere
      const moved = sc.scrollTop - before;
      const atTop = sc.scrollTop <= 1, atBottom = sc.scrollTop >= max - 1;
      // only count toward closing when the copy can't move any further in that direction
      if ((Math.abs(moved) < 0.5) && ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0))) {
        acc += Math.abs(e.deltaY);
        if (acc > 200) { acc = 0; this.closeDetail(); }
      } else { acc = 0; }
    }, { passive: false });
  }

  // Cards advance with SCROLL (the row is bound to the station-hold scroll, like
  // Active-Theory) — no dragging. The pointer is only used to hover and to CLICK a
  // card open (a press that doesn't move ≈ a click).
  _bindPointer() {
    const dom = document;
    const down = (e) => {
      if (!this.group.visible || this.detailOpen) return;
      this._down = true; this._px = e.clientX; this._py = e.clientY; this._moved = 0;
    };
    const move = (e) => {
      this._ndc.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
      if (this._down) { this._moved += Math.abs(e.clientX - this._px) + Math.abs(e.clientY - this._py); this._px = e.clientX; this._py = e.clientY; }
    };
    const up = () => {
      if (!this._down) return;
      this._down = false;
      if (this._moved < 8 && !this.detailOpen) {               // a click, not a scroll-drag → open the case
        this._ray.setFromCamera(this._ndc, this.camera);
        const hit = this._ray.intersectObjects(this.cards.map((c) => c.back), false)[0];
        if (hit) { const cd = this.cards.find((c) => c.back === hit.object); if (cd) this.openDetail(cd); }
      }
    };
    dom.addEventListener('pointerdown', down, { passive: true });
    dom.addEventListener('pointermove', move, { passive: true });
    dom.addEventListener('pointerup', up, { passive: true });
    dom.addEventListener('pointercancel', up, { passive: true });
  }

  openDetail(cd) {
    this._detailCard = cd;
    this.detailBody.innerHTML = buildDetailHTML(cd.project);
    this.detailEl.querySelector('.cd-scroll').scrollTop = 0;
    this.detailEl.style.setProperty('--accent', this._accentHex);
    this.detailEl.classList.add('show'); this.detailEl.setAttribute('aria-hidden', 'false');
    this.detailOpen = true;
    document.documentElement.style.overflow = 'hidden';     // hold the journey scroll while reading
    // the "scroll to exit" hint lingers a beat, then fades so it doesn't nag the reader
    clearTimeout(this._hintTimer);
    this.detailEl.classList.add('hint-on');
    this._hintTimer = setTimeout(() => this.detailEl.classList.remove('hint-on'), 4200);
  }

  closeDetail() {
    if (!this.detailOpen) return;
    this.detailOpen = false; this._detailCard = null;
    this.detailEl.classList.remove('show'); this.detailEl.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
  }

  _setStation(key) {
    if (this.detailOpen) this.closeDetail();
    // tear down both layers
    for (const cd of this.cards) {
      cd.back.material.dispose(); cd.fore.material.dispose();
      if (cd.bTex) cd.bTex.dispose(); if (cd.tTex) cd.tTex.dispose();
    }
    if (this._cardGeo) this._cardGeo.dispose();
    this.cards = []; this.group.clear(); this._detailCard = null;
    this.offset = 0; this.targetOffset = 0; this._offVel = 0; this.appear = 0;
    this.station = key;
    if (!key) { this.group.visible = false; return; }
    const st = STATIONS[key];
    const accentHex = ACCENTS[st.data.accent] || ACCENTS.ember;
    const accent = ACCENT3[st.data.accent] || ACCENT3.ember;
    this._accentHex = accentHex;
    // anchor the row in front of the hold camera, facing it
    this._tmp.copy(st.look).sub(st.pos).normalize();
    this.group.position.copy(st.pos).addScaledVector(this._tmp, ANCHOR_DIST);
    this.group.lookAt(st.pos);             // local +Z faces the camera
    // build a card per project: a group of { back glass, floating text }
    const geo = this._cardGeo = new THREE.PlaneGeometry(CARD_W, CARD_H, 1, 1);
    st.data.projects.forEach((p, i) => {
      const bTex = backTexture(p, accentHex), tTex = textTexture(p);
      const back = new THREE.Mesh(geo, glassCardMaterial(bTex, accent.clone()));
      const fore = new THREE.Mesh(geo, textCardMaterial(tTex));
      fore.position.z = 0.012;             // resting just above the glass
      back.frustumCulled = false; fore.frustumCulled = false;
      const cg = new THREE.Group(); cg.add(back); cg.add(fore);
      this.group.add(cg);
      this.cards.push({ group: cg, back, fore, bTex, tTex, i, project: p });
    });
    this.offset = 0; this.targetOffset = 0; this._offVel = 0; this.active = 0;
    this.group.visible = true;
  }

  update(t, dt) {
    // which station hold are we in?
    let key = null;
    for (const k in STATIONS) { const s = STATIONS[k]; if (t >= s.t0 - 0.004 && t <= s.t1 + 0.004) { key = k; break; } }
    if (key !== this.station) this._setStation(key);
    if (!this.group.visible) return;

    const dts = Math.min(dt, 0.05);
    this.detailT = damp(this.detailT, this.detailOpen ? 1 : 0, 6, dts);
    const dT = ease(this.detailT);

    // SCROLL-BOUND row: the station hold's scroll-progress (t across t0→t1, where
    // the camera is parked) maps onto the card offset — but warped with a DWELL
    // DETENT so each card holds at centre and only transitions through a short band
    // (Active-Theory "snap" feel). This also gives the first/last cards a sticky zone
    // even when the station scroll window is short (the Unilever hold is narrow).
    const st = STATIONS[this.station];
    const span = Math.max(1e-4, st.t1 - st.t0);
    const pRaw = clamp((t - st.t0) / span, 0, 1);
    // ENTRANCE / EXIT envelope — cards assemble in over the first IN of the hold and
    // dissolve out over the last OUT, kept INSIDE the parked-camera window.
    const IN = 0.16, OUT = 0.16;
    let env;
    if (pRaw < IN) env = pRaw / IN;
    else if (pRaw > 1 - OUT) env = (1 - pRaw) / OUT;
    else env = 1;
    this.appear = damp(this.appear, this.detailOpen ? 1 : clamp(env, 0, 1), 9, dts);

    if (!this.detailOpen) {
      // card-scroll rides the MIDDLE band (so the IN/OUT bands are pure entrance/exit)
      const p = clamp((pRaw - IN) / Math.max(1e-4, 1 - IN - OUT), 0, 1);
      const lastN = Math.max(0, this.cards.length - 1);
      // continuous card index, then snap-warp the fractional part:
      //   hold on card i, quick ease across the gap, hold on card i+1
      const cont = p * lastN;
      const base = Math.min(Math.floor(cont), Math.max(0, lastN - 1));
      const f = cont - base;
      const LO = 0.34, HI = 0.66;                 // flat dwell outside [LO,HI]
      let fw;
      if (f <= LO) fw = 0; else if (f >= HI) fw = 1;
      else { const k = (f - LO) / (HI - LO); fw = k * k * (3 - 2 * k); }
      this.targetOffset = (base + fw) * STEP;
    }
    // SPRING settle (elastic) toward the target — replaces the plain exponential damp
    // so the landing has a touch of give (a quick, slight overshoot then rest).
    {
      const K = 190, D = 19;
      const a = K * (this.targetOffset - this.offset) - D * this._offVel;
      this._offVel += a * dts;
      this.offset += this._offVel * dts;
      this.active = clamp(Math.round(this.offset / STEP), 0, this.cards.length - 1);
    }


    // --- VELOCITY DISTORTION: smear/lean/blur from how fast the row is moving ---
    const ds = this.offset - this._lastOffset; this._lastOffset = this.offset;
    this._smoothSpeed = damp(this._smoothSpeed, ds / Math.max(dts, 1e-3), 10, dts);
    const sp = this._smoothSpeed;
    SHARED.velDistort.value = clamp(sp * 0.032, -0.3, 0.3) * (1 - dT);
    SHARED.velAmt.value = clamp(Math.abs(sp) * 0.0024, 0, 0.034) * (1 - dT);
    SHARED.velDir.value.set(sp >= 0 ? 1 : -1, 0);

    // --- HOVER (disabled while a case is open): which card + the cursor UV on it ---
    let hovBack = null, hovCard = null, hovUV = null;
    if (!this.detailOpen) {
      this._ray.setFromCamera(this._ndc, this.camera);
      const hit = this._ray.intersectObjects(this.cards.map((c) => c.back), false)[0];
      if (hit) { hovBack = hit.object; hovUV = hit.uv; hovCard = this.cards.find((c) => c.back === hovBack); }
    }
    const lean = SHARED.velDistort.value * 0.6;        // match the glass's velocity lean on the text

    // lay out: coverflow grid; on detail-open the chosen card eases to a big "cover"
    // pose (forward + left) while the rest fade away — the HTML case panel sits right.
    // Hover is fully EASED (dreamy) and lights a warm lantern-pool on the glass while
    // the brand/title floats forward off the surface and blooms.
    const lastIdx = Math.max(1, this.cards.length - 1);
    const STAG = 0.55;                                  // entrance stagger spread across the row
    for (const cd of this.cards) {
      const d = (cd.i * STEP) - this.offset, a = d / STEP;
      const isHov = hovCard === cd;
      cd.hov = damp(cd.hov || 0, isHov ? 1 : 0, 9, dts); // eased hover (no jump)
      const h = cd.hov;
      const focus = clamp(1 - Math.abs(a) * 0.85, 0, 1) + h * 0.18;
      const fc = clamp(focus, 0, 1);
      // base coverflow transform (all hover terms eased through h)
      const bx = d * 0.86, by = 0, bz = -Math.abs(a) * 0.9 + fc * 0.5 + h * 0.18;
      const bry = -a * 0.5, bsc = 1 + fc * 0.18;
      // parallax tilt toward the cursor — like lifting a glass plate to the moonlight
      const tiltY = (isHov && hovUV ? hovUV.x - 0.5 : 0) * h * 0.43;
      const tiltX = (isHov && hovUV ? -(hovUV.y - 0.5) : 0) * h * 0.43;
      // staggered entrance/exit: cards rise from below + scale + fade + a slight tilt
      const norm = cd.i / lastIdx;
      const ec = ease(clamp(this.appear * (1 + STAG) - norm * STAG, 0, 1));
      const riseY = (1 - ec) * -1.15, entScale = 0.6 + 0.4 * ec, entRotX = (1 - ec) * 0.5;
      const bu = cd.back.material.userData;
      const isDetail = this._detailCard === cd;

      if (isDetail) {                                   // → "cover" pose
        cd.group.position.set(lerp(bx, -CARD_W * 0.52, dT), lerp(by, 0.12, dT), lerp(bz, 1.75, dT));
        cd.group.rotation.set(0, lerp(bry, 0.1, dT), 0);
        cd.group.scale.setScalar(lerp(bsc, 1.5, dT));
        bu.focus.value = damp(bu.focus.value, 1, 8, dts);
        cd.back.material.opacity = 1; cd.back.renderOrder = 20; cd.back.visible = true;
        cd.fore.position.set(0, 0, 0.012);
        cd.fore.scale.setScalar(1); cd.fore.material.color.setScalar(0.48);
        cd.fore.material.opacity = 1; cd.fore.renderOrder = 21; cd.fore.visible = true;
      } else {
        cd.group.position.set(bx, by + riseY, bz - (1 - ec) * 0.4);
        cd.group.rotation.set(entRotX + tiltX, bry + tiltY, 0);
        cd.group.scale.setScalar(bsc * entScale);
        bu.focus.value = damp(bu.focus.value, fc, 8, dts);
        const op = clamp(0.25 + fc * 0.95, 0, 1) * (1 - dT) * ec;
        cd.back.material.opacity = op;
        cd.back.renderOrder = Math.round(fc * 10);
        cd.back.visible = op > 0.02;
        // floating text layer: lifts well off the glass + a gentle (not blinding) lift in brightness
        cd.fore.position.set(lean, 0, 0.012 + h * 0.20);
        cd.fore.scale.setScalar(1 + h * 0.05);
        cd.fore.material.color.setScalar(0.48 + h * 0.16);
        cd.fore.material.opacity = op;
        cd.fore.renderOrder = cd.back.renderOrder + 1;
        cd.fore.visible = op > 0.02;
      }
      // lantern light-pool follows the cursor (gated by focus so dim cards don't glow)
      bu.hover.value = h * fc;
      if (isHov && hovUV) bu.pointer.value.set(hovUV.x, hovUV.y);
    }
  }

  get activeProject() { return this.cards[this.active]?.project || null; }
}
