# iampoonno.com — Build Bible & Self-Executing Spec

**For:** Sheikh Abdullah Bin Alam ("Poonno") — an immersive, scroll-driven 3D night-train story site.
**This file is the single source of truth.** Claude Code: read this file top to bottom, then build the site exactly as specified, **one phase at a time**, committing a git checkpoint after each phase. The user will not give you further prompts — everything you need is here.

---

## 0. INSTRUCTIONS TO CLAUDE CODE (read first, follow exactly)

1. **Work in phases.** Build ONLY the phase you are currently on (Section 11). Never attempt the whole site in one pass.
2. **After each phase:** start a local preview (`python3 -m http.server 8080` from the project folder, or `npx serve`), open it, and verify the phase's **Acceptance Check**. Fix until it passes.
3. **Checkpoint every working phase** with git:
   ```bash
   git add -A
   git commit -m "Phase N: <short description>"
   ```
   This is the safety net. If a later change breaks something, recover with:
   ```bash
   git reset --hard HEAD        # discard uncommitted breakage
   # or, to go back to an earlier good phase:
   git log --oneline            # find the last working commit
   git reset --hard <commit>
   ```
4. **Static site, served over http for full fidelity.** Build a static site (HTML/CSS/JS, no framework required) and **always preview via a local server** (`python3 -m http.server 8080`), never `file://`. Serving over http unlocks image textures, environment maps, and glTF models — use them freely to maximise detail (the site deploys to GitHub Pages, also http). Organize code into clear modules (e.g. `js/scene/…`, `js/data/…`) or a clearly-sectioned `index.html` — keep it readable.
5. **Go for detailed, beautiful realism — NOT low-poly.** Use PBR materials, image-based textures (albedo / normal / roughness / metalness), an **environment map** for real reflections, high-quality post-processing (bloom, SSAO if affordable, subtle DOF, grain, vignette), and **glTF models** where they raise quality. Procedural geometry + canvas textures are welcome where they already look great, but you are NOT limited to them. Store textures/models under `assets/` and load with `TextureLoader` / `GLTFLoader` (works because we serve over http). Aim for cinematic, atmospheric beauty held together by Section 4.5.
6. **Pin the Three.js version** to `0.160.0` via the importmap (already proven). Use only `three` + the addons listed in Section 3.
7. **Build the production site fresh as `index.html`.** A v1 prototype exists as **`prototype-v1.html`** — use it ONLY as a reference for *interaction logic, data wiring, audio handling, and the scroll→camera mapping* (these already work). Do **NOT** copy its visual style — it is intentionally simplified and this spec targets detailed realism (§4.5). Do not edit or delete `prototype-v1.html`; leave it as a reference. The real site lives in a new `index.html`.
8. **Honor the asset filenames exactly** (Section 2) — they contain spaces; `encodeURI()` them in JS.
9. **When the whole spec is built and all phases pass**, do a final commit `Phase 9: polish + deploy-ready` and print the deploy steps (Section 14) for the user.

---

## 1. CONCEPT

Poonno is one person seen through three windows — **athlete, creative director, commercial leader**. A night train carries the viewer through each, and at the end two tracks converge into one toward an unwritten future. Mood: **nocturnal, warm, mystical-forest nostalgia, cinematic, unhurried.** The world is cool (blue/steel); the light is warm (firefly gold). Every interactive object glows warm.

---

## 2. ASSET INVENTORY (already in this folder)

| File | Use |
|---|---|
| `Poonno Signature.svg` | The signature logo. `viewBox="0 0 125 71"`, 4 `<path>`s. Used in (a) the loading animation as a **stroke draw-on**, and (b) the **nav bar logo** (left). DOM/SVG only — never a WebGL texture. |
| `Sheikh_Abdullah_CV_2026.pdf` | The downloadable CV. Wire every "Download CV" button to this (`download` attribute). |
| `Sheikh_Abdullah_CV_2026.docx` | Source of the PDF; ignore at runtime. |
| `Whistle 1.mp3`, `Whistle 2.mp3`, `Whistle 3.mp3` | Whistle SFX. On each whistle-rope pull, play the next from a **reshuffled random bag** (no immediate repeat; reshuffle when all 3 used), + steam puff + camera shudder. |
| `ambient platform loop.mp3` | Looping ambient bed; **starts on the "Enter" tap** (feels auto), with a mute toggle (Section 8). |
| `Train Rumble.mp3` | Looping low rumble layered under the ambient bed; also rises during the "gaining speed" beat. |
| `Soft UI Chime.mp3` | Plays on every modal open. |

In **Phase 0**, create an `assets/` folder and move these into `assets/audio/`, `assets/img/` (svg), `assets/cv/` (pdf); update references. Keep the original `.docx` out of the deploy.

---

## 3. TECH STACK & SETUP

- **Three.js `0.160.0`** via importmap (CDN). Addons used: `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass` (postprocessing). No bundler, no framework.
- **Fonts** (Google Fonts): `Sacramento` (script fallback for signature contexts), `Fraunces` (serif headings), `Inter` (UI/body).
- **Preview:** static server (`python3 -m http.server 8080`). **Deploy:** GitHub Pages (Section 14).

Importmap (use exactly):
```html
<script type="importmap">
{ "imports": {
  "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
  "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
}}
</script>
```

---

## 4. ART DIRECTION (design tokens)

| Token | Hex | Use |
|---|---|---|
| `--night` | `#0B1622` | Deepest sky / fog base |
| `--dusk` | `#1C2E40` | Mid sky, shadow |
| `--steel` | `#2E4255` | Structures |
| `--haze` | `#5C7A99` | Distant fog, Unilever accent |
| `--firefly` | `#FFD37A` | Fireflies, lamps, key accent |
| `--ember` | `#F4A259` | Warm signage, creative accent, hovers |
| `--cream` | `#F5EBDC` | Text, signature |
| `--rust` | `#8A4B38` | Vintage train/wood accents |
| `--moss` | `#3E5641` | Forest, finale tree |
| `--br-blue` | `#2E6FB0` | **Whole train** upper body — Bangladesh Railway blue (locomotive **and** carriages) |
| `--br-cream` | `#E9D9A8` | Lower body & window band — cream |
| `--br-red` | `#B23A2E` | Waistline stripe + front buffer beam — red accent |
| `--br-yellow` | `#E8B23A` | Handrails, footplate & trim — yellow |

