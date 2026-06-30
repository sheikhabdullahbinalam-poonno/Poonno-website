// ============================================================================
//  newspaper.js — the intro hero. An aged folded newspaper rests on the platform
//  (with a few scattered sheets); the camera focuses it (§ camera keyframes), then
//  on scroll it lifts, tumbles, and flies to fill the frame — where the crisp HTML
//  article cross-fades in (see ui/news overlay). Driven by scroll t.
// ============================================================================

import * as THREE from 'three';
import { preloadModels, getModel, normalize } from './models.js';

const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); };

// scroll-t schedule for the hero — unhurried; the tumble dances with the scroll
export const NEWS = { rest: 0.045, fly0: 0.05, fly1: 0.165, gone: 0.19 };

export class Newspaper {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.hero = null;

    this.restPos = new THREE.Vector3(7, 0.95, 3);
    this.restQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.05, 0.5, 0.02));
    // print face is local +Y; this offset turns it to face the camera (broad side on)
    this._faceOffset = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    this._fwd = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._apex = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._spinQ = new THREE.Quaternion();
    this._faceQ = new THREE.Quaternion();
    this._edgeQ = new THREE.Quaternion();
    this._swirlQ = new THREE.Quaternion();
    // print face is local +Y. edgeOffset turns the facing paper 90° so its EDGE
    // points at the camera; swirlOffset is the tilted/yawed "lifted by air" pose.
    this._edgeOffset = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, Math.PI * 0.38, 0)); // strong angle, not a true (invisible) edge
    this._swirlOffset = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 1.15, 0.2));
    this._e = new THREE.Euler();
    this.flyAmt = 0;   // 0..1, exposed so the UI can time the cross-fade / wind

    preloadModels().then(() => {
      const np = getModel('newspaper');
      if (np) {
        // normalize recenters the model via ITS position; wrap it so we can move
        // a holder freely without undoing that recentring (the train/tree pattern).
        normalize(np, { length: 1.4, align: 'none', ground: false });
        const sheet = newsprintTex();   // aged, grungy newsprint (replaces baked print)
        const bump = newsprintBumpTex(1024, 1320);
        np.traverse((o) => {
          if (!o.isMesh) return;
          o.frustumCulled = false;
          o.material.side = THREE.DoubleSide;
          o.material.color = new THREE.Color(0x8c8068);   // dim at rest (emissive ramp lights it on the fly)
          o.material.roughness = 0.97; o.material.metalness = 0;
          o.material.map = sheet;
          o.material.bumpMap = bump; o.material.bumpScale = 0.5;   // creases/wrinkles — not flat
          // (no alphaMap — the folded GLB's UV islands made real tearing cut the middle;
          //  the worn/torn look is painted into the colour map instead)
          // unlit at rest (#1); a gentle self-light ramps in ONLY as it sweeps up
          // to face the viewer, so the fill reads instead of going black.
          o.material.emissive = new THREE.Color(0xffffff);
          o.material.emissiveMap = sheet;
          o.material.emissiveIntensity = 0;
          o.material.needsUpdate = true;
          this.heroMat = o.material;
        });
        const holder = new THREE.Group();
        holder.add(np);
        this.group.add(holder);
        this.hero = holder;
        // Seat it ON the platform: lift the (centred) holder by half its height
        // so the paper's underside rests on the surface — no clipping, no floating.
        holder.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(holder);
        this.restPos.y = 0.82 + (bb.max.y - bb.min.y) / 2 + 0.04;
      }
      // many scattered pages dressing the platform & ground (Scene 1) — randomised
      // size / rotation / lie for variety.
      const sheetMat = new THREE.MeshStandardMaterial({ color: 0x5f584e, roughness: 0.96, metalness: 0, side: THREE.DoubleSide });
      const rnd = (a, b) => a + Math.random() * (b - a);
      for (let i = 0; i < 14; i++) {
        const s = getModel('newspaperSheet'); if (!s) continue;
        normalize(s, { length: rnd(0.7, 1.6), align: 'none', ground: false });
        s.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.material = sheetMat; } });
        const holder = new THREE.Group();
        holder.add(s);
        // cluster near the hero (≈7,3) in the establishing/focus view; a few drift wider
        const near = Math.random() < 0.7;
        const x = near ? rnd(4, 11) : rnd(-3, 13);
        const z = near ? rnd(-2, 9) : rnd(-12, 16);
        holder.position.set(x, near ? 0.82 : 0.05, z);
        holder.rotation.set(rnd(-0.12, 0.12), Math.random() * Math.PI * 2, rnd(-0.1, 0.1));
        this.group.add(holder);
      }
    });
  }

  update(t, camera) {
    if (!this.hero) return;
    if (t > NEWS.gone) { this.hero.visible = false; this.flyAmt = 1; return; }
    this.hero.visible = true;

    if (t <= NEWS.fly0) {
      this.flyAmt = 0;
      if (this.heroMat) this.heroMat.emissiveIntensity = 0.2;     // soft self-glow at rest — reads as a luminous object to interact with
      const fl = Math.sin(performance.now() * 0.0022) * 0.025;   // resting flutter
      this.hero.position.copy(this.restPos); this.hero.position.y += fl;
      this.hero.quaternion.copy(this.restQuat);
      this.hero.scale.setScalar(0.9);
      return;
    }

    // k: 0..1 across the fly (linear; each phase eases internally so motion is fluid)
    const k = Math.min(1, (t - NEWS.fly0) / (NEWS.fly1 - NEWS.fly0));
    this.flyAmt = k;
    const now = performance.now();

    // Target: a point just in front of the camera (where it faces the viewer).
    this._fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    this._target.copy(camera.position).addScaledVector(this._fwd, 1.55);
    // Apex: lifted above the rest spot, already drifting toward the camera.
    this._apex.copy(this.restPos);
    this._apex.x += (this._target.x - this.restPos.x) * 0.3;
    this._apex.z += (this._target.z - this.restPos.z) * 0.3;
    this._apex.y += 2.4;

    // --- position: rest → (lift) → apex → (draw in) → in front of camera, then HOLD ---
    if (k < 0.4) {
      this.hero.position.lerpVectors(this.restPos, this._apex, ease(k / 0.4));
    } else {
      this.hero.position.lerpVectors(this._apex, this._target, ease(Math.min(1, (k - 0.4) / 0.45)));
    }
    // air wobble — strong while aloft, fades as it locks onto the camera
    const wob = (1 - k) * (1 - k) * 0.22;
    this.hero.position.x += Math.sin(now * 0.0024) * wob;
    this.hero.position.y += Math.cos(now * 0.0031) * wob * 0.8;
    this.hero.position.z += Math.sin(now * 0.0019 + 1.3) * wob * 0.6;

    // --- orientation: rest → swirl(lifted) → edge-first → face the viewer ---
    this._faceQ.copy(camera.quaternion).multiply(this._faceOffset);      // broad face to viewer
    this._edgeQ.copy(this._faceQ).multiply(this._edgeOffset);            // edge toward viewer
    this._swirlQ.copy(this.restQuat).multiply(this._swirlOffset);        // lifted/tilted pose
    const spin = (1 - k) * Math.PI * 1.5;                                // gentle continuous spin, dies out
    this._spinQ.setFromEuler(this._e.set(spin * 0.5, spin, spin * 0.35));
    if (k < 0.45) {                          // lifted by air, swirling up (broad face flashing)
      this._q.copy(this._swirlQ).multiply(this._spinQ);
      this.hero.quaternion.slerpQuaternions(this.restQuat, this._q, ease(k / 0.45));
    } else if (k < 0.65) {                   // swirls toward the camera, edge-first (brief)
      this._q.copy(this._swirlQ).multiply(this._spinQ);
      this.hero.quaternion.slerpQuaternions(this._q, this._edgeQ, ease((k - 0.45) / 0.20));
    } else if (k < 0.85) {                   // turns to face the viewer
      this.hero.quaternion.slerpQuaternions(this._edgeQ, this._faceQ, ease((k - 0.65) / 0.20));
    } else {                                 // HOLD facing the viewer, filling — then it dissolves
      this.hero.quaternion.copy(this._faceQ);
    }

    // --- scale: small aloft, grows to fill by the time it faces the viewer ---
    this.hero.scale.setScalar(lerp(0.9, 3.3, ease(Math.min(1, Math.max(0, (k - 0.2) / 0.6)))));
    // catch the light as it turns to face you (keeps the fill readable, not black)
    if (this.heroMat) this.heroMat.emissiveIntensity = 0.2 + Math.max(0, (k - 0.25) / 0.75) * 0.5;
  }
}

