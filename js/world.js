// ============================================================================
//  world.js — Phase 1 grey-box world.
//  Populates the scene with: fog, a dusk gradient sky dome, hemisphere + moon
//  lights, a ground plane, simple block landmarks at every story beat, and a
//  grey-box of the §5.1 TRACK TOPOLOGY — the main line, the V junction (train
//  banks LEFT, right branch trails into fog), and the Y junction (the creative
//  line and the Unilever line MERGE into one toward the finale tree).
//  Everything here is placeholder geometry; detailed models arrive in Phase 3+.
// ============================================================================

import * as THREE from 'three';
import { PALETTE, FOG, SKY } from './config.js';

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

// ---- station nameplates (§6.6, ref Name plate.webp): yellow board, dark bold
//      text, on blue posts; emissive so it reads at night, facing the viewer ----
function addNameplates(scene) {
  // Positioned on each beat's sightline so the full text reads in frame.
  scene.add(makeNameplate('CREATIVE ORIGINS', 10.2, 3.0, -190, 4.6, -182, 5.5));
  scene.add(makeNameplate('UNILEVER STATION', -12, 3.0, -293, -7, -289, 6));
  scene.add(makeNameplate('HORIZONS CROSSING', 6.8, 3.4, -371, 4.6, -366, 5));
}

function makeNameplate(name, px, py, pz, faceX, faceZ, w = 6) {
  const g = new THREE.Group();
  const tex = nameplateTex(name);
  const h = w * 160 / 512; // match the 512×160 canvas ratio

  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22,
      roughness: 0.6, metalness: 0, side: THREE.DoubleSide,
    })
  );
  board.position.y = py;
  g.add(board);

  const postMat = new THREE.MeshStandardMaterial({ color: 0x2E5A86, roughness: 0.6, metalness: 0.2 });
  const postTop = py + h / 2;
  for (const sx of [-w * 0.32, w * 0.32]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, postTop, 8), postMat);
    post.position.set(sx, postTop / 2, 0);
    g.add(post);
  }

  g.position.set(px, 0, pz);
  g.rotation.y = Math.atan2(faceX - px, faceZ - pz); // face the viewer's vantage
  return g;
}

function nameplateTex(name) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#E9B330'; g.fillRect(0, 0, 512, 160);          // yellow board
  g.strokeStyle = '#16202E'; g.lineWidth = 7; g.strokeRect(11, 11, 490, 138); // dark border
  g.lineWidth = 2; g.strokeRect(22, 22, 468, 116);
  g.fillStyle = '#16202E';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = '3px';
  let fs = 60;
  g.font = `700 ${fs}px Georgia, 'Times New Roman', serif`;
  while (g.measureText(name).width > 430 && fs > 20) { fs -= 2; g.font = `700 ${fs}px Georgia, serif`; }
  g.fillText(name, 256, 84);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- mystical conifer forest lining the route (instanced for performance) ---
function addForest(scene) {
  const COUNT = 340;
  const coneGeo = new THREE.ConeGeometry(1, 1, 7);          // unit cone, scaled per tree
  const coneMat = new THREE.MeshStandardMaterial({ color: 0x223528, roughness: 0.96, metalness: 0 });
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1.6, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x281E16, roughness: 1 });
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, COUNT);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, COUNT);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  let i = 0;
  let guard = 0;
  while (i < COUNT && guard++ < COUNT * 4) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side * (22 + Math.random() * 40);   // flanks the track corridor (|x| 22–62, clear of platforms)
    const z = 50 - Math.random() * 450;           // +50 → −400 along the journey
    if (z < -352 && x > -6 && x < 22) continue;   // keep the finale clearing open
    const h = 5 + Math.random() * 9;
    const r = 1.0 + Math.random() * 1.4;

    p.set(x, 0.6 + h / 2, z); s.set(r, h, r); q.identity();
    cones.setMatrixAt(i, m.compose(p, q, s));
    p.set(x, 0.8, z); s.set(1, 1, 1);
    trunks.setMatrixAt(i, m.compose(p, q, s));
    i++;
  }
  cones.count = i; trunks.count = i;
  cones.instanceMatrix.needsUpdate = true;
  trunks.instanceMatrix.needsUpdate = true;
  scene.add(cones);
  scene.add(trunks);
}

