// ============================================================================
//  cab.js — the driver's compartment (§6.2): a steam cab set inside the diesel
//  loco. Built as a static interior "set" at the cab's world position (the loco
//  exterior sits at the platform during the cab beat, so it reads as inside).
//  Riveted steel-blue walls, a window to the dusk yard, a brass boiler backhead
//  with pressure gauges + a large speedometer (its needle climbs on the speed
//  beat), red-handled levers, a flickering firebox, and an overhead bulkhead
//  lamp. On the LEFT wall: the clickable 3-tier shelf (§6.3) and the torn
//  "Who is Poonno" poster (§6.4), each with a pulsing click-guidance halo.
// ============================================================================

import * as THREE from 'three';
import { PALETTE } from './config.js';

const CX = 0, CY = 2.0, CZ = -13; // cab centre (world)

export function buildCab(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const steel = new THREE.MeshStandardMaterial({ map: wallTex(), color: 0x35506C, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide, envMapIntensity: 0.5 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x221D18, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x1A2733, roughness: 0.85, side: THREE.DoubleSide });

  const W = 5, H = 3.6, D = 7;
  addPlane(group, W, D, [CX, CY - H / 2, CZ], [-Math.PI / 2, 0, 0], floorMat);   // floor
  addPlane(group, W, D, [CX, CY + H / 2, CZ], [Math.PI / 2, 0, 0], ceilMat);     // ceiling
  addPlane(group, D, H, [CX - W / 2, CY, CZ], [0, Math.PI / 2, 0], steel);       // left wall
  addPlane(group, D, H, [CX + W / 2, CY, CZ], [0, -Math.PI / 2, 0], steel);      // right wall
  addPlane(group, W, H, [CX, CY, CZ - D / 2], [0, 0, 0], steel);                 // front wall
  addPlane(group, W, H, [CX, CY, CZ + D / 2], [0, Math.PI, 0], steel);           // back wall

  // overhead bulkhead lamp (warm pool of light)
  const lampGlow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16),
    new THREE.MeshStandardMaterial({ color: PALETTE.firefly, emissive: PALETTE.firefly, emissiveIntensity: 2.2 }));
  lampGlow.rotation.x = Math.PI / 2; lampGlow.position.set(CX, CY + H / 2 - 0.05, CZ - 0.5); group.add(lampGlow);
  lampGlow.material.emissiveIntensity = 0.4;
  const lamp = new THREE.PointLight(0xFFD9A0, 2.2, 7, 2); lamp.position.set(CX, CY + 1.3, CZ - 0.5); group.add(lamp);

  // window to the dusk railyard (front wall, left of the boiler)
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.3),
    new THREE.MeshStandardMaterial({ map: yardTex(), emissive: 0xffffff, emissiveMap: yardTex(), emissiveIntensity: 0.22, roughness: 0.5 }));
  win.position.set(CX - 1.1, CY + 0.35, CZ - D / 2 + 0.03); group.add(win);
  const winFrame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.5, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x20313F, roughness: 0.7, metalness: 0.4 }));
  winFrame.position.set(CX - 1.1, CY + 0.35, CZ - D / 2 + 0.01); group.add(winFrame);

  // boiler backhead + gauges + speedometer + levers + firebox (right/front)
  const needle = addBoiler(group);

  // firebox — flickering warm light leaking into the cab
  const fireGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xFF7A2A, emissive: 0xFF7A2A, emissiveIntensity: 1.1 }));
  fireGlow.material.emissiveIntensity = 0.8;
  fireGlow.position.set(CX + 1.4, CY - 1.0, CZ - 2.2); fireGlow.rotation.y = -0.5; group.add(fireGlow);
  const fire = new THREE.PointLight(0xFF7A30, 2, 7, 2); fire.position.set(CX + 1.2, CY - 0.7, CZ - 2.0); group.add(fire);

  // ---- interactives: shelf + poster on the LEFT wall ----
  const shelf = makeShelf();
  shelf.position.set(CX - W / 2 + 0.08, CY - 0.1, CZ + 0.4);
  shelf.userData.kind = 'shelf';
  group.add(shelf);

  const poster = makePoster();
  poster.position.set(CX - W / 2 + 0.06, CY + 0.35, CZ - 2.2);
  poster.rotation.y = Math.PI / 2;
  poster.rotation.z = 0.04;
  poster.userData.kind = 'poster';
  group.add(poster);

  // pulsing click-guidance halos
  const haloT = haloTex();
  const shelfHalo = halo(haloT); shelfHalo.position.set(CX - 1.5, CY + 0.0, CZ + 0.4); group.add(shelfHalo);
  const posterHalo = halo(haloT); posterHalo.position.set(CX - 1.6, CY + 0.35, CZ - 2.2); group.add(posterHalo);

  // collect shelf meshes for hover glow
  const shelfMeshes = [];
  shelf.traverse((o) => { if (o.isMesh) { o.material.emissive = new THREE.Color(PALETTE.firefly); o.material.emissiveIntensity = 0; shelfMeshes.push(o); } });

  let time = 0;
  return {
    group, shelf, poster,
    interactables: [shelf, poster],
    update(t, dt) {
      time += dt;
      // firebox flicker
      const fl = 1.6 + Math.sin(time * 13) * 0.5 + Math.sin(time * 27) * 0.3;
      fire.intensity = Math.max(0.8, fl);
      fireGlow.material.emissiveIntensity = 0.65 + Math.sin(time * 17) * 0.2;
      // speedometer needle: climbs across the speed beat (t .22 → .29)
      const sp = clamp01((t - 0.22) / 0.07);
      needle.rotation.z = Math.PI * 0.7 - sp * Math.PI * 1.25;
      // halos pulse
      const pulse = 0.5 + 0.5 * Math.sin(time * 3.0);
      for (const hh of [shelfHalo, posterHalo]) {
        hh.material.opacity = 0.25 + pulse * 0.4;
        const s = 1.0 + pulse * 0.18; hh.scale.set(s * hh.userData.s, s * hh.userData.s, 1);
      }
    },
    setHover(kind) {
      const sh = kind === 'shelf' ? 0.32 : 0;
      for (const m of shelfMeshes) m.material.emissiveIntensity = sh;
      poster.material.emissiveIntensity = kind === 'poster' ? 0.55 : 0.18;
    },
  };
}

