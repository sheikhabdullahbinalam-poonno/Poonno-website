// ============================================================================
//  world.js — the world the train travels through.
//  Fog, a dusk gradient sky dome, moonlit lighting, ground, the §5.1 track
//  topology built as REAL tracks (steel rails + wooden sleepers), the platform
//  + canopy, the two station platforms (far apart, with long forest runs between
//  them), the station nameplates, and a mystical forest that differs between the
//  two runs — tall conifers on the first, rounded broadleaf on the second.
// ============================================================================

import * as THREE from 'three';
import { PALETTE, FOG, SKY } from './config.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { preloadModels, getModel, normalize } from './models.js';
import { weatheredMetal, woodMaterial, stoneMaterial, slateMaterial, addMoonRim } from './materials.js';

const RAIL_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x8A929A, metalness: 0.85, roughness: 0.38, envMapIntensity: 1.0 });
const SLEEPER_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x3A2A1E, roughness: 0.95, metalness: 0.05 });
const ONE = new THREE.Vector3(1, 1, 1);

// Gas-lamp flicker registry + per-station light groups. updateStations(time, t)
// flickers the lamps AND gates each station's PointLights to when that station is in
// view — keeping the active light count ~10 across the journey instead of ~32.
const STATION_LAMPS = [];
const STATION_GROUPS = [];   // { lights:[PointLight…], tMin, tMax, on }
const _fl = (t, p) => 0.84 + 0.16 * (0.6 * Math.sin(t * 6.5 + p) + 0.4 * Math.sin(t * 16.0 + p * 2.3));
export function updateStations(time, t) {
  for (const g of STATION_GROUPS) {
    const on = t >= g.tMin && t <= g.tMax;
    if (g.on !== on) { for (const L of g.lights) L.visible = on; g.on = on; }
  }
  for (const L of STATION_LAMPS) {
    const f = _fl(time, L.phase);
    L.mat.emissiveIntensity = L.eBase * f;
    L.light.intensity = L.lBase * f;
    if (L.glow) L.glow.material.opacity = L.gBase * f;
    if (L.pool) L.pool.material.opacity = L.pBase * f;
  }
}

export function buildWorld(scene) {
  scene.fog = new THREE.FogExp2(FOG.color, FOG.density);
  scene.add(makeSky());
  addLights(scene);
  addGround(scene);
  addForest(scene);
  addLandmarks(scene);
  addTrack(scene);
  addNameplates(scene);
  addTelegraph(scene);
}

// ---- dusk gradient sky dome (unaffected by fog so the gradient always reads) -
function makeSky() {
  const geo = new THREE.SphereGeometry(2000, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(SKY.top) },
      horizonColor: { value: new THREE.Color(SKY.horizon) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vDir; uniform vec3 topColor; uniform vec3 horizonColor;
      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        gl_FragColor = vec4(mix(horizonColor, topColor, smoothstep(0.0, 0.75, h)), 1.0);
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = -1;
  return sky;
}

// ---- moonlit night lighting -------------------------------------------------
function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0x4A6C92, 0x1E2A38, 1.18));
  const moon = new THREE.DirectionalLight(0xBFD2EC, 1.6);
  moon.position.set(-150, 420, -250); // soft moonlight from above-front-left
  scene.add(moon);
  scene.add(new THREE.AmbientLight(0x1C2A38, 0.5));
  // soft moonlit fill over the darker far stretch (Unilever → Y-junction → finale).
  // decay 1 (linear) so it actually spreads across the stretch rather than dying
  // as 1/d² at ground level — the junction approach was reading near-black.
  const fill = new THREE.PointLight(0x9DB6D6, 16, 320, 1);
  fill.position.set(1.5, 22, -775);
  scene.add(fill);
  // a second, lower touch lifts the immediate foreground ground + rails there.
  const fill2 = new THREE.PointLight(0xA7BEDC, 9, 180, 1);
  fill2.position.set(0, 12, -745);
  scene.add(fill2);
}

// ---- ground -----------------------------------------------------------------
function addGround(scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(440, 1200),
    new THREE.MeshStandardMaterial({ color: 0x16242F, roughness: 0.82, metalness: 0.1, envMapIntensity: 0.5 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -420);
  scene.add(ground);
}

// ---- forest: real conifer GLB (tree1) instanced along the runs --------------
// Loaded async; tree1 is baked to unit height then instanced (foliage + trunk
// share one transform per tree). One draw call per sub-mesh, any number of trees.
function addForest(scene) {
  preloadModels().then(() => {
    const src = getModel('tree1');
    if (!src) return;
    normalize(src, { height: 1, align: 'none', ground: true });
    const baked = bakeModelMeshes(src);                  // [{geometry, material}], root-local
    if (!baked.length) return;

    // largest sub-mesh = foliage, the rest = trunk
    baked.sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x231910, roughness: 1, metalness: 0 });
    const foliageDark = new THREE.MeshStandardMaterial({ color: 0x2C4A3A, roughness: 0.92, metalness: 0, envMapIntensity: 0.45 });
    // Unilever forest: leaves are faintly luminous so moonlight seems to glow on them.
    const foliageMoon = new THREE.MeshStandardMaterial({
      color: 0x3E6E72, roughness: 0.85, metalness: 0,
      emissive: new THREE.Color(0x2C5A66), emissiveIntensity: 0.38, envMapIntensity: 0.7,
    });

    const { rest, moon } = forestMatrices();
    const buildSet = (mats, foliageMat) => {
      if (!mats.length) return;
      baked.forEach((b, idx) => {
        const inst = new THREE.InstancedMesh(b.geometry, idx === 0 ? foliageMat : trunkMat, mats.length);
        for (let i = 0; i < mats.length; i++) inst.setMatrixAt(i, mats[i]);
        inst.instanceMatrix.needsUpdate = true;
        inst.frustumCulled = false;   // transforms live in the matrix; keep it visible
        scene.add(inst);
      });
    };
    buildSet(rest, foliageDark);
    buildSet(moon, foliageDark);   // #9: Unilever forest now matches run 1 (no luminous leaves)
  }).catch((e) => console.warn('[world] forest load failed:', e.message));
}

// Bake each mesh of a model into the normalized model's space so it can be
// instanced. `root` is detached, so o.matrixWorld already expresses the mesh in
// the normalized frame (unit height, centred at origin, grounded) — bake that
// directly. (Do NOT divide out root.matrixWorld; that would undo normalize().)
function bakeModelMeshes(root) {
  root.updateMatrixWorld(true);
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const geometry = o.geometry.clone();
    geometry.applyMatrix4(o.matrixWorld);
    out.push({ geometry, material: o.material });
  });
  return out;
}

