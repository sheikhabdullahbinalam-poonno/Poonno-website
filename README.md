# iampoonno.com

An immersive, scroll-driven 3D storytelling website for **Sheikh Abdullah Bin Alam ("Poonno")** — athlete, creative director, and commercial leader. The visitor boards a night train and travels through a mystical forest, stopping at stations that reveal each side of Poonno's story, until two tracks converge toward an unwritten future.

## What this is

A cinematic WebGL experience built with **Three.js**. Scroll drives a single camera journey: a forest platform at dusk → the driver's cab → Creative Origins Station → a junction → Unilever Station → the convergence → a final tree where you can connect.

The complete design, flow, parameters, and phase-by-phase build plan live in **[`CREATIVE_DIRECTION.md`](./CREATIVE_DIRECTION.md)** — that file is the single source of truth.

## Tech

- **Three.js 0.160** (WebGL) + postprocessing (bloom, vignette, grain)
- Detailed PBR materials, environment-map reflections, optional glTF models
- Vanilla HTML/CSS/JS — no framework required
- Real audio (whistle, ambient platform loop, train rumble, UI chime)

## Run locally

This is a static site; serve it over http (not `file://`):

```bash
# from this folder
python3 -m http.server 8080
# then open http://localhost:8080
```

(or `npx serve` if you prefer Node.)

## Project structure

```
CREATIVE_DIRECTION.md   # the build bible / spec (for Claude Code)
HOW_TO_TALK_TO_CLAUDE_CODE.md  # plain-language feedback guide (for you)
index.html              # the final experience (Claude Code builds this)
LICENSE                 # copyright / all-rights-reserved notice
assets/                 # audio, images, cv, models, textures
References/              # visual references (livery, cab, stalls, etc.)
Poonno Signature.svg    # signature logo (loader + nav)
```

## Build approach

Built in phases, with a git checkpoint after each working phase (see `CREATIVE_DIRECTION.md` §11). To roll back: `git log --oneline` then `git reset --hard <commit>`.

## Deploy

GitHub Pages from `main` (repo Settings → Pages). Custom domain: **iampoonno.com** via a `CNAME` file + DNS.

## Credits

Design, content, and creative direction: Sheikh Abdullah Bin Alam (Poonno).
Audio and reference imagery: provided by Poonno.
Website by Poonno & [Medha](http://znsharif.com/).

## License

© 2026 Sheikh Abdullah Bin Alam. All rights reserved. This work is proprietary —
do not reproduce without permission. See [`LICENSE`](./LICENSE) for details.
Third-party assets (Three.js, fonts, audio, any sourced models) remain under their
own licenses.
