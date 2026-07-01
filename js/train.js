// ============================================================================
//  train.js — the Bangladesh Railway train (§6.1, refs Train Engine.png +
//  Carriage.webp). A detailed (not low-poly) diesel LOCOMOTIVE — front cab with
//  lit windows + number, long ribbed hood, cream lower band, yellow footplate &
//  handrails, red buffer beam + round BR monogram on the nose, black bogies with
//  wheels — pulls matching CARRIAGES (recolored to the blue/cream/red livery,
//  rounded roof, rows of lit windows, red waistline). Built procedurally with
//  PBR materials + canvas livery textures; reflections come from scene.environment.
//
//  The whole rake follows a Catmull-Rom curve (TRAIN_PATH) driven by scroll t:
//  it waits at the platform, runs to Creative Origins, banks left to Unilever,
//  then runs the merged track and STOPS behind the final camera (§5.1).
// ============================================================================

import * as THREE from 'three';
import { PALETTE, TRAIN_PATH } from './config.js';
import { preloadModels, getModel, normalize } from './models.js';
import { weatheredMetal } from './materials.js';

const BODY_Y = 1.9;
// Separate scales so the engine roof can be brought in line with the carriages
const ENGINE_SCALE = 0.62;   // slightly smaller than CAR_SCALE → matching roof height
const CAR_SCALE    = 0.72;
const ENGINE_LEN   = 8.9 * ENGINE_SCALE / 0.72;   // ≈ 7.67 world units
const CARRIAGE_LEN = 15.0;
const COUPLE = 0.45;    // tighter coupling gap between adjacent car ends

export class Train {
  constructor(scene) {
    this.curve = new THREE.CatmullRomCurve3(
      TRAIN_PATH.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.5
    );
    this.total = this.curve.getLength();

    this.uWait = this._findU(0, -10);
    this.uCreative = this._findU(0, -340);
    this.uUnilever = this._findU(-5, -720);
    this.uTree = 1.0;

    this.cars = [];
    this.group = new THREE.Group();
    this.cars.push(makeLoco());
    this.cars.push(makeCarriage());
    this.cars.push(makeCarriage());
    this.cars.push(makeCarriage());
    this.cars.forEach(c => this.group.add(c));
    scene.add(this.group);

    // Distance (as a fraction of the curve) of each car CENTRE behind the lead
    // point u, so adjacent cars couple with a fixed COUPLE gap between their ends.
    const lengths = [ENGINE_LEN, CARRIAGE_LEN, CARRIAGE_LEN, CARRIAGE_LEN];
    this.offsetsU = [0];
    let acc = 0;
    for (let i = 1; i < lengths.length; i++) {
      acc += lengths[i - 1] / 2 + COUPLE + lengths[i] / 2;
      this.offsetsU.push(acc / this.total);
    }

    this._p = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this.u = this.uWait;
    this.speed = 0;
    this._place(this.u);
  }

  _findU(x, z) {
    const pts = this.curve.getSpacedPoints(260);
    let best = 0, bd = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const dx = pts[i].x - x, dz = pts[i].z - z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return best / (pts.length - 1);
  }

  progressForT(t) {
    const W = this.uWait, C = this.uCreative, U = this.uUnilever, T = this.uTree;
    if (t < 0.48) return W;                                       // waits through reading + boarding
    if (t < 0.548) return lerp(W, C, ease((t - 0.48) / 0.068));   // departs → Creative
    if (t < 0.638) return C;
    if (t < 0.804) return lerp(C, U, ease((t - 0.638) / 0.166));  // → Unilever
    if (t < 0.880) return U;
    return lerp(U, T, ease((t - 0.880) / 0.120));                 // → the tree
  }

  update(t, dt) {
    const target = this.progressForT(t);
    const prev = this.u;
    this.u += (target - this.u) * (1 - Math.exp(-2.6 * dt));
    this.speed = Math.min(1, Math.abs(this.u - prev) / Math.max(dt, 1e-3) / 0.11);
    this._place(this.u);
  }

  _place(u) {
    for (let i = 0; i < this.cars.length; i++) {
      const cu = clamp(u - this.offsetsU[i], 0.0002, 0.9998);
      this.curve.getPointAt(cu, this._p);
      this.curve.getTangentAt(cu, this._t);
      const car = this.cars[i];
      car.position.set(this._p.x, this._p.y + BODY_Y, this._p.z);
      car.rotation.y = Math.atan2(this._t.x, this._t.z); // local +Z (front) along travel
    }
  }
}

