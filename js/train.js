// ============================================================================
//  train.js — the Bangladesh Railway train that travels the route (§5.1, §6.1).
//  A grey-box-but-recognisable loco + carriages (blue body, cream window band,
//  lit windows, red waistline) follow a Catmull-Rom curve along TRAIN_PATH.
//  Progress is driven by scroll t: the train waits at the platform, accelerates
//  to Creative Origins, banks left to Unilever, then runs the merged track and
//  STOPS beside the tree (it never drives into it). Detailed PBR build = Phase 3.
// ============================================================================

import * as THREE from 'three';
import { PALETTE, TRAIN_PATH } from './config.js';

const CAR_SPACING = 14; // world units between car centres (along the rail)

export class Train {
  constructor(scene) {
    this.curve = new THREE.CatmullRomCurve3(
      TRAIN_PATH.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.5
    );
    this.total = this.curve.getLength();
    this.gapU = CAR_SPACING / this.total;

    // Station progress (arc-length fractions) found from the curve.
    this.uWait = this._findU(0, -10);
    this.uCreative = this._findU(0, -185);
    this.uUnilever = this._findU(-5, -292);
    this.uTree = 1.0;

    this.cars = [];
    this.group = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const car = makeCar(i === 0);
      this.group.add(car);
      this.cars.push(car);
    }
    scene.add(this.group);

    this._p = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this.update(0);
  }

  // Arc-length fraction whose point is nearest (x,z).
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

  // Map scroll t → the loco's progress along the route (matches the camera beats).
  progressForT(t) {
    const W = this.uWait, C = this.uCreative, U = this.uUnilever, T = this.uTree;
    if (t < 0.22) return W;
    if (t < 0.40) return lerp(W, C, (t - 0.22) / 0.18);
    if (t < 0.52) return C;
    if (t < 0.66) return lerp(C, U, (t - 0.52) / 0.14);
    if (t < 0.78) return U;
    return lerp(U, T, (t - 0.78) / 0.22);
  }

  update(t) {
    const u = this.progressForT(t);
    for (let i = 0; i < this.cars.length; i++) {
      const cu = clamp(u - i * this.gapU, 0.0002, 0.9998);
      this.curve.getPointAt(cu, this._p);
      this.curve.getTangentAt(cu, this._t);
      const car = this.cars[i];
      car.position.set(this._p.x, this._p.y + 1.9, this._p.z);
      car.rotation.y = Math.atan2(this._t.x, this._t.z); // local +Z (front) along travel
    }
  }
}

function makeCar(isLoco) {
  const g = new THREE.Group();
  const len = isLoco ? 15 : 13;
  const w = 3;

  const blue = new THREE.MeshStandardMaterial({ color: PALETTE.brBlue, roughness: 0.5, metalness: 0.25 });
  const cream = new THREE.MeshStandardMaterial({ color: PALETTE.brCream, roughness: 0.65 });
  const red = new THREE.MeshStandardMaterial({ color: PALETTE.brRed, roughness: 0.5 });
  const lit = new THREE.MeshStandardMaterial({
    color: PALETTE.brCream, emissive: new THREE.Color(PALETTE.firefly), emissiveIntensity: 0.32, roughness: 0.4,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, 3.0, len), blue);
  g.add(body);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 1.0, len), cream);
  lower.position.y = -1.0; g.add(lower);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.22, len), red);
  stripe.position.y = -0.35; g.add(stripe);
  const windows = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.55, len * 0.84), lit);
  windows.position.y = 0.5; g.add(windows);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w - 0.25, 0.5, len), blue);
  roof.position.y = 1.6; g.add(roof);

  if (isLoco) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 12, 12),
      new THREE.MeshStandardMaterial({ color: PALETTE.firefly, emissive: PALETTE.firefly, emissiveIntensity: 3 })
    );
    lamp.position.set(0, 0.2, len / 2 + 0.1); // local +Z is the front
    g.add(lamp);
  }
  return g;
}

const lerp = (a, b, k) => a + (b - a) * Math.min(1, Math.max(0, k));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