// ---- boiler backhead with gauges + speedometer + levers ---------------------
function addBoiler(group) {
  const iron = new THREE.MeshStandardMaterial({ color: 0x2B2622, roughness: 0.7, metalness: 0.6, envMapIntensity: 0.6 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xB8893B, roughness: 0.4, metalness: 0.85, envMapIntensity: 0.35 });
  const red = new THREE.MeshStandardMaterial({ color: PALETTE.brRed, roughness: 0.4, metalness: 0.3 });

  const back = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 2.6, 16), iron);
  back.position.set(CX + 1.7, CY - 0.1, CZ - 1.9); group.add(back);

  // brass pipes
  for (const off of [-0.5, 0.3]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8), brass);
    pipe.position.set(CX + 1.1, CY + 0.2, CZ - 2.0 + off); pipe.rotation.z = 0.4; group.add(pipe);
  }

  // two small pressure gauges (backlit so they read at night)
  gauge(group, CX + 0.9, CY + 0.7, CZ - 1.3, 0.28, 'PSI', -0.5, true);
  gauge(group, CX + 1.05, CY + 0.4, CZ - 1.0, 0.22, 'BAR', 0.4, true);

  // large backlit speedometer with an animated needle (returned)
  const dial = gauge(group, CX + 0.75, CY + 0.05, CZ - 0.5, 0.45, 'KM/H', 0.0, true);
  // Needle is a CHILD of the dial so it lies in the dial's plane and sweeps across
  // its face (rotating about the dial normal), not in a perpendicular plane.
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xE85A40, emissive: 0xE85A40, emissiveIntensity: 1.1 }));
  needle.geometry.translate(0, 0.17, 0);   // pivot near one end
  needle.position.set(0, 0, 0.04);          // just in front of the dial face
  needle.rotation.z = Math.PI * 0.7;
  dial.add(needle);

  // red-handled levers / throttle
  for (const lz of [-0.4, 0.1]) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8),
      new THREE.MeshStandardMaterial({ color: 0x6A6A6A, metalness: 0.8, roughness: 0.3 }));
    stem.position.set(CX + 1.9, CY - 0.6, CZ + lz); stem.rotation.x = 0.5; group.add(stem);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), red);
    knob.position.set(CX + 1.9, CY - 0.3, CZ + lz + 0.15); group.add(knob);
  }
  return needle;
}