// ---- dusk gradient sky dome (unaffected by fog so the gradient always reads) -
function makeSky() {
  const geo = new THREE.SphereGeometry(1500, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(SKY.top) },
      horizonColor: { value: new THREE.Color(SKY.horizon) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        float k = smoothstep(0.0, 0.75, h);
        gl_FragColor = vec4(mix(horizonColor, topColor, k), 1.0);
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = -1;
  return sky;
}

// ---- cool hemisphere + dim warmish-cool moon directional --------------------
function addLights(scene) {
  // Moonlit night: cool hemisphere + a brighter moon so PBR liveries actually
  // read, with warm lamp accents added per-location (platform/stations).
  const hemi = new THREE.HemisphereLight(0x44648A, 0x1A2430, 0.9);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0xBFD2EC, 1.35);
  moon.position.set(-40, 70, 25);
  scene.add(moon);

  scene.add(new THREE.AmbientLight(0x18242F, 0.42)); // lift the deepest shadows
}

// ---- ground + faint grid (grid helps perceive camera motion this phase) -----
function addGround(scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 760),
    new THREE.MeshStandardMaterial({ color: 0x16242F, roughness: 0.96, metalness: 0.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -200);
  scene.add(ground);

  const grid = new THREE.GridHelper(760, 152, 0x2A4258, 0x1E3144);
  grid.position.set(0, 0.02, -200);
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  scene.add(grid);
}

// ---- block-landmark helper: a grey box + a small emissive beacon ------------
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

// ---- the story beats, as grey-box stand-ins ---------------------------------
function addLandmarks(scene) {
  // Start platform — set BESIDE the track (centreline x≈0) with a clear gap. The
  // waiting train is added dynamically (see Train), not as a static block here.
  block(scene, { x: 8, y: 0.4, z: 2, w: 11, h: 0.8, d: 30, color: 0x3A3F44, beacon: false });

  // Platform canopy — a flat roof on posts (§6.1), framing the "T" view overhead.
  const canMat = new THREE.MeshStandardMaterial({ color: 0x39454F, roughness: 0.85, metalness: 0.15 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2A333C, roughness: 0.8, metalness: 0.3 });
  const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.3, 27), canMat);
  roofSlab.position.set(8, 5.0, 2);
  scene.add(roofSlab);
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(11.7, 0.5, 0.3), canMat);
  fascia.position.set(8, 4.75, -11.4); scene.add(fascia);
  for (const sx of [4, 12]) {
    for (const pz of [-10, -2, 6, 14]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.2, 8), postMat);
      post.position.set(sx, 2.9, pz);
      scene.add(post);
    }
  }
  // Warm hanging bulbs under the canopy that actually light the waiting train.
  const bulbMat = new THREE.MeshStandardMaterial({ color: PALETTE.firefly, emissive: PALETTE.firefly, emissiveIntensity: 2.4 });
  for (const pz of [-8, 0, 8]) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), bulbMat);
    bulb.position.set(6, 4.5, pz);
    scene.add(bulb);
    const lamp = new THREE.PointLight(0xFFCF8C, 26, 26, 2);
    lamp.position.set(5.5, 4.3, pz);
    scene.add(lamp);
  }

  // Creative Origins station (ember accent) — platform on the +X side (gap ~3).
  block(scene, { x: 10, y: 0.4, z: -190, w: 14, h: 0.8, d: 34, color: 0x33383D, beacon: false });
  block(scene, { x: 16, y: 2.5, z: -190, w: 6, h: 5, d: 10, color: 0x394A57, beaconColor: PALETTE.ember });

  // Unilever station (steel-blue accent) — platform on the −X side of its track
  // (track at x≈−5, platform beyond, gap ~1) where the train banks left. The
  // building sits back as a backdrop so the platform vantage isn't a dark wall.
  block(scene, { x: -13, y: 0.4, z: -295, w: 14, h: 0.8, d: 30, color: 0x33383D, beacon: false });
  block(scene, { x: -18, y: 2.2, z: -295, w: 6, h: 4, d: 10, color: 0x394A57, beaconColor: PALETTE.haze });

  // Finale: a step-down platform bridges from the train's stop (z≈-352, behind
  // the camera) forward to the great tree (z≈-373), so you walk down and beneath
  // the canopy with the train left behind, out of view.
  block(scene, { x: 5, y: 0.3, z: -362, w: 5, h: 0.6, d: 22, color: 0x33383D, beacon: false });

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.7, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x4A3A2E, roughness: 0.95 })
  );
  trunk.position.set(7.5, 6, -373);
  scene.add(trunk);
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(7.5, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x2E4034, roughness: 0.9 })
  );
  canopy.position.set(7.5, 13.5, -373);
  canopy.scale.set(1, 0.78, 1);
  scene.add(canopy);
  scene.add(beaconAt(7.5, 20, -373, PALETTE.firefly, 0.9, 2.6));
}

