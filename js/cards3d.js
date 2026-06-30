// ============================================================================
//  cards3d.js — WebGL glass project cards (Active-Theory "Work" language), shown
//  IN the 3D scene during a station hold. A draggable row of glass-fronted panels
//  with damped inertia + snap, an active card forward + crisp, neighbours receding,
//  dimmed and angled (coverflow). Built procedurally — designed card faces (accent
//  gradient + brand / title / meta), fresnel-rimmed glass that reflects the scene
//  env. Milestone 1: grid + drag/inertia/snap + glass + focus falloff.
//  (Velocity distortion, DOF, and click→detail land next.)
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

// ---- designed card face (no photos): accent wash + brand / title / meta -----
function faceTexture(project, accentHex) {
  const w = 600, h = 800, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  // deep base + accent glow from the lower third (premium dusk panel)
  g.fillStyle = '#0d1219'; g.fillRect(0, 0, w, h);
  const gl = g.createRadialGradient(w * 0.5, h * 0.92, 30, w * 0.5, h * 0.62, h * 0.9);
  gl.addColorStop(0, accentHex + 'cc'); gl.addColorStop(0.4, accentHex + '33'); gl.addColorStop(1, 'rgba(13,18,25,0)');
  g.fillStyle = gl; g.fillRect(0, 0, w, h);
  // fine grain
  for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
  // hairline frame
  g.strokeStyle = 'rgba(245,235,220,0.16)'; g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44);
  // kicker (meta) — mono, letter-spaced, accent
  g.fillStyle = accentHex; g.font = '600 17px "Space Mono", monospace';
  g.textBaseline = 'alphabetic';
  drawTracked(g, (project.meta || '').toUpperCase(), 44, 96, 3.5);
  // brand — display serif, large
  g.fillStyle = '#F5EBDC'; g.textBaseline = 'top';
  wrap(g, project.brand || '', 44, h * 0.30, w - 88, 58, '600 52px "Cormorant Garamond", Georgia, serif', 1.02);
  // title — smaller serif
  g.fillStyle = 'rgba(245,235,220,0.82)';
  wrap(g, project.title || '', 44, h * 0.62, w - 88, 30, '500 27px "Cormorant Garamond", Georgia, serif', 1.12);
  // view cue
  g.fillStyle = 'rgba(245,235,220,0.6)'; g.font = '600 14px "Space Mono", monospace';
  drawTracked(g, 'VIEW CASE →', 44, h - 56, 2.5);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function drawTracked(g, str, x, y, tracking) {
  let cx = x; for (const ch of str) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + tracking; }
}
function wrap(g, str, x, y, maxW, lh, font, lhMul) {
  g.font = font; const words = str.split(' '); let line = '', yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (g.measureText(test).width > maxW && line) { g.fillText(line, x, yy); line = word; yy += lh * lhMul; }
    else line = test;
  }
  if (line) g.fillText(line, x, yy);
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

// ---- fresnel-rimmed glass card: env reflection + soft glow + VELOCITY DISTORTION
// (lean/stretch + directional motion blur on the flick) + DOF blur when receded ----
function glassCardMaterial(tex, accent) {
  const mat = new THREE.MeshStandardMaterial({
    map: tex, color: 0xffffff, roughness: 0.18, metalness: 0.0,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35,
    envMapIntensity: 1.2, transparent: true, side: THREE.FrontSide,
  });
  mat.userData.focus = { value: 1 };        // 0 (receded/dim/blur) .. 1 (active/crisp)
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uAccent = { value: accent };
    shader.uniforms.uFocus = mat.userData.focus;
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
      .replace('#include <common>', '#include <common>\nuniform vec3 uAccent; uniform float uFocus,uVelAmt,uDofBlur; uniform vec2 uVelDir;\nvec4 gCard;')
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
          totalEmissiveRadiance += uAccent * fres * (0.45 + 0.7 * uFocus); } // accent glass rim`);
  };
  mat.customProgramCacheKey = () => 'glassCard_v2';
  return mat;
}