// ---- procedurally-drawn aged newsprint (replaces the model's "Lorem Ipsum") --
let _newsprint = null;
function newsprintTex() {
  if (_newsprint) return _newsprint;
  const w = 1024, h = 1320;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const ink = '#241a0f', M = 60;

  // heavily-yellowed aged paper + uneven staining
  g.fillStyle = '#cdb162'; g.fillRect(0, 0, w, h);
  const yt = g.createLinearGradient(0, 0, w, h);          // amber wash for an old, deep-yellow tone
  yt.addColorStop(0, 'rgba(180,140,50,0.18)'); yt.addColorStop(1, 'rgba(150,110,40,0.22)');
  g.fillStyle = yt; g.fillRect(0, 0, w, h);
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, 'rgba(110,82,38,0.18)'); grd.addColorStop(0.5, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(92,66,30,0.24)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(126,92,46,0.06)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 60 + Math.random() * 140, 0, 6.283); g.fill(); }

  // masthead
  g.fillStyle = ink; g.textAlign = 'center';
  g.fillRect(M, 84, w - 2 * M, 5);
  g.font = '700 78px Georgia, "Times New Roman", serif';
  g.fillText('The Daily Adroit', w / 2, 168);
  g.fillRect(M, 196, w - 2 * M, 5);
  g.font = '600 19px Georgia, serif';
  g.fillText('NIGHT EDITION   ·   EST. CURIOSITY   ·   No. 01', w / 2, 226);
  g.fillRect(M, 244, w - 2 * M, 2);

  // headline + byline
  g.textAlign = 'left';
  g.font = '700 70px Georgia, serif'; g.fillText('Who Is Poonno?', M, 332);
  g.font = 'italic 24px Georgia, serif'; g.fillText('A Special Report · By the Editorial Desk', M, 372);
  g.fillRect(M, 392, w - 2 * M, 1);

  // layout: photo top-left, text wrapping; second column of text
  const gap = 40, colW = (w - 2 * M - gap) / 2;
  const px = M, py = 416, pw = colW, ph = 360;
  const pg = g.createLinearGradient(px, py, px + pw, py + ph);
  pg.addColorStop(0, '#6b6b6b'); pg.addColorStop(1, '#161616');
  g.fillStyle = pg; g.fillRect(px, py, pw, ph);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 600; i++) { g.beginPath(); g.arc(px + Math.random() * pw, py + Math.random() * ph, Math.random() * 1.6, 0, 6.283); g.fill(); }
  g.strokeStyle = ink; g.lineWidth = 1.5; g.strokeRect(px, py, pw, ph);
  g.fillStyle = ink; g.font = '600 14px Georgia, serif'; g.fillText('THE MAN BEHIND THE JOURNEY', px, py + ph + 22);

  // thin column rule between the two columns
  g.globalAlpha = 0.35; g.fillStyle = ink;
  g.fillRect(M + colW + gap / 2, py, 1, h - py - M);
  g.globalAlpha = 1;

  fakeText(g, ink, px, py + ph + 44, colW, h - (py + ph + 44) - M);   // col 1 (below photo)
  fakeText(g, ink, M + colW + gap, py, colW, h - py - M);             // col 2 (full)

  // ---- AGING (drawn OVER the print so it reads as a genuinely old, handled sheet) ----
  // faded/sun-bleached patches (lighten the ink unevenly)
  for (let i = 0; i < 9; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 90 + Math.random() * 170;
    const fg = g.createRadialGradient(x, y, 0, x, y, r);
    fg.addColorStop(0, 'rgba(206,190,154,0.18)'); fg.addColorStop(1, 'rgba(206,190,154,0)');
    g.fillStyle = fg; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }
  // foxing — small brown age spots
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 1 + Math.random() * 5;
    g.fillStyle = `rgba(${118 + Math.random() * 54},${78 + Math.random() * 40},${38 + Math.random() * 28},${0.05 + Math.random() * 0.16})`;
    g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }
  // damp / water stains — soft brown blooms with darker rims
  for (let i = 0; i < 7; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 60 + Math.random() * 150;
    const wg = g.createRadialGradient(x, y, r * 0.35, x, y, r);
    wg.addColorStop(0, 'rgba(108,78,38,0.03)'); wg.addColorStop(0.82, 'rgba(92,62,28,0.12)'); wg.addColorStop(1, 'rgba(80,54,24,0)');
    g.fillStyle = wg; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }
  // fold creases — centre cross fold + crinkles, darkened along the lines
  g.strokeStyle = 'rgba(66,46,24,0.24)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, h * 0.5); g.bezierCurveTo(w * 0.3, h * 0.5 - 7, w * 0.62, h * 0.5 + 7, w, h * 0.5 - 4); g.stroke();
  g.beginPath(); g.moveTo(w * 0.5, 0); g.bezierCurveTo(w * 0.5 - 7, h * 0.32, w * 0.5 + 7, h * 0.62, w * 0.5 - 4, h); g.stroke();
  g.strokeStyle = 'rgba(66,46,24,0.08)'; g.lineWidth = 1.4;
  for (let i = 0; i < 16; i++) { g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.lineTo(w, y + (Math.random() - 0.5) * 46); g.stroke(); }
  // coffee-ring stains — a darker ring with a faint flooded centre
  const coffeeRing = (cx, cy, rad) => {
    g.save();
    const rg = g.createRadialGradient(cx, cy, rad * 0.62, cx, cy, rad);
    rg.addColorStop(0, 'rgba(96,58,24,0.0)'); rg.addColorStop(0.72, 'rgba(96,58,24,0.07)');
    rg.addColorStop(0.9, 'rgba(70,40,16,0.36)'); rg.addColorStop(1, 'rgba(70,40,16,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, rad, 0, 6.283); g.fill();
    g.strokeStyle = 'rgba(64,36,14,0.42)'; g.lineWidth = 2.5 + Math.random() * 2;        // the crisp ring edge
    g.beginPath(); for (let a = 0; a <= 6.3; a += 0.18) { const rr = rad * (0.9 + Math.sin(a * 5) * 0.012); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; a === 0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
    g.restore();
  };
  coffeeRing(w * 0.72, h * 0.2, 78);
  coffeeRing(w * 0.2, h * 0.82, 58);
  // handled edge darkening (vignette) + soft worn-edge fringe
  const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.64);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(54,38,20,0.4)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
  paintWornEdge(g, w, h);

  _newsprint = new THREE.CanvasTexture(c);
  _newsprint.colorSpace = THREE.SRGBColorSpace;
  // flipped both ways so the masthead lands UN-mirrored on the panel facing the camera at rest
  _newsprint.flipY = true;
  _newsprint.wrapS = THREE.RepeatWrapping; _newsprint.repeat.x = -1; _newsprint.offset.x = 1;
  _newsprint.anisotropy = 8;
  return _newsprint;
}

