# How to Talk to Claude Code — A Plain-Language Guide

You're new to this, and that's completely fine. You do **not** need to know any technical words. Your job is to be the *director* — to look at what's on screen and say what feels right or wrong. Claude Code's job is to know the buttons to push. This guide shows you how to give that feedback simply and confidently.

---

## The one golden rule

**Describe what you SEE, then what you WANT — in everyday words.**

You never have to know *how* to fix it. "The train looks fake and shiny like plastic — I want it to look like real painted metal" is a perfect instruction. Claude Code figures out the rest.

---

## The simple feedback formula

When something isn't right, say three things:

1. **Where** — point at it ("the first scene", "the shelf in the train", "the station sign").
2. **What's wrong** — how it looks/feels to you ("too dark", "feels empty", "moves too fast").
3. **What you want** — the feeling you're after ("cozy and warm", "more alive", "slow and calm").

**Template you can copy:**
> "In **[where]**, the **[thing]** looks **[what's wrong]**. I want it to feel **[what you want]**."

**Examples:**
> "In the first scene, the fog looks too thin. I want it thicker and drifting in slowly from the sides so it feels mysterious."
>
> "The train looks flat and toy-like. I want it to look like a real, slightly worn painted metal train."
>
> "The basketball shelf is hard to notice. Make it glow more so people know to click it."

That's it. That formula handles 90% of everything.

---

## Plain-English dictionary (so the scary words stop being scary)

If Claude Code (or I) ever use a technical word, here's what it actually means — and how *you* could have just said it:

| The jargon | What it really means | How you'd say it |
|---|---|---|
| **Env-map / reflections** | Whether shiny things mirror their surroundings (so metal/paint looks real, not flat) | "the metal looks flat/fake — make it look polished and real" |
| **Buffer beam** | The red bar across the very front of the train | "the front of the train" |
| **PBR / materials / textures** | How surfaces look — wood grain, rust, fabric, paint | "make the wood look like real wood", "add a worn paint look" |
| **Bloom / glow** | The soft halo around lights | "make the lights glow softer/stronger" |
| **Fog density** | How thick the haze is | "more/less fog" |
| **Lighting / ambient** | How bright and what color the scene is lit | "warmer", "darker", "moodier", "too dim" |
| **Camera / dolly / pan** | The viewer's eye moving through the scene | "the view", "the camera", "how we move" |
| **FPS / performance / lag** | How smoothly it runs | "it's stuttering/laggy — make it smooth" |
| **Modal / popup** | The info card that opens when you click something | "the popup", "the info card" |
| **Asset** | Any file used — an image, sound, model | "the photo", "the sound", "the file" |
| **Responsive / mobile** | How it looks on a phone | "on my phone it looks ___" |
| **Geometry / mesh / model** | The 3D shape of an object | "the train", "the tree", "the shape" |
| **Emissive** | An object that gives off its own light/glow | "make it glow on its own" |

You can always just say: *"I don't know the word for it, but the thing that ___."* Claude Code will understand.

---

## Ready-to-use phrases by area

Copy/paste and tweak these. Plain words only.

### Mood & lighting
- "It feels cold and empty. Make it warmer and cozier."
- "Too dark — I can barely see the train. Brighten it a little but keep it nighttime."
- "It looks like daytime. I want dusk — that blue-gray, just-after-sunset feeling."
- "The whole thing feels flat. Add more depth and atmosphere."

### The train & engine
- "The train looks fake and plasticky. Make it look like real painted metal, a little worn."
- "The blue is too bright/cartoonish. Make it a deeper, more realistic railway blue."
- "It looks too clean and new. Add gentle wear so it feels vintage — but not broken or rusty."
- "The windows should look warmly lit from inside, like people are aboard."

### The driver's cab (inside)
- "The inside feels bare. Add more detail — gauges, pipes, levers — so it feels like a real engine room."
- "I can't tell the speed dial is important. Make the needle clearly move when the train speeds up."
- "It's too bright in here. Make it dim and warm, lit by one overhead lamp."

### Forest, platform, fog, fireflies, moon
- "I want more fireflies, drifting slowly, not too many."
- "The forest behind the train feels far away and fake. Make it denser and more present."
- "Add a moon in the sky for that mystical night feeling."
- "The fog should roll in from the edges of the screen, slowly."

### Stations & kiosks (stalls)
- "The stalls don't look Bangladeshi enough. Look at the Tong Dokan reference and match that feel."
- "I can't read the shop signs. Make the names bigger and clearer."
- "When I reach a station, the view moves on too quickly — let it stop so I can click around."

### Camera & movement (how we travel)
- "It moves too fast and makes me dizzy. Slow everything down."
- "The jump from inside the train to the bird's-eye view feels sudden. Make it smooth and gradual."
- "When the train speeds up, I want a gentle shaking like a real train on tracks — not too much."

### Sound
- "The whistle is too loud / too quiet."
- "The background sound should be quieter, just barely there."
- "Play the soft chime sound whenever a popup opens."

### Clicking & popups
- "It's not obvious I can click the shelf. Add a glow and a little 'tap to explore' label."
- "The popup text is too small and hard to read. Make it bigger with more spacing."
- "Closing the popup is confusing. Let me close it by clicking outside it or pressing Escape."

### Text & content
- "Fix the wording on the Project Pigeon card — here's the correct text: ___."
- "The font feels generic. Use something more elegant for the headings."

### When it runs badly
- "It's stuttering and laggy on my laptop. Make it run smoothly, even if you simplify some details."
- "It takes forever to load. Speed up the loading."

---

## When something breaks (your safety net)

You committed a checkpoint after each working phase, so you can always rewind. Say:

- **"That change broke it / I liked it better before. Go back to the last working version."**
- **"Undo the last change."**
- **"Show me what the site looked like two commits ago and go back to that."**

You will never lose your work. That's the whole point of the checkpoints.

---

## How to know a phase is "good enough" (so you don't fuss forever)

Before moving to the next phase, ask yourself:
1. Does it match what the spec described for this part?
2. Does it *feel* right — the mood, the pace?
3. Does everything I'm supposed to click actually work?

If yes to all three, say **"This looks great, commit it and move to the next phase."** Don't chase perfection on every tiny detail in one go — you can always polish more at the end. Getting all phases standing first, then doing a final "polish pass," works better than perfecting Phase 3 for hours.

---

## Phrases that DON'T help — and better versions

| Instead of... | Say... |
|---|---|
| "Make it better." | "Make the train look more realistic and worn." |
| "It's bad." | "The lighting feels cold — make it warmer." |
| "I don't like it." | "The camera moves too fast — slow it down." |
| "Add more stuff." | "The platform feels empty — add a bench, a lamp, and some luggage." |

The more specific the *feeling* you describe, the closer you'll get on the first try.

---

## A few power phrases that consistently work well

- "**Make it feel more cinematic and atmospheric**" — pushes overall richness and mood.
- "**Everything should feel like the same place at the same time of night**" — keeps it cohesive (nothing out of place).
- "**Show me before you commit**" — so you approve each step.
- "**Take a screenshot and compare it to the [reference] image**" — Claude Code can self-check against your references.
- "**Polish this until it looks professional, but keep the warm night mood**" — invites it to go all-out without breaking the vibe.

---

## Final word

You are the eyes and the taste. Claude Code is the hands. You don't need to speak its language — it speaks yours. Be honest about what feels off, describe the feeling you want, review each step, and rewind without fear if needed. That loop — *look, react, refine* — is exactly how the stunning version gets built.

You've got this. 🚂