export class Cards3D {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group);
    this.station = null; this.cards = [];
    this.offset = 0; this.targetOffset = 0; this.vel = 0; this.active = 0;
    this.dragging = false; this._px = 0; this._py = 0; this._moved = 0; this._horizontal = false;
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
    el.innerHTML = `<button class="cd-close" type="button" aria-label="Close case">&#215;</button><div class="cd-scroll"><div class="cd-body"></div></div>`;
    document.body.appendChild(el);
    this.detailEl = el; this.detailBody = el.querySelector('.cd-body');
    el.querySelector('.cd-close').addEventListener('click', () => this.closeDetail());
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.detailOpen) this.closeDetail(); });
  }

  _bindPointer() {
    const dom = document;
    const down = (e) => {
      if (!this.group.visible || this.detailOpen) return;
      this.dragging = true; this._px = e.clientX; this._py = e.clientY; this._moved = 0; this._horizontal = false; this.vel = 0;
    };
    const move = (e) => {
      this._ndc.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
      if (!this.dragging) return;
      const dx = e.clientX - this._px, dy = e.clientY - this._py;
      this._moved += Math.abs(dx) + Math.abs(dy);
      if (!this._horizontal && Math.abs(dx) > Math.abs(dy) + 3) this._horizontal = true;
      if (this._horizontal) {
        const k = (STEP * 2.2) / window.innerWidth;            // px → world drag
        this.targetOffset -= dx * k; this.vel = -dx * k;
        this._px = e.clientX; this._py = e.clientY;
        if (e.cancelable) e.preventDefault();
      }
    };
    const up = () => {
      if (!this.dragging) return;
      this.dragging = false;
      if (this._moved < 7 && !this.detailOpen) {               // a tap, not a drag → maybe open a case
        this._ray.setFromCamera(this._ndc, this.camera);
        const hit = this._ray.intersectObjects(this.cards.map((c) => c.mesh), false)[0];
        if (hit) { const cd = this.cards.find((c) => c.mesh === hit.object); if (cd) { this.targetOffset = cd.i * STEP; this.openDetail(cd); return; } }
      }
      this.targetOffset += this.vel * 6;                       // flick inertia
      this.targetOffset = clamp(Math.round(this.targetOffset / STEP) * STEP, 0, (this.cards.length - 1) * STEP); // snap
    };
    dom.addEventListener('pointerdown', down, { passive: true });
    dom.addEventListener('pointermove', move, { passive: false });
    dom.addEventListener('pointerup', up, { passive: true });
    dom.addEventListener('pointercancel', up, { passive: true });
  }

  // jump cards by n (arrows / external)
  flip(n) {
    if (!this.station) return;
    this.targetOffset = clamp((this.active + n) * STEP, 0, (this.cards.length - 1) * STEP);
  }

  openDetail(cd) {
    this._detailCard = cd;
    this.detailBody.innerHTML = buildDetailHTML(cd.project);
    this.detailEl.querySelector('.cd-scroll').scrollTop = 0;
    this.detailEl.style.setProperty('--accent', this._accentHex);
    this.detailEl.classList.add('show'); this.detailEl.setAttribute('aria-hidden', 'false');
    this.detailOpen = true;
    document.documentElement.style.overflow = 'hidden';     // hold the journey scroll while reading
  }

  closeDetail() {
    if (!this.detailOpen) return;
    this.detailOpen = false; this._detailCard = null;
    this.detailEl.classList.remove('show'); this.detailEl.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
  }

  _setStation(key) {
    if (this.detailOpen) this.closeDetail();
    // tear down
    for (const cd of this.cards) { cd.mesh.geometry.dispose(); cd.mesh.material.dispose(); if (cd.tex) cd.tex.dispose(); }
    this.cards = []; this.group.clear(); this._detailCard = null;
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
    // build a card per project
    const geo = new THREE.PlaneGeometry(CARD_W, CARD_H, 1, 1);
    st.data.projects.forEach((p, i) => {
      const tex = faceTexture(p, accentHex);
      const mesh = new THREE.Mesh(geo, glassCardMaterial(tex, accent));
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.cards.push({ mesh, tex, i, project: p });
    });
    this.offset = 0; this.targetOffset = 0; this.vel = 0; this.active = 0;
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

    // damp toward target; idle inertia decays (frozen while a case is open)
    if (!this.detailOpen) {
      if (!this.dragging) this.targetOffset += this.vel, this.vel *= Math.exp(-dt * 4);
      this.offset = damp(this.offset, this.targetOffset, 7, dts);
      this.active = clamp(Math.round(this.offset / STEP), 0, this.cards.length - 1);
    }

    // --- VELOCITY DISTORTION: smear/lean/blur from how fast the row is moving ---
    const ds = this.offset - this._lastOffset; this._lastOffset = this.offset;
    this._smoothSpeed = damp(this._smoothSpeed, ds / Math.max(dts, 1e-3), 10, dts);
    const sp = this._smoothSpeed;
    SHARED.velDistort.value = clamp(sp * 0.032, -0.3, 0.3) * (1 - dT);
    SHARED.velAmt.value = clamp(Math.abs(sp) * 0.0024, 0, 0.034) * (1 - dT);
    SHARED.velDir.value.set(sp >= 0 ? 1 : -1, 0);

    // --- HOVER (disabled while a case is open) ---
    let hovMesh = null;
    if (!this.detailOpen) {
      this._ray.setFromCamera(this._ndc, this.camera);
      const hit = this._ray.intersectObjects(this.cards.map((c) => c.mesh), false)[0];
      hovMesh = hit ? hit.object : null;
    }

    // lay out: coverflow grid; on detail-open the chosen card eases to a big "cover"
    // pose (forward + left) while the rest fade away — the HTML case panel sits right.
    for (const cd of this.cards) {
      const d = (cd.i * STEP) - this.offset, a = d / STEP;
      cd.hovered = cd.mesh === hovMesh;
      const focus = clamp(1 - Math.abs(a) * 0.85, 0, 1) + (cd.hovered ? 0.16 : 0);
      const fc = clamp(focus, 0, 1);
      // base coverflow transform
      const bx = d * 0.86, by = 0, bz = -Math.abs(a) * 0.9 + fc * 0.5 + (cd.hovered ? 0.12 : 0);
      const bry = -a * 0.5, bsc = 1 + fc * 0.18;
      const isDetail = this._detailCard === cd;
      if (isDetail) {                                   // → "cover" pose
        cd.mesh.position.set(lerp(bx, -CARD_W * 0.52, dT), lerp(by, 0.12, dT), lerp(bz, 1.75, dT));
        cd.mesh.rotation.y = lerp(bry, 0.1, dT);
        cd.mesh.scale.setScalar(lerp(bsc, 1.5, dT));
        cd.mesh.material.userData.focus.value = damp(cd.mesh.material.userData.focus.value, 1, 8, dts);
        cd.mesh.material.opacity = 1; cd.mesh.renderOrder = 20; cd.mesh.visible = true;
      } else {
        cd.mesh.position.set(bx, by, bz); cd.mesh.rotation.y = bry; cd.mesh.scale.setScalar(bsc);
        cd.mesh.material.userData.focus.value = damp(cd.mesh.material.userData.focus.value, fc, 8, dts);
        cd.mesh.material.opacity = clamp(0.25 + fc * 0.95, 0, 1) * (1 - dT);
        cd.mesh.renderOrder = Math.round(fc * 10);
        cd.mesh.visible = cd.mesh.material.opacity > 0.02;
      }
    }
  }

  get activeProject() { return this.cards[this.active]?.project || null; }
}
