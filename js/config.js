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
export const FOG = { color: 0x14202B, density: 0.009 }; // FogExp2 hugging the ground
export const SKY = { top: 0x0B1622, horizon: 0x1B2E42 };  // dusk gradient dome

// §4 — Post-processing (UnrealBloom)
export const BLOOM = { strength: 0.85, radius: 0.6, threshold: 0.2 };

// §4 — Renderer
export const RENDER = { exposure: 1.05, maxPixelRatio: 2 };

// §5 — Scroll spacer height (≈820vh). t = scrollTop / (scrollHeight - innerHeight)
export const SCROLL = { spacerVH: 820 };

// §5 — Camera
export const CAMERA = { fov: 55, near: 0.1, far: 4000, damp: 3.5 };

// §5 — Reference camera keyframes. World laid out along −Z, left = −X.
// pos = camera position, look = look-at target. HOLD bands repeat near-identical
// positions so the camera settles and the viewer can explore.
export const KEYFRAMES = [
  { t: 0.00, pos: [12,  2.6,   4 ], look: [ 0.0, 2.2,   4 ] }, // "T" view, train spans screen
  { t: 0.05, pos: [ 2,  2.0,   9 ], look: [ 0.0, 2.0,   2 ] }, // board
  { t: 0.12, pos: [ 0,  1.7, 0.6 ], look: [-1.4, 1.6,  -1 ] }, // inside cab → shelf/poster (left)
  { t: 0.22, pos: [ 0.2,1.6, 0.2 ], look: [ 1.2, 1.3,-1.2 ] }, // → gauges/odometer (right console)
  { t: 0.30, pos: [ 0, 12,  -30 ], look: [ 0.0, 1.0, -70 ] }, // lift to bird's-eye
  { t: 0.40, pos: [ 0,  3.2,-178 ], look: [ 3.0, 1.8,-192 ] }, // creative platform (HOLD start)
  { t: 0.52, pos: [ 0,  3.0,-198 ], look: [ 3.0, 1.6,-202 ] }, // creative platform (HOLD end)
  { t: 0.58, pos: [ 0, 16, -220 ], look: [ 0.0, 1.0,-250 ] }, // bird's-eye over V junction
  { t: 0.64, pos: [-3, 12, -255 ], look: [-5.0, 2.0,-290 ] }, // banking left
  { t: 0.66, pos: [-1,  3.2,-285 ], look: [-5.5, 1.6,-298 ] }, // unilever platform (HOLD start)
  { t: 0.78, pos: [-1,  3.0,-303 ], look: [-5.5, 1.6,-300 ] }, // unilever platform (HOLD end)
  { t: 0.84, pos: [ 0, 20, -330 ], look: [ 0.0, 1.0,-365 ] }, // bird's-eye over Y junction
  { t: 0.92, pos: [ 2,  3, -360 ], look: [ 7.0, 2.5,-372 ] }, // arriving at tree
  { t: 1.00, pos: [ 4.5,1.7,-366 ], look: [ 7.0, 3.0,-372 ] }, // stepped down, under tree
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
