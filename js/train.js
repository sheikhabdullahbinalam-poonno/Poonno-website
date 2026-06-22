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

const CAR_SPACING = 16; // world units between car centres along the rail
const BODY_Y = 1.9;     // body-centre height above the rail

export class Train {
  constructor(scene) {
    this.curve = new THREE.CatmullRomCurve3(
      TRAIN_PATH.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.5
    );
    this.total = this.curve.getLength();
    this.gapU = CAR_SPACING / this.total;

    this.uWait = this._findU(0, -10);
    this.uCreative = this._findU(0, -185);
    this.uUnilever = this._findU(-5, -292);
    this.uTree = 1.0;

    this.cars = [];
    this.group = new THREE.Group();
    this.cars.push(makeLoco());
    this.cars.push(makeCarriage());
    this.cars.push(makeCarriage());
    this.cars.push(makeCarriage());
    this.cars.forEach(c => this.group.add(c));
    scene.add(this.group);

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
    if (t < 0.22) return W;
    if (t < 0.40) return lerp(W, C, ease((t - 0.22) / 0.18));
    if (t < 0.52) return C;
    if (t < 0.66) return lerp(C, U, ease((t - 0.52) / 0.14));
    if (t < 0.78) return U;
    return lerp(U, T, ease((t - 0.78) / 0.22));
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
      const cu = clamp(u - i * this.gapU, 0.0002, 0.9998);
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
  const liv = carriageLivery();
  M = {
    blue: std(PALETTE.brBlue, 0.38, 0.35),
    blueDark: std(0x244F77, 0.5, 0.3),
    cream: std(PALETTE.brCream, 0.6, 0.1),
    red: std(PALETTE.brRed, 0.45, 0.2),
    yellow: std(PALETTE.brYellow, 0.5, 0.25),
    roof: std(0x9AA6AE, 0.7, 0.3),
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

// ---- LOCOMOTIVE -------------------------------------------------------------
function makeLoco() {
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

// ---- CARRIAGE ---------------------------------------------------------------
function makeCarriage() {
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
