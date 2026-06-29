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
export const FOG = { color: 0x0C1822, density: 0.010 }; // dark night haze — distance recedes into darkness, not white
export const SKY = { top: 0x0B1622, horizon: 0x294257 };  // horizon lifted to blend with the fog

// §4 — Post-processing (UnrealBloom). Threshold nudged up from the spec's 0.2 so
// the warm emissive sources glow without blowing out the close station views.
export const BLOOM = { strength: 0.82, radius: 0.6, threshold: 0.3 };

// §4 — Renderer
export const RENDER = { exposure: 1.05, maxPixelRatio: 2 };

// §5 — Scroll spacer height (kept in sync with css #scroll-spacer). The journey
// is long now (forest runs between stations), so the scroll is deliberate.
export const SCROLL = { spacerVH: 2200 };

// §5 — Camera
export const CAMERA = { fov: 55, near: 0.1, far: 5000, damp: 3.0 };

// §5/§5.1 — Reference camera keyframes (world along −Z, left = −X). Long forest
// runs separate the stations; transits drop LOW so the viewer feels the forest.
// HOLD bands use near-identical start/end positions so the camera truly stops.
export const KEYFRAMES = [
  // ---- INTRO: platform → newspaper → read articles → board (train waits) ----
  { t: 0.00,  pos: [11.5, 3.0, -6],  look: [0.5, 2.0, -9] },  // T-view — squared to the train
  { t: 0.035, pos: [11.5, 3.0, -6],  look: [7.0, 1.3, 3] },   // PAN left in place — sweep the gaze to the newspaper
  { t: 0.085, pos: [9.4, 1.75, 4.6], look: [7.0, 1.05, 3] },  // then DOLLY in & down — a low view of the paper
  { t: 0.10,  pos: [9.1, 1.66, 4.4], look: [7.0, 1.05, 3] },  // hold low as it lifts off
  { t: 0.18, pos: [8.7, 1.6, 4.1],  look: [7.0, 1.1, 3] },    // it fills the frame → HTML article (HOLD start)
  { t: 0.40, pos: [8.6, 1.6, 4.0],  look: [7.0, 1.1, 3] },    // articles read behind the overlay (HOLD end)
  { t: 0.45, pos: [6.5, 2.3, 4.0],  look: [0.5, 1.8, -10] },  // overlay leaves → turn to the waiting train (board)
  // ---- JOURNEY: train departs, forest → Creative → forest → Unilever → tree ----
  { t: 0.48,  pos: [3, 6, -36],      look: [0.0, 3.0, -92] },  // board & lift toward bird's-eye (train departs)
  { t: 0.51,  pos: [1, 4.0, -150],   look: [0.0, 3.0, -212] }, // descend into the corridor, follow the train
  { t: 0.54,  pos: [0.5, 3.6, -275], look: [0.0, 3.2, -332] }, // thread the trees, train running ahead
  { t: 0.548, pos: [4.6, 2.6, -337], look: [10.0, 2.2, -342] },// Creative Origins (HOLD start)
  { t: 0.638, pos: [4.6, 2.6, -338], look: [10.0, 2.2, -343] },// Creative Origins (HOLD end)
  { t: 0.646, pos: [0.5, 3.2, -356], look: [-2.0, 3.8, -415] },// step to train roof
  { t: 0.657, pos: [-2.5, 3.8, -392],look: [-3.5, 4.5, -455] },// train banks left, junction signal behind us
  { t: 0.668, pos: [-4.5, 4.2, -428],look: [-4.5, 6.0, -515] },// following the curve
  { t: 0.682, pos: [-5.5, 4.8, -465],look: [-5.0, 9.5, -565] },// gaze lifting — no reversals in any axis from here
  { t: 0.700, pos: [-6.0, 5.0, -498],look: [-5.0, 15.0, -610] },// smoothly rising toward the moon
  { t: 0.720, pos: [-6.5, 4.8, -535],look: [-5.5, 17.0, -650] },// peak moon-gaze
  { t: 0.740, pos: [-7.0, 4.4, -575],look: [-6.0, 14.0, -695] },// begin descent
  { t: 0.759, pos: [-7.0, 4.0, -612],look: [-6.5, 10.0, -720] },// returning to level
  { t: 0.789, pos: [-7.0, 3.4, -688],look: [-7.5, 3.0, -714] },// decelerate INTO Unilever (no speed-up-then-stop)
  { t: 0.804, pos: [-7, 2.6, -715],  look: [-11.0, 2.0, -718] },// Unilever Years (HOLD start)
  { t: 0.880, pos: [-7, 2.6, -716],  look: [-11.0, 2.0, -719] },// Unilever Years (HOLD end)
  { t: 0.910, pos: [0, 16, -755],    look: [1.0, 3.0, -792] }, // rise, reveal Y junction
  { t: 0.947, pos: [4.6, 2.6, -805], look: [7.5, 6.0, -825] },// approach, tilting up to the tree
  { t: 1.00,  pos: [5.4, 2.4, -812], look: [7.6, 8.5, -826] },// BENEATH the tree, gazing up (HOLD)
];

// §5 — Beat labels for the on-screen readout (verification aid).
export const BEATS = [
  { t0: 0.00, t1: 0.05,  label: 'Platform arrival',     hold: true  },
  { t0: 0.05, t1: 0.18,  label: 'A newspaper lifts',    hold: false },
  { t0: 0.18, t1: 0.40,  label: 'Who is Poonno',        hold: true  },
  { t0: 0.40, t1: 0.48,  label: 'Board the train',      hold: false },
  { t0: 0.48, t1: 0.548, label: 'Through the forest',   hold: false },
  { t0: 0.548, t1: 0.638,label: 'Creative Origins',     hold: true  },
  { t0: 0.638, t1: 0.691,label: 'Re-board & rise',      hold: false },
  { t0: 0.691, t1: 0.721,label: 'V junction',           hold: false },
  { t0: 0.721, t1: 0.804,label: 'Deeper forest',        hold: false },
  { t0: 0.804, t1: 0.880,label: 'Unilever Years',       hold: true  },
  { t0: 0.880, t1: 0.947,label: 'Toward the tree',      hold: false },
  { t0: 0.947, t1: 1.01, label: 'Horizons Crossing',    hold: true  },
];

// §5.1 — the route the train physically travels (rear lead-in → stop behind the
// final camera). Stations are far apart now, with long forest runs between.
export const TRAIN_PATH = [
  [0, 0, 42], [0, 0, 6], [0, 0, -120], [0, 0, -260], [0, 0, -340], // start → Creative
  [0, 0, -400],                                                     // V junction
  [-3, 0, -432], [-5, 0, -490], [-5, 0, -650], [-5, 0, -720],       // bank LEFT → Unilever
  [-5, 0, -745], [-2, 0, -772], [1.5, 0, -789],                     // Unilever → Y junction
  [2, 0, -791.5], [2, 0, -793],                                     // stop BEHIND the final camera (z−800)
];