**Typography:** signature = the SVG; headings = Fraunces 600; body/UI = Inter. **Lighting:** cool hemisphere + dim moon directional; warm point/emissive from lamps, train windows, stall bulbs. **Atmosphere:** `FogExp2` (~0.009) hugging the ground; **fog should visibly drift in from the screen sides** at the platform (animated sprite planes / large soft particles). **Post:** `UnrealBloom` (strength ~0.85, radius ~0.6, threshold ~0.2), plus subtle film grain + vignette (can be a CSS overlay). **ACES** tone mapping, exposure ~1.05.

---

## 4.5 COHESION & STYLIZATION — non-negotiable, read carefully

The single biggest quality risk is **things feeling out of place** — one element too crude next to another too refined, or a clash of mood. Hold the whole world to ONE consistent look:

- **Target style: detailed, cinematic, atmospheric realism.** Richly modeled forms, PBR materials, real reflections from an environment map, believable wood/metal/fabric/concrete textures, soft volumetric-feeling fog and bloom. Beautiful and detailed — **not** low-poly, **not** cartoonish. The reference renders (e.g. the blue loco) are for **livery and proportion**, *not* for a faceted low-poly look — build the real thing, detailed. Every object — train, cab, stalls, trees, platform, props — sits in this same high-fidelity register so nothing looks cheaper or shinier than its neighbour.
- **One wear level everywhere: "restored nostalgia, not decay."** Vintage and warm, lightly weathered — never pristine showroom, never broken/rusted-out. The loco, carriages, wooden stalls, torn poster, and platform all sit at the *same* age. The poster is the only object with visible "tearing," and even it is gently aged, not grungy.
- **Unified light & atmosphere:** every scene shares the same dusk-blue ambient + warm key, the same environment map, the same `FogExp2` density/color, the same bloom amount, the same firefly gold. Any new object must be lit by the existing scene lights + env map — no object carries its own mismatched lighting. Reflections/speculars stay soft and warm (wet-platform sheen, brass glints, glossy loco paint) so nothing looks plasticky or flat.
- **Palette discipline:** only the tokens in Section 4. Cool world, warm light. Creative accent = ember; Unilever accent = steel-blue. Don't introduce new hues per object.
- **Sound matches picture:** ambient bed + low rumble sit *under* everything quietly; whistle and chime are events, not constant. Balanced so audio feels like the same place the visuals show — a quiet forest platform at night.
- **Consistency test (before each commit):** screenshot the new scene next to the platform scene. If any element reads as "from a different project" — too flat, too shiny, wrong age, wrong light, less detailed — fix it before committing. Go all-out on polish *toward this unified cinematic mood*.

---

## 5. THE SCROLL FLOW — full timeline with parameters

Scroll drives a single normalized progress `t` (0→1). The camera follows a keyframe spline; **damp** the camera toward its target each frame (lerp factor ~`dt*3.5`) so motion is smooth, never snapping. **Several bands are HOLD zones** where the camera stays near-static at a station so the viewer can explore — implement holds by giving adjacent keyframes near-identical positions across that t-range.

Beats map to the user's 15 points:

| t-band | Beat | Camera behaviour |
|---|---|---|
| **0.00–0.05** | **Platform arrival (HOLD)** | POV stands on the platform in the **"T" view** — perpendicular to the train so the blue/cream/red BR locomotive + carriages span **horizontally across the screen**. Lit windows, mystical forest + woods behind, **fog drifting in from the sides**, fireflies entering, **cursor interacts with the fireflies/fog** (6.12). Feels like *you just arrived and the train is waiting*. |
| 0.05–0.12 | Board | Camera glides forward toward the train and transitions inside to the **driver's cab** (a smooth storytelling cut through the doorway — no need to physically walk the length of the loco). |
| **0.12–0.22** | **Driver's compartment (HOLD)** | Inside the driver's cab (ref: `Train Engine compartment interior.png`): gauges, brass pipes, levers, firebox glow, window to the dusk yard. On the **left wall: the 3-tier shelf** + the **"Who is Poonno" torn poster**. Camera mostly still with a gentle 1° sway. **Click-guidance** appears on shelf + poster (Section 8). |
| 0.22–0.30 | **Gaining speed** | Camera stays inside and tilts/pushes toward the **speedometer/odometer**; needle climbs. **Train-jerk**: rhythmic camera shake (small vertical + lateral jolts on a ~0.45s beat, amplitude rising with "speed"). `Train Rumble.mp3` swells. |
| 0.30–0.40 | Lift to bird's-eye | Camera dollies up and back to a 3/4 **bird's-eye**; the train is seen from above gliding through moonlit forest toward Creative Origins. |
| **0.40–0.52** | **Creative Origins Station (HOLD)** | Camera flies down to the platform and **holds**. Five stalls to explore. Station **nameplate** reads "CREATIVE ORIGINS" (ref: `Name plate.webp`). Viewer clicks stalls at their own pace. |
| 0.52–0.58 | Re-board + rise | On scroll, camera returns to the train, then flies up to bird's-eye. |
| 0.58–0.64 | **"V" junction → bank LEFT** | The track splits in a **V**; the train takes the **LEFT** branch (never the right) toward Unilever. The right branch trails off. |
| 0.64–0.66 | Approach | Train runs the left track toward Unilever Station. |
| **0.66–0.78** | **Unilever Station (HOLD)** | Camera flies down and **holds**. Four stalls. Nameplate "UNILEVER STATION". Explore at will. |
| 0.78–0.84 | Re-board + rise | Camera returns to train, flies up, **reveals the "Y" junction ahead**: one track from Unilever + one track from Creative Origins **merge into one**, leading toward the great tree. |
| 0.84–0.92 | Toward the tree | Train glides along the merged single track toward the glowing finale tree on the horizon. |
| **0.92–1.00** | **Horizons Crossing (END)** | Camera descends; the viewer **steps down** under the great firefly-strung tree. Contact panel: **"Let's cross paths. Horizons Crossing"** with LinkedIn / WhatsApp / Email. |

