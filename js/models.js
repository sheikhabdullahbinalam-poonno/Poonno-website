// ============================================================================
//  models.js — central GLB loader for the optimized (Draco + WebP) assets in
//  assets/models/opt/. Loads once, caches, and hands out fresh clones. Also
//  provides normalize() to recenter/scale/orient a raw model into the scene's
//  conventions (front = local +Z, sitting on y=0, a target length in world units).
//
//  Every opt GLB is Draco-compressed, so GLTFLoader MUST be given a DRACOLoader.
// ============================================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const BASE = 'assets/models/opt/';
const FILES = {
  engine: 'engine.glb',         // detailed textured diesel (the locomotive)
  carriage: 'carriage.glb',     // heritage clerestory coach (untextured)
  finaleTree: 'finale-tree.glb',
  newspaper: 'newspaper.glb',         // aged folded newspaper — intro hero fly-in
  newspaperSheet: 'newspaper-sheet.glb', // flat page — scattered on the platform
  tree1: 'tree1.glb',
};

const draco = new DRACOLoader().setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');
const loader = new GLTFLoader().setDRACOLoader(draco);

const _cache = {};       // key -> THREE.Group (the loaded scene)
let _promise = null;

function loadOne(key) {
  return new Promise((resolve, reject) => {
    loader.load(BASE + FILES[key],
      (gltf) => { _cache[key] = gltf.scene; resolve(gltf.scene); },
      undefined,
      (err) => reject(new Error(`load ${key}: ${err?.message || err}`)));
  });
}

// Preload everything. onProgress(loaded, total) fires per-model. Resolves with
// the cache. Rejects on the first failure (caller decides how to degrade).
export function preloadModels(onProgress) {
  if (_promise) return _promise;
  const keys = Object.keys(FILES);
  let done = 0;
  _promise = Promise.all(keys.map((k) =>
    loadOne(k).then((s) => { done++; onProgress && onProgress(done, keys.length); return s; })
  )).then(() => _cache);
  return _promise;
}

// A fresh deep clone of a preloaded model (so multiple placements don't share
// transforms). Returns null if not loaded yet.
export function getModel(key) {
  const src = _cache[key];
  return src ? src.clone(true) : null;
}

// Recenter + uniformly scale + orient a model in place.
//   opts.length  — target size of the model's longest horizontal axis (world units)
//   opts.height  — target size of the vertical (Y) axis (use for trees/towers)
//   opts.scale   — explicit uniform scale (use instead of length to keep several
//                  models proportional to each other)
//   opts.align   — 'z' rotates longest horizontal axis to Z (default); 'none' skips
//   opts.ground  — if true, drop so the model's min-Y sits at y=0; else center Y
//   opts.yaw     — extra Y rotation (radians) applied after auto-align (e.g. flip front)
// Returns { size, scale } for callers that need the fitted dimensions.
export function normalize(obj, opts = {}) {
  const { length = null, height = null, scale: fixedScale = null, align = 'z', ground = true, yaw = 0 } = opts;
  obj.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(obj);
  let size = new THREE.Vector3(); box.getSize(size);

  // Orient: make the longest horizontal axis run along Z (so 'front' = +Z).
  if (align === 'z' && size.x > size.z) {
    obj.rotation.y += Math.PI / 2;
    obj.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(obj);
    box.getSize(size);
  }
  if (yaw) { obj.rotation.y += yaw; obj.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(obj); box.getSize(size); }

  // Scale by explicit factor, or fit a chosen axis to a target size.
  let scale = 1;
  if (fixedScale) scale = fixedScale;
  else if (height) scale = height / Math.max(size.y, 1e-4);
  else if (length) scale = length / Math.max(size.z, 1e-4);
  if (scale !== 1) obj.scale.multiplyScalar(scale);
  obj.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(obj);

  // Recenter horizontally; sit on the ground (or center vertically).
  const center = new THREE.Vector3(); box.getCenter(center);
  obj.position.x -= center.x;
  obj.position.z -= center.z;
  obj.position.y -= ground ? box.min.y : center.y;
  obj.updateMatrixWorld(true);
  return { size: size.clone().multiplyScalar(scale), scale };
}
