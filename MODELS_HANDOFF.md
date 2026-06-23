# Blender → Web — Model Handoff Spec

How to prepare and hand off your 3D models so they drop cleanly into the site's
engine (Three.js r0.160). Follow this and your Blender work won't be wasted.

## 1. Format
- Export each piece as **`.glb`** (binary glTF 2.0) — use the Blender **glTF 2.0**
  exporter with its defaults (it converts Blender's Z-up to web Y-up automatically).
- **Apply all transforms** before export: select all → `Object ▸ Apply ▸ All Transforms`.
- **Scale in real-world metres** (a carriage ≈ 20 m long, a person ≈ 1.8 m) so the
  models match the world's scale and the camera path.
- **Origins:** trunk base for trees; base-centre for the loco/carriage; a logical
  corner/centre for platforms & stations.
- One `.glb` per logical piece (see §5). Keep file sizes lean.

## 2. Materials & textures (PBR)
- Use the **Principled BSDF**. Provide Base Color, Roughness, Metallic, Normal,
  and **Emission** where things glow.
- **Emission is important** — set it on lit windows, lamps, the firebox, signal
  lights, and the finale tree's string-lights. Those will glow at night + catch bloom.
- Textures **≤ 2K (1K preferred)**, power-of-two (1024 / 2048). Pack them into the
  `.glb` (or a `textures/` folder beside it).
- Keep colours in the warm dusk / firefly palette so they match the atmosphere
  (blues/steel world, firefly-gold + ember accents).

## 3. Shadows / baking — the short answer
- **Bake Ambient Occlusion and multiply it into the Base Color texture for every
  model.** This is the single biggest realism boost, needs no extra setup on my
  side, and works for both static and moving parts.
- **Do NOT bake cast / directional shadows into anything that moves** (the train,
  its wheels, anything I animate) — bake AO only. I light the scene in real time
  (moonlight + lamps + environment map) so the moving train stays correct and the
  fog/fireflies interact with it.
- **Static scenery is optional:** for the forest, platform, stations, tree and
  ground you *may* bake the full soft lighting/shadows into the texture for extra
  richness (they don't move). If you do, tell me and I'll render those pieces
  "unlit". If unsure, just bake AO — I'll light them in code; it's flexible and
  already looks good.
- **TL;DR — bake AO: yes (always). Full shadows: only on static pieces, only if
  you want to. Cast shadows on the train: never.**

## 4. Poly & performance budget (target 60 fps)
- Hero pieces (loco, cab, carriage, finale tree) can be detailed: ~20–80k tris each.
- **Forest: hand me 2–4 tree models** (e.g. 2 conifer variants + 2 broadleaf) — NOT
  a whole forest. I scatter/instance hundreds in code. Same for any repeated prop.
- Keep total on-screen tris under ~500k.

## 5. Pieces to deliver (separate `.glb` each)
1. `loco.glb` — the locomotive (detailed; the hero).
2. `cab.glb` — the driver's-cab **interior** (or include in the loco). Name the
   interactive/animated parts (see §6): `shelf`, `poster`, `speedometer-needle`,
   `lever-1`, `lever-2`, `firebox`, `cab-window`.
3. `carriage.glb` — one passenger carriage (I repeat it down the rake).
4. `tree-conifer-a.glb`, `tree-broadleaf-a.glb` (+ a variant or two) — the two
   forest runs use different trees.
5. `platform.glb` — start platform + canopy + lamps.
6. `station.glb` — a station building/stalls (I'll re-skin for Creative=ember and
   Unilever=steel) — or one per station if they differ.
7. `nameplate.glb` — the yellow junction board (or include it in `station.glb`).
8. `tree-finale.glb` — the great tree (with emissive string-lights).
9. *(optional)* `ground.glb` / terrain — or I keep the procedural ground.

## 6. Naming (so I can wire interaction + animation)
Give clear, lowercase, hyphenated names to anything I must find, click, glow, or
animate — I target them by name after loading:
`shelf`, `poster`, `speedometer-needle`, `wheel-fl/fr/rl/rr…`, `firebox`,
`lamp-1…`, `window-…` (emissive), `signal-v`, `signal-y`.

## 7. What you are NOT losing
The engine stays and your models plug into it: the scroll-driven camera journey
with the station holds, the V/Y track logic, atmosphere (fireflies/fog/mist),
audio (ambient/rumble/whistle/chime), loader, nav, modals, the project-card
system, the contact/footer finale, progress rail, mobile + no-WebGL fallback.
I'll also **rebuild the UI (cards, cursor, pop-ups, motion) to a higher bar** —
that's code, independent of Blender, and can happen while you model.

---
*Hand me the `.glb` files (drop them in `assets/models/`), and I'll wire them into
the journey, atmosphere, and UI.*
