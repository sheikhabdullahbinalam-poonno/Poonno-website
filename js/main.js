// ============================================================================
//  main.js — engine + render loop.
//  Renderer (ACES tone mapping) + bloom; builds the grey-box world and the
//  living atmosphere (fireflies / fog / pointer field); maps scroll → progress
//  t (0→1); wires the loader/Enter gate, audio and nav; and each frame damps the
//  camera along the §5 keyframes, stirs the atmosphere, and renders.
// ============================================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { BLOOM, RENDER, CAMERA, BEATS } from './config.js';
import { buildWorld } from './world.js';
import { makeEnvironment } from './environment.js';
import { CameraRig } from './camera-rig.js';
import { Train } from './train.js';
import { Sky, MOON_POS } from './sky.js';
import { Atmosphere } from './atmosphere.js';
import { AudioManager } from './audio.js';
import { initUI } from './ui.js';
import { buildCab } from './cab.js';
import { initModals, openModal, closeModal, isOpen } from './modals.js';
import { initInteraction } from './interaction.js';
import { initCards, updateCards } from './cards.js';
import { initCursor } from './cursor.js';
import { initFinale, updateFinale } from './finale.js';
import { Newspaper, NEWS } from './newspaper.js';
import { initNews, updateNews } from './news.js';
import { initStationOverlay, updateStationOverlay } from './station-overlay.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- no-WebGL fallback -------------------------------------------------------
function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) { return false; }
}
if (!webglOK()) {
  const nw = document.getElementById('no-webgl'); if (nw) nw.hidden = false;
  const ld = document.getElementById('loader'); if (ld) ld.style.display = 'none';
  throw new Error('WebGL unavailable — showing fallback');
}

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
scene.environment = makeEnvironment(renderer); // dusk IBL + PBR reflections (§9)
const camera = new THREE.PerspectiveCamera(
  CAMERA.fov, window.innerWidth / window.innerHeight, CAMERA.near, CAMERA.far
);

buildWorld(scene);
const rig = new CameraRig(camera);
const train = new Train(scene);
const sky = new Sky(scene);
const atmosphere = new Atmosphere(scene, camera);
const audio = new AudioManager();

// --- post-processing: bloom --------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  BLOOM.strength, BLOOM.radius, BLOOM.threshold
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// Filmic colour-grade + vignette (display-space, after tone mapping) — split-tone
// warm shadows / cool highlights, gentle contrast, edge darkening.
const GradeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    varying vec2 vUv; uniform sampler2D tDiffuse;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      // split-tone: warm-brown shadows, cool highlights (dreamy, Noomo-leaning)
      vec3 warm = vec3(1.08, 0.99, 0.86), cool = vec3(0.93, 0.98, 1.08);
      c *= mix(warm, cool, smoothstep(0.12, 0.82, l));
      // lift the deepest values toward a blue-black floor (no pure black)
      c = mix(vec3(0.022, 0.030, 0.050), c, smoothstep(0.0, 0.18, l));
      c = (c - 0.5) * 1.06 + 0.5;                         // gentle contrast
      c *= 0.98;                                          // deepen a touch
      vec2 q = vUv - 0.5;
      c *= mix(0.84, 1.0, smoothstep(0.95, 0.33, length(q))); // vignette
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};
composer.addPass(new ShaderPass(GradeShader));

// --- scroll → progress t -----------------------------------------------------
let t = 0;
function readScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  t = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}
window.addEventListener('scroll', readScroll, { passive: true });
readScroll();

function goTo(tt) {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo({ top: max * Math.min(1, Math.max(0, tt)), behavior: REDUCED ? 'auto' : 'smooth' });
}

// --- HUD (debug, hidden unless toggled with 'h') -----------------------------
const hudBeat = document.getElementById('hud-beat');
const hudT = document.getElementById('hud-t');
const hudHold = document.getElementById('hud-hold');
const scrollHint = document.getElementById('scroll-hint');
const progFill = document.getElementById('progress-fill');
let lastLabel = '';
window.addEventListener('scroll', () => {
  if (window.scrollY > 40) scrollHint.classList.remove('show');
}, { passive: true });

function beatAt(tt) {
  for (const b of BEATS) if (tt >= b.t0 && tt <= b.t1) return b;
  return BEATS[BEATS.length - 1];
}

// --- whistle camera shudder (skipped under reduced motion) -------------------
let shudder = 0;
function onWhistle() { if (!REDUCED) shudder = 0.22; }

// train-jerk amplitude across the gaining-speed beat: rises with "speed", then
// settles before the bird's-eye lift (§5.1, t .22 → .31).
function jerkAmp(tt) {
  if (tt < 0.48 || tt > 0.55) return 0;
  if (tt < 0.52) return (tt - 0.48) / 0.04;
  return Math.max(0, 1 - (tt - 0.52) / 0.03);
}