function gauge(group, x, y, z, r, label, ry, lit = false) {
  const tex = gaugeTex(label);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.1 });
  if (lit) { mat.emissive = new THREE.Color(0xF0DFB0); mat.emissiveMap = tex; mat.emissiveIntensity = 0.55; }
  const face = new THREE.Mesh(new THREE.CircleGeometry(r, 24), mat);
  face.position.set(x, y, z); face.rotation.y = -Math.PI / 2 + ry; group.add(face);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xB8893B, metalness: 0.9, roughness: 0.3 }));
  ring.position.copy(face.position); ring.rotation.copy(face.rotation); group.add(ring);
  return face;
}

// ---- the 3-tier shelf (§6.3) ------------------------------------------------
function makeShelf() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x5A3D26, roughness: 0.8, metalness: 0.05 });
  // depth along +X (into room), width along Z (along wall), 3 tiers up Y
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 2.6), wood); back.position.set(0, 0.2, 0); g.add(back);
  for (const sz of [-1.3, 1.3]) g.add(box(0.7, 2.6, 0.1, wood, 0.35, 0.2, sz));
  const tiers = [1.05, 0.0, -1.05];
  for (const ty of tiers) g.add(box(0.72, 0.07, 2.6, wood, 0.36, ty, 0));

  // top tier: basketball + medals
  g.add(ball(0.2, 0.5, 1.18, -0.7));
  g.add(medal(0.45, 1.2, 0.4)); g.add(medal(0.45, 1.2, 0.75));
  // middle tier: trophies + medals
  g.add(trophy(0.45, 0.32, -0.6)); g.add(trophy(0.45, 0.32, 0.0));
  g.add(medal(0.4, 0.2, 0.9));
  // bottom tier: folded jersey (#27) + D Rose shoes
  g.add(foldedJersey(0.5, -0.7, -0.6));
  g.add(shoe(0.45, -0.74, 0.5)); g.add(shoe(0.45, -0.74, 0.85));
  // hanging jersey #27 below the bottom shelf
  g.add(hangingJersey(0.55, -1.95, 0.0));
  return g;
}

function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }

function ball(r, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xC4632A, roughness: 0.85 }));
  m.position.set(x, y, z); return m;
}
function medal(x, y, z) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16),
    new THREE.MeshStandardMaterial({ color: 0xD9A93A, metalness: 0.9, roughness: 0.3 }));
  disc.rotation.x = Math.PI / 2; disc.position.set(x, y, z); g.add(disc);
  const rib = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.22),
    new THREE.MeshStandardMaterial({ color: PALETTE.brRed, side: THREE.DoubleSide, roughness: 0.7 }));
  rib.position.set(x, y + 0.18, z); g.add(rib);
  return g;
}
function trophy(x, y, z) {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xE3B73E, metalness: 0.9, roughness: 0.25 });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.26, 14), gold); cup.position.set(x, y + 0.32, z); g.add(cup);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8), gold); stem.position.set(x, y + 0.12, z); g.add(stem);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0x3A2A1E, roughness: 0.8 })); base.position.set(x, y + 0.02, z); g.add(base);
  return g;
}
function shoe(x, y, z) {
  const g = new THREE.Group();
  const grey = new THREE.MeshStandardMaterial({ color: 0x8A8E92, roughness: 0.7 });
  const sole = new THREE.MeshStandardMaterial({ color: 0xEDEDED, roughness: 0.6 });
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.16), grey); upper.position.set(x, y + 0.12, z); g.add(upper);
  const toe = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), grey); toe.position.set(x + 0.16, y + 0.08, z); g.add(toe);
  const midsole = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.18), sole); midsole.position.set(x + 0.02, y + 0.03, z); g.add(midsole);
  return g;
}
function foldedJersey(x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.4),
    new THREE.MeshStandardMaterial({ map: jerseyTex(), roughness: 0.85 }));
  m.position.set(x, y + 0.06, z); m.rotation.y = Math.PI / 2; return m;
}
function hangingJersey(x, y, z) {
  const g = new THREE.Group();
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8, roughness: 0.3 }));
  hook.position.set(x, y + 0.55, z); g.add(hook);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.7, roughness: 0.4 }));
  bar.position.set(x, y + 0.45, z); g.add(bar);
  const jersey = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.7),
    new THREE.MeshStandardMaterial({ map: jerseyTex(), side: THREE.DoubleSide, roughness: 0.85 }));
  jersey.position.set(x, y + 0.05, z); jersey.rotation.y = Math.PI / 2; g.add(jersey);
  return g;
}