// Per-tree transforms. Unit tree, so uniform scale = height; ±10% width variance
// + random yaw. Trees are laid in CONTINUOUS rows hugging both sides of the track
// (weighted close so the camera threads a tunnel of trees), not scattered far off.
function forestMatrices() {
  const rest = [], moon = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const add = (out, x, z, h) => {
    q.setFromAxisAngle(up, Math.random() * Math.PI * 2);
    const r = 0.88 + Math.random() * 0.24;
    p.set(x, 0, z); s.set(h * r, h, h * r);
    out.push(m.compose(p, q, s).clone());
  };
  // A run lays a continuous near wall of trees hugging both sides of the track
  // (so the camera threads a tunnel) plus a sparser mid/far band for depth. Runs
  // STOP well before a station so the viewer can see it coming (anticipation gap).
  const run = (out, z0, z1, trackX, hMin, hMax, clear, opts = {}) => {
    const { near = 4, span = 6, wall2 = 0.6, depthProb = 0.6, step = 2.2 } = opts;
    for (let z = z0; z >= z1; z -= step) {
      for (const side of [-1, 1]) {
        const wall = 1 + (Math.random() < wall2 ? 1 : 0);
        for (let j = 0; j < wall; j++) {
          const x = trackX + side * (near + Math.random() * span), zz = z + (Math.random() - 0.5) * step;
          if (!(clear && clear(x, zz))) add(out, x, zz, hMin + Math.random() * (hMax - hMin));
        }
        if (Math.random() < depthProb) {
          const x = trackX + side * (near + span + Math.random() * 30), zz = z + (Math.random() - 0.5) * step;
          if (!(clear && clear(x, zz))) add(out, x, zz, hMin * 0.8 + Math.random() * (hMax - hMin));
        }
      }
    }
  };

  // Run 1 (start → Creative @ z−340): open & airy; ENDS at −296 so the last ~44u
  // before the station are clear and Creative Origins is visible on approach.
  run(rest, -14, -296, 0, 10, 16, null, { near: 6, span: 7, wall2: 0.2, depthProb: 0.45, step: 2.8 });
  // Run 2 (Creative → Unilever @ z−720): luminous moonlit forest, thinned a touch;
  // ENDS at −676 so Unilever Station can be anticipated through the clearing.
  run(moon, -404, -676, -5, 11, 19, null, { near: 5, span: 6, wall2: 0.32, depthProb: 0.45, step: 2.4 });
  // Sparse deeper backdrop for distance layering (stations & finale stay open).
  for (let i = 0; i < 150; i++) {
    const x = (Math.random() < 0.5 ? -1 : 1) * (28 + Math.random() * 50), z = 30 - Math.random() * 900;
    if (z < -800 && Math.abs(x) < 30) continue;          // finale: open sky
    if (z < -300 && z > -360 && Math.abs(x - 10) < 24) continue; // Creative approach clear
    if (z < -676 && z > -742 && Math.abs(x + 12) < 24) continue; // Unilever approach clear
    add(rest, x, z, 7 + Math.random() * 11);
  }
  return { rest, moon };
}

// A layered fir built by merging three smooth cones (base at y0, total height ~1).
let _firGeo = null;
function firGeometry() {
  if (_firGeo) return _firGeo;
  const layers = [{ b: 0.0, r: 1.0, h: 0.55 }, { b: 0.33, r: 0.72, h: 0.48 }, { b: 0.62, r: 0.46, h: 0.4 }];
  const parts = layers.map((L) => {
    const c = new THREE.ConeGeometry(L.r, L.h, 12);
    c.translate(0, L.b + L.h / 2, 0);
    return c;
  });
  _firGeo = mergeGeometries(parts);
  return _firGeo;
}

// Place up to `n` trees (canopy InstancedMesh + trunk InstancedMesh) from a spec fn.
function fill(scene, n, canopyGeo, canopyMat, trunkGeo, trunkMat, specFn, m, q, p, s) {
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, n);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
  let i = 0;
  for (let g = 0; g < n * 4 && i < n; g++) {
    const spec = specFn(i);
    if (!spec) continue;
    q.identity();
    p.set(spec.canopy[0], spec.canopy[1], spec.canopy[2]); s.set(spec.canopy[3], spec.canopy[4], spec.canopy[5]);
    canopies.setMatrixAt(i, m.compose(p, q, s));
    p.set(spec.trunk[0], spec.trunk[1], spec.trunk[2]); s.set(spec.trunk[3], spec.trunk[4], spec.trunk[5]);
    trunks.setMatrixAt(i, m.compose(p, q, s));
    i++;
  }
  canopies.count = i; trunks.count = i;
  canopies.instanceMatrix.needsUpdate = true; trunks.instanceMatrix.needsUpdate = true;
  // Instance transforms live in the matrix, so the default origin bounding sphere
  // would wrongly cull the whole forest when the origin is off-screen.
  canopies.frustumCulled = false; trunks.frustumCulled = false;
  scene.add(canopies); scene.add(trunks);
}

// ---- block helper -----------------------------------------------------------
function block(scene, { x = 0, y, z, w, h, d, color = 0x33485C, beacon = true, beaconColor = PALETTE.firefly }) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05 })
  );
  mesh.position.set(x, y, z);
  scene.add(mesh);
  if (beacon) scene.add(beaconAt(x, y + h / 2 + 1.4, z, beaconColor));
  return mesh;
}

function beaconAt(x, y, z, color, size = 0.7, intensity = 2.4) {
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 })
  );
  b.position.set(x, y, z);
  return b;
}

// ============================================================================
//  Cinematic code-built station (ref: References/Old Railway Station).
//  A raised plank platform, a weathered plaster + timber-frame building with a
//  slate-roofed clock tower and chimney, an open platform shelter, wrought-iron
//  lamps with warm glow, and the station nameplate. One reusable builder serves
//  both case-study stations (mirrored to whichever side the camera faces).
// ============================================================================

