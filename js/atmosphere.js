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
  { c: [3, 3.5, 0],     r: [18, 5, 20],  w: 0.40 }, // platform (densest)
  { c: [4, 3.5, -190],  r: [16, 5, 18],  w: 0.17 }, // creative origins
  { c: [-6, 3.5, -295], r: [16, 5, 18],  w: 0.17 }, // unilever
  { c: [7, 6, -372],    r: [12, 8, 12],  w: 0.12 }, // finale tree
  { c: [0, 4, -185],    r: [11, 6, 360], w: 0.14 }, // scattered along track
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

  // ---- fog sprites that drift in from the sides ---------------------------
  _buildFog() {
    this.fogSprites = [];
    // zCenter = the Z the sprite drifts around (so fade/wrap are local, not at 0).
    const make = (x, y, zCenter, z, scl, vz, zHalf, op) => {
      const m = new THREE.SpriteMaterial({
        map: this.fog, color: new THREE.Color(PALETTE.haze),
        transparent: true, opacity: op, depthWrite: false,
        blending: THREE.NormalBlending,
      });
      const s = new THREE.Sprite(m);
      s.scale.set(scl, scl * 0.6, 1);
      s.position.set(x, y, z);
      s.userData = { vz, baseY: y, phase: Math.random() * 6.28, zCenter, zHalf, baseOp: op };
      this.scene.add(s);
      this.fogSprites.push(s);
    };
    // Platform fog: drifts along ±Z (screen-horizontal in the T-view), wraps.
    for (let i = 0; i < 6; i++) {
      const dir = i % 2 ? 1 : -1;
      make(2 + (Math.random() * 16 - 8), 2 + Math.random() * 2.5,
           0, (Math.random() * 36 - 18), 18 + Math.random() * 10,
           dir * (1.4 + Math.random() * 1.2), 20, 0.20);
    }
    // A little ambient drift at each station + the tree.
    make(4, 2.5, -190, -190, 20, 1.3, 18, 0.16);
    make(-6, 2.5, -295, -295, 20, -1.3, 18, 0.16);
    make(7, 3.5, -372, -372, 16, 1.0, 14, 0.14);
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
    halo(11, 5, -1, PALETTE.firefly, 6, 0.7);
    halo(11, 5, -15, PALETTE.firefly, 5, 0.6);
    halo(9, 5, -190, PALETTE.ember, 5, 0.55);
    halo(-10, 5, -295, PALETTE.firefly, 5, 0.55);
    halo(7, 9, -372, PALETTE.firefly, 6, 0.6);

    // A couple of real warm point lights so the glows feel grounded.
    const l1 = new THREE.PointLight(PALETTE.firefly, 8, 30, 2);
    l1.position.set(11, 5, -8);
    this.scene.add(l1);
  }

  // ---- pointer glow trail + light -----------------------------------------
  _buildPointer() {
    if (REDUCED) { this.trail = null; return; }
    const m = new THREE.SpriteMaterial({
      map: this.glow, color: new THREE.Color(PALETTE.firefly),
      transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.trail = new THREE.Sprite(m);
    this.trail.scale.set(4, 4, 1);
    this.trail.position.copy(this.pointerWorld);
    this.scene.add(this.trail);

    this.trailLight = new THREE.PointLight(PALETTE.firefly, 0, 18, 2);
    this.scene.add(this.trailLight);
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
  grd.addColorStop(0.0, 'rgba(180,200,222,0.55)');
  grd.addColorStop(0.5, 'rgba(150,175,200,0.22)');
  grd.addColorStop(1.0, 'rgba(140,165,190,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
