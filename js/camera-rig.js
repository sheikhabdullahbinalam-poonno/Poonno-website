// ============================================================================
//  camera-rig.js — drives the camera along the §5 keyframe spline.
//  sample(t) → linear-interpolated target position + look-at from KEYFRAMES.
//  update(t, dt) → frame-rate-independent damping toward that target so motion
//  is smooth and never snaps (§5: "damp toward target each frame ~dt*3.5").
//  HOLD bands fall out naturally: adjacent keyframes are near-identical, so the
//  interpolated target barely moves and the camera settles.
// ============================================================================

import * as THREE from 'three';
import { KEYFRAMES, CAMERA } from './config.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.keys = KEYFRAMES.map(k => ({
      t: k.t,
      pos: new THREE.Vector3(...k.pos),
      look: new THREE.Vector3(...k.look),
    }));
    this._pos = new THREE.Vector3();   // sampled target position
    this._look = new THREE.Vector3();  // sampled target look-at
    this.curLook = new THREE.Vector3();// damped current look-at

    // Start exactly on the t=0 framing so there's no opening swing.
    this.sample(0);
    camera.position.copy(this._pos);
    this.curLook.copy(this._look);
    camera.lookAt(this.curLook);
  }

  // Fill _pos / _look with the interpolated target at progress t (0..1).
  sample(t) {
    const keys = this.keys;
    t = Math.min(1, Math.max(0, t));
    let i = 0;
    while (i < keys.length - 1 && t > keys[i + 1].t) i++;
    const a = keys[i];
    const b = keys[Math.min(i + 1, keys.length - 1)];
    const span = (b.t - a.t) || 1;
    let u = Math.min(1, Math.max(0, (t - a.t) / span));
    u = u * u * u * (u * (u * 6 - 15) + 10); // smootherstep — ease in/out per segment
    this._pos.lerpVectors(a.pos, b.pos, u);
    this._look.lerpVectors(a.look, b.look, u);
    return this;
  }

  update(t, dt) {
    this.sample(t);
    // Exponential smoothing — the frame-rate-independent form of "lerp ~dt*3.5".
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
