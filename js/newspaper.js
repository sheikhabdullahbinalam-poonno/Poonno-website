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
        np.traverse((o) => {
          if (!o.isMesh) return;
          o.frustumCulled = false;
          o.material.side = THREE.DoubleSide;
          o.material.color = new THREE.Color(0x6a6258);   // dim aged paper, lit only by the scene
          o.material.roughness = 0.95; o.material.metalness = 0;
          // unlit at rest (#1); a gentle self-light ramps in ONLY as it sweeps up
          // to face the viewer, so the fill reads instead of going black.
          o.material.emissive = new THREE.Color(0xffffff);
          o.material.emissiveMap = o.material.map;
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
      if (this.heroMat) this.heroMat.emissiveIntensity = 0;       // unlit at rest (#1)
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
    if (this.heroMat) this.heroMat.emissiveIntensity = Math.max(0, (k - 0.5) / 0.5) * 0.7;
  }
}
