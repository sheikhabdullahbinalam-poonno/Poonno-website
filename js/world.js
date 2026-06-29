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
import { weatheredMetal, woodMaterial, stoneMaterial } from './materials.js';

const RAIL_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x8A929A, metalness: 0.85, roughness: 0.38, envMapIntensity: 1.0 });
const SLEEPER_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x3A2A1E, roughness: 0.95, metalness: 0.05 });
const ONE = new THREE.Vector3(1, 1, 1);

export function buildWorld(scene) {
  scene.fog = new THREE.FogExp2(FOG.color, FOG.density);
  scene.add(makeSky());
  addLights(scene);
  addGround(scene);
  addForest(scene);
  addLandmarks(scene);
  addTrack(scene);
  addNameplates(scene);
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
  g.fillStyle = '#ece3cf'; g.beginPath(); g.arc(R, R, 58, 0, 6.283); g.fill();   // cream face
  g.strokeStyle = '#1c1610'; g.lineWidth = 4; g.beginPath(); g.arc(R, R, 58, 0, 6.283); g.stroke();
  g.strokeStyle = '#1c1610'; g.lineWidth = 3;
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; g.beginPath();
    g.moveTo(R + Math.cos(a) * 50, R + Math.sin(a) * 50); g.lineTo(R + Math.cos(a) * 44, R + Math.sin(a) * 44); g.stroke(); }
  g.lineWidth = 4; g.beginPath(); g.moveTo(R, R); g.lineTo(R + Math.cos(-1.1) * 28, R + Math.sin(-1.1) * 28); g.stroke(); // hour ~2 o'clock
  g.lineWidth = 3; g.beginPath(); g.moveTo(R, R); g.lineTo(R + Math.cos(-2.6) * 42, R + Math.sin(-2.6) * 42); g.stroke(); // minute
  _clockTexCache.t = new THREE.CanvasTexture(c); _clockTexCache.t.colorSpace = THREE.SRGBColorSpace; return _clockTexCache.t;
}
// Carved wooden name board: a colour map (weathered plank + dark routed serif text
// with a carved-bevel highlight) and a MATCHING bump/depth map (same text + position,
// black = recessed) so raked light shows the engraving. Per the attached photo.
function signTex(name) {
  const w = 640, h = 150;
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const c = mk(), g = c.getContext('2d');
  g.fillStyle = '#c9bb98'; g.fillRect(0, 0, w, h);                       // weathered cream-tan board
  for (let i = 0; i < 150; i++) {                                        // plank grain streaks
    g.strokeStyle = `rgba(110,90,58,${0.03 + Math.random() * 0.06})`; g.lineWidth = 1;
    const y = Math.random() * h; g.beginPath(); g.moveTo(0, y);
    g.bezierCurveTo(w * 0.33, y + (Math.random() - 0.5) * 7, w * 0.66, y + (Math.random() - 0.5) * 7, w, y + (Math.random() - 0.5) * 5); g.stroke();
  }
  const eg = g.createLinearGradient(0, 0, 0, h);                          // edge weathering
  eg.addColorStop(0, 'rgba(50,36,20,0.28)'); eg.addColorStop(0.5, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(50,36,20,0.34)');
  g.fillStyle = eg; g.fillRect(0, 0, w, h);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 66; g.font = `700 ${fs}px Georgia, serif`;
  while (g.measureText(name).width > w - 64 && fs > 20) { fs -= 2; g.font = `700 ${fs}px Georgia, serif`; }
  g.fillStyle = 'rgba(238,230,210,0.5)'; g.fillText(name, w / 2 - 1.5, h / 2 - 1.5); // carved bevel highlight
  g.fillStyle = '#231a0e'; g.fillText(name, w / 2, h / 2);                            // recessed ink
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  // matching depth map — white board, black (recessed) letters in the SAME place
  const b = mk(), gb = b.getContext('2d');
  gb.fillStyle = '#fff'; gb.fillRect(0, 0, w, h);
  gb.textAlign = 'center'; gb.textBaseline = 'middle'; gb.font = `700 ${fs}px Georgia, serif`;
  gb.fillStyle = '#000'; gb.fillText(name, w / 2, h / 2);
  const bump = new THREE.CanvasTexture(b);
  return { map, bump };
}

function buildStation(scene, { z, side = 1, trackX = 0, accent = PALETTE.ember, name = '' }) {
  const G = new THREE.Group(); scene.add(G);
  const add = (m) => { m.frustumCulled = false; G.add(m); return m; };
  const X = (d) => trackX + side * d;                 // d = distance out from the track
  const faceTrack = side > 0 ? -Math.PI / 2 : Math.PI / 2;  // a +X face turns toward the track

  // --- materials (procedural PBR, weathered & moonlit) ---
  // Walls/quoins: real triplanar masonry. Deck/timber: object-space wood grain.
  // Iron: the train's rusty weatheredMetal so the station shares its patina.
  const stone   = stoneMaterial({ stone: new THREE.Color(0x3d362b), mortar: new THREE.Color(0x12100b), scale: 1.5, bump: 1.1 });
  const brickQ  = stoneMaterial({ stone: new THREE.Color(0x472f22), mortar: new THREE.Color(0x110b06), scale: 2.6, bump: 1.2 }); // quoins/chimney brick
  const slate   = new THREE.MeshStandardMaterial({ map: slateTex(), color: 0x3f444c, roughness: 0.84, metalness: 0.08 });
  const timber  = woodMaterial({ light: new THREE.Color(0x322212), dark: new THREE.Color(0x120a04), scale: 1.4 });
  const deckWood = woodMaterial({ light: new THREE.Color(0x392717), dark: new THREE.Color(0x180f07), scale: 0.7 });
  const iron    = weatheredMetal({
    base: new THREE.Color(0x191a18), rust: new THREE.Color(0x4f2d1a),
    yLow: 0.0, yHigh: 4.0, paintRough: 0.62, rustRough: 0.97, metalBase: 0.62, scale: 1.6, panel: 0.0, rustAmt: 0.42,
  });
  // dark, unlit night glass — the building has NO interior light; faint cool sheen only
  const winGlow = new THREE.MeshStandardMaterial({ color: 0x0b0e12, roughness: 0.3, metalness: 0.4, envMapIntensity: 0.6 });

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

  // ---- recessed door: brick surround + panelled timber door (unlit, dark recess) ----
  const doorW = 1.6, doorH = 3.0;
  const voidMat = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 1, metalness: 0 });
  box(doorW + 0.6, doorH + 0.4, 0.32, brickQ, bFront + 0.06, doorH / 2 + 0.05, 0); // surround
  box(doorW + 0.4, doorH + 0.2, 0.1, voidMat, bFront - 0.18, doorH / 2 + 0.05, 0); // dark void behind
  box(doorW, doorH, 0.28, timber, bFront - 0.1, doorH / 2, 0);                     // door slab
  for (const py of [doorH * 0.72, doorH * 0.38])                                   // raised panels
    box(doorW * 0.6, doorH * 0.24, 0.06, timber, bFront - 0.26, py, 0);
  // ---- two windows: brick surround + dim warm pane + timber mullion cross ----
  for (const dz of [-2.95, 2.95]) {
    box(1.6, 1.9, 0.32, brickQ, bFront + 0.05, 2.75, dz);            // surround
    box(1.2, 1.5, 0.1, winGlow, bFront - 0.12, 2.75, dz);           // dim warm pane
    box(0.1, 1.5, 0.16, timber, bFront - 0.16, 2.75, dz);          // mullion (vertical)
    box(1.2, 0.1, 0.16, timber, bFront - 0.16, 2.75, dz);          // mullion (horizontal)
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
  // clock face on the track-facing side, only FAINTLY self-lit (was too bright)
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32),
    new THREE.MeshStandardMaterial({ map: clockTex(), emissive: 0xffffff, emissiveMap: clockTex(), emissiveIntensity: 0.14, roughness: 0.7, side: THREE.DoubleSide }));
  clock.position.set(X(tD - tW / 2 - 0.02), 6.2, z + tDZ); clock.rotation.y = faceTrack; add(clock);

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

  // bench against the building
  box(1.8, 0.12, 0.5, timber, bFront - 1.0, deckTop + 0.55, 4.5);
  box(1.8, 0.5, 0.1, timber, bFront - 0.78, deckTop + 0.8, 4.7);

  // ---- ornate wrought-iron gas lamp (ref photo): stepped base, fluted post,
  // glass-paned lantern with iron frame, peaked cap + finial. Dim warm glass. ----
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x2a1d0c, emissive: 0xff9f48, emissiveIntensity: 0.42, roughness: 0.5, transparent: true, opacity: 0.9 });
  const addLamp = (lx, lz) => {
    const y0 = deckTop;
    const m = (geo, y) => { const e = new THREE.Mesh(geo, iron); e.position.set(lx, y0 + y, z + lz); add(e); return e; };
    m(new THREE.CylinderGeometry(0.24, 0.32, 0.4, 12), 0.2);            // base step 1
    m(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 12), 0.55);          // base step 2
    m(new THREE.CylinderGeometry(0.055, 0.09, 3.0, 12), 2.1);         // fluted post
    m(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), 2.0);          // mid collar
    const ly = 3.7;
    m(new THREE.BoxGeometry(0.5, 0.08, 0.5), ly - 0.34);              // lantern floor
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.58, 0.4), glassMat);
    glass.position.set(lx, y0 + ly, z + lz); add(glass);
    for (const ex of [-0.21, 0.21]) for (const ez of [-0.21, 0.21]) {  // iron frame corners
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.04), iron);
      e.position.set(lx + ex, y0 + ly, z + lz + ez); add(e);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.32, 4), iron);
    roof.position.set(lx, y0 + ly + 0.45, z + lz); roof.rotation.y = Math.PI / 4; add(roof);
    m(new THREE.SphereGeometry(0.07, 8, 8), ly + 0.66);               // finial ball
    m(new THREE.ConeGeometry(0.03, 0.18, 6), ly + 0.82);             // finial spike
    const L = new THREE.PointLight(0xff9f4a, 1.7, 12, 2);
    L.position.set(lx, y0 + ly, z + lz); add(L);
  };
  addLamp(X(nearD + 0.5), -12); addLamp(X(nearD + 0.5), 2); addLamp(X(nearD + 0.5), 15);
  // NB: no building light — the station is dark/unlit (only the platform lamps glow).

  // ---- carved wooden name board at the platform START, faced down the line so an
  // approaching train reads it from a distance (rotated to face +z, ref photo) ----
  {
    const { map, bump } = signTex(name);
    const sw = 4.8, sh = 1.2, signZ = z + PLEN / 2 - 2.5;
    const boardMat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.9, roughness: 0.82, metalness: 0 });
    const sign = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, 0.1), [timber, timber, timber, timber, boardMat, timber]);
    board.position.y = 2.5; sign.add(board);                          // boardMat on +Z face (toward the train)
    for (const sx of [-sw * 0.4, sw * 0.4]) {                          // rusted posts
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.1, 10), iron);
      p.position.set(sx, 1.55, 0); sign.add(p);
    }
    // set WELL BACK onto the platform so the board never overhangs the track/train
    sign.position.set(X(nearD + 3.0), 0, signZ);
    sign.rotation.y = -side * 0.28;                                    // faced +z, angled slightly to the track
    sign.traverse((o) => { o.frustumCulled = false; });
    G.add(sign);
  }

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
  const bulbMat = new THREE.MeshStandardMaterial({ color: PALETTE.firefly, emissive: PALETTE.firefly, emissiveIntensity: 2.4 });
  for (const pz of [-8, 0, 8]) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), bulbMat);
    bulb.position.set(6, 4.5, pz); scene.add(bulb);
    const lamp = new THREE.PointLight(0xFFCF8C, 26, 26, 2);
    lamp.position.set(5.5, 4.3, pz); scene.add(lamp);
  }

  // Creative Origins — cinematic station on the +X side (camera looks right).
  buildStation(scene, { z: -340, side: 1, trackX: 0, accent: PALETTE.ember, name: 'CREATIVE ORIGINS' });
  // Unilever Years — same station mirrored to the −X side (track x≈−5).
  buildStation(scene, { z: -720, side: -1, trackX: -5, accent: PALETTE.haze, name: 'UNILEVER YEARS' });

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
