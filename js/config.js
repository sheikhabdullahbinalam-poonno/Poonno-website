// ============================================================================
//  config.js — single source of tunable constants
//  All design tokens, render params, scroll math, camera keyframes and beat
//  labels live here so the rest of the code stays readable. Values trace
//  directly to CREATIVE_DIRECTION.md (§4 art direction, §5 scroll flow).
// ============================================================================

// §4 — Art-direction palette (hex as 0x ints for Three.js)
export const PALETTE = {
  night:    0x0B1622, // deepest sky / fog base
  dusk:     0x1C2E40, // mid sky, shadow
  steel:    0x2E4255, // structures
  haze:     0x5C7A99, // distant fog, Unilever accent
  firefly:  0xFFD37A, // fireflies, lamps, key accent
  ember:    0xF4A259, // warm signage, creative accent, hovers
  cream:    0xF5EBDC, // text, signature
  rust:     0x8A4B38, // vintage train / wood accents
  moss:     0x3E5641, // forest, finale tree
  brBlue:   0x2E6FB0, // train upper body (Bangladesh Railway blue)
  brCream:  0xE9D9A8, // lower body & window band
  brRed:    0xB23A2E, // waistline stripe + buffer beam
  brYellow: 0xE8B23A, // handrails, footplate, trim
};

// §4 — Atmosphere
export const FOG = { color: 0x14202B, density: 0.011 }; // FogExp2 hugging the ground (mistier)
export const SKY = { top: 0x0B1622, horizon: 0x1B2E42 };  // dusk gradient dome

// §4 — Post-processing (UnrealBloom). Threshold nudged up from the spec's 0.2 so
// the many warm emissive sources glow without blowing out the close station views.
export const BLOOM = { strength: 0.82, radius: 0.6, threshold: 0.3 };

// §4 — Renderer
export const RENDER = { exposure: 1.05, maxPixelRatio: 2 };

// §5 — Scroll spacer height (≈820vh). t = scrollTop / (scrollHeight - innerHeight)
export const SCROLL = { spacerVH: 820 };

// §5 — Camera
export const CAMERA = { fov: 55, near: 0.1, far: 4000, damp: 3.0 };

// §5 — Reference camera keyframes. World laid out along −Z, left = −X.
// pos = camera position, look = look-at target. HOLD bands repeat near-identical
// positions so the camera settles and the viewer can explore.
// HOLD bands use near-identical start/end keyframes so the camera truly STOPS at
// the station (you get down and explore), then re-boards on further scroll.
export const KEYFRAMES = [
  { t: 0.00, pos: [12,  2.6,   4 ], look: [ 0.0, 2.2,   2 ] }, // "T" view arrival (train spans screen)
  { t: 0.05, pos: [ 5,  2.3,   6 ], look: [ 0.0, 2.0,  -2 ] }, // board: glide toward the train
  { t: 0.12, pos: [ 0,  1.9, -12 ], look: [-2.2, 1.7, -15 ] }, // inside cab → shelf/poster (HOLD)
  { t: 0.22, pos: [ 0,  1.9, -12 ], look: [ 2.2, 1.4, -15 ] }, // cab pan → gauges (HOLD, look only)
  { t: 0.30, pos: [ 0, 13,  -44 ], look: [ 0.0, 2.0, -95 ] }, // lift to bird's-eye
  { t: 0.40, pos: [ 4.6,2.6,-182 ], look: [10.0, 2.2,-190 ] }, // creative platform (HOLD start)
  { t: 0.52, pos: [ 4.6,2.6,-183 ], look: [10.0, 2.2,-191 ] }, // creative platform (HOLD end)
  { t: 0.58, pos: [ 0, 16, -222 ], look: [ 0.0, 2.0,-256 ] }, // bird's-eye over V junction
  { t: 0.64, pos: [-4, 13, -262 ], look: [-6.0, 2.0,-292 ] }, // banking left
  { t: 0.66, pos: [-7,  2.6,-289 ], look: [-11.0,2.0,-291 ] }, // unilever platform (HOLD start)
  { t: 0.78, pos: [-7,  2.6,-290 ], look: [-11.0,2.0,-292 ] }, // unilever platform (HOLD end)
  { t: 0.84, pos: [ 0, 20, -333 ], look: [ 1.5, 2.0,-360 ] }, // bird's-eye over Y junction
  { t: 0.92, pos: [ 4,  3, -360 ], look: [ 7.5, 3.0,-373 ] }, // arriving beside the tree
  { t: 1.00, pos: [ 4.6,1.9,-366 ], look: [ 7.5, 4.0,-373 ] }, // stepped down, beneath the tree (HOLD)
];

// §5.1 — the route the train physically travels (rear lead-in → stop beside the
// tree). Used by Train to drive the loco + carriages along the scroll. The merged
// track ends at the stop (~[2,-363]); the tree (~[7.5,-373]) stays separate.
export const TRAIN_PATH = [
  [0, 0, 42], [0, 0, 6], [0, 0, -60], [0, 0, -130],
  [0, 0, -185], [0, 0, -235], [-3, 0, -262], [-5, 0, -292],
  [-5, 0, -312], [-2, 0, -332], [1.5, 0, -341], [2, 0, -348], [2, 0, -352],
];

// §5 — Beat labels for the on-screen readout (verification aid this phase).
export const BEATS = [
  { t0: 0.00, t1: 0.05, label: 'Platform arrival',      hold: true  },
  { t0: 0.05, t1: 0.12, label: 'Board the train',       hold: false },
  { t0: 0.12, t1: 0.22, label: "Driver's compartment",  hold: true  },
  { t0: 0.22, t1: 0.30, label: 'Gaining speed',         hold: false },
  { t0: 0.30, t1: 0.40, label: "Bird's-eye lift",       hold: false },
  { t0: 0.40, t1: 0.52, label: 'Creative Origins',      hold: true  },
  { t0: 0.52, t1: 0.58, label: 'Re-board & rise',       hold: false },
  { t0: 0.58, t1: 0.64, label: 'V junction — bank left',hold: false },
  { t0: 0.64, t1: 0.66, label: 'Approach Unilever',     hold: false },
  { t0: 0.66, t1: 0.78, label: 'Unilever Station',      hold: true  },
  { t0: 0.78, t1: 0.84, label: 'Re-board & reveal Y',   hold: false },
  { t0: 0.84, t1: 0.92, label: 'Toward the tree',       hold: false },
  { t0: 0.92, t1: 1.01, label: 'Horizons Crossing',     hold: true  },
];