// ---- shared materials + textures (built once) ------------------------------
let M = null;
function mats() {
  if (M) return M;
  const std = (color, rough, metal, env = 0.7) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: env });
  // glossy painted metal (clearcoat) for the loco/carriage bodywork
  const paint = (color, rough = 0.3) =>
    new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0.0, clearcoat: 0.85, clearcoatRoughness: 0.22, envMapIntensity: 1.25 });
  const liv = carriageLivery();
  M = {
    blue: paint(PALETTE.brBlue, 0.32),
    blueDark: paint(0x244F77, 0.4),
    cream: std(PALETTE.brCream, 0.55, 0.0, 0.55),
    red: paint(PALETTE.brRed, 0.4),
    yellow: std(PALETTE.brYellow, 0.45, 0.3, 0.7),
    roof: std(0x9AA6AE, 0.6, 0.3, 0.85),
    dark: std(0x14181C, 0.85, 0.2, 0.3),
    wheel: std(0x0C0E11, 0.7, 0.4, 0.3),
    glass: new THREE.MeshStandardMaterial({
      color: PALETTE.brCream, emissive: new THREE.Color(PALETTE.firefly),
      emissiveIntensity: 0.45, roughness: 0.35, metalness: 0, envMapIntensity: 0.5,
    }),
    livery: liv,
  };
  return M;
}

// ---- TRAIN — real GLBs (engine.glb + carriage.glb) --------------------------
// The car group's origin sits at rail.y + BODY_Y; we ground each model then drop
// it by BODY_Y so the wheels meet the rail. A single TRAIN_SCALE keeps the engine
// (~12.4u native) and carriage (~20.8u native) proportional to each other.
const TRAIN_SCALE = 0.72;
function makeLoco() {
  const g = new THREE.Group();
  preloadModels().then(() => {
    const loco = getModel('engine');
    if (!loco) return;
    normalize(loco, { scale: ENGINE_SCALE, ground: true, align: 'z' });
    loco.position.y -= BODY_Y;
    applyTrainMaterials(loco);
    g.add(loco);
  }).catch((e) => console.warn('[train] engine load failed:', e.message));
  return g;
}

function makeCarriage() {
  const g = new THREE.Group();
  preloadModels().then(() => {
    const car = getModel('carriage');
    if (!car) return;
    normalize(car, { scale: CAR_SCALE, ground: true, align: 'z' });
    car.position.y -= BODY_Y;
    applyCarriageMaterials(car);
    const bb = new THREE.Box3().setFromObject(car);
    const sz = new THREE.Vector3(); bb.getSize(sz);
    g.add(car);
    decorateCarriage(g, sz.x, sz.y, sz.z);
  }).catch((e) => console.warn('[train] carriage load failed:', e.message));
  return g;
}

// The heritage coach is untextured (white). Give it the engine's weathered,
// rusty painted-metal feel via the procedural shader, keyed to the car's own
// height range so grime gathers low on the body.
function applyCarriageMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false; o.receiveShadow = false;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    o.material = weatheredMetal({
      base: new THREE.Color(0x3d6462),     // engine-like greenish-teal, lifted so it reads at night
      rust: new THREE.Color(0x5e3018),
      yLow: bb.min.y, yHigh: bb.max.y,
      paintRough: 0.55, rustRough: 0.95, metalBase: 0.38,   // less metal = catches diffuse fill
      scale: 0.6, panel: 0.55, envMapIntensity: 1.0,
    });
  });
}

// Dark-glass / moonlit material treatment for the real train: warm-lit cab glass,
// boosted environment reflections, no pure-black shadows.
function applyTrainMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    o.castShadow = false; o.receiveShadow = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const name = (o.name || '').toLowerCase();
    mats.forEach((mat, i) => {
      if (name.includes('glass')) {
        mats[i] = new THREE.MeshPhysicalMaterial({
          color: 0x8FB6CC, roughness: 0.15, metalness: 0,
          transmission: 0.9, thickness: 0.6, ior: 1.3,
          emissive: new THREE.Color(PALETTE.firefly), emissiveIntensity: 0.25,
          envMapIntensity: 1.4,
        });
      } else if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
        mat.envMapIntensity = 1.15;
        mat.needsUpdate = true;
      }
    });
    o.material = Array.isArray(o.material) ? mats : mats[0];
  });
}

