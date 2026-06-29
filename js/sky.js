// ============================================================================
//  sky.js — a textured MOON (maria + craters), a restrained glow, a field of
//  stars, and a small flock of birds that drift toward the moon and dissolve
//  (our take on Noomo's bird-to-light hero moment). All fog:false so they read
//  against the dusk dome.
// ============================================================================

import * as THREE from 'three';

// The moon sits far beyond the finale tree, so the great tree is silhouetted
// against it at the end (the "dark brown + blue-black" Horizons Crossing moment).
export const MOON_POS = new THREE.Vector3(40, 380, -1350);

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this._addStars();
    this._addMoon();
    this._addBirds();
    this._start = new THREE.Vector3();
  }

  _addMoon() {
    const disc = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonTex(), transparent: true, depthWrite: false, fog: false,
    }));
    disc.scale.set(155, 155, 1);
    disc.position.copy(MOON_POS);
    disc.renderOrder = -1;
    this.scene.add(disc);

    // restrained glow — much dimmer / tighter than before
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex(), color: new THREE.Color(0xB9CBE6), transparent: true, opacity: 0.22,
      depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    }));
    halo.scale.set(330, 330, 1);
    halo.position.copy(MOON_POS);
    halo.renderOrder = -2;
    this.scene.add(halo);
  }

  _addStars() {
    const N = 850;
    const pos = new Float32Array(N * 3);
    const scl = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      // distribute across a far shell, biased to the upper sky we actually see
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(1 - Math.random() * 0.9);
      const r = 1700;
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.85 + 90;   // keep above the horizon
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 500; // bias toward the journey's −Z
      scl[i] = 0.4 + Math.random() * 1.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scl, 1));
    this.starMat = new THREE.PointsMaterial({
      map: starTex(), size: 6, sizeAttenuation: true, transparent: true, opacity: 0.85,
      depthWrite: false, fog: false, blending: THREE.AdditiveBlending, color: 0xcdd9f0,
    });
    this.stars = new THREE.Points(geo, this.starMat);
    this.stars.renderOrder = -1.5;   // in front of the dome, behind everything else
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
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
    if (this.starMat) this.starMat.opacity = 0.72 + 0.13 * Math.sin(this.time * 0.9); // gentle twinkle
    for (const b of this.birds) {
      const d = b.userData;
      d.t += d.speed * dt;
      if (d.t > 1.25) d.t -= 1.25;            // pause before re-emerging
      const tt = Math.min(1, d.t);
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
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'); const R = s / 2;
  // base disc with gentle spherical shading (light upper-left)
  const grd = g.createRadialGradient(R * 0.8, R * 0.76, R * 0.1, R, R, R);
  grd.addColorStop(0, '#f4f6f9'); grd.addColorStop(0.55, '#e2e7ef');
  grd.addColorStop(0.9, '#c6cedb'); grd.addColorStop(0.985, '#aeb7c6');
  grd.addColorStop(1, 'rgba(174,183,198,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(R, R, R * 0.99, 0, 6.2832); g.fill();

  g.save(); g.beginPath(); g.arc(R, R, R * 0.97, 0, 6.2832); g.clip();
  // maria (darker seas)
  g.fillStyle = 'rgba(150,160,180,0.22)';
  for (const [x, y, r] of [[0.42, 0.40, 0.22], [0.62, 0.58, 0.16], [0.50, 0.67, 0.13], [0.34, 0.60, 0.10], [0.69, 0.35, 0.09]]) {
    g.beginPath(); g.arc(x * s, y * s, r * s, 0, 6.2832); g.fill();
  }
  // craters — soft dark pit + a faint bright rim
  for (let i = 0; i < 28; i++) {
    const x = Math.random() * s, y = Math.random() * s, r = 2 + Math.random() * 7;
    g.fillStyle = 'rgba(120,130,150,0.16)'; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.6, 0, 6.2832); g.fill();
  }
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function haloTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  grd.addColorStop(0, 'rgba(199,215,239,0.5)');
  grd.addColorStop(0.35, 'rgba(160,185,220,0.16)');
  grd.addColorStop(1, 'rgba(140,170,210,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function starTex() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.5, 'rgba(220,230,250,0.5)');
  grd.addColorStop(1, 'rgba(220,230,250,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(16, 16, 16, 0, 6.2832); g.fill();
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
