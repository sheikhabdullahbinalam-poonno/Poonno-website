// ============================================================================
//  atmosphere.js — the living night air (§6.11, §6.12).
//  • Fireflies: Points + additive glow sprite, per-particle twinkle + sine-bob,
//    clustered around the four story hubs (platform/creative/unilever/tree).
//  • Fog sprites: large soft planes that drift in from the screen sides.
//  • Lamp glows: warm additive halos near the platform + stations.
//  • Pointer field: the cursor pulls nearby fireflies toward it, trails a warm
//    glow + point light, and nudges fog aside — damped, organic, premium.
//  Honors prefers-reduced-motion (no attraction/trail) and mobile (fewer motes).
// ============================================================================

import * as THREE from 'three';
import { PALETTE } from './config.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 720px)').matches;

const _v = new THREE.Vector3();

// Firefly clusters: [center, half-extents, weight]. Last entry scatters motes
// thinly along the whole track so the air feels alive everywhere.
const HUBS = [
  { c: [3, 3.5, 0],      r: [18, 5, 20],  w: 0.32 }, // platform (densest)
  { c: [10, 3.5, -340],  r: [16, 5, 18],  w: 0.15 }, // creative origins
  { c: [-12, 3.5, -720], r: [16, 5, 18],  w: 0.15 }, // unilever
  { c: [-5, 4.5, -555],  r: [13, 6, 130], w: 0.20 }, // Unilever forest — drifting fireflies among the moonlit trees
  { c: [0, 4, -400],     r: [12, 6, 420], w: 0.22 }, // scattered along the long route
];

export class Atmosphere {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.time = 0;

    this.mouse = new THREE.Vector2(0, 0);
    this.pointerActive = false;
    this.pointerWorld = new THREE.Vector3(0, 3, 0);

    this.glow = glowTex();
    this.fog = fogTex();

