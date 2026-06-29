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

// ---------------------------------------------------------------------------
//  woodMaterial(): object-space wood grain (rings + fine streaks + dark grain
//  lines) so planks read as real timber, not a flat colour. Grain runs along
//  local +Z (the plank length). Diffuse mixes two tones; roughness mottles.
// ---------------------------------------------------------------------------
export function woodMaterial(opts = {}) {
  const {
    light = new THREE.Color(0x6e4d2c), dark = new THREE.Color(0x33220f),
    rough = 0.9, scale = 1.0,
  } = opts;
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: rough, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uLight: { value: light }, uDark: { value: dark }, uScale: { value: scale } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWLP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWLP = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\n' + NOISE_GLSL +
        'varying vec3 vWLP;\nuniform vec3 uLight,uDark;\nuniform float uScale;\nfloat gWoodR;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 wlp = vWLP * uScale;
        float rings = fbm3(vec3(wlp.x*7.0, wlp.y*2.0, wlp.z*0.6));      // long grain along Z
        float fine  = fbm3(vec3(wlp.x*34.0, wlp.y*5.0, wlp.z*3.0));     // fine fibre
        float g = clamp(rings*0.7 + fine*0.4, 0.0, 1.0);
        vec3 col = mix(uDark, uLight, g);
        col *= 0.8 + 0.34*fine;                                        // streaky tone
        float line = smoothstep(0.46, 0.5, abs(fract(wlp.x*7.0 + rings*1.3) - 0.5));
        col *= 1.0 - 0.28*line;                                        // dark grain lines
        gWoodR = fine;
        diffuseColor.rgb *= col;`)
      .replace('#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\n        roughnessFactor *= 0.82 + 0.26*gWoodR;');
  };
  mat.customProgramCacheKey = () => 'wood_v1';
  return mat;
}

// ---------------------------------------------------------------------------
//  stoneMaterial(): triplanar brick/stone masonry in object space — staggered
//  courses with recessed mortar, per-brick tone variation and weathering. Reads
//  correctly on every face of a box (blended by the object normal).
// ---------------------------------------------------------------------------
export function stoneMaterial(opts = {}) {
  const {
    stone = new THREE.Color(0x6f6453), mortar = new THREE.Color(0x29251c),
    rough = 0.96, scale = 1.5,
  } = opts;
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: rough, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uStone: { value: stone }, uMortar: { value: mortar }, uScale: { value: scale } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSLP;\nvarying vec3 vSLN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSLP = position;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvSLN = objectNormal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\n' + NOISE_GLSL +
        `varying vec3 vSLP;\nvarying vec3 vSLN;\nuniform vec3 uStone,uMortar;\nuniform float uScale;
        float brickMask(vec2 uv){
          float row = floor(uv.y);
          uv.x += 0.5*mod(row, 2.0);                 // stagger alternate courses
          vec2 f = fract(uv);
          vec2 d = min(f, 1.0 - f);
          return smoothstep(0.0, 0.05, min(d.x, d.y*2.0));   // 0 in mortar, 1 on brick
        }
        float brickTone(vec2 uv){
          float row = floor(uv.y); uv.x += 0.5*mod(row, 2.0);
          return h31(vec3(floor(uv.x), row, 3.0));
        }
        float gStoneG;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 slp = vSLP * uScale;
        vec3 an = abs(normalize(vSLN)); an /= (an.x + an.y + an.z + 1e-4);
        vec2 ux = vec2(slp.z, slp.y*2.6), uy = vec2(slp.x, slp.z), uz = vec2(slp.x, slp.y*2.6);
        float m  = brickMask(ux)*an.x + brickMask(uy)*an.y + brickMask(uz)*an.z;
        float tn = brickTone(ux)*an.x + brickTone(uy)*an.y + brickTone(uz)*an.z;
        vec3 col = mix(uMortar, uStone*(0.66 + 0.5*tn), m);
        col *= 0.84 + 0.3*fbm3(slp*2.6);                       // weathering mottle
        gStoneG = m;
        diffuseColor.rgb *= col;`)
      .replace('#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\n        roughnessFactor = mix(1.0, roughnessFactor, gStoneG);'); // mortar rougher
  };
  mat.customProgramCacheKey = () => 'stone_v1';
  return mat;
}
