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
  const s = 512, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'); const R = s / 2;

  // --- base disc: highlands with spherical shading, light from upper-left.
  // Deliberately mid-toned (not near-white) so the bloom pass doesn't blow the
  // whole disc out — the dark maria then read as real lunar seas.
  const grd = g.createRadialGradient(R * 0.74, R * 0.68, R * 0.05, R, R, R);
  grd.addColorStop(0.00, '#d7dce4');
  grd.addColorStop(0.45, '#c2c9d5');
  grd.addColorStop(0.78, '#a3adbe');
  grd.addColorStop(0.93, '#828da1');
  grd.addColorStop(1.00, '#6c7689');
  g.fillStyle = grd; g.beginPath(); g.arc(R, R, R * 0.995, 0, 6.2832); g.fill();

  g.save(); g.beginPath(); g.arc(R, R, R * 0.985, 0, 6.2832); g.clip();

  // soft-edged dark blob (a mare), built from a radial gradient so edges feather
  const blob = (x, y, rr, rgb, a) => {
    const cx = x * s, cy = y * s, r = rr * s;
    const bg = g.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
    bg.addColorStop(0, `rgba(${rgb},${a})`);
    bg.addColorStop(0.65, `rgba(${rgb},${a * 0.85})`);
    bg.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = bg; g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.fill();
  };

  // --- maria: the recognisable near-side pattern ("the man in the moon"),
  // dark blue-grey seas. Overlapping blobs give irregular, organic shapes.
  const MARE = '70,80,99';
  blob(0.34, 0.30, 0.17, MARE, 0.80);  // Mare Imbrium (large, upper-left)
  blob(0.28, 0.43, 0.13, MARE, 0.72);  // Oceanus Procellarum (left)
  blob(0.55, 0.32, 0.10, MARE, 0.78);  // Mare Serenitatis
  blob(0.63, 0.45, 0.11, MARE, 0.80);  // Mare Tranquillitatis
  blob(0.79, 0.40, 0.066, MARE, 0.82); // Mare Crisium (isolated oval, right)
  blob(0.71, 0.57, 0.075, MARE, 0.74); // Mare Fecunditatis
  blob(0.61, 0.63, 0.058, MARE, 0.70); // Mare Nectaris
  blob(0.43, 0.64, 0.085, MARE, 0.68); // Mare Nubium (lower-left)
  blob(0.50, 0.50, 0.05, MARE, 0.45);  // faint central tie

  // --- crater field across the brighter highlands: dark pit + lit upper-left
  // rim + lower-right shadow gives each one a little 3-D relief.
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * s, y = Math.random() * s, r = 2 + Math.random() * 8;
    g.fillStyle = 'rgba(60,68,84,0.30)'; g.beginPath(); g.arc(x + r * 0.18, y + r * 0.18, r, 0, 6.2832); g.fill(); // shadow
    g.fillStyle = 'rgba(95,104,120,0.40)'; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();                    // pit
    g.fillStyle = 'rgba(240,244,250,0.32)'; g.beginPath(); g.arc(x - r * 0.28, y - r * 0.28, r * 0.55, 0, 6.2832); g.fill(); // lit rim
  }

  // --- a couple of bright ray craters (Tycho, Copernicus) with faint rays
  const rayCrater = (x, y, r) => {
    const cx = x * s, cy = y * s, rr = r * s;
    g.strokeStyle = 'rgba(236,240,247,0.07)'; g.lineWidth = 1.4;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * 6.2832 + Math.random() * 0.3, len = rr * (4 + Math.random() * 4);
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); g.stroke();
    }
    g.fillStyle = 'rgba(244,247,252,0.5)'; g.beginPath(); g.arc(cx, cy, rr, 0, 6.2832); g.fill();
    g.fillStyle = 'rgba(70,78,95,0.5)'; g.beginPath(); g.arc(cx, cy, rr * 0.45, 0, 6.2832); g.fill();
  };
  rayCrater(0.46, 0.82, 0.022); // Tycho (lower)
  rayCrater(0.40, 0.45, 0.016); // Copernicus

  // --- limb darkening: deepen the edge so the disc reads as a sphere, not a coin
  const lg = g.createRadialGradient(R, R, R * 0.62, R, R, R);
  lg.addColorStop(0, 'rgba(18,24,38,0)');
  lg.addColorStop(1, 'rgba(14,20,34,0.55)');
  g.fillStyle = lg; g.beginPath(); g.arc(R, R, R * 0.99, 0, 6.2832); g.fill();
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
