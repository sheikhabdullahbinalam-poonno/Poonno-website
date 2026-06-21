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
  addLandmarks(scene);
  addTrack(scene);
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
  const hemi = new THREE.HemisphereLight(0x3A5A7A, PALETTE.night, 0.65);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0xAFC4E0, 0.6);
  moon.position.set(-40, 70, 25);
  scene.add(moon);

  scene.add(new THREE.AmbientLight(0x16222F, 0.35)); // lift the deepest shadows
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
  // Start: concrete platform + the waiting train (long block running along Z so
  // it spans the screen left-to-right in the "T" view).
  block(scene, { x: 7, y: 0.4, z: 2, w: 12, h: 0.8, d: 30, color: 0x3A3F44, beacon: false });
  block(scene, { x: 0, y: 2.0, z: -2, w: 3, h: 4, d: 38, color: 0x2C4256, beaconColor: PALETTE.firefly }); // train

  // Creative Origins station (ember accent), slightly +X per the look targets.
  block(scene, { x: 4, y: 0.4, z: -190, w: 18, h: 0.8, d: 34, color: 0x33383D, beacon: false });
  block(scene, { x: 9, y: 2.5, z: -190, w: 6, h: 5, d: 10, color: 0x394A57, beaconColor: PALETTE.ember });

  // Unilever station (steel-blue accent), offset LEFT (−X) where the train banks.
  block(scene, { x: -6, y: 0.4, z: -295, w: 16, h: 0.8, d: 30, color: 0x33383D, beacon: false });
  block(scene, { x: -10, y: 2.5, z: -295, w: 6, h: 5, d: 10, color: 0x394A57, beaconColor: PALETTE.haze });

  // Finale tree (trunk + layered canopy), where the merged track ends.
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.4, 9, 10),
    new THREE.MeshStandardMaterial({ color: 0x4A3A2E, roughness: 0.95 })
  );
  trunk.position.set(7, 4.5, -372);
  scene.add(trunk);
  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(6.5, 11, 12),
    new THREE.MeshStandardMaterial({ color: 0x2E4034, roughness: 0.9 })
  );
  canopy.position.set(7, 12, -372);
  scene.add(canopy);
  scene.add(beaconAt(7, 19, -372, PALETTE.firefly, 0.9, 2.6));
}

// ---- §5.1 track topology (grey-box) -----------------------------------------
//  Steel-blue = the line the train rides (main → V-left → Unilever → Y).
//  Faded haze = the V's RIGHT branch, decorative, trailing off into fog.
//  Ember      = the Creative-Origins line sweeping in from the side to the Y.
//  Warm cream = the single MERGED track from the Y junction to the tree.
function addTrack(scene) {
  const Y = 0.25; // rails sit just above the ground

  // Main line + the left branch the train actually takes, on through Unilever
  // and down to the Y junction.
  rail(scene, [
    [0, Y, 14], [0, Y, -60], [0, Y, -130], [0, Y, -185],   // start → Creative Origins
    [0, Y, -235],                                            // V junction
    [-2, Y, -258], [-5, Y, -292],                            // bank LEFT → Unilever
    [-5, Y, -308], [-2, Y, -330], [1.5, Y, -341],            // Unilever → Y junction
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

  // The MERGED single track: Y junction → finale tree (warmer, the thesis line).
  rail(scene, [
    [1.5, Y, -341], [4, Y, -356], [7, Y, -372],
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
