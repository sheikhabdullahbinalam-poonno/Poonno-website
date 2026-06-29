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
  // gentle, undetectable fill over the darker far stretch (Unilever → finale)
  const fill = new THREE.PointLight(0x9DB6D6, 0.5, 360, 2);
  fill.position.set(-4, 30, -770);
  scene.add(fill);
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

  // Creative Origins station (ember) — platform +X side, building set back.
  block(scene, { x: 10, y: 0.4, z: -340, w: 14, h: 0.8, d: 34, color: 0x33383D, beacon: false });
  block(scene, { x: 16, y: 2.5, z: -340, w: 6, h: 5, d: 10, color: 0x394A57, beaconColor: PALETTE.ember });

  // Unilever station (steel-blue) — platform −X side (track x≈−5), building back.
  block(scene, { x: -13, y: 0.4, z: -720, w: 14, h: 0.8, d: 30, color: 0x33383D, beacon: false });
  block(scene, { x: -18, y: 2.2, z: -720, w: 6, h: 4, d: 10, color: 0x394A57, beaconColor: PALETTE.haze });

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
  junctionMarker(scene, 1.5, -789, PALETTE.moss);  // Y
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
function addNameplates(scene) {
  scene.add(makeNameplate('CREATIVE ORIGINS', 10.2, 3.0, -344, 4.6, -337, 5.5));
  scene.add(makeNameplate('UNILEVER YEARS', -12, 3.0, -720, -7, -715, 6));
}

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