// ---- the torn "Who is Poonno" poster (§6.4) --------------------------------
function makePoster() {
  const tex = posterTex();
  return new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.0),
    new THREE.MeshStandardMaterial({
      map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.18, roughness: 0.85,
    }));
}

// ---- pulsing halo sprite ----------------------------------------------------
function halo(tex) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: PALETTE.firefly, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.userData.s = 2.2; s.scale.set(2.2, 2.2, 1);
  return s;
}

// ---- helpers ----------------------------------------------------------------
function addPlane(group, w, h, pos, rot, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(...pos); m.rotation.set(...rot); group.add(m);
}

// ---- canvas textures --------------------------------------------------------
function wallTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#314A64'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3;
  for (let x = 0; x <= 256; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.10)';
  for (let x = 16; x < 256; x += 64) for (let y = 16; y < 256; y += 32) { g.beginPath(); g.arc(x, y, 2.5, 0, 6.28); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function yardTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 192;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 192);
  grd.addColorStop(0, '#1B2E44'); grd.addColorStop(0.6, '#24384C'); grd.addColorStop(1, '#10202C');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 192);
  for (let i = 0; i < 16; i++) { g.fillStyle = `rgba(255,211,122,${0.2 + Math.random() * 0.5})`; g.beginPath(); g.arc(Math.random() * 256, 60 + Math.random() * 90, 1.5 + Math.random() * 2.5, 0, 6.28); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function gaugeTex(label) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#15110C'; g.beginPath(); g.arc(64, 64, 64, 0, 6.28); g.fill();
  g.strokeStyle = '#E9D9A8'; g.lineWidth = 2;
  for (let a = 0; a < 12; a++) { const ang = -Math.PI * 0.75 + a * (Math.PI * 1.5 / 11); g.beginPath(); g.moveTo(64 + Math.cos(ang) * 50, 64 + Math.sin(ang) * 50); g.lineTo(64 + Math.cos(ang) * 58, 64 + Math.sin(ang) * 58); g.stroke(); }
  g.fillStyle = '#C9B98A'; g.font = '700 13px Georgia, serif'; g.textAlign = 'center'; g.fillText(label, 64, 92);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function jerseyTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#C8102E'; g.fillRect(0, 0, 256, 256);          // Bangladesh red
  g.fillStyle = '#F5F5F5'; g.fillRect(0, 0, 256, 40);           // white shoulder band
  g.fillStyle = '#F5F5F5'; g.font = '800 130px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('27', 128, 150);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function posterTex() {
  const c = document.createElement('canvas'); c.width = 384; c.height = 512;
  const g = c.getContext('2d');
  // transparent first, then draw aged paper with a jagged torn border
  g.clearRect(0, 0, 384, 512);
  g.save();
  g.beginPath();
  const N = 40, cx = 192, cy = 256;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rr = 0.84 + Math.sin(i * 3.3) * 0.05 + (Math.random() - 0.5) * 0.06;
    const x = cx + Math.cos(a) * 188 * rr, y = cy + Math.sin(a) * 250 * rr;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath(); g.clip();
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, '#E7D8B6'); grd.addColorStop(1, '#C9B488');
  g.fillStyle = grd; g.fillRect(0, 0, 384, 512);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(90,70,40,${Math.random() * 0.12})`; g.beginPath(); g.arc(Math.random() * 384, Math.random() * 512, 6 + Math.random() * 20, 0, 6.28); g.fill(); }
  g.fillStyle = '#3A2A1A'; g.font = '800 40px Georgia, serif'; g.textAlign = 'center';
  g.fillText('WHO IS', 192, 110); g.fillText('POONNO?', 192, 158);
  // portrait silhouette
  g.fillStyle = '#6B563A'; g.beginPath(); g.arc(192, 280, 52, 0, 6.28); g.fill();
  g.beginPath(); g.ellipse(192, 380, 78, 60, 0, Math.PI, 0, true); g.fill();
  g.fillStyle = '#5A4A33'; g.font = '500 17px Georgia, serif';
  for (let i = 0; i < 4; i++) g.fillText('— — — — — — — —', 192, 440 + i * 22);
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function haloTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 30, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,211,122,0)');
  grd.addColorStop(0.7, 'rgba(255,211,122,0.5)');
  grd.addColorStop(0.85, 'rgba(255,224,160,0.9)');
  grd.addColorStop(1, 'rgba(255,211,122,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
