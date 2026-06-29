// ============================================================================
//  camera-rig.js — drives the camera along the §5 keyframe spline.
//  Position and look-at are interpolated with CENTRIPETAL Catmull-Rom curves so
//  the path is C1-continuous: velocity carries THROUGH each keyframe instead of
//  dying at it (a per-segment ease made the camera pulse — stop/go — at every
//  keyframe, which read as jerky). Centripetal parameterisation avoids the
//  overshoot/looping plain Catmull-Rom can introduce near tight clusters.
//  update(t, dt) → damp toward the sampled target each frame so motion is buttery
//  and never snaps. HOLD bands fall out naturally: adjacent keyframes are
//  near-identical, so the curve barely moves there and the camera settles.
// ============================================================================

import * as THREE from 'three';
import { KEYFRAMES, CAMERA } from './config.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.ts = KEYFRAMES.map(k => k.t);
    // Centripetal Catmull-Rom through every keyframe — one continuous curve for
    // the dolly, one for the aim. The global progress t is remapped onto the
    // curve's [0,1] parameter so each keyframe still lands at its authored t.
    this.posCurve = new THREE.CatmullRomCurve3(
      KEYFRAMES.map(k => new THREE.Vector3(...k.pos)), false, 'centripetal');
    this.lookCurve = new THREE.CatmullRomCurve3(
      KEYFRAMES.map(k => new THREE.Vector3(...k.look)), false, 'centripetal');
    this.N = KEYFRAMES.length;

    this._pos = new THREE.Vector3();   // sampled target position
    this._look = new THREE.Vector3();  // sampled target look-at
    this.curLook = new THREE.Vector3();// damped current look-at

    // Start exactly on the t=0 framing so there's no opening swing.
    this.sample(0);
    camera.position.copy(this._pos);
    this.curLook.copy(this._look);
    camera.lookAt(this.curLook);
  }

  // Map global progress t (0..1) onto the Catmull-Rom parameter u (0..1):
  // find the keyframe segment t falls in, then place u proportionally within it.
  _u(t) {
    const ts = this.ts;
    t = Math.min(1, Math.max(0, t));
    let i = 0;
    while (i < ts.length - 1 && t > ts[i + 1]) i++;
    const span = (ts[i + 1] - ts[i]) || 1;
    const f = Math.min(1, Math.max(0, (t - ts[i]) / span));
    return Math.min(1, (i + f) / (this.N - 1));
  }

  // Fill _pos / _look with the interpolated target at progress t (0..1).
  sample(t) {
    const u = this._u(t);
    this.posCurve.getPoint(u, this._pos);
    this.lookCurve.getPoint(u, this._look);
    return this;
  }

  update(t, dt) {
    this.sample(t);
    // Exponential smoothing — frame-rate-independent "lerp ~dt*damp".
    const alpha = 1 - Math.exp(-CAMERA.damp * dt);
    this.camera.position.lerp(this._pos, alpha);
    this.curLook.lerp(this._look, alpha);
    this.camera.lookAt(this.curLook);
  }

  // Place the camera exactly on the t framing (no damping) — used by ?t= jumps.
  snap(t) {
    this.sample(t);
    this.camera.position.copy(this._pos);
    this.curLook.copy(this._look);
    this.camera.lookAt(this.curLook);
  }
}