// A SOFT worn edge: the outer band of the sheet darkens and frays gently (fine
// short fibres), so the rim reads as old, handled, lightly-torn paper — without the
// hard zigzag silhouette cut that looked unreal on the folded model.
function paintWornEdge(g, w, h) {
  g.save();
  const band = 26;
  for (const [x0, y0, x1, y1] of [[0, 0, w, 0], [0, h, w, h], [0, 0, 0, h], [w, 0, w, h]]) {
    const horiz = y0 === y1;
    const lg = horiz
      ? g.createLinearGradient(0, y0, 0, y0 === 0 ? band : h - band)
      : g.createLinearGradient(x0, 0, x0 === 0 ? band : w - band, 0);
    lg.addColorStop(0, 'rgba(58,40,18,0.5)'); lg.addColorStop(1, 'rgba(58,40,18,0)');
    g.fillStyle = lg;
    if (horiz) g.fillRect(0, y0 === 0 ? 0 : h - band, w, band);
    else g.fillRect(x0 === 0 ? 0 : w - band, 0, band, h);
  }
  // fine frayed fibres poking in from each edge (short, soft — not a zigzag)
  g.strokeStyle = 'rgba(60,42,20,0.4)'; g.lineWidth = 1;
  for (let i = 0; i < 260; i++) {
    const edge = i % 4; let x, y, dx = 0, dy = 0; const len = 2 + Math.random() * 8;
    if (edge === 0) { x = Math.random() * w; y = 1; dy = len; }
    else if (edge === 1) { x = Math.random() * w; y = h - 1; dy = -len; }
    else if (edge === 2) { x = 1; y = Math.random() * h; dx = len; }
    else { x = w - 1; y = Math.random() * h; dx = -len; }
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx + (Math.random() - 0.5) * 3, y + dy + (Math.random() - 0.5) * 3); g.stroke();
  }
  g.restore();
}