    this.count = MOBILE ? 120 : 300;
    this._buildFireflies();
    this._buildFog();
    this._buildLamps();
    this._buildPointer();
    this._bindPointer();
  }

  // ---- fireflies ----------------------------------------------------------
  _buildFireflies() {
    const n = this.count;
    this.base = new Float32Array(n * 3);
    this.seed = new Float32Array(n);
    this.spd = new Float32Array(n);
    this.amp = new Float32Array(n);
    const scale = new Float32Array(n);
    const pos = new Float32Array(n * 3);

    for (let i = 0; i < n; i++) {
      const h = pickHub();
      const i3 = i * 3;
      this.base[i3]     = h.c[0] + (Math.random() * 2 - 1) * h.r[0];
      this.base[i3 + 1] = h.c[1] + (Math.random() * 2 - 1) * h.r[1];
      this.base[i3 + 2] = h.c[2] + (Math.random() * 2 - 1) * h.r[2];
      pos[i3] = this.base[i3]; pos[i3 + 1] = this.base[i3 + 1]; pos[i3 + 2] = this.base[i3 + 2];
      this.seed[i] = Math.random() * Math.PI * 2;
      this.spd[i] = 0.4 + Math.random() * 0.9;
      this.amp[i] = 0.5 + Math.random() * 1.1;
      scale[i] = 0.6 + Math.random() * 1.1;
    }

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 1));
    this.geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    this.pos = pos;

    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPx: { value: Math.min(window.devicePixelRatio, 2) },
        uTex: { value: this.glow },
        uColor: { value: new THREE.Color(PALETTE.firefly) },
      },
      vertexShader: `
        attribute float aSeed;
        attribute float aScale;
        uniform float uTime;
        uniform float uPx;
        varying float vTw;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float tw = 0.55 + 0.45 * sin(uTime * 1.7 + aSeed * 6.2831);
          vTw = tw;
          float size = aScale * uPx * (90.0 / max(1.0, -mv.z)) * (0.6 + tw * 0.6);
          gl_PointSize = min(size, 64.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uTex;
        uniform vec3 uColor;
        varying float vTw;
        void main() {
          vec4 tex = texture2D(uTex, gl_PointCoord);
          gl_FragColor = vec4(uColor, tex.a * vTw);
        }`,
    });

    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  // ---- fog sprites — REMOVED ----------------------------------------------
  // The bright additive sprite banks read as a "curtain of white light", not fog.
  // Depth now comes from the dark exponential scene fog + (later) a blur pass.
  _buildFog() {
    this.fogSprites = [];
    return;
    /* eslint-disable no-unreachable */
    // zCenter = the Z the sprite drifts around (so fade/wrap are local, not at 0).
    // fog:false so the mist banks aren't fogged away by scene.fog; a light
    // moonlit colour + higher opacity so they actually read as fog.
    const make = (x, y, zCenter, z, scl, vz, zHalf, op) => {
      const m = new THREE.SpriteMaterial({
        map: this.fog, color: new THREE.Color(0x8AA6C6),
        transparent: true, opacity: op, depthWrite: false, fog: false,
        blending: THREE.NormalBlending,
      });
      const s = new THREE.Sprite(m);
      s.scale.set(scl, scl * 0.5, 1);
      s.position.set(x, y, z);
      s.userData = { vz, baseY: y, phase: Math.random() * 6.28, zCenter, zHalf, baseOp: op };
      this.scene.add(s);
      this.fogSprites.push(s);
    };
    // Platform fog: low ground banks drifting along ±Z (screen-horizontal in
    // T-view) — kept low + lighter so they wreathe the train without veiling it.
    for (let i = 0; i < 7; i++) {
      const dir = i % 2 ? 1 : -1;
      make(2 + (Math.random() * 20 - 10), 0.5 + Math.random() * 1.6,
           0, (Math.random() * 40 - 20), 24 + Math.random() * 14,
           dir * (1.2 + Math.random() * 1.1), 22, 0.24);
    }
    // Ambient drift at each station + the tree.
    make(10, 1.8, -340, -340, 30, 1.2, 20, 0.4);
    make(-13, 1.8, -720, -720, 30, -1.2, 20, 0.4);
    make(7.5, 2.5, -825, -825, 22, 1.0, 16, 0.34);
    // Dense low ground mist drifting along the whole route — the mystical depth.
    for (let i = 0; i < 44; i++) {
      const z = -42 - i * 18 + (Math.random() * 12 - 6);
      const dir = i % 2 ? 1 : -1;
      make((Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 18), 0.8 + Math.random() * 2.2,
           z, z + (Math.random() * 20 - 10), 26 + Math.random() * 16,
           dir * (0.7 + Math.random()), 28, 0.34);
    }
  }

  // ---- warm lamp glows (halos now; real fixtures arrive Phase 3) ----------
  _buildLamps() {
    const halo = (x, y, z, color, scl, op) => {
      const m = new THREE.SpriteMaterial({
        map: this.glow, color: new THREE.Color(color),
        transparent: true, opacity: op, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const s = new THREE.Sprite(m);
      s.scale.set(scl, scl, 1);
      s.position.set(x, y, z);
      this.scene.add(s);
    };
    halo(11, 6, -6, PALETTE.firefly, 3.5, 0.42);
    halo(11, 6, -18, PALETTE.firefly, 3.0, 0.36);
    // (the station halos + bright station point lights were removed — the stations
    //  now carry their own dim lamps + accent lighting in buildStation(); the big
    //  ember orb by the clock was this halo.)

    // Warm point light for the START platform only (the boarding area).
    const l1 = new THREE.PointLight(PALETTE.firefly, 3, 24, 2); l1.position.set(11, 6, -10); this.scene.add(l1);
  }

  // ---- pointer glow trail + light -----------------------------------------
  // DISABLED: the warm sprite + point light that followed the cursor read as a
  // big "cursor glow". Removed entirely (the update guards on `this.trail`).
  _buildPointer() {
    this.trail = null;
    this.trailLight = null;
  }

  _bindPointer() {
    const move = (cx, cy) => {
      this.mouse.x = (cx / window.innerWidth) * 2 - 1;
      this.mouse.y = -(cy / window.innerHeight) * 2 + 1;
      this.pointerActive = true;
    };
    window.addEventListener('mousemove', e => move(e.clientX, e.clientY), { passive: true });
    window.addEventListener('mouseleave', () => { this.pointerActive = false; });
    window.addEventListener('touchmove', e => {
      if (e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchend', () => { this.pointerActive = false; });
  }

  _updatePointerWorld() {
    _v.set(this.mouse.x, this.mouse.y, 0.5).unproject(this.camera);
    _v.sub(this.camera.position).normalize();
    this.pointerWorld.copy(this.camera.position).addScaledVector(_v, 12);
  }

  // ---- per-frame ----------------------------------------------------------
  update(dt) {
    this.time += dt;
    const t = this.time;
    const interact = this.pointerActive && !REDUCED;
    if (interact) this._updatePointerWorld();

    // Fireflies: animated home (bob) + damped pull toward the cursor.
    const k = 1 - Math.exp(-4 * dt);
    const pw = this.pointerWorld;
    const R = 9, R2 = R * R;
    const base = this.base, pos = this.pos, seed = this.seed, spd = this.spd, amp = this.amp;
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3, s = seed[i], sp = spd[i], a = amp[i];
      let tx = base[i3]     + Math.sin(t * sp + s) * 0.5 * a;
      let ty = base[i3 + 1] + Math.sin(t * sp * 1.3 + s * 1.7) * 0.35;
      let tz = base[i3 + 2] + Math.cos(t * sp * 0.9 + s * 2.1) * 0.5 * a;
      if (interact) {
        const dx = pw.x - tx, dy = pw.y - ty, dz = pw.z - tz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < R2) {
          const pull = (1 - Math.sqrt(d2) / R) * 0.55;
          tx += dx * pull; ty += dy * pull; tz += dz * pull;
        }
      }
      pos[i3]     += (tx - pos[i3]) * k;
      pos[i3 + 1] += (ty - pos[i3 + 1]) * k;
      pos[i3 + 2] += (tz - pos[i3 + 2]) * k;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.mat.uniforms.uTime.value = t;

    // Fog: drift along Z, wrap at the edges, fade toward the extremes, and ease
    // away from the pointer.
    for (const f of this.fogSprites) {
      const d = f.userData;
      const span = d.zHalf + 18;
      f.position.z += d.vz * dt;
      if (d.vz > 0 && f.position.z > d.zCenter + span) f.position.z = d.zCenter - span;
      if (d.vz < 0 && f.position.z < d.zCenter - span) f.position.z = d.zCenter + span;
      f.position.y = d.baseY + Math.sin(t * 0.3 + d.phase) * 0.4;
      const fade = Math.max(0, 1 - Math.abs(f.position.z - d.zCenter) / (d.zHalf + 6));
      let op = d.baseOp * fade;
      if (interact) {
        const dx = f.position.x - pw.x, dz = f.position.z - pw.z;
        const near = dx * dx + dz * dz;
        if (near < 40) {
          const push = (1 - near / 40) * 2.5;
          f.position.x += (dx >= 0 ? push : -push) * dt * 2;
          op *= 0.7;
        }
      }
      f.material.opacity += (op - f.material.opacity) * (1 - Math.exp(-3 * dt));
    }

    // Pointer glow trail + light.
    if (this.trail) {
      const tk = 1 - Math.exp(-6 * dt);
      if (interact) {
        this.trail.position.lerp(pw, tk);
        this.trailLight.position.copy(this.trail.position);
        this.trail.material.opacity += (0.85 - this.trail.material.opacity) * tk;
        this.trailLight.intensity += (5 - this.trailLight.intensity) * tk;
      } else {
        this.trail.material.opacity += (0 - this.trail.material.opacity) * tk;
        this.trailLight.intensity += (0 - this.trailLight.intensity) * tk;
      }
    }
  }
}

// ---- weighted hub picker ---------------------------------------------------
function pickHub() {
  let r = Math.random();
  for (const h of HUBS) { if ((r -= h.w) <= 0) return h; }
  return HUBS[HUBS.length - 1];
}

// ---- canvas textures (§10 glowTex) ----------------------------------------
function glowTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0.0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,226,162,0.9)');
  grd.addColorStop(0.6, 'rgba(255,200,120,0.25)');
  grd.addColorStop(1.0, 'rgba(255,200,120,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function fogTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0.0, 'rgba(212,226,242,0.9)');
  grd.addColorStop(0.45, 'rgba(182,202,226,0.45)');
  grd.addColorStop(1.0, 'rgba(170,194,220,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