**Reference camera keyframes** (tune visually; world laid out along −Z, left = −X):
```
t .00  pos(12, 2.6, 4)   look(0, 2.2, 4)     // "T" view: perpendicular to train side, train spans the screen left-to-right
t .05  pos( 2, 2.0, 9)   look(0, 2.0, 2)
t .12  pos( 0, 1.7, 0.6) look(-1.4, 1.6, -1) // inside cab, toward shelf/poster (left)
t .22  pos( 0.2,1.6,0.2) look(1.2, 1.3, -1.2)// toward gauges/odometer (right console)
t .30  pos( 0, 12, -30)  look(0, 1, -70)     // lift to birds-eye
t .40  pos( 0, 3.2,-178) look(3, 1.8, -192)  // creative platform (HOLD start)
t .52  pos( 0, 3.0,-198) look(3, 1.6, -202)  // creative platform (HOLD end)
t .58  pos( 0, 16,-220)  look(0, 1, -250)    // birds-eye over V junction
t .64  pos(-3, 12,-255)  look(-5, 2, -290)   // banking left
t .66  pos(-1, 3.2,-285) look(-5.5,1.6,-298) // unilever platform (HOLD start)
t .78  pos(-1, 3.0,-303) look(-5.5,1.6,-300) // unilever platform (HOLD end)
t .84  pos( 0, 20,-330)  look(0, 1, -365)    // birds-eye over Y junction
t .92  pos( 2, 3,-360)   look(7, 2.5, -372)  // arriving at tree
t 1.0  pos( 4.5,1.7,-366)look(7, 3, -372)    // stepped down, under tree
```
Scroll spacer height ≈ `820vh`. `t = scrollTop / (scrollHeight - innerHeight)`.

---

## 6. SCENE COMPONENTS — detailed spec

**6.1 Platform & waiting train (refs: `Train Engine.png`, `Carriage.webp`).** A worn concrete platform with a flat canopy roof on posts. The train = a **Bangladesh Railway diesel locomotive (engine) at the front + matching passenger carriages behind**, ALL in the same **blue / cream / red** BR livery (detailed, not low-poly).

**Opening composition — the "T" view.** The viewer stands on the platform looking **straight at the side of the train, perpendicular to it**, so the train runs **horizontally across the screen** (the cab + carriages span left-to-right) and the viewer's line of sight is the vertical stem — together forming a **"T"**. Frame the whole train side-on: you see the driver's cab and the carriages in one composition, waiting. (Not a head-on look down the tracks.)

- **Locomotive (engine)** — model on `Train Engine.png` for *livery and proportion* (the reference happens to be a low-poly render — **build it detailed**, not faceted): blue upper body with glossy paint, cream/sand lower band, yellow handrails, footplate & trim, red front buffer beam, the round BR monogram on the nose, ribbed hood vents, six-wheel bogies, roof horn, headlamp. **Diesel on the outside — but a steam engine on the inside** (see 6.2), so the steam puff + whistle + firebox feel real, not arbitrary. **The driver's cab is the front of this loco.** Hero object — give it the most detail.
- **Passenger carriage(s)** behind — **blue body + cream window band + red waistline stripe** (match the loco, NOT green/red), rows of warmly lit windows, gently rounded roof, visible rivets/panel lines, undercarriage detail.

Build with detailed geometry + PBR textures (normal/roughness) and the shared env map for paint reflections. Forest of tall conifers + dense woods behind; ground fog drifting **in from both screen sides** (animated); fireflies entering; distant warm station lamps. The hero first impression — *you arrived at a forest station and the train is waiting.*

**6.2 Driver's compartment — a steam cab inside a diesel body (ref: `Train Engine compartment interior.png`).** Even though the loco is a diesel on the outside, the **inside is a classic steam engine cab** — that's what justifies the steam, whistle, and firebox. Build it **detailed and realistic**: riveted steel/blue walls, worn wooden/metal floor, a **window to the dusk railyard** (a real rendered view or a high-res blurred-yard texture), a **brass-and-iron boiler backhead** with pipes and valves, round brass **steam/pressure gauges** with glass, needles and tick marks — at least one large **speedometer/odometer** whose needle animates during the speed beat — red-handled **levers/throttle**, and a **firebox** with warm flickering light (its glow leaks into the cab). Overhead bulkhead lamp casting a real pool of light. Gentle continuous sway. Cab wear + lighting identical to the exterior (see 4.5).

**6.3 The 3-tier shelf (left wall) — clickable as ONE object → "Basketball Journey".**
- **Top shelf:** a **basketball** + a few **medals** (ribboned discs).
- **Middle shelf:** **trophies** (gold cups) + **more medals**.
- **Bottom shelf:** a folded **Poonno jersey #27** + a pair of **D Rose 3** shoes (ref: grey suede upper, red perforation accents, black + white midsole, red "rose/D" logo on the tongue — keep the grey/red/black colorway).
- **Hanging from the bottom shelf:** a **jersey on a hanger**, number **27** (hanging down).
- *Jersey number:* **27** (confirmed). Both the folded jersey and the hanging jersey read **27**. Use the `Poonno jersey.jpeg` reference for the jersey *style* (Bangladesh red/white), but the number is **27**.
Build the shelf as a wooden 3-tier frame; make the **entire group** a single click target (one invisible bounding-box mesh, or attach the same `userData.id='shelf'` to all child meshes so any click opens the basketball modal). On hover: the whole shelf warms/glows.

**6.4 "Who is Poonno" poster (next to the shelf) — clickable → bio.** An **old, weathered poster** with **torn/bruised edges** (canvas texture: aged paper, irregular ripped border drawn with jagged alpha, faded ink reading "WHO IS POONNO?", a small portrait silhouette). Slight curl/tilt. On hover: dims slightly then glows. Click → "Who is Poonno?" modal.