// ---- §5.1 track topology (grey-box) -----------------------------------------
//  Steel-blue = the line the train rides (main → V-left → Unilever → Y).
//  Faded haze = the V's RIGHT branch, decorative, trailing off into fog.
//  Ember      = the Creative-Origins line sweeping in from the side to the Y.
//  Warm cream = the single MERGED track from the Y junction to the tree.
function addTrack(scene) {
  const Y = 0.25; // rails sit just above the ground

  // Main line + the left branch the train actually takes, on through Unilever
  // and down to the Y junction (extends back under the waiting train at the start).
  rail(scene, [
    [0, Y, 42], [0, Y, 6], [0, Y, -60], [0, Y, -130], [0, Y, -185], // start → Creative
    [0, Y, -235],                                            // V junction
    [-3, Y, -262], [-5, Y, -292],                            // bank LEFT → Unilever
    [-5, Y, -312], [-2, Y, -332], [1.5, Y, -341],            // Unilever → Y junction
  ], { color: PALETTE.haze, radius: 0.38, intensity: 1.3 });

  // V junction RIGHT branch — decorative, never used; trails off and fades.
  rail(scene, [
    [0, Y, -235], [5, Y, -255], [13, Y, -282], [24, Y, -308],
  ], { color: PALETTE.haze, radius: 0.3, opacity: 0.32, intensity: 0.5 });

  // The Creative-Origins line: leaves the station, sweeps out on the +X side and
  // curves back IN to the Y junction (the "sweeps in from the side" of §5.1).
  rail(scene, [
    [0, Y, -185], [9, Y, -225], [11, Y, -285], [7, Y, -320], [3, Y, -338], [1.6, Y, -341],
  ], { color: PALETTE.ember, radius: 0.34, intensity: 1.2 });

  // The MERGED single track: Y junction → STOP (the thesis line). The stop sits
  // well BEHIND the final camera (~[2,-352]) so the train is out of the finale
  // shot; the viewer steps forward to the separate tree at [7.5,-373].
  rail(scene, [
    [1.5, Y, -341], [2, Y, -348], [2, Y, -352],
  ], { color: PALETTE.cream, radius: 0.42, intensity: 1.7 });

  // Junction markers — grey-box switch posts + signal lights.
  junctionMarker(scene, 0, -235, PALETTE.ember);   // V
  junctionMarker(scene, 1.5, -341, PALETTE.moss);  // Y
}

function rail(scene, pts, { color, radius = 0.36, opacity = 1, intensity = 1.2 }) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, Math.max(24, pts.length * 14), radius, 8, false);
  const mat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: intensity,
    roughness: 0.6, metalness: 0.1,
    transparent: opacity < 1, opacity,
  });
  scene.add(new THREE.Mesh(geo, mat));
}

function junctionMarker(scene, x, z, signalColor) {
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 5, 8),
    new THREE.MeshStandardMaterial({ color: 0x2A3742, roughness: 0.8 })
  );
  post.position.set(x + 2, 2.5, z);
  scene.add(post);
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 12, 12),
    new THREE.MeshStandardMaterial({ color: signalColor, emissive: signalColor, emissiveIntensity: 2.8 })
  );
  light.position.set(x + 2, 5, z);
  scene.add(light);
}
