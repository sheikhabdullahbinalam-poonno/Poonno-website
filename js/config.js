// ============================================================================
//  config.js — single source of tunable constants
//  All design tokens, render params, scroll math, camera keyframes and beat
//  labels live here so the rest of the code stays readable. Values trace
//  directly to CREATIVE_DIRECTION.md (§4 art direction, §5 scroll flow).
// ============================================================================

// §4 — Art-direction palette (hex as 0x ints for Three.js)
export const PALETTE = {
  night:    0x0B1622,
  dusk:     0x1C2E40,
  steel:    0x2E4255,
  haze:     0x5C7A99,
  firefly:  0xFFD37A,
  ember:    0xF4A259,
  cream:    0xF5EBDC,
  rust:     0x8A4B38,
  moss:     0x3E5641,
  brBlue:   0x2E6FB0,
  brCream:  0xE9D9A8,
  brRed:    0xB23A2E,
  brYellow: 0xE8B23A,
};

// §4 — Atmosphere
export const FOG = { color: 0x14202B, density: 0.011 };
export const SKY = { top: 0x0B1622, horizon: 0x1B2E42 };

// §4 — Post-processing (UnrealBloom). Threshold nudged up from the spec's 0.2 so
// the warm emissive sources glow without blowing out the close station views.
export const BLOOM = { strength: 0.82, radius: 0.6, threshold: 0.3 };

// §4 — Renderer
export const RENDER = { exposure: 1.05, maxPixelRatio: 2 };

// §5 — Scroll spacer height (kept in sync with css #scroll-spacer). The journey
// is long now (forest runs between stations), so the scroll is deliberate.
export const SCROLL = { spacerVH: 1100 };

// §5 — Camera
export const CAMERA = { fov: 55, near: 0.1, far: 5000, damp: 3.0 };

// §5/§5.1 — Reference camera keyframes (world along −Z, left = −X). Long forest
// runs separate the stations; transits drop LOW so the viewer feels the forest.
// HOLD bands use near-identical start/end positions so the camera truly stops.
export const KEYFRAMES = [
  { t: 0.00, pos: [12, 2.6, 4],     look: [0.0, 2.2, 2] },     // "T" view arrival (HOLD)
  { t: 0.05, pos: [5, 2.3, 6],      look: [0.0, 2.0, -2] },    // board
  { t: 0.12, pos: [0, 1.9, -12],    look: [-2.6, 1.8, -13.6] },// cab → shelf + poster (HOLD start)
  { t: 0.22, pos: [0, 1.9, -12],    look: [2.0, 1.4, -15] },   // cab pan → gauges (HOLD end)
  { t: 0.27, pos: [-0.3, 2.0, -13.0], look: [0.75, 2.05, -13.5] }, // PUSH toward the speedometer (inside, needle climbs)
  { t: 0.31, pos: [2, 7, -34],      look: [0.0, 3.0, -85] },    // lift up & out toward bird's-eye
  { t: 0.35, pos: [7, 6, -150],     look: [1.0, 3.5, -205] },   // through forest run 1
  { t: 0.39, pos: [7, 6, -275],     look: [1.0, 3.5, -320] },   // forest run 1 → approach
  { t: 0.40, pos: [4.6, 2.6, -337], look: [10.0, 2.2, -342] }, // Creative Origins (HOLD start)
  { t: 0.52, pos: [4.6, 2.6, -338], look: [10.0, 2.2, -343] }, // Creative Origins (HOLD end)
  { t: 0.56, pos: [0, 9, -372],     look: [-3.0, 3.0, -402] }, // rise over V
  { t: 0.59, pos: [0, 16, -392],    look: [0.0, 3.0, -420] },  // bird's-eye over V junction
  { t: 0.63, pos: [-5, 10, -440],   look: [-6.0, 3.0, -485] }, // bank left, descend into forest 2
  { t: 0.68, pos: [-9, 6, -545],    look: [-5.0, 3.5, -600] }, // through forest run 2 (different trees)
  { t: 0.72, pos: [-9, 6, -655],    look: [-5.0, 3.5, -705] }, // forest run 2 → approach
  { t: 0.74, pos: [-7, 2.6, -715],  look: [-11.0, 2.0, -718] },// Unilever Station (HOLD start)
  { t: 0.84, pos: [-7, 2.6, -716],  look: [-11.0, 2.0, -719] },// Unilever Station (HOLD end)
  { t: 0.88, pos: [0, 16, -755],    look: [1.0, 3.0, -792] },  // rise, reveal Y junction
  { t: 0.93, pos: [4, 4, -792],     look: [7.5, 3.0, -825] },  // toward the tree
  { t: 1.00, pos: [4.6, 1.9, -800], look: [7.5, 4.0, -825] },  // beneath the tree (HOLD)
];

// §5 — Beat labels for the on-screen readout (verification aid).
export const BEATS = [
  { t0: 0.00, t1: 0.05, label: 'Platform arrival',      hold: true  },
  { t0: 0.05, t1: 0.12, label: 'Board the train',       hold: false },
  { t0: 0.12, t1: 0.22, label: "Driver's compartment",  hold: true  },
  { t0: 0.22, t1: 0.31, label: 'Gaining speed',         hold: false },
  { t0: 0.31, t1: 0.40, label: 'Through the forest',    hold: false },
  { t0: 0.40, t1: 0.52, label: 'Creative Origins',      hold: true  },
  { t0: 0.52, t1: 0.59, label: 'Re-board & rise',       hold: false },
  { t0: 0.59, t1: 0.63, label: 'V junction — bank left',hold: false },
  { t0: 0.63, t1: 0.74, label: 'Deeper forest',         hold: false },
  { t0: 0.74, t1: 0.84, label: 'Unilever Station',      hold: true  },
  { t0: 0.84, t1: 0.88, label: 'Re-board & reveal Y',   hold: false },
  { t0: 0.88, t1: 0.93, label: 'Toward the tree',       hold: false },
  { t0: 0.93, t1: 1.01, label: 'Horizons Crossing',     hold: true  },
];

// §5.1 — the route the train physically travels (rear lead-in → stop behind the
// final camera). Stations are far apart now, with long forest runs between.
export const TRAIN_PATH = [
  [0, 0, 42], [0, 0, 6], [0, 0, -120], [0, 0, -260], [0, 0, -340], // start → Creative
  [0, 0, -400],                                                     // V junction
  [-3, 0, -432], [-5, 0, -490], [-5, 0, -650], [-5, 0, -720],       // bank LEFT → Unilever
  [-5, 0, -745], [-2, 0, -772], [1.5, 0, -789],                     // Unilever → Y junction
  [2, 0, -797], [2, 0, -800],                                       // stop (behind final camera)
];