**6.5 Click-guidance (point 6).** Both the shelf and the poster must **invite clicks**: a soft **pulsing ring/halo** on each, a small floating **"Tap to explore"** label, and a one-time hint line on entering the cab (e.g., "Two things in here know Poonno best — give them a tap"). Hints fade once the object has been opened once.

**6.6 Station nameplates (ref: `Name plate.webp`).** Each station has a **nameplate sign on a post** (yellow board, dark bold text, like Indian/Bangladeshi junction boards): "CREATIVE ORIGINS", "UNILEVER STATION", and a final "HORIZONS CROSSING". Canvas-texture board on two posts, lit by a nearby lamp so it reads at night.

**6.7 Stalls / kiosks (both stations) — ref: Indian/Bangladeshi railway stall.** Match the provided *tong dokan* photo: a **front counter with a bold diagonal green/yellow paint split**, a flat tin canopy on metal posts overhead, a long **hand-painted signboard banner** across the top, a **bare tube/bulb light** under the canopy, stocked shelves/goods behind, and small **hanging bundles** (fruit/packets) at the canopy edge. For our stations the signboard carries the **brand/case name** (creative = amber banner, Unilever = steel-blue banner) in the same painted style. When the camera holds at the station, the **glass project cards (Section 8.1)** appear in front of the stalls; clicking a stall or its card opens that project's case detail. Stalls face the track so the held camera sees their fronts. Model them detailed (worn wood grain, tin ridges, the painted banner) in the same realistic register as everything else.

**6.8 "V" junction (after Creative).** A visible track split shaped like a **V**: incoming single track divides into left + right branches with a switch lever + signal light. The train clearly takes the **LEFT**; the right branch fades into fog.

**6.9 "Y" junction (after Unilever).** Two tracks — the Unilever branch and the Creative-Origins branch — sweep together and **merge into one** track (a Y), heading to the tree. This is the visual thesis: creative + commercial become one path forward.

**6.10 Finale tree.** A large tree (thick trunk + layered canopy), strung with ~24 firefly lamps, on soft grass. The merged track ends here. Calm open sky.

**6.11 Fireflies & fog.** Fireflies = instanced/Points with additive soft-glow sprite, sine-bob drift, ~300 desktop / ~120 mobile. Fog = `FogExp2` + a few large soft sprite planes that **slide in from the sides** at the platform and stations.

**6.12 Interactive cursor / pointer magic (activetheory.net-grade).** The world must feel alive under the pointer — this is a signature wow moment, strongest in the opening platform scene. Implement a **pointer field**: track the mouse/touch in screen space, raycast to a world point, and let nearby **fireflies be gently attracted toward (or softly part around) the cursor**, with a little lag/spring so it feels organic. Add a **soft warm glow / light that trails the cursor** (a sprite or a small moving point light) and let **fog subtly displace** near the pointer (offset a few fog sprites away from the cursor). Keep it performant (affect only the N nearest particles) and smooth (damped, no jitter). On touch devices, the finger does the same. Tune it to feel premium and responsive like activetheory.net — Claude Code may `WebFetch https://activetheory.net/` for inspiration on feel (do not copy assets/code). Disable under `prefers-reduced-motion`.

---

## 7. CONTENT DATA (paste verbatim into the DATA section)

**Basketball** (shelf modal — title "The game is never truly over"):
- *Milestones:* 2× MVP (2015, 2016) · Premier League Champion (2020) · Best Defensive Player (2025)
- *National Team:* Bangladesh U18 (2014) · Bangladesh U18 (2016) · Bangladesh U23 3x3 (2018)
- *Memorable Games:* NDC vs. St. Joseph Higher Secondary School — SIBT 2015 · Bangladesh vs. Sri Lanka — 2016
- *What Basketball Taught Me:* "Basketball has been one of the defining forces in my life. It taught me that consistency and disciplined effort matter more than talent alone. Through victories, setbacks, and recovering from ACL and meniscus injuries, the game built resilience, mental toughness, and a commitment to keep moving forward."

**Who is Poonno?** (poster modal — full text):
> If you're looking for a neat, one-line description, I'm afraid you've boarded the wrong train.
> Hi, I'm Poonno.
> Over the years, I've been a creative director, a brand builder, a spreadsheet enthusiast (yes, they exist), a data nerd, a problem solver, and a basketball player playing at the highest level as part of the Bangladesh National Team who still refuses to believe the game is ever truly over.
> Most people pick a track and stay on it. I got curious and explored a few.
> The first station takes you through my creative roots—where ideas, storytelling, and late-night brainstorming sessions became real projects. The second station explores my journey through Unilever, where I learned how products move, brands grow, and data tells stories that creativity alone cannot.
> And then comes the final station. The interesting thing is... it hasn't been built yet.
> Maybe it's a startup. Maybe it's a new business challenge. Maybe it's a team trying to solve a problem worth solving. Maybe it's you!
> What I do know is what I'll bring when I get there: the creativity to imagine, the commercial understanding to execute, the analytical mindset to measure, and the resilience to keep moving when things get tough. As basketball has always been the engine pulling me forward.
> So take a look around. If our paths happen to cross at the next station, perhaps we'll build it together. All aboard.

**Creative Origins — 5 stalls** (signboard = brand; modal = title, brand, challenge, tools, Behance link(s)):
1. **One Percent Basketball** — *Comprehensive Identity & Web Design.* Challenge: Creating a premium brand identity and web concept for a basketball training startup offering facilities, coaching, and a custom gear line. Tools: Figma, Blender, Photoshop. Links: **Brand Identity** → https://www.behance.net/gallery/136472045/One-Percent-Basketball-Brand-Identity · **Website Concept** → https://www.behance.net/gallery/136499733/1Percent-Website-Design-Concept
2. **Saleha Metal Industries** — *Industrial Corporate Rebranding.* Challenge: Modernizing an established manufacturer's legacy and vision into a single, high-impact logo. Tools: Figma, Photoshop. Link: https://www.behance.net/gallery/136465367/Saleha-Metal-Industries-Brand-Identity
3. **Favour Bank** — *Symbolic Visual Identity.* Challenge: Distilling a community organization's collective mission and core values into a unified brand mark. Tools: Figma, Illustrator, Photoshop. Link: https://www.behance.net/gallery/136451219/Favour-Bank-Brand-Identity
4. **Haval** — *Digital Marketing & Social Campaign Concept.* Challenge: Engineering high-impact visual solutions to elevate the brand's social media marketing presence. Tools: Figma, Illustrator, Photoshop. Link: https://www.behance.net/gallery/121028921/Haval-Social-Media-Marketing-Concept
5. **Cornucopia** — *Culinary Brand Identity & Launch.* Challenge: Building a distinct visual identity, custom illustrations, and digital footprint from scratch for a new eatery. Tools: Figma, Illustrator, Photoshop, Procreate. Link: https://www.behance.net/gallery/120529627/Cornucopia-Restaurant-Branding

