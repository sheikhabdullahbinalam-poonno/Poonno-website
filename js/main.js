// ============================================================================
//  main.js — engine + render loop.
//  Sets up the WebGL renderer (ACES tone mapping), scene, camera and the bloom
//  post-processing chain; builds the grey-box world; maps scroll position to a
//  normalized progress t (0→1); and on each frame damps the camera along the
//  §5 keyframe spline and updates the beat readout.
// ============================================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { BLOOM, RENDER, CAMERA, BEATS } from './config.js';
import { buildWorld } from './world.js';
import { CameraRig } from './camera-rig.js';

// --- renderer ----------------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER.maxPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = RENDER.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// --- scene + camera ----------------------------------------------------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  CAMERA.fov, window.innerWidth / window.innerHeight, CAMERA.near, CAMERA.far
);

buildWorld(scene);
const rig = new CameraRig(camera);

// --- post-processing: bloom --------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  BLOOM.strength, BLOOM.radius, BLOOM.threshold
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// --- scroll → progress t -----------------------------------------------------
let t = 0;
function readScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  t = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}
window.addEventListener('scroll', readScroll, { passive: true });
readScroll();

// --- HUD (beat + progress readout) -------------------------------------------
const hudBeat = document.getElementById('hud-beat');
const hudT = document.getElementById('hud-t');
const hudHold = document.getElementById('hud-hold');
const scrollHint = document.getElementById('scroll-hint');
let lastLabel = '';

setTimeout(() => scrollHint.classList.add('show'), 1200);
window.addEventListener('scroll', () => {
  if (window.scrollY > 40) scrollHint.classList.remove('show');
}, { passive: true });

function beatAt(tt) {
  for (const b of BEATS) if (tt >= b.t0 && tt <= b.t1) return b;
  return BEATS[BEATS.length - 1];
}

// --- resize ------------------------------------------------------------------
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER.maxPixelRatio));
  renderer.setSize(w, h);
  composer.setSize(w, h);
});

// --- render loop -------------------------------------------------------------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); // clamp to stay stable on stalls

  rig.update(t, dt);

  const b = beatAt(t);
  if (b.label !== lastLabel) { hudBeat.textContent = b.label; lastLabel = b.label; }
  hudT.textContent = 't ' + t.toFixed(3);
  hudHold.textContent = b.hold ? 'HOLD' : '';

  composer.render();
}
animate();

// Expose for verification: jump (with damping) or snap (instant) to a beat.
window.__poonno = {
  goTo(tt) { window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * tt); },
  snapTo(tt) { this.goTo(tt); t = tt; rig.snap(tt); },
};

// Honor ?t=<0..1> on load so screenshots can target a specific beat instantly.
const _tParam = new URLSearchParams(location.search).get('t');
if (_tParam !== null) {
  const tt = Math.min(1, Math.max(0, parseFloat(_tParam) || 0));
  window.addEventListener('load', () => window.__poonno.snapTo(tt));
}