// ---- carriage decoration: yellow handrails, number plates, hazard ends ------
// Overlaid on the carriage group (g) AFTER the GLB loads; positions are in
// group-local space where y=0 = BODY_Y above rail = carriage centre height.
function decorateCarriage(g, W, H, L) {
  const gy = grungyYellowMaterial();
  const yBot = -BODY_Y + 0.08;         // group-local
  const yMid = -BODY_Y + H * 0.45;
  const ySide = -BODY_Y + H * 0.17;    // low on the BODY (not on the track below it)

  // Yellow footstep rail along EACH SIDE of the body (matches the engine's climbing
  // rail). NB: no full-width slab under the car — that was showing on the track.
  for (const sx of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, L * 0.94), gy);
    strip.position.set(sx * (W / 2 + 0.05), ySide, 0); g.add(strip);
  }

  // Vertical grab rails at door positions on both sides
  for (const sx of [-1, 1]) {
    for (const ez of [-(L / 2 - 0.9), L / 2 - 0.9]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, H * 0.52, 8), gy);
      rail.position.set(sx * (W / 2 + 0.07), yBot + H * 0.28, ez); g.add(rail);
    }
  }

  // Number / car-id plate on each side (random BR-style number)
  const carNum = (1000 + Math.floor(Math.random() * 8999)).toString();
  g.add(numberPlate(carNum, -(W / 2 + 0.02), yMid, 0, -Math.PI / 2));
  g.add(numberPlate(carNum,   W / 2 + 0.02,  yMid, 0,  Math.PI / 2));

  // Yellow-black hazard chevron on both end faces (bottom quarter)
  const haz = hazardMaterial();
  for (const [ez, ry] of [[ L / 2 + 0.02, 0], [-(L / 2 + 0.02), Math.PI]]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.88, 0.44), haz);
    panel.position.set(0, yBot + H * 0.14, ez); panel.rotation.y = ry; g.add(panel);
  }
}

// Grungy industrial yellow — base yellow overlaid with rust streaks, spots, grime
// and scratches so the rails read as weathered metal, not flat plastic.
let _gyMat;
function grungyYellowMaterial() {
  if (_gyMat) return _gyMat;
  const w = 256, h = 64;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#C9A227'; g.fillRect(0, 0, w, h);                          // industrial yellow base
  for (let i = 0; i < 70; i++) {                                            // vertical rust/grime streaks
    g.fillStyle = `rgba(${58 + Math.random() * 46},${30 + Math.random() * 22},10,${0.05 + Math.random() * 0.18})`;
    const x = Math.random() * w; g.fillRect(x, Math.random() * h * 0.4, 1 + Math.random() * 3, h);
  }
  for (let i = 0; i < 55; i++) {                                            // rust flecks
    g.fillStyle = `rgba(${60 + Math.random() * 40},${34 + Math.random() * 24},14,${0.12 + Math.random() * 0.32})`;
    g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 0, 6.283); g.fill();
  }
  const grd = g.createLinearGradient(0, 0, 0, h);                           // dark grime top & bottom edges
  grd.addColorStop(0, 'rgba(28,18,6,0.42)'); grd.addColorStop(0.5, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(28,18,6,0.5)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 22; i++) {                                            // fine scratches
    g.strokeStyle = `rgba(90,72,22,${0.18 + Math.random() * 0.3})`; g.lineWidth = 0.6;
    const y = Math.random() * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (Math.random() - 0.5) * 8); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 1); tex.anisotropy = 8;
  _gyMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0.28, envMapIntensity: 0.6 });
  return _gyMat;
}

let _hazMat;
function hazardMaterial() {
  if (_hazMat) return _hazMat;
  const cw = 256, ch = 72;
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  g.fillStyle = '#C9A227'; g.fillRect(0, 0, cw, ch);          // weathered yellow (not bright)
  g.fillStyle = '#141210';
  const sw = 20;
  for (let x = -ch; x < cw + ch; x += sw * 2) {
    g.beginPath();
    g.moveTo(x, 0); g.lineTo(x + sw, 0);
    g.lineTo(x + sw + ch, ch); g.lineTo(x + ch, ch);
    g.closePath(); g.fill();
  }
  for (let i = 0; i < 70; i++) {                               // rust flecks + grime over the stripes
    g.fillStyle = `rgba(${60 + Math.random() * 40},${34 + Math.random() * 24},14,${0.1 + Math.random() * 0.3})`;
    g.beginPath(); g.arc(Math.random() * cw, Math.random() * ch, 1 + Math.random() * 4, 0, 6.283); g.fill();
  }
  const grd = g.createLinearGradient(0, 0, 0, ch);
  grd.addColorStop(0, 'rgba(24,16,6,0.4)'); grd.addColorStop(0.5, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(24,16,6,0.5)');
  g.fillStyle = grd; g.fillRect(0, 0, cw, ch);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  _hazMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.12, side: THREE.DoubleSide });
  return _hazMat;
}