**Unilever Station — 4 stalls** (signboard = case name; modal = Challenge / Approach / Impact / Tools / Key Learning, tagged by pillar):
1. **Project Pigeon** — *Pillar: Analytics & Automation.* Challenge: During periods of political disruption and national elections, market servicing became inconsistent and retailer communication heavily depended on field sales teams, creating gaps in communicating loyalty updates, payouts, and trade offers. Approach: Built an automated retailer communication system integrating the DMS with the Pushbullet API, delivering personalized SMS at scale with real-time loyalty/payout/offer visibility. Impact: ~9% increase in loyalty program depth · ~13% increase in width · significant order-volume uplift · eliminated manual communication · enabled engagement during unserviceable conditions. Tools: Excel VBA, Automation Workflows, Pushbullet API, Access Tokens, DMS Integration. Key Learning: Technology can solve distribution challenges more effectively than added manpower; scalable communication builds trust, consistency, and commercial impact.
2. **Town Mirror** — *Pillar: Analytics & Automation.* Challenge: After Unilever's move to Business-Unit-specific sales structures, management visibility fragmented; no single source of truth to monitor performance and intervene early. Approach: Built a BI dashboard consolidating BU performance, sales-officer productivity, route performance, loyalty execution, and distribution KPIs, with a flag-based framework auto-highlighting underperformance vs. time elapsed and potential. Impact: reporting accumulation time −67% · business visibility ×3 · instant identification of weak BUs/officers/routes · faster decisions & field intervention · complete snapshot via one interface. Tools: Power Query, DAX, Excel Data Modelling, KPI Framework Design, Performance Analytics. Key Learning: Analytics' value is revealing where action is needed before performance deteriorates, not just reporting the past.
3. **Dhaka EPZ Bifurcation & RTM Design** — *Pillar: Distribution & RTM Strategy.* Challenge: Design a new Route-to-Market model by dissolving Dhamrai into Dhaka EPZ, reducing dependence on garment billing cycles, ensuring geographic diversification, maximizing coverage, and keeping distributor returns attractive. Approach: Created a new 9 Cr/month Dhaka EPZ territory via bifurcation and restructuring of five adjacent towns; evaluated RTM scenarios with Cost-to-Serve, Distributor ROI, outlet-universe mapping, and route optimization; redesigned the sales structure from both legacy territories. Impact: launched a balanced 9 Cr/month territory · 18%+ first-year ROI · record 11.34 Cr in March 2025 · 6.1% YoY growth · diversified, sustainable base · improved coverage at low Cost-to-Serve. Tools: Cost-to-Serve Analysis, Route Geolocation Matrix, Market Assessment & Segmentation, Outlet Universe Mapping, Distributor Viability Model, Distributor ROI Model, RTM Design Framework, Network Optimization. Key Learning: The strongest networks are built for profitable coverage, sustainable growth, and operational resilience — not maximum coverage.
4. **Rin Execution Challenge** — *Pillar: Brand & Commercial Execution.* Challenge: Develop a market-execution campaign for the Rin relaunch to maximize visibility, strengthen recall, and create meaningful engagement in the territory. Approach: A localized 360° campaign on one insight — during Durga Puja, consumers want to celebrate without worrying about stains — integrating retail visibility, festival branding, community touchpoints, outdoor, branded tea stalls, backlit displays, signage, and Puja Mandap activations under one message linking celebration with Rin's cleaning power. Impact: significantly higher top-of-mind awareness · strong organic engagement & sharing · high visibility across touchpoints · **2nd place nationally** in the Rin Execution Challenge. Tools: 360° Campaign Design, Trade Marketing, BTL Activation, Retail Visibility, Shopper Marketing, POSM, Outdoor Branding, Community Activation, Experiential Marketing, Festival Marketing, Consumer Insight Mapping. Key Learning: The best campaigns are built around local cultural moments and consumer behavior, so the brand becomes part of the experience rather than advertising around it.

**Contact (Horizons Crossing):** heading "Let's cross paths." / subhead "Horizons Crossing" — LinkedIn `https://www.linkedin.com/in/poonno/` · WhatsApp `https://wa.me/8801844681862` · Email `mailto:Sheikhabdullahbinalam@gmail.com`. Keep "Download CV" pinned in nav throughout.

**Footer (very bottom of the final section, small & subtle, under the contact links):**
- Credit line: `Website by Poonno & Medha` — with **"Medha" hyperlinked** to `http://znsharif.com/` (open in a new tab, `rel="noopener"`).
- Copyright line beneath it: `© 2026 Sheikh Abdullah Bin Alam. All rights reserved.`
- Usage notice beneath that (even smaller): `Do not reproduce without permission.`
Style all three in the small mono/uppercase footer type, low-emphasis (haze/cream at reduced opacity) so they sit quietly beneath the warm contact panel. (A matching `LICENSE` file lives in the repo root.)

**Nav:** left = signature SVG (click → scroll to top). Center = **Whistle Rope**. Right = `Download CV`, `Creative Origins` (→ t .40), `Unilever Station` (→ t .66), `Horizons Crossing` (→ t 1.0).

---

## 8. INTERACTION & UX