// --- shared aged textures (built once) ---
let _plasterTex, _slateTex, _clockTexCache = {};
function plasterTex() {
  if (_plasterTex) return _plasterTex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#b3a78f'; g.fillRect(0, 0, 256, 256);                 // aged plaster base
  for (let i = 0; i < 80; i++) {                                       // mottled staining
    g.fillStyle = `rgba(${90 + Math.random() * 40},${78 + Math.random() * 36},${56 + Math.random() * 30},${0.05 + Math.random() * 0.10})`;
    g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 30, 0, 6.283); g.fill();
  }
  g.strokeStyle = 'rgba(40,30,20,0.22)'; g.lineWidth = 1;              // hairline cracks
  for (let i = 0; i < 14; i++) {
    g.beginPath(); let x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 40; y += Math.random() * 26; g.lineTo(x, y); } g.stroke();
  }
  // a few exposed-brick patches (worn plaster) near the base
  for (let i = 0; i < 5; i++) {
    const bx = Math.random() * 200, by = 150 + Math.random() * 90;
    g.fillStyle = 'rgba(120,72,48,0.30)'; g.fillRect(bx, by, 24 + Math.random() * 30, 16 + Math.random() * 18);
  }
  _plasterTex = new THREE.CanvasTexture(c); _plasterTex.wrapS = _plasterTex.wrapT = THREE.RepeatWrapping;
  _plasterTex.colorSpace = THREE.SRGBColorSpace; return _plasterTex;
}
function slateTex() {
  if (_slateTex) return _slateTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#3c434c'; g.fillRect(0, 0, 128, 128);                 // dark slate
  for (let r = 0; r < 8; r++) for (let col = 0; col < 8; col++) {      // tile grid, offset rows
    const ox = (r % 2) * 8;
    g.fillStyle = `rgb(${48 + Math.random() * 22},${54 + Math.random() * 22},${62 + Math.random() * 22})`;
    g.fillRect(col * 16 + ox - 8, r * 16, 15, 15);
    g.strokeStyle = 'rgba(12,16,22,0.6)'; g.lineWidth = 1; g.strokeRect(col * 16 + ox - 8, r * 16, 15, 15);
  }
  _slateTex = new THREE.CanvasTexture(c); _slateTex.wrapS = _slateTex.wrapT = THREE.RepeatWrapping;
  _slateTex.colorSpace = THREE.SRGBColorSpace; return _slateTex;
}
function clockTex() {
  if (_clockTexCache.t) return _clockTexCache.t;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const R = 64;
  // aged, foxed cream face with brown stains
  g.fillStyle = '#bdb091'; g.beginPath(); g.arc(R, R, 58, 0, 6.283); g.fill();
  for (let i = 0; i < 44; i++) {
    g.fillStyle = `rgba(${88 + Math.random() * 44},${66 + Math.random() * 32},${38 + Math.random() * 24},${0.05 + Math.random() * 0.13})`;
    g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 9, 0, 6.283); g.fill();
  }
  g.fillStyle = 'rgba(74,52,28,0.2)'; g.beginPath(); g.arc(46, 82, 17, 0, 6.283); g.fill();   // damp stain bloom
  // grimy outer ring
  g.strokeStyle = 'rgba(26,20,12,0.75)'; g.lineWidth = 6; g.beginPath(); g.arc(R, R, 56, 0, 6.283); g.stroke();
  // worn, uneven tick marks
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * 6.283; const big = i % 3 === 0;
    g.strokeStyle = `rgba(38,30,18,${0.45 + Math.random() * 0.5})`; g.lineWidth = big ? 4 : 2;
    g.beginPath(); g.moveTo(R + Math.cos(a) * 50, R + Math.sin(a) * 50);
    g.lineTo(R + Math.cos(a) * (big ? 41 : 46), R + Math.sin(a) * (big ? 41 : 46)); g.stroke();
  }
  // faded, slightly bent hands + hub
  g.strokeStyle = 'rgba(26,20,12,0.85)'; g.lineCap = 'round';
  g.lineWidth = 5; g.beginPath(); g.moveTo(R, R); g.lineTo(R + Math.cos(-1.25) * 25, R + Math.sin(-1.25) * 25); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.moveTo(R, R); g.lineTo(R + Math.cos(2.3) * 40, R + Math.sin(2.3) * 40); g.stroke();
  g.fillStyle = '#1b150d'; g.beginPath(); g.arc(R, R, 3, 0, 6.283); g.fill();
  // a hairline crack across the glass
  g.strokeStyle = 'rgba(232,236,240,0.16)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(30, 38); g.lineTo(58, 64); g.lineTo(70, 58); g.lineTo(98, 94); g.stroke();
  _clockTexCache.t = new THREE.CanvasTexture(c); _clockTexCache.t.colorSpace = THREE.SRGBColorSpace; return _clockTexCache.t;
}
// Carved wooden name board: a colour map (weathered plank + dark routed serif text
// with a carved-bevel highlight) and a MATCHING bump/depth map (same text + position,
// black = recessed) so raked light shows the engraving. Per the attached photo.
function signTex(name) {
  const w = 640, h = 150;
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // natural humanist sans (cast-concrete signage feel), not a stiff serif
  const ff = (fs) => `700 ${fs}px "Trebuchet MS","Segoe UI","Helvetica Neue",Arial,sans-serif`;
  const c = mk(), g = c.getContext('2d');
  // --- cast CEMENT board: mottled grey concrete with aggregate speckle + stains ---
  g.fillStyle = '#9a988f'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 240; i++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(68,66,60,${0.04 + Math.random() * 0.1})`
                                      : `rgba(202,200,192,${0.03 + Math.random() * 0.08})`;
    g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 0, 6.283); g.fill();
  }
  for (let i = 0; i < 28; i++) {                                          // damp weather streaks
    g.strokeStyle = `rgba(58,56,50,${0.04 + Math.random() * 0.05})`; g.lineWidth = 1 + Math.random() * 2;
    const x = Math.random() * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 22, h); g.stroke();
  }
  const eg = g.createLinearGradient(0, 0, 0, h);
  eg.addColorStop(0, 'rgba(38,36,32,0.22)'); eg.addColorStop(0.5, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(38,36,32,0.3)');
  g.fillStyle = eg; g.fillRect(0, 0, w, h);
  // recessed cast border
  g.strokeStyle = 'rgba(40,38,33,0.55)'; g.lineWidth = 6; g.strokeRect(17, 17, w - 34, h - 34);
  g.strokeStyle = 'rgba(212,210,202,0.2)'; g.lineWidth = 1.5; g.strokeRect(14, 14, w - 28, h - 28);
  // pre-roll chipped-edge notches (broken concrete) — centres shared by both maps
  const chips = [];
  for (let i = 0; i < 30; i++) {
    const e = i % 4; let x = Math.random() * w, y = Math.random() * h;
    if (e === 0) y = Math.random() * 8; else if (e === 2) y = h - Math.random() * 8;
    else if (e === 1) x = w - Math.random() * 8; else x = Math.random() * 8;
    chips.push({ x, y, r: 3 + Math.random() * 9 });
  }
  const drawChips = (ctx, col) => {
    ctx.fillStyle = col;
    for (const ch of chips) {
      ctx.beginPath(); ctx.moveTo(ch.x, ch.y);
      for (let k = 0; k < 5; k++) ctx.lineTo(ch.x + (Math.random() - 0.5) * ch.r * 2, ch.y + (Math.random() - 0.5) * ch.r * 2);
      ctx.closePath(); ctx.fill();
    }
  };
  // engraved station name
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 56; g.font = ff(fs);
  while (g.measureText(name).width > w - 80 && fs > 16) { fs -= 2; g.font = ff(fs); }
  g.fillStyle = 'rgba(224,222,214,0.4)'; g.fillText(name, w / 2 - 1.5, h / 2 - 1.5);   // cast bevel highlight
  g.fillStyle = '#33312b'; g.fillText(name, w / 2, h / 2);                             // engraved letters
  g.strokeStyle = 'rgba(150,148,140,0.28)'; g.lineWidth = 1;                           // worn scratches over the text
  for (let i = 0; i < 8; i++) { const yy = h / 2 + (Math.random() - 0.5) * 56; g.beginPath(); g.moveTo(110 + Math.random() * 120, yy); g.lineTo(360 + Math.random() * 150, yy + (Math.random() - 0.5) * 8); g.stroke(); }
  drawChips(g, 'rgba(52,50,44,0.7)');                                                  // dark chip notches
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  // matching DEPTH map: mid board + surface pitting, recessed border/letters/chips
  const b = mk(), gb = b.getContext('2d');
  gb.fillStyle = '#b2b2b2'; gb.fillRect(0, 0, w, h);
  for (let i = 0; i < 1700; i++) { const v = 150 + Math.floor(Math.random() * 95); gb.fillStyle = `rgb(${v},${v},${v})`; gb.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } // pitting
  gb.strokeStyle = '#3a3a3a'; gb.lineWidth = 6; gb.strokeRect(17, 17, w - 34, h - 34);
  gb.textAlign = 'center'; gb.textBaseline = 'middle'; gb.font = ff(fs);
  gb.fillStyle = '#0e0e0e'; gb.fillText(name, w / 2, h / 2);
  drawChips(gb, '#1c1c1c');
  const bump = new THREE.CanvasTexture(b);
  return { map, bump };
}
// small warm radial halo for the gas-lamp glow
let _lampGlow;
function lampGlowTex() {
  if (_lampGlow) return _lampGlow;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,228,170,0.9)');     // warm yellow core
  grd.addColorStop(0.34, 'rgba(255,202,120,0.34)'); // amber, NOT red
  grd.addColorStop(1, 'rgba(255,194,110,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  _lampGlow = new THREE.CanvasTexture(c); _lampGlow.colorSpace = THREE.SRGBColorSpace; return _lampGlow;
}
// gravel ballast texture (grey stones) for the trackbed
let _gravelTex;
function gravelTex() {
  if (_gravelTex) return _gravelTex;
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#3b3934'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 1400; i++) {
    const v = 50 + Math.floor(Math.random() * 70);
    g.fillStyle = `rgb(${v},${v - 4},${v - 8})`;
    g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 2.6, 0, 6.283); g.fill();
  }
  _gravelTex = new THREE.CanvasTexture(c); _gravelTex.wrapS = _gravelTex.wrapT = THREE.RepeatWrapping;
  _gravelTex.repeat.set(3, 16); _gravelTex.colorSpace = THREE.SRGBColorSpace; return _gravelTex;
}

function buildStation(scene, { z, side = 1, trackX = 0, accent = PALETTE.ember, name = '', tMin = 0, tMax = 1 }) {
  const G = new THREE.Group(); scene.add(G);
  // Static geometry → keep frustum culling ON (off-screen stations aren't drawn).
  const add = (m) => { G.add(m); return m; };
  const X = (d) => trackX + side * d;                 // d = distance out from the track
  const faceTrack = side > 0 ? -Math.PI / 2 : Math.PI / 2;  // a +X face turns toward the track

  // --- materials (procedural PBR, weathered & moonlit) ---
  // Walls/quoins: real triplanar masonry. Deck/timber: object-space wood grain.
  // Iron: the train's rusty weatheredMetal so the station shares its patina.
  const stone   = stoneMaterial({ stone: new THREE.Color(0x3d362b), mortar: new THREE.Color(0x12100b), scale: 1.5, bump: 1.1 });
  const brickQ  = stoneMaterial({ stone: new THREE.Color(0x472f22), mortar: new THREE.Color(0x110b06), scale: 2.6, bump: 1.2 }); // quoins/chimney brick
  const slate   = slateMaterial({ base: new THREE.Color(0x363d46), moss: new THREE.Color(0x29371f), scale: 1.5, bump: 0.8 }); // no moon-rim: the per-tile bump made each tile catch it (read as "lit per brick")
  const timber  = woodMaterial({ light: new THREE.Color(0x322212), dark: new THREE.Color(0x120a04), scale: 1.4 });
  const deckWood = woodMaterial({ light: new THREE.Color(0x392717), dark: new THREE.Color(0x180f07), scale: 0.7 });
  const iron    = weatheredMetal({
    base: new THREE.Color(0x191a18), rust: new THREE.Color(0x4f2d1a),
    yLow: 0.0, yHigh: 4.0, paintRough: 0.62, rustRough: 0.97, metalBase: 0.62, scale: 1.6, panel: 0.0, rustAmt: 0.42,
    rim: 0.12, rimPow: 4.2,
  });
  // window glass — a DIM warm interior glow (a low-lit room behind it) so the panes
  // just read, plus a cool sheen for the moonlit reflection (ref photo)
  const winGlow = new THREE.MeshStandardMaterial({ color: 0x140d05, emissive: 0xffb260, emissiveIntensity: 0.32, roughness: 0.22, metalness: 0.45, envMapIntensity: 0.8 });

  const box = (w, h, dp, mat, d, y, dz, ry = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dp), mat);
    m.position.set(X(d), y, z + dz); m.rotation.y = ry; return add(m);
  };

  // ---- raised plank platform (base slab + individual boards with grain gaps) ----
  const PLEN = 42, deckTop = 0.92, nearD = 2.6, farD = 10.6, midD = (nearD + farD) / 2, pW = farD - nearD;
  box(pW, deckTop, PLEN, stone, midD, deckTop / 2, 0);                 // stone substructure
  for (let d = nearD + 0.25; d < farD; d += 0.5) {                    // deck boards (grain runs along z), gaps show the dark base
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, PLEN), deckWood);
    m.position.set(X(d), deckTop + 0.05, z); add(m);
  }
  box(0.18, 0.5, PLEN, timber, nearD - 0.02, deckTop - 0.1, 0);        // timber edge fascia (track side)
  for (let dz = -PLEN / 2 + 2; dz <= PLEN / 2 - 2; dz += 5)            // trestle supports under the edge
    box(0.3, deckTop, 0.3, timber, nearD + 0.2, deckTop / 2, dz);

  // ---- station building: stone walls, timber framing, slate gable, brick chimney
  const bD = 13.5, bFront = 10.2, bW = 8.5, bH = 5.0;                  // body
  box(7, bH, bW, stone, bD, bH / 2, 0);
  // brick corner quoins at the track-facing front
  box(0.6, bH, 0.6, brickQ, bFront, bH / 2, -bW / 2 + 0.3);
  box(0.6, bH, 0.6, brickQ, bFront, bH / 2, bW / 2 - 0.3);
  // half-timbered framing on the front wall
  const beam = (w, h, d, y, dz, ry = 0) => box(w, h, d, timber, bFront - 0.03, y, dz, ry);
  beam(0.22, bH, 0.22, bH / 2, -2.6); beam(0.22, bH, 0.22, bH / 2, 0); beam(0.22, bH, 0.22, bH / 2, 2.6); // verticals
  beam(0.22, 0.22, bW, bH - 0.3, 0); beam(0.22, 0.22, bW, 2.4, 0);     // horizontals
  // gable roof (two slate slopes) — slightly irregular: per-slope jitter, a ridge
  // cap, and a scatter of displaced / missing slate tiles along the eaves.
  for (const s of [-1, 1]) {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(7.7, 0.24, bW + 0.7), slate);
    slope.position.set(X(bD) + side * s * 1.55, bH + 1.35 + (Math.random() - 0.5) * 0.08, z + (Math.random() - 0.5) * 0.1);
    slope.rotation.z = s * 0.62 + (Math.random() - 0.5) * 0.025;
    slope.rotation.x = (Math.random() - 0.5) * 0.018; add(slope);
    // loose/displaced tiles riding the eave, a few sunk (missing) for a worn line
    for (let i = 0; i < 9; i++) {
      const tz = z - (bW + 0.5) / 2 + Math.random() * (bW + 0.5);
      const missing = Math.random() < 0.18;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 0.5),
        missing ? new THREE.MeshStandardMaterial({ color: 0x161a1f, roughness: 1 }) : slate);
      tile.position.set(X(bD) + side * s * 3.0 + side * (Math.random() - 0.5) * 0.3,
        bH + 0.45 + (missing ? -0.06 : Math.random() * 0.08), tz);
      tile.rotation.set((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.2, s * 0.62 + (Math.random() - 0.5) * 0.12);
      add(tile);
    }
  }
  // ridge cap along the apex
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, bW + 0.8), slate);
  ridge.position.set(X(bD), bH + 2.42, z); ridge.rotation.y = Math.PI / 4; ridge.scale.x = 0.7; add(ridge);
  box(7.0, 1.7, 0.3, stone, bD, bH + 0.85, -bW / 2 + 0.16);
  box(7.0, 1.7, 0.3, stone, bD, bH + 0.85, bW / 2 - 0.16);
  // brick chimney + slate cap
  box(1.0, 2.4, 1.0, brickQ, bD + 1.6, bH + 1.7, -2.2);
  box(1.3, 0.3, 1.3, slate, bD + 1.6, bH + 3.0, -2.2);

  // The track-facing wall plane (the stone body's front face). Door/windows are
  // thin in X (depth) and wide in Z (along the wall), sitting PROUD of this face
  // so they read head-on from the track — the earlier version had X/Z swapped.
  const bFace = bD - 3.5;
  // ---- door: brick jambs + lintel framing the opening, panelled timber door set in
  const doorW = 1.5, doorH = 3.0;
  for (const sx of [-1, 1])                                                       // brick jambs
    box(0.34, doorH + 0.3, 0.34, brickQ, bFace - 0.12, doorH / 2, sx * (doorW / 2 + 0.2));
  box(0.34, 0.42, doorW + 0.9, brickQ, bFace - 0.12, doorH + 0.16, 0);            // lintel
  box(0.14, doorH, doorW, timber, bFace - 0.06, doorH / 2, 0);                    // door slab (recessed in frame)
  for (const py of [doorH * 0.7, doorH * 0.36])                                   // raised panels
    box(0.05, doorH * 0.22, doorW * 0.55, timber, bFace - 0.14, py, 0);
  box(0.1, 0.1, 0.1, iron, bFace - 0.15, 1.4, doorW * 0.32);                      // door knob
  // ---- two windows: brick sill + lintel + jambs, recessed dark glass, mullion cross
  const winW = 1.2, winH = 1.5, winY = 2.75;
  for (const dz of [-2.9, 2.9]) {
    box(0.4, 0.2, winW + 0.5, brickQ, bFace - 0.12, winY - winH / 2 - 0.06, dz);  // sill
    box(0.4, 0.24, winW + 0.5, brickQ, bFace - 0.12, winY + winH / 2 + 0.07, dz); // lintel
    for (const sx of [-1, 1])                                                     // jambs
      box(0.36, winH, 0.18, brickQ, bFace - 0.12, winY, dz + sx * (winW / 2 + 0.12));
    box(0.08, winH, winW, winGlow, bFace - 0.05, winY, dz);                       // recessed dark glass
    box(0.12, winH, 0.05, timber, bFace - 0.12, winY, dz);                        // mullion (vertical)
    box(0.12, 0.05, winW, timber, bFace - 0.12, winY, dz);                        // mullion (horizontal)
  }

  // ---- clock tower at the front corner: stone shaft + pyramid slate roof + clock
  const tD = bFront + 0.4, tDZ = -bW / 2 - 0.6, tH = 8.2, tW = 2.6;
  box(tW, tH, tW, stone, tD, tH / 2, tDZ);
  box(0.26, tH, 0.26, timber, tD - tW / 2 + 0.1, tH / 2, tDZ - tW / 2 + 0.1); // corner beams
  box(0.26, tH, 0.26, timber, tD - tW / 2 + 0.1, tH / 2, tDZ + tW / 2 - 0.1);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.05, 2.4, 4), slate);  // pyramidal slate cap
  spire.position.set(X(tD), tH + 1.2, z + tDZ); spire.rotation.y = Math.PI / 4; add(spire);
  const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), iron);
  finial.position.set(X(tD), tH + 2.6, z + tDZ); add(finial);
  // grimy clock face on the track-facing side, with a rusted iron bezel; barely self-lit
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.82, 32),
    new THREE.MeshStandardMaterial({ map: clockTex(), emissive: 0xffffff, emissiveMap: clockTex(), emissiveIntensity: 0.1, roughness: 0.88, side: THREE.DoubleSide }));
  clock.position.set(X(tD - tW / 2 - 0.02), 6.2, z + tDZ); clock.rotation.y = faceTrack; add(clock);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.1, 8, 24), iron);
  bezel.position.set(X(tD - tW / 2 - 0.02), 6.2, z + tDZ); bezel.rotation.y = faceTrack; add(bezel);

  // ---- open platform shelter (posts + pitched slate roof) further along ----
  const shZ = 11, shD = 6.2, shW = 5;
  for (const px of [shD - 1.6, shD + 1.6]) for (const pz of [-shW / 2, shW / 2])
    box(0.18, 2.5, 0.18, timber, px, deckTop + 1.25, shZ + pz);       // four posts
  box(4.6, 0.16, shW + 0.6, timber, shD, deckTop + 2.5, shZ);          // lintel/ceiling
  for (const s of [-1, 1]) {                                           // pitched roof
    const r = box(2.9, 0.18, shW + 1, slate, shD, deckTop + 2.95, shZ, 0);
    r.rotation.z = s * 0.5; r.position.set(X(shD) + side * s * 1.25, deckTop + 3.0, z + shZ);
  }
  box(4.4, 0.4, 0.12, timber, shD - 1.45, deckTop + 2.3, shZ + shW / 2 + 0.3); // valance board

  // bench against the building — GLB prop, async loaded
  preloadModels().then(() => {
    const bm = getModel('bench');
    if (!bm) return;
    normalize(bm, { length: 2.0, ground: true });
    bm.traverse((o) => { if (o.isMesh) { o.material = timber; o.material.needsUpdate = true; } });
    bm.position.set(X(bFront - 0.85), deckTop, z + 4.5);
    bm.rotation.y = faceTrack + Math.PI;   // back to building wall
    add(bm);
  });

  // ---- low-poly lamp post GLB — async loaded, lights added immediately ----
  const addLamp = (lx, lz) => {
    const LY = 4.2;         // lantern height above deck surface (matches GLB scale)
    const lampGroup = new THREE.Group();
    lampGroup.position.set(lx, deckTop, z + lz);
    add(lampGroup);

    preloadModels().then(() => {
      const lm = getModel('lamp');
      if (!lm) return;
      normalize(lm, { height: LY, ground: true });
      lm.traverse((o) => { if (o.isMesh) { o.material = iron; o.castShadow = false; } });
      lampGroup.add(lm);
    });

    // Warm glow sprite + point light — independent of async model, flicker-ready
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: lampGlowTex(), color: 0xffc878, transparent: true, opacity: 0.5,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    glow.position.set(0, LY, 0); glow.scale.set(1.6, 1.6, 1);
    lampGroup.add(glow);

    const L = new THREE.PointLight(0xffb45a, 1.8, 12, 2);
    L.position.set(0, LY, 0); lampGroup.add(L);

    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6),
      new THREE.MeshBasicMaterial({ map: lampGlowTex(), color: 0xffb35a, transparent: true, opacity: 0.26, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.07, 0);
    lampGroup.add(pool);

    const glassMat = new THREE.MeshStandardMaterial({ color: 0x2a1d0c, emissive: 0xffb45a, emissiveIntensity: 0.5, roughness: 0.5, transparent: true, opacity: 0.9 });
    const phase = (STATION_LAMPS.length % 2) * Math.PI + Math.random() * 0.5;
    STATION_LAMPS.push({ mat: glassMat, light: L, glow, pool, eBase: 0.5, lBase: 1.8, gBase: 0.5, pBase: 0.26, phase });
  };
  addLamp(X(nearD + 0.5), -12); addLamp(X(nearD + 0.5), 2); addLamp(X(nearD + 0.5), 15);
  // NB: no building light — the station is dark/unlit (only the platform lamps glow).

  // ---- carved wooden name board at the platform START, faced down the line so an
  // approaching train reads it from a distance (rotated to face +z, ref photo) ----
  {
    const { map, bump } = signTex(name);
    const sw = 4.8, sh = 1.3, signZ = z + PLEN / 2 - 2.5, signCementBack = new THREE.MeshStandardMaterial({ color: 0x6d6a61, roughness: 0.95, metalness: 0 });
    const boardMat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.4, roughness: 0.94, metalness: 0 });
    const sign = new THREE.Group();
    // cast cement slab — boardMat (engraved face) on +Z toward the train, cement on the rest
    const board = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, 0.16),
      [signCementBack, signCementBack, signCementBack, signCementBack, boardMat, signCementBack]);
    board.position.y = 2.5; sign.add(board);
    // two CONCRETE posts BEHIND the board (the -Z side), holding it up
    const postMat = new THREE.MeshStandardMaterial({ color: 0x6a675e, roughness: 0.96, metalness: 0 });
    for (const sx of [-sw * 0.32, sw * 0.32]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.17, 3.3, 0.17), postMat);
      p.position.set(sx, 1.65, -0.2); sign.add(p);                     // behind the board face
    }
    // set WELL BACK onto the platform so the board never overhangs the track/train
    sign.position.set(X(nearD + 3.0), 0, signZ);
    sign.rotation.y = -side * 0.28;                                    // faced +z, angled slightly to the track
    G.add(sign);
    // a dim dedicated lamp so ONLY the board reads (short range, warm)
    const sl = new THREE.PointLight(0xffce93, 1.5, 5.5, 2);
    sl.position.set(X(nearD + 3.0), 3.0, signZ + 1.5); add(sl);
  }

  // ---- ground transition: gravel trackbed + grass verges so the platform meets
  // the world instead of floating on the dark ground plane ----
  const plane = (w2, d2, mat, gx, gz) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w2, d2), mat);
    p.rotation.x = -Math.PI / 2; p.position.set(gx, 0.04, gz); add(p);
  };
  const grassMatV = new THREE.MeshStandardMaterial({ color: 0x202c18, roughness: 1, metalness: 0 });
  plane(16, PLEN + 26, grassMatV, X(farD + 8), z);                     // verge behind the platform
  plane(2.4, PLEN + 26, grassMatV, X(nearD - 1.7), z);                 // grass strip platform→track
  const gravelMat = new THREE.MeshStandardMaterial({ map: gravelTex(), color: 0x55524b, roughness: 1, metalness: 0 });
  plane(5.4, PLEN + 30, gravelMat, trackX, z);                         // gravel ballast under the rails

  // ---- weathering: moss, weeds, leaf litter, and a little debris ----
  const moss = new THREE.MeshStandardMaterial({ color: 0x2c361f, roughness: 1, metalness: 0 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f3016, roughness: 1, metalness: 0 });
  const weedMat = new THREE.MeshStandardMaterial({ color: 0x313d1c, roughness: 1, metalness: 0 });
  for (let i = 0; i < 24; i++) {                                       // moss patches on the deck
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.18 + Math.random() * 0.32, 6), moss);
    p.rotation.x = -Math.PI / 2; p.rotation.z = Math.random() * 6;
    p.position.set(X(nearD + Math.random() * pW), deckTop + 0.105, z + (Math.random() - 0.5) * PLEN);
    p.scale.y = 0.6 + Math.random(); add(p);
  }
  for (let i = 0; i < 16; i++) {                                       // moss creeping up the wall base
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.16 + Math.random() * 0.28, 6), moss);
    p.rotation.y = faceTrack; p.position.set(X(bFront - 0.03), 0.15 + Math.random() * 1.4, z + (Math.random() - 0.5) * (bW - 0.6)); add(p);
  }
  for (let i = 0; i < 12; i++) {                                       // weeds at the track-side base
    const wc = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.35 + Math.random() * 0.3, 4), weedMat);
    wc.position.set(X(nearD - 0.25 + Math.random() * 0.5), 0.2, z + (Math.random() - 0.5) * PLEN);
    wc.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * 6, (Math.random() - 0.5) * 0.4); add(wc);
  }
  for (let i = 0; i < 26; i++) {                                       // leaf litter on the deck
    const lf = new THREE.Mesh(new THREE.CircleGeometry(0.04 + Math.random() * 0.05, 5), leafMat);
    lf.rotation.x = -Math.PI / 2; lf.position.set(X(nearD + Math.random() * pW), deckTop + 0.105, z + (Math.random() - 0.5) * PLEN); add(lf);
  }
  const crate = (cd, cz, s2) => { const m2 = new THREE.Mesh(new THREE.BoxGeometry(s2, s2, s2), timber); m2.position.set(X(cd), deckTop + s2 / 2, z + cz); m2.rotation.y = Math.random(); add(m2); };
  crate(bFront - 1.3, -3.6, 0.7); crate(bFront - 1.7, -3.2, 0.5); crate(shD + 1.8, -shW + 2, 0.6);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.9, 12), timber);
  barrel.position.set(X(bFront - 1.0), deckTop + 0.45, z - 5.6); add(barrel);
  // ivy creeping up a corner of the building (blends it into the world)
  const ivyMat = new THREE.MeshStandardMaterial({ color: 0x22331c, roughness: 1, metalness: 0 });
  for (let i = 0; i < 26; i++) {
    const iv = new THREE.Mesh(new THREE.CircleGeometry(0.12 + Math.random() * 0.24, 5), ivyMat);
    iv.rotation.y = faceTrack; iv.rotation.z = Math.random() * 6;
    iv.position.set(bFace - 0.05, 0.4 + Math.random() * (bH - 0.4), 0); // placed via group offset below
    iv.position.x = X(bFace - 0.05);
    iv.position.z = z - bW / 2 + 0.25 + Math.random() * 1.6;
    add(iv);
  }
  // grass tufts along the platform base, track side (softens the hard edge)
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x2d391f, roughness: 1, metalness: 0 });
  for (let i = 0; i < 22; i++) {
    const gt = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3 + Math.random() * 0.26, 4), grassMat);
    gt.position.set(X(nearD - 0.45 + Math.random() * 0.35), 0.18, z + (Math.random() - 0.5) * PLEN);
    gt.rotation.set((Math.random() - 0.5) * 0.35, Math.random() * 6, (Math.random() - 0.5) * 0.35); add(gt);
  }

  // ---- ACCENT LIGHTING (ref: warm-uplit stone house at dusk). Ground uplights
  // graze up the stone façade so the masonry/bump reads, a soffit wash catches the
  // gable, the windows glow warm on their own (emissive), and a cool moon-rim keeps
  // the roof silhouette. Warm + localised = architectural, not a flat flood. ----
  const warmUp = (d, y, dz, int, dist) => { const L = new THREE.PointLight(0xffb265, int, dist, 2); L.position.set(X(d), y, z + dz); add(L); };
  warmUp(bFace - 0.55, 0.5, -2.9, 2.8, 8.5);   // façade uplight — left
  warmUp(bFace - 0.55, 0.5, 0.6, 2.8, 8.5);    // façade uplight — door/centre
  warmUp(bFace - 0.55, 0.5, 2.9, 2.8, 8.5);    // façade uplight — right
  warmUp(bFace - 0.5, bH + 0.5, 0, 2.4, 8);    // soffit wash up into the gable peak
  warmUp(tD - tW / 2 - 0.4, 1.8, tDZ, 2.2, 8); // warm graze on the clock-tower face
  const rim = new THREE.PointLight(0x9fb8db, 3.0, 34, 2);           // cool moon-rim on the roof
  rim.position.set(X(bD + 2), bH + 12, z - bW); add(rim);
  const towerWash = new THREE.PointLight(0xbcd2ee, 1.5, 16, 2);     // faint cool on the tower
  towerWash.position.set(X(tD - 2.2), tH * 0.72, z + tDZ + 2.2); add(towerWash);

  // gather this station's PointLights and gate them to when it's in view (perf).
  const sLights = []; G.traverse((o) => { if (o.isLight) sLights.push(o); });
  for (const L of sLights) L.visible = false;                      // start off (updateStations enables on approach)
  STATION_GROUPS.push({ lights: sLights, tMin, tMax, on: false });
  return G;
}

// ---- platform, canopy, stations, finale tree --------------------------------
function addLandmarks(scene) {
  // Start platform beside the track (centreline x≈0), with a clear gap.
  block(scene, { x: 8, y: 0.4, z: 2, w: 11, h: 0.8, d: 30, color: 0x3A3F44, beacon: false });

  // Platform canopy — a flat roof on posts (§6.1), framing the "T" view overhead.
  const canMat = new THREE.MeshStandardMaterial({ color: 0x39454F, roughness: 0.85, metalness: 0.15 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2A333C, roughness: 0.8, metalness: 0.3 });
  const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.3, 27), canMat);
  roofSlab.position.set(8, 5.0, 2); scene.add(roofSlab);
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(11.7, 0.5, 0.3), canMat);
  fascia.position.set(8, 4.75, -11.4); scene.add(fascia);
  for (const sx of [4, 12]) for (const pz of [-10, -2, 6, 14]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.2, 8), postMat);
    post.position.set(sx, 2.9, pz); scene.add(post);
  }
  const bulbMat = new THREE.MeshStandardMaterial({ color: PALETTE.firefly, emissive: PALETTE.firefly, emissiveIntensity: 0.9 });
  for (const pz of [-8, 0, 8]) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), bulbMat);
    bulb.position.set(6, 4.5, pz); scene.add(bulb);
    const lamp = new THREE.PointLight(0xFFCF8C, 7, 20, 2);
    lamp.position.set(5.5, 4.3, pz); scene.add(lamp);
  }

  // Creative Origins — cinematic station on the +X side (camera looks right).
  // tMin/tMax gate its lights to the approach→depart window (hold is 0.548–0.638).
  buildStation(scene, { z: -340, side: 1, trackX: 0, accent: PALETTE.ember, name: 'CREATIVE ORIGINS', tMin: 0.50, tMax: 0.67 });
  // Unilever Years — same station mirrored to the −X side (track x≈−5) (hold 0.804–0.880).
  buildStation(scene, { z: -720, side: -1, trackX: -5, accent: PALETTE.haze, name: 'UNILEVER YEARS', tMin: 0.75, tMax: 0.90 });

  // Finale: a step-down platform bridges from the train's stop (z≈−793, behind
  // the camera) forward to the great tree (z≈−825). No station here — just the tree.
  block(scene, { x: 5, y: 0.3, z: -809, w: 5, h: 0.6, d: 34, color: 0x33383D, beacon: false });
  addFinaleTree(scene, 7.5, -825);
  addFinaleConifers(scene);
}

// Conifers flanking the finale — a few to the LEFT (#15) plus a couple on the
// right to frame the great tree without crowding the moonlit silhouette.
function addFinaleConifers(scene) {
  const spots = [
    [-2, -832, 13], [0.8, -812, 11], [-4.5, -848, 14], [2.2, -842, 12.5],  // left
    [15.5, -836, 13], [17, -816, 11.5],                                     // right
  ];
  preloadModels().then(() => {
    const src = getModel('tree1');
    if (!src) return;
    const foliage = new THREE.MeshStandardMaterial({ color: 0x2C4A3A, roughness: 0.92, metalness: 0, envMapIntensity: 0.45 });
    const trunk = new THREE.MeshStandardMaterial({ color: 0x231910, roughness: 1, metalness: 0 });
    for (const [x, z, h] of spots) {
      const t = getModel('tree1');
      normalize(t, { height: h, align: 'none', ground: true });
      let big = -1, fol = null;
      t.traverse((o) => { if (o.isMesh && o.geometry.attributes.position.count > big) { big = o.geometry.attributes.position.count; fol = o; } });
      t.traverse((o) => { if (o.isMesh) { o.material = (o === fol) ? foliage : trunk; o.frustumCulled = false; } });
      t.position.set(x, 0, z); t.rotation.y = Math.random() * Math.PI * 2;
      scene.add(t);
    }
  }).catch(() => {});
}

// ---- the hero finale tree (real GLB, intricate bare silhouette) -------------
const FINALE_HEIGHT = 28;
function addFinaleTree(scene, x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  scene.add(group);

  preloadModels().then(() => {
    const tree = getModel('finaleTree');
    if (!tree) return;
    normalize(tree, { height: FINALE_HEIGHT, align: 'none', ground: true });
    const bark = new THREE.MeshStandardMaterial({ color: 0x2A2620, roughness: 0.92, metalness: 0.0, envMapIntensity: 1.3 });
    let canopy = null, max = -1;
    tree.traverse((o) => {
      if (!o.isMesh) return;
      o.material = bark; o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false;
      if (o.geometry.attributes.position.count > max) { max = o.geometry.attributes.position.count; canopy = o; }
    });
    group.add(tree);
    addBlossoms(scene, canopy, group, 4500);   // pink glowing luminous leaves on the one tree
  }).catch((e) => console.warn('[world] finale tree load failed:', e.message));
}

// Scatter pink, glowing, luminous blossoms across the finale tree's branches —
// soft emissive points that catch the bloom pass and gently breathe.
function addBlossoms(scene, mesh, group, count) {
  mesh.updateMatrixWorld(true);
  // Fill the crown as an ellipsoid SHELL (independent of the bare tree's uneven
  // vertex density) so the blossoms read as an even, glowing pink canopy.
  const box = new THREE.Box3().setFromObject(mesh);
  const c = new THREE.Vector3(); box.getCenter(c);
  const top = box.max.y, crownLo = box.min.y + (box.max.y - box.min.y) * 0.45;
  const cy = (crownLo + top) / 2, ry = (top - crownLo) / 2;
  const rx = (box.max.x - box.min.x) * 0.5 * 0.72, rz = (box.max.z - box.min.z) * 0.5 * 0.72;
  const arr = new Float32Array(count * 3);
  const u = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    u.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    if (u.lengthSq() < 1e-4) u.set(0, 1, 0);
    u.normalize().multiplyScalar(0.55 + 0.45 * Math.random());   // shell bias
    arr[i * 3]     = c.x + u.x * rx;
    arr[i * 3 + 1] = cy + u.y * ry;
    arr[i * 3 + 2] = c.z + u.z * rz;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xFF93C8, size: 1.05, sizeAttenuation: true, map: blossomTex(),
    transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.onBeforeRender = () => { mat.size = 1.0 + 0.2 * Math.sin(performance.now() * 0.0016); };
  scene.add(pts);
}

let _blossomTex = null;
function blossomTex() {
  if (_blossomTex) return _blossomTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0.0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.4, 'rgba(255,190,222,0.9)');
  gr.addColorStop(1.0, 'rgba(255,150,200,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 32, 0, 6.2832); g.fill();
  _blossomTex = new THREE.CanvasTexture(c);
  _blossomTex.colorSpace = THREE.SRGBColorSpace;
  return _blossomTex;
}

// ---- §5.1 track topology as REAL tracks (steel rails + wooden sleepers) ------
function addTrack(scene) {
  // The route the train rides: main line → V → left branch → Unilever → Y.
  buildRealTrack(scene, [
    [0, 42], [0, 6], [0, -120], [0, -260], [0, -340], [0, -400],
    [-3, -432], [-5, -490], [-5, -650], [-5, -720],
    [-5, -745], [-2, -772], [1.5, -789],
  ]);
  // V junction RIGHT branch — decorative, trails off into the forest/fog.
  buildRealTrack(scene, [[0, -400], [6, -428], [16, -468], [30, -520]]);
  // Creative-Origins line — sweeps out on the +X side and into the Y junction.
  buildRealTrack(scene, [[0, -340], [11, -430], [13, -560], [9, -680], [4, -760], [1.6, -789]]);
  // Merged single track: Y → stop BEHIND the final camera (so the train is out of the finale shot).
  buildRealTrack(scene, [[1.5, -789], [2, -791.5], [2, -793]]);

  junctionMarker(scene, 0, -400, PALETTE.ember);   // V
  junctionMarker(scene, 1.5, -789, PALETTE.ember); // Y — warm lit lamps, same as the V crossing (moss was too dark to read as lit)
}

function buildRealTrack(scene, pts2d, { gauge = 0.7 } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts2d.map(([x, z]) => new THREE.Vector3(x, 0.2, z)));
  const len = curve.getLength();
  const N = Math.max(24, Math.round(len / 2.2));
  const up = new THREE.Vector3(0, 1, 0);
  const left = [], right = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const pt = curve.getPointAt(u), tan = curve.getTangentAt(u);
    const nl = Math.hypot(tan.z, tan.x) || 1;
    const ox = tan.z / nl * gauge, oz = -tan.x / nl * gauge;
    left.push(new THREE.Vector3(pt.x + ox, 0.32, pt.z + oz));
    right.push(new THREE.Vector3(pt.x - ox, 0.32, pt.z - oz));
  }
  for (const arr of [left, right]) {
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arr), N, 0.07, 6, false);
    scene.add(new THREE.Mesh(geo, RAIL_MATERIAL));
  }
  // sleepers (instanced), laid perpendicular across the rails
  const sgeo = new THREE.BoxGeometry(gauge * 2 + 0.7, 0.14, 0.5);
  const inst = new THREE.InstancedMesh(sgeo, SLEEPER_MATERIAL, N + 1);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3();
  let k = 0;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const pt = curve.getPointAt(u), tan = curve.getTangentAt(u);
    q.setFromAxisAngle(up, Math.atan2(tan.x, tan.z));
    p.set(pt.x, 0.14, pt.z);
    inst.setMatrixAt(k++, m.compose(p, q, ONE));
  }
  inst.count = k; inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);
}

// A detailed railway level-crossing signal: mast + base, a crossbuck (RAILWAY
// CROSSING X with red tips), twin hooded lamps, a top beacon, and a soft glow.
function junctionMarker(scene, x, z, signalColor) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2A3742, roughness: 0.65, metalness: 0.45 });
  const lampMat = new THREE.MeshStandardMaterial({ color: signalColor, emissive: signalColor, emissiveIntensity: 3 });

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 6, 10), metal);
  post.position.y = 3; g.add(post);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.56, 0.5, 10), metal);
  base.position.y = 0.25; g.add(base);

  // crossbuck — two crossed planks with red end tips
  const plankMat = new THREE.MeshStandardMaterial({ color: 0xE8E2D2, roughness: 0.6 });
  const tipMat = new THREE.MeshStandardMaterial({ color: 0xB23A2E, roughness: 0.6 });
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.42, 0.08), plankMat);
    plank.position.set(0, 5.4, 0.14); plank.rotation.z = a; g.add(plank);
    for (const s of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.44, 0.09), tipMat);
      tip.position.set(s * 1.05 * Math.cos(a), 5.4 + s * 1.05 * Math.sin(a), 0.15); tip.rotation.z = a; g.add(tip);
    }
  }
  // twin hooded signal lamps
  for (const s of [-0.55, 0.55]) {
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.18, 10), metal);
    hood.rotation.x = Math.PI / 2; hood.position.set(s, 4.1, 0.18); g.add(hood);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), lampMat);
    lamp.position.set(s, 4.1, 0.3); g.add(lamp);
  }
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), lampMat);
  top.position.y = 6.15; g.add(top);
  const glow = new THREE.PointLight(signalColor, 2.2, 16, 2);
  glow.position.set(0, 4.4, 0.6); g.add(glow);

  g.position.set(x + 2, 0, z);
  scene.add(g);
}

// ---- telegraph line: creosote poles with crossarms + insulators and sagging
// wires, receding down the line for depth + period detail. Two runs, each on the
// side AWAY from that region's platform so they never clutter the station shots. --
function addTelegraph(scene) {
  // a VERY faint cool moon-rim so the dark poles/wires just catch a sliver of moonlight
  const poleMat = addMoonRim(new THREE.MeshStandardMaterial({ color: 0x1b130a, roughness: 0.95, metalness: 0.04 }), { strength: 0.22, power: 3.2 });
  const wireMat = addMoonRim(new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.6, metalness: 0.5 }), { strength: 0.2, power: 2.8 });
  const insMat = addMoonRim(new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.7 }), { strength: 0.2, power: 3.2 });
  const add = (m) => { scene.add(m); return m; };   // static → frustum culling stays on
  const runs = [
    { x: -8, z0: 18, z1: -382, n: 18 },     // start → Creative (platform is +X)
    { x: 4, z0: -402, z1: -760, n: 16 },    // forest → Unilever (platform is −X)
  ];
  for (const run of runs) {
    const poles = [];
    for (let i = 0; i < run.n; i++) {
      const pz = run.z0 + (run.z1 - run.z0) * (i / (run.n - 1));
      const px = run.x + (Math.random() - 0.5) * 0.7;
      const H = 7 + Math.random() * 0.7;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, H, 8), poleMat);
      p.position.set(px, H / 2, pz); p.rotation.z = (Math.random() - 0.5) * 0.04; add(p);
      const arms = [];
      for (const [ay, aw] of [[H - 0.4, 2.4], [H - 1.2, 1.8]]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(aw, 0.12, 0.12), poleMat);
        arm.position.set(px, ay, pz); add(arm);
        for (const sx of [-aw / 2 + 0.2, aw / 2 - 0.2]) {
          const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.14, 6), insMat);
          ins.position.set(px + sx, ay + 0.12, pz); add(ins);
        }
        arms.push({ y: ay, w: aw });
      }
      poles.push({ x: px, z: pz, arms });
    }
    // sagging wires between consecutive poles, one per insulator
    for (let i = 0; i < poles.length - 1; i++) {
      const a = poles[i], b = poles[i + 1];
      for (let k = 0; k < a.arms.length; k++) {
        const arm = a.arms[k];
        for (const sx of [-arm.w / 2 + 0.2, arm.w / 2 - 0.2]) {
          const p0 = new THREE.Vector3(a.x + sx, arm.y + 0.18, a.z);
          const p1 = new THREE.Vector3(b.x + sx, arm.y + 0.18, b.z);
          const mid = p0.clone().lerp(p1, 0.5); mid.y -= 0.85;     // catenary sag
          const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
          add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.018, 4, false), wireMat));
        }
      }
    }
  }
}

// ---- station nameplates (§6.6, ref Name plate.webp) -------------------------
// Nameplates are now placed by buildStation() at each platform edge; this is a
// no-op kept so buildWorld()'s call site stays unchanged.
function addNameplates() {}

function makeNameplate(name, px, py, pz, faceX, faceZ, w = 6) {
  const g = new THREE.Group();
  const tex = nameplateTex(name);
  const h = w * 160 / 512;
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22,
      roughness: 0.6, metalness: 0, side: THREE.DoubleSide,
    })
  );
  board.position.y = py; g.add(board);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2E5A86, roughness: 0.6, metalness: 0.2 });
  const postTop = py + h / 2;
  for (const sx of [-w * 0.32, w * 0.32]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, postTop, 8), postMat);
    post.position.set(sx, postTop / 2, 0); g.add(post);
  }
  g.position.set(px, 0, pz);
  g.rotation.y = Math.atan2(faceX - px, faceZ - pz);
  return g;
}

function nameplateTex(name) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#E9B330'; g.fillRect(0, 0, 512, 160);
  g.strokeStyle = '#16202E'; g.lineWidth = 7; g.strokeRect(11, 11, 490, 138);
  g.lineWidth = 2; g.strokeRect(22, 22, 468, 116);
  g.fillStyle = '#16202E'; g.textAlign = 'center'; g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = '3px';
  let fs = 60;
  g.font = `700 ${fs}px Georgia, 'Times New Roman', serif`;
  while (g.measureText(name).width > 430 && fs > 20) { fs -= 2; g.font = `700 ${fs}px Georgia, serif`; }
  g.fillText(name, 256, 84);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
