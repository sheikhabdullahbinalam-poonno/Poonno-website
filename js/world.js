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
  scene.add(new THREE.HemisphereLight(0x44648A, 0x1A2430, 0.9));
  const moon = new THREE.DirectionalLight(0xBFD2EC, 1.35);
  moon.position.set(-40, 70, 25);
  scene.add(moon);
  scene.add(new THREE.AmbientLight(0x18242F, 0.42));
}

// ---- ground -----------------------------------------------------------------
function addGround(scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(440, 1200),
    new THREE.MeshStandardMaterial({ color: 0x16242F, roughness: 0.97, metalness: 0.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -420);
  scene.add(ground);
}

// ---- forest: two distinct runs the train passes through ---------------------
function addForest(scene) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const coneGeo = new THREE.ConeGeometry(1, 1, 7);
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 1.8, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x241B14, roughness: 1 });
  const coniferMat = new THREE.MeshStandardMaterial({ color: 0x1E3A2E, roughness: 0.95 });

  // Run 1 (start → Creative): dense tall CONIFERS, close to the corridor.
  fill(scene, 440, coneGeo, coniferMat, trunkGeo, trunkMat, (i) => {
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side * (8 + Math.random() * 50);
    const z = -8 - Math.random() * 322;
    if (Math.abs(x) < 22 && z < -322) return null;   // keep the Creative platform clear
    const h = 7 + Math.random() * 13, r = 1.0 + Math.random() * 1.6;
    return { canopy: [x, 0.7 + h / 2, z, r, h, r], trunk: [x, 0.9, z, 1, 1, 1] };
  }, m, q, p, s);

  // Run 2 (Creative → Unilever): dense ROUNDED BROADLEAF (olive), a different feel.
  const ballGeo = new THREE.SphereGeometry(1, 8, 6);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3C4A26, roughness: 0.95, flatShading: true });
  const trunk2Geo = new THREE.CylinderGeometry(0.2, 0.36, 1, 6);
  fill(scene, 440, ballGeo, leafMat, trunk2Geo, trunkMat, (j) => {
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side * (8 + Math.random() * 50);
    const z = -405 - Math.random() * 300;
    if (x < 0 && Math.abs(x + 5) < 20 && z < -703) return null; // keep Unilever clear
    const rad = 2.2 + Math.random() * 2.4, hh = 3 + Math.random() * 3;
    return { canopy: [x, hh + rad * 0.6, z, rad, rad * (0.8 + Math.random() * 0.5), rad], trunk: [x, hh / 2 + 0.2, z, 1, hh, 1] };
  }, m, q, p, s);

  // Sparse backdrop conifers elsewhere (behind platforms, distance), finale clear.
  fill(scene, 140, coneGeo, coniferMat, trunkGeo, trunkMat, () => {
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side * (24 + Math.random() * 42);
    const z = 40 - Math.random() * 900;
    if (z < -800 && Math.abs(x) < 30) return null;   // finale: open sky
    const h = 6 + Math.random() * 8, r = 1 + Math.random();
    return { canopy: [x, 0.7 + h / 2, z, r, h, r], trunk: [x, 0.9, z, 1, 1, 1] };
  }, m, q, p, s);
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
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.7, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x4A3A2E, roughness: 0.95 })
  );
  trunk.position.set(7.5, 6, -825); scene.add(trunk);
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(7.5, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x2E4034, roughness: 0.9 })
  );
  canopy.position.set(7.5, 13.5, -825); canopy.scale.set(1, 0.78, 1); scene.add(canopy);
  scene.add(beaconAt(7.5, 20, -825, PALETTE.firefly, 0.9, 2.6));
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

function junctionMarker(scene, x, z, signalColor) {
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 5, 8),
    new THREE.MeshStandardMaterial({ color: 0x2A3742, roughness: 0.8 })
  );
  post.position.set(x + 2, 2.5, z); scene.add(post);
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 12, 12),
    new THREE.MeshStandardMaterial({ color: signalColor, emissive: signalColor, emissiveIntensity: 2.8 })
  );
  light.position.set(x + 2, 5, z); scene.add(light);
}

// ---- station nameplates (§6.6, ref Name plate.webp) -------------------------
function addNameplates(scene) {
  scene.add(makeNameplate('CREATIVE ORIGINS', 10.2, 3.0, -344, 4.6, -337, 5.5));
  scene.add(makeNameplate('UNILEVER STATION', -12, 3.0, -720, -7, -715, 6));
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