- **Modals = designed cards, never plain text.** Every popup is a styled card: a header band in the section's accent color, a kicker/eyebrow label, clear typographic hierarchy (Fraunces headings, Inter body), thin dividers between sub-sections, small line-icons, and a faint themed background texture. They dim the canvas, the target object glows/scales slightly, the panel slides up; Esc / outside-click / × closes; camera holds while open; `Soft UI Chime.mp3` on open.
  - **Basketball card (give this extra love):** a header banner carrying a **#27 jersey motif** and the title "The game is never truly over"; the four blocks (Milestones / National Team / Memorable Games / What Basketball Taught Me) each led by a small icon (trophy, flag, ball, quote); a very subtle court-line or basketball-pebble texture in the card background; accent = ember/firefly. It must read as a crafted card, not a wall of text.
- **Whistle rope:** random-bag whistle + steam puff + brief camera shudder (skip shudder if `prefers-reduced-motion`). The steam/firebox are fully justified now — the loco has a **steam engine inside** (6.2).
- **Audio that starts on entry (like activetheory.net), not a buried toggle.** Browsers block sound until the first user gesture, so gate the experience behind a one-time **"Enter"** moment: when the loader finishes, show a gentle pulsing prompt (e.g. *"tap to begin ♪"*). The viewer's tap/click both reveals the scene AND starts the ambient bed (`ambient platform loop.mp3` + low `Train Rumble.mp3`, looped) — so it feels like it auto-plays. Always show a small **mute/unmute** control thereafter. Respect a returning visitor's mute choice.
- **Interactive cursor (activetheory-style) — see 6.12.** From the very first scene, moving the mouse/finger stirs the world (fireflies drawn toward or parting around the pointer, fog displaced, a soft glow trailing the cursor). This is a signature "alive" touch — make it feel as responsive and premium as activetheory.net.
- **Progress rail:** thin firefly line with ticks at the station t-values; fills with scroll.
- **Click-guidance:** pulsing halos + "Tap to explore" on shelf, poster, and every stall; a scroll hint on the platform.
- **Reduced motion:** replace camera dolly with cross-fades between still "postcard" framings of each beat; disable jerk/shudder/sway and the cursor-attraction.

---

## 8.1 WORK / CASE-STUDY CARDS — modeled on activetheory.net/work (the project cards)

Governs the **Creative Origins projects (5)** and **Unilever cases (4)**. This spec is based on a direct review of Active Theory's live `/work` cards + a screen recording. **Capture their structure, motion, and glass feel — but skin it in OUR warm dusk/firefly palette, not their dark-cyber look.** Do NOT copy their assets or code; Claude Code may `WebFetch https://activetheory.net/work` for feel.

**Layout — a 3D card carousel (coverflow), not a flat row.** When the camera **holds** at a station, the projects appear as a horizontal carousel of large floating cards: ONE big **center (active) card**, with the others **smaller, angled inward, and receding** into the fog on each side. It floats in front of the station inside our dusk scene (fireflies + fog behind), with a faint dark scrim for legibility. Creative = **ember** accent, Unilever = **steel-blue** accent.

**The card.** A large rounded rectangle with subtly **notched / chamfered corners** (the Active Theory signature shape). **Glass:** translucent, faint film grain, soft edge-light, gentle inner glow, light depth shadow. The **active card's face** shows the **brand wordmark (small) + project title in large glowing type**, sitting over a soft, slowly drifting accent-tinted hero. (We have no project videos, so the hero = the brand color + a moving firefly/sheen texture; a real project still can be dropped in later, optional.)

**Navigation + hover — the moment you love.**
- Flip projects with **prev/next arrows that show the project name** between them (`‹  ONE PERCENT BASKETBALL  ›`), plus arrow keys, scroll, or drag; or **click a side card** to bring it to center.
- **Hover on the active card:** it **tilts toward the cursor** (parallax — the title layer floats above the glass), a **diagonal light sheen sweeps across the glass**, a faint shimmer/grain animates, and the edge-light + brand glow intensify. Side cards lean slightly toward the pointer. Magnetic, springy, damped — buttery, never jittery.

**Transition — fireflies (our take on their particle dissolve).** Active Theory switches cards by **disintegrating them into thousands of particles** that swirl and reform into the next. We do the same — but the particles are **fireflies / embers**, which is perfectly on-theme: the outgoing card **bursts into a swarm of glowing motes that coil and re-coalesce** into the next card (or into the opened detail, and back on close). This coiling reform IS the "spiral" feel. Use it for flips and open/close.

