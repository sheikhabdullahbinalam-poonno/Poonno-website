// ============================================================================
//  environment.js — a procedural dusk environment map (§9). Built once from a
//  canvas equirect (night→dusk gradient + a soft moon + warm horizon specks) via
//  PMREMGenerator, then assigned to scene.environment so every PBR material gets
//  consistent, cohesive reflections + soft image-based lighting. No external HDR.
// ============================================================================

import * as THREE from 'three';

export function makeEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const eq = equirectTexture();
  eq.mapping = THREE.EquirectangularReflectionMapping;
  const rt = pmrem.fromEquirectangular(eq);
  eq.dispose();
  pmrem.dispose();
  return rt.texture;
}

function equirectTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');

  // vertical gradient: deep night up top → dusk band at the horizon → dark ground
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0.00, '#0a1420');
  grd.addColorStop(0.42, '#16273a');
  grd.addColorStop(0.50, '#243a52'); // horizon glow
  grd.addColorStop(0.58, '#16222e');
  grd.addColorStop(1.00, '#05080c');
  g.fillStyle = grd;
  g.fillRect(0, 0, 1024, 512);

  // soft moon, upper-left
  const moon = g.createRadialGradient(300, 140, 0, 300, 140, 130);
  moon.addColorStop(0, 'rgba(225,233,247,0.95)');
  moon.addColorStop(0.18, 'rgba(185,203,228,0.5)');
  moon.addColorStop(1, 'rgba(185,203,228,0)');
  g.fillStyle = moon;
  g.fillRect(120, 0, 360, 320);

  // a few warm lamp specks near the horizon (give the glossy paint warm glints)
  for (let i = 0; i < 9; i++) {
    const x = Math.random() * 1024;
    const y = 250 + Math.random() * 24;
    const r = 10 + Math.random() * 18;
    const sp = g.createRadialGradient(x, y, 0, x, y, r);
    sp.addColorStop(0, 'rgba(255,211,122,0.6)');
    sp.addColorStop(1, 'rgba(255,211,122,0)');
    g.fillStyle = sp;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