// Run-2 "looking out at the moon": ride at the lead carriage's moon-side window
// and gaze up at the moon while the magical forest streams past (eases in/out).
const WIN0 = 0.700, WIN1 = 0.748;
const _winPos = new THREE.Vector3(), _winLook = new THREE.Vector3(), _npLook = new THREE.Vector3();
const _winM = new THREE.Matrix4(), _winQ = new THREE.Quaternion(), _UP = new THREE.Vector3(0, 1, 0);
function windowCam(tt) {
  if (frozen || tt <= WIN0 || tt >= WIN1) return;
  const car = train.cars[1]; if (!car) return;
  // smooth ease in/out across ~0.025 t at each edge
  const ramp = Math.min((tt - WIN0) / 0.025, (WIN1 - tt) / 0.025, 1);
  const k = ramp * ramp * (3 - 2 * ramp);
  const cp = car.position;
  _winPos.set(cp.x + 3.0, cp.y + 1.1, cp.z + 1.0);   // just outside the moon-side window
  camera.position.lerp(_winPos, k);
  _winLook.set(cp.x + 9, cp.y + 15, cp.z - 34);      // up & forward, toward the moon
  _winM.lookAt(camera.position, _winLook, _UP);       // blend orientation too (no snap at edges)
  _winQ.setFromRotationMatrix(_winM);
  camera.quaternion.slerp(_winQ, k);
}

let frozen = null; // debug camera freeze (set via window.__poonno.freeze)

// --- UI: loader / Enter / audio / nav ---------------------------------------
initUI({ audio, goTo, onWhistle });

// --- cab interior + modals + interaction (Phase 4) --------------------------
const cab = buildCab(scene);
cab.group.visible = false;
const newspaper = new Newspaper(scene);   // intro: aged newspaper flies in (replaces the cab)
initNews();                               // crisp HTML article overlay (cross-fades from the paper)
initStationOverlay();                     // "Next Station" approach announcements
initModals({ audio, onOpen: (w) => cab.setHover(w), onClose: () => cab.setHover(null) });
const interaction = initInteraction({ camera, cab, openModal, isModalOpen: isOpen, getT: () => t });
initCards({
  audio,
  onLock: () => { document.documentElement.style.overflow = 'hidden'; },
  onUnlock: () => { document.documentElement.style.overflow = ''; },
});
initCursor();
initFinale();

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
  const dt = Math.min(clock.getDelta(), 0.05);

  if (frozen) {
    camera.position.copy(frozen.p);
    camera.lookAt(frozen.l);
  } else {
    rig.update(t, dt);
    if (shudder > 0.001) {
      shudder *= Math.exp(-dt * 6);
      camera.position.x += (Math.random() - 0.5) * shudder;
      camera.position.y += (Math.random() - 0.5) * shudder;
    }
    // train-jerk: subtle rhythmic sway, scaled by ACTUAL train speed so it stops
    // dead when the viewer stops scrolling (no violent jumping at rest).
    const ja = jerkAmp(t) * train.speed;
    if (ja > 0.001 && !REDUCED) {
      const ph = (performance.now() / 560) * Math.PI * 2;
      camera.position.y += Math.sin(ph) * 0.03 * ja;
      camera.position.x += Math.sin(ph * 0.5 + 1.2) * 0.018 * ja;
    }
  }
  train.update(t, dt);
  // windowCam DISABLED: it overrode the camera across t0.700–0.748 — exactly the
  // moon-gaze region the rig spline now handles — yanking position/orientation
  // toward a separate carriage-window shot and causing the jerk. One smooth
  // source of camera truth (the rig) owns the moon gaze now.
  // windowCam(t);
  sky.update(dt);
  // idle rumble + swell with the train's speed, boosted through the speed beat
  audio.setRumbleLevel(Math.min(1, 0.4 + 0.42 * train.speed + 0.35 * jerkAmp(t)));
  atmosphere.update(dt);

  newspaper.update(t, camera);          // intro hero (self-gates to the early beats)
  // during the lift/tumble the camera tracks the paper so it stays beautifully framed
  if (!frozen && t > NEWS.rest && t < NEWS.gone && newspaper.hero) {
    newspaper.hero.getWorldPosition(_npLook);
    camera.lookAt(_npLook);
  }
  updateNews(t);                        // crisp article overlay + page-turn (scroll-driven)
  updateStationOverlay(t);              // "Next Station" approach announcements
  cab.group.visible = false;            // cab retired in favour of the newspaper intro
  interaction.update();
  updateCards(t);
  updateFinale(t);

  const b = beatAt(t);
  if (b.label !== lastLabel) { hudBeat.textContent = b.label; lastLabel = b.label; }
  hudT.textContent = 't ' + t.toFixed(3);
  hudHold.textContent = b.hold ? 'HOLD' : '';
  if (progFill) progFill.style.height = (t * 100).toFixed(1) + '%';

  composer.render();
}
animate();

// Verification helpers: jump (damped) or snap (instant) to a beat; freeze the
// camera at an arbitrary pose (debug only).
window.__poonno = {
  goTo,
  snapTo(tt) {
    tt = Math.min(1, Math.max(0, tt));
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, max * tt); // instant (no smooth-scroll race on the visibility gates)
    t = tt; rig.snap(t);
  },
  freeze(px, py, pz, lx, ly, lz) { frozen = { p: new THREE.Vector3(px, py, pz), l: new THREE.Vector3(lx, ly, lz) }; },
  unfreeze() { frozen = null; },
  openModal, closeModal,
  train, scene, camera, newspaper, // debug handles
};

// Honor ?t=<0..1> on load so screenshots can target a specific beat instantly.
const _tParam = new URLSearchParams(location.search).get('t');
if (_tParam !== null) {
  const tt = Math.min(1, Math.max(0, parseFloat(_tParam) || 0));
  window.addEventListener('load', () => window.__poonno.snapTo(tt));
}