// ---- (legacy procedural loco — kept for reference / fallback) ---------------
function makeLocoProcedural() {
  const m = mats();
  const g = new THREE.Group();
  const W = 2.9;

  // long hood (rear, lower) — blue, with a ribbed vent panel on each side
  const hood = new THREE.Mesh(new THREE.BoxGeometry(W, 2.2, 9), m.blue);
  hood.position.set(0, 0.15, -3.4);
  g.add(hood);
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 1.4, 0.12), m.blueDark);
    rib.position.set(0, 0.2, -1.4 - i * 1.0);
    g.add(rib);
  }
  // exhaust + horn on the hood roof
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.5, 10), m.dark);
  stack.position.set(0, 1.45, -2.2); g.add(stack);

  // cab (front, taller) with windows + number plate
  const cab = new THREE.Mesh(new THREE.BoxGeometry(W, 3.0, 4), m.blue);
  cab.position.set(0, 0.55, 3.0);
  g.add(cab);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.35, 4.2), m.blueDark);
  roof.position.set(0, 2.1, 3.0); g.add(roof);

  // windscreen (front of cab) + side cab windows — warm lit
  const windscreen = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), m.glass);
  windscreen.position.set(0, 1.35, 5.02); g.add(windscreen);
  for (const sx of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), m.glass);
    sw.position.set(sx * (W / 2 + 0.01), 1.35, 3.1);
    sw.rotation.y = sx * Math.PI / 2;
    g.add(sw);
    const handrail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 7.5), m.yellow);
    handrail.position.set(sx * (W / 2 + 0.06), 1.3, -1.5);
    g.add(handrail);
  }
  g.add(numberPlate('2605', 0, 2.0, 5.03, 0));

  // cream lower band along the whole loco
  const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.7, 13.6), m.cream);
  band.position.set(0, -0.85, -1.2); g.add(band);

  // yellow footplate / walkway edge
  const foot = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.16, 13.8), m.yellow);
  foot.position.set(0, -1.2, -1.2); g.add(foot);

  // nose (front, below cab) + red BR monogram + buffer beam + headlamps
  const nose = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 1.5, 1.6), m.cream);
  nose.position.set(0, -0.55, 5.3); g.add(nose);
  const monogram = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), monogramTex());
  monogram.position.set(0, -0.45, 6.11); g.add(monogram);
  const buffer = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.5, 0.4), m.red);
  buffer.position.set(0, -1.25, 6.2); g.add(buffer);
  for (const sx of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12),
      new THREE.MeshStandardMaterial({ color: PALETTE.firefly, emissive: PALETTE.firefly, emissiveIntensity: 3 }));
    lamp.position.set(sx, 0.2, 6.18);
    g.add(lamp);
  }

  addRunningGear(g, 11, -1.4);
  return g;
}

// ---- (legacy procedural carriage — kept for reference / fallback) -----------
function makeCarriageProcedural() {
  const m = mats();
  const g = new THREE.Group();
  const W = 3.0, H = 2.7, L = 14;

  // body box: livery on the long sides, blue ends, dark underside
  const side = new THREE.MeshStandardMaterial({
    map: m.livery.map, emissive: 0xffffff, emissiveMap: m.livery.em,
    emissiveIntensity: 0.4, roughness: 0.45, metalness: 0.25, envMapIntensity: 0.7,
  });
  const sideR = side.clone();
  sideR.map = m.livery.mapR; sideR.emissiveMap = m.livery.emR;
  const faces = [
    new THREE.MeshStandardMaterial({ map: m.livery.map, emissive: 0xffffff, emissiveMap: m.livery.em, emissiveIntensity: 0.4, roughness: 0.45, metalness: 0.25, envMapIntensity: 0.7 }), // +x
    sideR,        // -x
    m.blueDark,   // +y (under the roof)
    m.dark,       // -y
    m.blue,       // +z end
    m.blue,       // -z end
  ];
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, L), faces);
  body.position.y = 0.05;
  g.add(body);

  // rounded roof (cylinder laid along Z; lower half hidden inside the body)
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(W / 2 + 0.02, W / 2 + 0.02, L, 20, 1, false, 0, Math.PI), m.roof);
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.y = H / 2 + 0.05;
  g.add(roof);
  // roof ribs
  for (let i = -2; i <= 2; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(W / 2 + 0.03, 0.04, 6, 14, Math.PI), m.roof);
    r.rotation.y = Math.PI / 2;
    r.position.set(0, H / 2 + 0.05, i * 2.4);
    g.add(r);
  }

  addRunningGear(g, L, -1.4);
  return g;
}