**Open — the case detail (bottom-left panel).** Clicking the active card settles it center (notched corners, hero playing) and slides a **detail panel in at the bottom-left**, in **uppercase, letter-spaced monospace** type (Active Theory's technical-editorial feel) — cream + accent over our dusk:
1. **TITLE** — project title (large).
2. **META line** — `YEAR / CLIENT / CATEGORY` in the accent color. (Creative e.g. `BRAND · IDENTITY & WEB`; Unilever e.g. `PILLAR: ANALYTICS & AUTOMATION`.)
3. **DESCRIPTION** — the project's short narrative. Unilever cards then stack the labelled blocks **Challenge / Approach / Impact / Tools / Key Learning** with hairline dividers.
4. **LINKS** — `VIEW CASE STUDY →` to **Behance** (One Percent shows two: `BRAND IDENTITY` / `WEBSITE`).
5. **‹ CLOSE** — dissolves the card back into the carousel (firefly transition).
`Soft UI Chime.mp3` on open.

**Type & feel.** Meta lines, labels, and links in an **uppercase, letter-spaced monospace** webfont (e.g. Space Mono / IBM Plex Mono) for the Active Theory technical feel; large titles may use that mono-caps or Fraunces — pick one and stay consistent. All motion eased/damped, 60fps, `backdrop-filter` glass, CSS transforms. Under `prefers-reduced-motion`: drop the tilt / sheen / firefly-dissolve — the carousel becomes a simple list and transitions cross-fade.

*(Cohesion: these cards share the warm-glass look with the cab's basketball/"Who is Poonno" modals (Section 8) so the site feels like one family. The card world lives INSIDE our dusk/firefly scene — it must never look like a separate dark-cyber app. The optional central "sculpture/spine" element Active Theory floats behind its carousel is NOT needed; our fireflies carry that role.)*

---

## 9. 3D MODELING — detailed first, procedural where it shines

Prefer the path that looks best. **glTF models and image textures are encouraged** (we serve over http) for the hero pieces — especially the locomotive, carriages, cab interior, and finale tree — whether authored, sourced CC0 (Poly Pizza / Sketchfab CC0 / Quaternius), or built detailed in code. Where procedural geometry already looks great (rails, sleepers, fog, fireflies, simple props), keep it. Either way, apply PBR materials + the shared env map so everything reflects the same world. Primitive-build guidance (use as a floor, then add detail/textures/normal maps):
- **Carriage / loco / cab:** `BoxGeometry` bodies; rounded roof = squashed `CylinderGeometry`; wheels = `CylinderGeometry` rotated; rivets = small spheres or a canvas bump pattern; windows = emissive planes; livery stripes = thin boxes or a texture painting the blue/cream/red bands.
- **Gauges:** `CircleGeometry`/`RingGeometry` with a **canvas dial texture**; needle = thin box rotated by a value you animate.
- **Shelf items:** ball = `SphereGeometry`; trophy = `CylinderGeometry` cup + stem + base; medal = thin `CylinderGeometry` + ribbon plane; jersey = thin box / `PlaneGeometry` with a canvas texture (number **27**); shoe = rounded box cluster.
- **Stalls, posters, nameplates, signboards:** geometry + **canvas textures** (Section 10).
- **Trees:** trunk `CylinderGeometry` + canopy `ConeGeometry`/`SphereGeometry`. Finale tree = bigger, layered.
- **Junctions (V & Y):** rails are thin boxes laid along computed paths; draw the V and Y by positioning two rail lines that split/merge; add `BoxGeometry` sleepers and a switch-lever + signal sprite.
- **Fireflies/fog:** `Points` + additive glow sprite; fog sprites = large `PlaneGeometry` with soft radial canvas alpha.

**Reflections:** load an HDR/equirectangular **environment map** once (a dusk/night sky) and assign it as `scene.environment` so all PBR materials get consistent reflections — this is a big part of the "detailed, cohesive" look.

---

## 10. CANVAS-TEXTURE RECIPES

Write small helper functions that draw to an offscreen `<canvas>` and return a `THREE.CanvasTexture`:
- `signTex(name, accentHex)` — cream board, accent top/bottom stripes, bold Georgia text auto-fit, inner border. (Stall signboards.)
- `nameplateTex(name)` — yellow board, dark bold condensed text, thin border (ref: `Name plate.webp`).
- `posterTex()` — aged paper gradient, blotches, **jagged torn-edge alpha**, faded "WHO IS POONNO?" headline + portrait silhouette + body lines.
- `gaugeTex(label)` — dark dial face, tick marks, numerals, label; needle drawn separately as geometry.
- `liveryTex()` — horizontal **blue/cream/red** bands for the carriage & loco sides.
- `glowTex()` — radial white→firefly→transparent (fireflies, lamps, halos).
- `yardTex()` — blurred night railyard for the cab window.
Keep textures ≤512px; set `anisotropy`. All self-lit surfaces use `emissive`+`emissiveMap` so they read at night.

---

## 11. BUILD PHASES (do these in order; commit after each)

**Phase 0 — Project & safety net.** Organize assets into `assets/…`; generate a short **`README.md`** (project name, what it is, how to run locally `python3 -m http.server 8080`, tech, credits) and a **`.gitignore`** (ignore `.DS_Store`, `*.tmp`, `*.docx`, `.~lock*`, `node_modules`); `git init`; first commit `Phase 0: scaffold + assets`. Then connect the user's GitHub remote and push (see Section 12):
```bash
git remote add origin https://github.com/sheikhabdullahbinalam-poonno/Poonno-website.git
git branch -M main
git push -u origin main
```
*Acceptance:* `git log` shows one commit, assets resolve, README + .gitignore exist, and the commit appears in the GitHub repo.

**Phase 1 — Skeleton + scroll spine.** `index.html`, canvas, renderer, fog, dusk sky, hemisphere+moon light, bloom, the `t` scroll mapping, and a camera that travels the Section-5 keyframes (grey-box world). *Acceptance:* scrolling moves the camera smoothly through all bands incl. the HOLD plateaus. Commit `Phase 1: scroll spine + camera`.

**Phase 2 — Atmosphere + cursor magic + enter/audio.** Fireflies (instanced, sine-bob), side-drifting fog sprites, lamp glows, grain+vignette overlay, loader with the **signature SVG draw-on**, nav bar with the **signature logo**, the **interactive pointer field** (6.12 — fireflies/fog react to the cursor + a glow trail), and the **"Enter" gate** that starts the looping ambient audio on first tap (8) with a mute control. *Acceptance:* dusk mood reads; loader plays once; tapping "Enter" starts the sound and reveals the scene; moving the cursor visibly stirs the fireflies/fog. Commit `Phase 2: atmosphere + cursor + audio + nav`.

**Phase 3 — Platform & waiting train (refs: `Train Engine.png`, `Carriage.webp`).** Platform, canopy, forest/woods, the **blue/cream/red BR locomotive + matching carriages** with lit windows, detailed PBR + env-map reflections; opening framing reads like the references. *Acceptance:* t≈0 looks like "arrived at a forest station, train waiting" and the train is detailed, not low-poly. Commit `Phase 3: platform + train`.

**Phase 4 — Driver's compartment (ref: `Train Engine compartment interior.png`) + shelf + poster.** Cab interior, gauges/levers/firebox/window; the **3-tier shelf** (exact items, hanging #27 jersey) clickable as one → basketball modal; the **torn "Who is Poonno" poster** → bio modal; **click-guidance** halos + hints; modal system; chime; Download CV. *Acceptance:* both interactives open correct modals; guidance is obvious. Commit `Phase 4: cab + shelf + poster + modals`.

**Phase 5 — Gaining speed.** Odometer focus + needle climb + **train-jerk** shake + rumble swell across t .22–.30. *Acceptance:* feels like accelerating on rails; settles before bird's-eye. Commit `Phase 5: speed + jerk`.

**Phase 6 — Creative Origins (HOLD) + stalls + glass cards + nameplate.** Bird's-eye transit, fly-down HOLD, 5 stalls with signboards, the **Active-Theory-style glass card carousel (Section 8.1)** — coverflow, magnetic hover/tilt, light-sheen, **firefly-dissolve transitions**, expand-to-case detail panel, Behance links (One Percent has two) — and the "CREATIVE ORIGINS" nameplate. *Acceptance:* camera holds; the carousel flips smoothly, the active card hovers beautifully, cards dissolve into fireflies on switch, the detail panel opens, and links work. Commit `Phase 6: creative station + glass cards`.

**Phase 7 — V junction → Unilever (HOLD) + stalls + glass cards.** Re-board, rise, **V junction banking LEFT**, fly-down HOLD at Unilever, 4 stalls with the same **glass card carousel (Section 8.1)** in steel-blue (detail panel shows Challenge/Approach/Impact/Tools/Key Learning), "UNILEVER STATION" nameplate. *Acceptance:* train clearly takes the left branch; station holds; the 4-card carousel flips, hovers, firefly-dissolves, and expands to full case detail. Commit `Phase 7: V junction + unilever station`.

**Phase 8 — Y junction + finale.** Re-board, rise, **Y junction merge**, glide to the **finale tree**, step-down, "Let's cross paths. Horizons Crossing" contact (LinkedIn/WhatsApp/Email), and the **footer** ("Website by Poonno & Medha" with Medha → `http://znsharif.com/`, plus the © line). *Acceptance:* two tracks visibly merge; contact links work; footer credit shows with the Medha link working. Commit `Phase 8: Y junction + horizons crossing`.

**Phase 9 — Polish + responsive + deploy-ready.** Mobile (simplify particles, tap-to-glow, hamburger nav, DPR≤2), `prefers-reduced-motion` path, progress rail, whistle/ambient SFX final mix, perf pass (instancing, culling), `<title>` + meta description + **OG image** + **favicon from the signature**, relative asset paths, fallback for no-WebGL. *Acceptance:* 60fps desktop / 30fps+ mobile; reduced-motion works; loads clean; favicon + share preview show. Commit `Phase 9: polish + deploy-ready`, then print deploy steps.

---

## 12. GIT & GITHUB

This folder is **not yet a git repo**. The user's GitHub repo already exists:
**`https://github.com/sheikhabdullahbinalam-poonno/Poonno-website`**

In Phase 0, `git init`, commit locally, then add this remote and push (commands in Phase 0). Commit locally after **every** phase (rollback safety net) and push after each:
```bash
git push
```
If the push is rejected because the remote already has commits (e.g. an auto-created README), run `git pull --rebase origin main` once, then push. If auth is needed, the user signs in via the browser prompt (HTTPS) or has the GitHub CLI authenticated (`gh auth login`).

### Tooling for Claude Code (recommended, optional)
Claude Code already builds Three.js well and needs no special skill. For best results, add **Context7** so it references the current Three.js `0.160` API while coding:
```bash
claude mcp add --transport http context7 https://mcp.context7.com/mcp/oauth
```
Verify inside a Claude Code session with `/mcp` — `context7` should show **connected**.

---

## 13. REFERENCE IMAGES TO PROVIDE (helps fidelity; none are loaded at runtime)

All references are **provided** in the **`References/`** folder. **Open and view them** before modeling. They guide **livery, proportion, and detail — build detailed/realistic, never low-poly** (the loco render just happens to be low-poly; ignore its faceting, match its colors and shapes). You MAY also load them as textures where useful (we serve over http).

| File | Informs |
|---|---|
| `References/Train Engine.png` | The **locomotive** — blue/cream/red BR livery, monogram, proportions (6.1). Most important. |
| `References/Carriage.webp` | Passenger carriage shape/window band — **recolor to blue/cream/red to match the loco** (6.1). |
| `References/Train Engine compartment interior.png` | Driver's **cab** — gauges, pipes, levers, firebox (6.2). |
| `References/Name plate.webp` | Station **nameplates** — yellow board, bold text (6.6). |
| `References/Tong Dokan.jpg` | **Stalls** — green/yellow counter, tin canopy, hanging fruit, banner (6.7). |
| `References/Drose 3.jpg` | Shelf **shoe** — grey/red/black colorway (6.3). |
| `References/Poonno jersey.jpeg` | **Jersey** look (Bangladesh red/white); number is **27**; optional portrait for the basketball modal (6.3). |

If a detail is ambiguous, prefer a detailed realistic interpretation and keep the unified cinematic mood (4.5).

---

## 14. RESPONSIVE · ACCESSIBILITY · PERFORMANCE · DEPLOY

- **Mobile:** keep the spine, simplify geometry/particles, tap-to-glow, hamburger nav, DPR≤2.
- **Reduced motion:** cross-fade postcards instead of dolly; no jerk/shudder.
- **Performance:** instanced fireflies, frustum culling, lazy station geometry, textures ≤512px, target 60fps desktop / 30fps+ mobile.
- **Accessibility/SEO:** real `<h1>` + descriptive copy in DOM (visually hidden), `aria-label`s on nav/whistle, a `<title>`, a meta description, an **OG image** (the firefly title card), and a **favicon** made from the signature SVG.
- **Use RELATIVE asset paths** (`assets/…`, never `/assets/…`) so the site works both at the GitHub Pages project sub-path and at the custom domain.
- **Deploy (GitHub Pages):** push to `main`; in the repo **Settings → Pages → Source = `main` / root**. It first goes live at `https://sheikhabdullahbinalam-poonno.github.io/Poonno-website/`. Then for the custom domain: add a `CNAME` file containing `iampoonno.com`, set it under Settings → Pages → Custom domain, enable **Enforce HTTPS**, and at your domain registrar add DNS records — an `A`/`ALIAS` to GitHub Pages for the apex (`iampoonno.com`) and/or a `CNAME` for `www` pointing to `sheikhabdullahbinalam-poonno.github.io`. (Claude Code can give you the exact records.)

---

*Travel light. Let the train do the talking.*
