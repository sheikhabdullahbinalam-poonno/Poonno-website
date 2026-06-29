// ============================================================================
//  materials.js — procedural PBR materials authored in code (no texture files).
//  weatheredMetal(): extends MeshStandardMaterial via onBeforeCompile to paint
//  weathered, rusty, panel-seamed metal in OBJECT space, so it stays locked to
//  the model (no swimming as the train moves) and is independent of the model's
//  UVs. Keyed on local height for grime that gathers low on the body.
// ============================================================================

import * as THREE from 'three';

const NOISE_GLSL = `
float h31(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n31(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h31(i+vec3(0,0,0)),h31(i+vec3(1,0,0)),f.x),
                 mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),
                 mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm3(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*n31(p); p*=2.02; a*=0.5; } return s; }
float gW;
`;

// opts: base/rust THREE.Color, yLow/yHigh (object-space height range for grime),
// paintRough, rustRough, metalBase, scale (pattern frequency), panel (seam freq),
// rustAmt (0..1 bias), emissiveWindows (unused hook).
export function weatheredMetal(opts = {}) {
  const {
    base = new THREE.Color(0x294845),
    rust = new THREE.Color(0x5a2f1c),
    yLow = 0, yHigh = 1,
    paintRough = 0.5, rustRough = 0.95, metalBase = 0.55,
    scale = 0.5, panel = 0.5, rustAmt = 0.0, envMapIntensity = 1.0,
  } = opts;

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: paintRough, metalness: metalBase, envMapIntensity,
  });

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uBase: { value: base }, uRust: { value: rust },
      uYLow: { value: yLow }, uYHigh: { value: yHigh },
      uPaintR: { value: paintRough }, uRustR: { value: rustRough },
      uMetal: { value: metalBase }, uScale: { value: scale },
      uPanel: { value: panel }, uRustAmt: { value: rustAmt },
    });

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\n' + NOISE_GLSL +
        'varying vec3 vLP;\nuniform vec3 uBase,uRust;\nuniform float uYLow,uYHigh,uPaintR,uRustR,uMetal,uScale,uPanel,uRustAmt;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 lp = vLP * uScale;
        float grime  = smoothstep(uYHigh, uYLow, vLP.y);                 // 1 low on body
        float n      = fbm3(lp);
        float streak = fbm3(vec3(lp.x*0.9, vLP.y*0.05, lp.z*0.9));        // vertical rust runs
        float rust   = clamp(smoothstep(0.46, 0.86, n*0.55 + grime*0.5 + streak*0.25) + uRustAmt, 0.0, 1.0);
        gW = rust;
        vec3 col = mix(uBase, uRust, rust);
        col *= 0.78 + 0.44 * n;                                          // tonal mottling
        col = mix(col, uBase*0.45, grime*0.4);                          // grime darkens the skirt
        vec2 pan = abs(fract(vec2(vLP.x*uPanel + 0.5, vLP.y*uPanel*1.3)) - 0.5);
        float seam = smoothstep(0.44, 0.5, max(pan.x, pan.y));
        col *= 1.0 - 0.24 * seam;                                        // recessed panel seams
        float rivet = step(0.92, h31(floor(vLP*uPanel*2.0)));
        col *= 1.0 - 0.10 * rivet;
        diffuseColor.rgb *= col;`)
      .replace('#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\n        roughnessFactor = mix(uPaintR, uRustR, gW);')
      .replace('#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\n        metalnessFactor = mix(uMetal, 0.12, gW);');
  };
  mat.customProgramCacheKey = () => 'weatheredMetal_v1';
  return mat;
}