// ---- bogies + wheels shared by loco & carriages ----------------------------
function addRunningGear(g, len, y) {
  const m = mats();
  const offsets = [len / 2 - 2.6, -(len / 2 - 2.6)];
  for (const oz of offsets) {
    const bogie = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 3.4), m.dark);
    bogie.position.set(0, y + 0.1, oz);
    g.add(bogie);
    for (let a = -1; a <= 1; a++) {
      for (const sx of [-1, 1]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.25, 16), m.wheel);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(sx * 1.15, y - 0.35, oz + a * 1.05);
        g.add(wheel);
      }
    }
  }
}

// ---- canvas textures -------------------------------------------------------
function carriageLivery() {
  const w = 1024, h = 220;
  const map = document.createElement('canvas'); map.width = w; map.height = h;
  const em = document.createElement('canvas'); em.width = w; em.height = h;
  const g = map.getContext('2d');
  const e = em.getContext('2d');
  e.fillStyle = '#000'; e.fillRect(0, 0, w, h);

  // body blue
  g.fillStyle = '#2E6FB0'; g.fillRect(0, 0, w, h);
  // cream upper band + thin red stripe (the "BANGLADESH RAILWAY" band)
  g.fillStyle = '#E9D9A8'; g.fillRect(0, 0, w, h * 0.15);
  g.fillStyle = '#B23A2E'; g.fillRect(0, h * 0.15, w, h * 0.035);
  // cream window band
  const winTop = h * 0.24, winH = h * 0.30;
  g.fillStyle = '#E9D9A8'; g.fillRect(0, winTop, w, winH);
  // red waistline stripe
  g.fillStyle = '#B23A2E'; g.fillRect(0, winTop + winH + h * 0.02, w, h * 0.05);
  // lower cream skirt
  g.fillStyle = '#E9D9A8'; g.fillRect(0, h * 0.82, w, h * 0.06);

  // windows (dark glass on the map; warm on the emissive)
  const n = 11, margin = w * 0.04, gap = (w - 2 * margin) / n;
  const wy = winTop + winH * 0.16, wh = winH * 0.66;
  for (let i = 0; i < n; i++) {
    const x = margin + i * gap + gap * 0.16, ww = gap * 0.68;
    g.fillStyle = '#0E1A24'; roundRect(g, x, wy, ww, wh, 4); g.fill();
    e.fillStyle = '#FFE3A0'; roundRect(e, x, wy, ww, wh, 4); e.fill();
  }
  // panel lines + faint rivets
  g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 2;
  for (let i = 0; i <= n; i++) { const x = margin + i * gap; g.beginPath(); g.moveTo(x, winTop); g.lineTo(x, winTop + winH); g.stroke(); }
  // wordmark
  g.fillStyle = '#16202E'; g.font = '700 22px Georgia, serif'; g.textBaseline = 'middle';
  g.fillText('BANGLADESH RAILWAY', w * 0.52, h * 0.075);

  const map1 = ctex(map), em1 = ctex(em);
  const mapR = ctex(map), emR = ctex(em);   // horizontally-mirrored copies for the −X face
  for (const t of [mapR, emR]) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; }
  return { map: map1, em: em1, mapR, emR };
}

function numberPlate(text, x, y, z, ry) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#16202E'; g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#E9D9A8'; g.font = '700 56px Georgia, serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 52);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.38),
    new THREE.MeshStandardMaterial({ map: ctex(c), emissive: 0xffffff, emissiveMap: ctex(c), emissiveIntensity: 0.25, roughness: 0.6 }));
  mesh.position.set(x, y, z); mesh.rotation.y = ry;
  return mesh;
}

function monogramTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#B23A2E'; g.beginPath(); g.arc(64, 64, 62, 0, 6.2832); g.fill();
  g.strokeStyle = '#E9D9A8'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 54, 0, 6.2832); g.stroke();
  g.fillStyle = '#E9D9A8'; g.font = '700 46px Georgia, serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BR', 64, 66);
  return new THREE.MeshStandardMaterial({ map: ctex(c), roughness: 0.5, metalness: 0.2, envMapIntensity: 0.6 });
}

function ctex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const lerp = (a, b, k) => a + (b - a) * Math.min(1, Math.max(0, k));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (k) => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); };