// CREASE / CRUMPLE bump so the paper isn't flat — fold grooves + soft crinkle blobs.
let _newsBump;
function newsprintBumpTex(w, h) {
  if (_newsBump) return _newsBump;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);                 // neutral height
  for (let i = 0; i < 150; i++) {                                  // soft crumple blobs (raise/lower)
    const x = Math.random() * w, y = Math.random() * h, r = 24 + Math.random() * 90, v = Math.random() < 0.5 ? 36 : 220;
    const bg = g.createRadialGradient(x, y, 0, x, y, r);
    bg.addColorStop(0, `rgba(${v},${v},${v},${0.05 + Math.random() * 0.06})`); bg.addColorStop(1, 'rgba(128,128,128,0)');
    g.fillStyle = bg; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }
  // fold grooves (dark) with a bright ridge alongside (the raised crease)
  const fold = (mv) => { g.lineWidth = 3; g.strokeStyle = 'rgba(30,30,30,0.7)'; mv(0); g.lineWidth = 2; g.strokeStyle = 'rgba(225,225,225,0.5)'; mv(4); };
  fold((o) => { g.beginPath(); g.moveTo(0, h * 0.5 + o); g.bezierCurveTo(w * 0.3, h * 0.5 - 7 + o, w * 0.62, h * 0.5 + 7 + o, w, h * 0.5 - 4 + o); g.stroke(); });
  fold((o) => { g.beginPath(); g.moveTo(w * 0.5 + o, 0); g.bezierCurveTo(w * 0.5 - 7 + o, h * 0.32, w * 0.5 + 7 + o, h * 0.62, w * 0.5 - 4 + o, h); g.stroke(); });
  for (let i = 0; i < 26; i++) {                                   // fine crinkle scratches
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? 40 : 215},${Math.random() < 0.5 ? 40 : 215},${Math.random() < 0.5 ? 40 : 215},0.18)`;
    g.lineWidth = 1; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.lineTo(w, y + (Math.random() - 0.5) * 50); g.stroke();
  }
  _newsBump = new THREE.CanvasTexture(c); _newsBump.flipY = true; // match the colour map
  _newsBump.wrapS = THREE.RepeatWrapping; _newsBump.repeat.x = -1; _newsBump.offset.x = 1;
  return _newsBump;
}

// Fine, dense justified "type" (thin, tightly-leaded lines with paragraph breaks
// and the odd bold cross-head) so the columns read as real newsprint — not the
// sparse straight dashes the old version produced.
function fakeText(g, ink, x, y, w, h, lh = 8) {
  let yy = y;
  while (yy < y + h - lh) {
    // occasional bold sub-headline / cross-head to break up the grey
    if (Math.random() < 0.13 && yy + 20 < y + h) {
      g.globalAlpha = 1; g.fillStyle = ink;
      g.fillRect(x, yy + 3, w * (0.42 + Math.random() * 0.42), 3.6);
      yy += 17;
    }
    const lines = 4 + Math.floor(Math.random() * 7);
    for (let i = 0; i < lines && yy < y + h - lh; i++) {
      const last = i === lines - 1;
      const lw = last ? w * (0.24 + Math.random() * 0.5) : w * (0.93 + Math.random() * 0.06);
      g.globalAlpha = 0.55 + Math.random() * 0.28;          // slight ink variance
      g.fillStyle = ink; g.fillRect(x, yy, Math.min(lw, w), 1.3);
      yy += lh;
    }
    g.globalAlpha = 1;
    yy += lh * 0.85;                                          // paragraph gap
  }
}
