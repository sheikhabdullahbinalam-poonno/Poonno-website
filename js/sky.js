// ============================================================================
//  sky.js — a glowing MOON in the night sky and a small flock of birds that
//  drift toward it and dissolve into the light (our take on Noomo's bird-to-sun
//  hero moment). Sprites with fog:false so they read against the dusk dome.
// ============================================================================

import * as THREE from 'three';

// The moon sits far beyond the finale tree, so the great tree is silhouetted
// against it at the end (the "dark brown + blue-black" Horizons Crossing moment).
export const MOON_POS = new THREE.Vector3(40, 380, -1350);

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this._addMoon();
    this._addBirds();
    this._start = new THREE.Vector3();
  }

  _addMoon() {
    const disc = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonTex(), transparent: true, depthWrite: false, fog: false,
    }));
    disc.scale.set(150, 150, 1);
    disc.position.copy(MOON_POS);
    disc.renderOrder = -1;
    this.scene.add(disc);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex(), color: new THREE.Color(0xC7D7EF), transparent: true, opacity: 0.5,
      depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    }));
    halo.scale.set(520, 520, 1);
    halo.position.copy(MOON_POS);
    halo.renderOrder = -2;
    this.scene.add(halo);
  }

  _addBirds() {
    this.birds = [];
    const tex = birdTex();
    for (let i = 0; i < 5; i++) {
      const m = new THREE.SpriteMaterial({
        map: tex, color: new THREE.Color(0x0C1422), transparent: true, opacity: 0.9,
        depthWrite: false, fog: false,
      });
      const b = new THREE.Sprite(m);
      b.userData = {
        t: i / 5, speed: 0.03 + Math.random() * 0.02, phase: Math.random() * 6.28,
        size: 16 + Math.random() * 10, lane: (Math.random() - 0.5),
      };
      this.scene.add(b);
      this.birds.push(b);
    }
    this._end = new THREE.Vector3();
  }

  update(dt) {
    this.time += dt;
    for (const b of this.birds) {
      const d = b.userData;
      d.t += d.speed * dt;
      if (d.t > 1.25) d.t -= 1.25;            // pause before re-emerging
      const tt = Math.min(1, d.t);
      // a flock crossing the finale sky, up toward the moon's bearing, then dissolving
      this._start.set(180 + d.lane * 70, 150 + d.lane * 45, -960);
      this._end.set(20, 330, -1240);
      b.position.lerpVectors(this._start, this._end, ease(tt));
      const flap = 0.5 + 0.5 * Math.abs(Math.sin(this.time * 7 + d.phase));
      b.scale.set(d.size, d.size * flap, 1);
      b.material.opacity = d.t > 1 ? 0 : 0.85 * (1 - tt * 0.6); // dissolve into the moonlight
    }
  }
}

const ease = (k) => k * k * (3 - 2 * k);

function moonTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 60);
  grd.addColorStop(0, 'rgba(255,250,238,1)');
  grd.addColorStop(0.72, 'rgba(244,238,221,1)');
  grd.addColorStop(0.93, 'rgba(214,224,240,0.85)');
  grd.addColorStop(1, 'rgba(200,214,235,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(64, 64, 60, 0, 6.2832); g.fill();
  g.fillStyle = 'rgba(196,198,188,0.18)';
  for (const [x, y, r] of [[50, 52, 9], [80, 72, 6], [64, 84, 5], [44, 74, 4]]) { g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function haloTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  grd.addColorStop(0, 'rgba(199,215,239,0.6)');
  grd.addColorStop(0.4, 'rgba(160,185,220,0.22)');
  grd.addColorStop(1, 'rgba(140,170,210,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function birdTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = '#000'; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(8, 42); g.quadraticCurveTo(24, 20, 32, 36); g.quadraticCurveTo(40, 20, 56, 42);
  g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
