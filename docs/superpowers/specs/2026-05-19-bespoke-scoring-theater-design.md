# Bespoke Scoring Theater — Top 5 Design Spec

**Date:** 2026-05-19
**Status:** DRAFT — awaiting user review before implementation
**Author:** Brainstormed with user (senior UI/UX + game-feel framing)

## Goal

Take the scoring theater from "good Balatro clone" → bespoke, signature, fun. Build five moves that give each scoring moment a unique fingerprint:
1. Each **combo type** sounds and looks different (Pair ≠ Three of a Kind ≠ Straight)
2. Each **mod** has its own fire signature (Gilded ≠ Amplify ≠ Loaded)
3. **Mult tier escalation** earns visible rituals at thresholds (×4, ×8, ×16, ×32+)
4. **Cross-target** triggers the active constellation literally drawing across the playfield
5. **Held-breath** becomes a true cinematic freeze frame — film-paused punctuation before boom

## Engine context

- `Beat` union already carries `importance`, `triggerReason`, `targetId`, `retrigger`, `sourceType`, `sourceId`
- Sequence builder emits `combo-detect`, `combo-bonus`, `mult-slam`, `cross-target`, `hold-breath`, `boom`
- TheaterDirector emits `onTheaterPhase` (ramping / sustained / held-breath / release)
- ComboFlash exists with entrance/persistent/fading stages
- BeatTracer draws SVG arcs source→target with motes
- CatalystCard has `mat-pulse-fire` keyframe (wind-up + lift + spring)
- ScoringVFX has `fireConstellationSeal`, `fireConductiveArcs`, `fireSlam`, `fireBoom`, `fireStarRipple`
- audio/scoring.ts routes per-beat with importance gain + pitch ladder + chord stacks

All five moves layer on existing infrastructure — no new beat kinds needed.

---

## Move 1 — Combo-class signatures

### Intent
Every hand class has its own audiovisual signature played at `combo-detect` time. Beyond just the name flash, the player should *feel* what hand they played in the same way Balatro's "Full House" has a different rhythm than its "Pair."

### Per-combo signature table

| Combo | Visual cue | Audio cue | Duration |
|-------|------------|-----------|----------|
| **Chance** | Single soft pulse on ComboFlash | Single soft tone, low | 200ms |
| **Pair** | ComboFlash text bounces twice (double-pulse) | Two-note ascending interval | 320ms |
| **Two Pair** | Two parallel ripples flow outward from ComboFlash | Two stacked dyads | 380ms |
| **Three of a Kind** | Triplet drumroll on dice + ComboFlash flashes 3× | Triplet tom roll | 480ms |
| **Straight** | Sequential cascade ripple across dice positions L→R | Ascending arpeggio (5 notes) | 600ms |
| **Full House** | Layered chord visual: dual + triplet ripples overlapping | Major chord swell | 540ms |
| **Four of a Kind** | Thunder strike — bright flash + screen-shake-tiny | Thunder crack + low rumble | 560ms |
| **Five of a Kind** | Galactic burst — constellation accent pulses outward, brief time-dilation (200ms slow-mo) | Bell choir + sustained shimmer | 800ms |

### Implementation

- New component `ComboSignature` listens to `combo-detect` beat
- Reads `beat.comboLabel` (already exists) to determine which signature to play
- Each signature is a brief overlay (SVG + DOM) anchored over the dice row
- Audio: piggyback existing `comboChime` voice with frequency variations + setTimeout-spaced retriggers — no new synth voice needed
- Importance scales overlay opacity/intensity: a stale Pair gets quieter signature than a fresh Five of a Kind
- Reduced-motion users: skip the visual; keep the audio cue (single tone)

### Files touched
- `src-next/app/hud/theater/ComboSignature.tsx` (new)
- `src-next/audio/scoring.ts` (extend combo-detect case)
- `src-next/styles/index.css` (combo-specific keyframes)
- `src-next/app/App.tsx` (mount ComboSignature)

### Out of scope
- Custom synth voices per combo (deferred — reuse comboChime)
- Hand-type level-up indicator (already in Galaxy consumables, not in scoring theater)

---

## Move 2 — Constellation draws on cross-target

### Intent
When the player crosses target, the active constellation (Lyra, Ursa, Cygnus, etc.) literally **draws itself** in the playfield as a luminous line shape — not as a generic glyph stamp. The current `fireConstellationSeal` shows a static svg glyph at center; replace with a stroke-animated constellation drawn over the dice row.

### Behavior
- On `cross-target` beat: lookup `state.run.constellationId` → fetch constellation point array
- Render SVG polyline connecting the points, anchored over playfield (between dice row and PIPS×MULT panel)
- Animate stroke-dashoffset from full length → 0 over 600ms with `cubic-bezier(0.4, 0, 0.2, 1)` — line draws in
- Each "star" point gets a small halo dot drawn 60ms after the stroke reaches it (sequential ignition)
- After full draw: hold 400ms, then fade to background as part of the standard cross-target VFX
- Color: constellation accent color (lookup from `lookupConstellation(id).color`)

### Layered with existing
- Replaces `scoringVFX.fireConstellationSeal` for the visible stamp; keep the bus emit `onCrystallineEdgeCatch` so dice still pulse
- Existing `fireConductiveArcs` (between dice on cast-swell) stays — different visual moment
- Existing godrays + vignette on cross-target stay — constellation draw layers underneath

### Reduced motion
- Show the final composed constellation in a 200ms fade (no stroke animation)

### Files touched
- `src-next/app/hud/theater/ConstellationDraw.tsx` (new)
- `src-next/app/hud/ScoreMoment.tsx` (replace fireConstellationSeal call OR augment with new component)
- `src-next/app/App.tsx` (mount ConstellationDraw)
- `src-next/styles/index.css` (constellation-draw-in keyframe)

### Data dependency
- `data/constellations.ts` already has `points: Array<{x,y}>` per constellation. Verify schema; if absent, add per-constellation point arrays normalized to a 0-100 coord space then scaled to playfield rect at render time.

### Out of scope
- Per-constellation per-star animation choreography (deferred)
- Constellation completion stamp on Hub trial cards (covered elsewhere)

---

## Move 3 — Mult tier rituals (escalation thresholds)

### Intent
Each time `runningMult` crosses a tier threshold (×4, ×8, ×16, ×32, ×64+), a unique short ritual plays. The player learns through repetition what "×8 territory" feels like. Currently mult tiers only change the PIPS×MULT panel color — add a moment of pageantry.

### Per-tier ritual table

| Threshold | Ritual | Audio | Notes |
|-----------|--------|-------|-------|
| ×2 → ×4 | small ascension ring expands around MULT panel | brief high chime | already partially in chipsTickPop ring-receive |
| ×4 → ×8 | ambient pip particles rain DOWN through scene for 1.2s | layered chord (already exists) | particles use accent color of catalyst that crossed the tier |
| ×8 → ×16 | screen-wide constellation flash (active constellation flickers once at low opacity over whole viewport) | bell strike + low rumble | brief 200ms — quick punctuation |
| ×16 → ×32 | camera ZOOM on PIPS×MULT panel (existing `theater-zoom` 1.02 → bump to 1.05) for 500ms then settles | sustained bell + light choir | "the world leans in" |
| ×32+ → ×64+ | full theater freeze (existing `theater-freeze`) + single golden spotlight + cuts ALL audio except one ringing bell for 600ms | one ringing bell, then full mix returns | true reverence moment |

### Implementation
- New module `multTierRituals.ts` exports `playRitual(fromTier, toTier)`
- ScoreBreakdown already tracks tier via `tierIndex(mult)` — emit a new event `onMultTierCross` when tier changes via setMult
- Subscribe `multTierRituals.ts` to this event; route to the appropriate ritual handler
- Each ritual is its own component or imperative function (existing infrastructure: `scoringVFX.fireStarRipple`, `theater-zoom` class, `theater-freeze` class)

### Files touched
- `src-next/events/types.ts` (new event `onMultTierCross: { fromTier: number; toTier: number; accent: string }`)
- `src-next/app/hud/ScoreBreakdown.tsx` (emit event on tier change)
- `src-next/app/hud/theater/MultTierRituals.tsx` (new orchestrator component)
- `src-next/styles/index.css` (constellation-flicker, pip-rain, spotlight keyframes)
- `src-next/audio/scoring.ts` (per-tier audio cues)

### Out of scope
- Per-constellation flicker color (use accent for now; expand later)
- Pip-rain physics simulation (use simple CSS keyframe rain)

---

## Move 4 — Per-mod bespoke fire

### Intent
Each die-attached mod gets its own fire visual when it triggers. Currently all mod fires emit the same `upgrade-chip` / `upgrade-mult` beat with sourceType='mod' — visually only the floater color differentiates. Mods should feel like distinct identities.

### Per-mod signature table (initial 8 mods)

| Mod | Visual cue | Audio cue |
|-----|------------|-----------|
| **Gilded** | Gold dust spray off die for 600ms | metal scrape + chip tick |
| **Amplify** | Shockwave ring expands from die | low whoomp + chip tick (already wired) |
| **Loaded** | Chamber-load clack flash + numeric flicker | mechanical click + chip tick |
| **Sharpened** | Blade glint sweep across die face | knife-draw + chip tick |
| **Crown** | Halo above die for 400ms | bright fanfare + mult slam |
| **Conduit** | Lightning arc from this die to next scoring die | electric crackle |
| **Resonance** | Faint mirror-image of self appears next to die | reverb shimmer |
| **Brittle** | Cracks etch on die face | glass crack |

### Implementation
- `mods/index.ts` already has `triggerFx` field per ModDef (with values like `'loaded'`, `'pipCharge'`, `'crown'`, `'shatter'`, etc.) — many bespoke FX already exist in `render/three/modFx/*.ts`
- Audit which mods have a bespoke triggerFx vs default 'pulse' — add fx for the unstyled mods
- Audio routing: extend `audio/scoring.ts` upgrade-chip case to read `beat.sourceType === 'mod'` AND look up mod-specific audio cue via a new `data/modAudio.ts` map
- Visual routing: Dice3D already dispatches `firePulse`, `fireLoaded`, `firePipCharge`, etc. on die-tick — extend this dispatch table to cover all mods (currently many fall through to generic `firePulse`)

### Files touched
- `src-next/core/mods/index.ts` (verify triggerFx coverage; add missing fx assignments)
- `src-next/render/three/modFx/*.ts` (new per-mod fx files for un-styled mods: gilded, sharpened, conduit, resonance, brittle)
- `src-next/data/modAudio.ts` (new audio map per mod id)
- `src-next/audio/scoring.ts` (mod-specific audio lookup on upgrade-chip with sourceType='mod')

### Scope reality
- Coverage of 8 most-used mods. Remaining ~50 mods get a slightly differentiated default (color/pitch variation).

### Out of scope
- Custom 3D meshes per mod (use existing material kit + particle FX)
- Per-mod synth voices (use existing voices with parameter variation)

---

## Move 5 — Held-breath cinematic freeze frame

### Intent
The `hold-breath` beat (right before boom) becomes a true film-paused punctuation. Existing `theater-freeze` class drops saturation + pauses cosmos drift; extend into a full cinematic freeze: monochrome desaturation, single golden light on the score panels, all audio cuts to a single sustained bell, everything else holds its position.

### Behavior
- On `hold-breath` beat: ScoreMoment triggers `theater-freeze` class on `#stage-root` AND new `theater-deep-freeze` modifier
- CSS:
  - `theater-deep-freeze` applies `filter: saturate(0.15) brightness(0.85)` to `#stage-root`
  - PIPS×MULT panel + ComboFlash get `--frozen-spotlight: 1` — golden glow boost via CSS var
  - Cosmos background freezes (already pauses drift via existing `.theater-freeze`)
- Audio:
  - `audioEngine.duck` with `depth: 0.92` (deeper than existing tippingPoint) — music + ambient nearly silent
  - Single sustained bell tone via `sfxPlay('comboChime', { freq: 220, gain: 0.6, sustain: true })`  (note: sustain param may need synth voice tweak)
- Duration: matches existing `hold-breath` beat `durMs` (typically 400-800ms based on tier)
- Boom beat fires: release everything at once — saturate snaps back, music returns full mix, bell tone fades

### Layered with existing
- Builds on existing `theater-freeze`. The new `theater-deep-freeze` modifier is the BIG version reserved for the held-breath; the existing `theater-freeze` may still be useful for less-dramatic pauses (currently used for held-breath as well — distinction is moot if we fold them together)
- Sub-bass rumble (existing on hold-breath) stays — adds physical weight under the silence

### Files touched
- `src-next/app/hud/theater/TheaterStage.tsx` (add `theater-deep-freeze` class on held-breath phase)
- `src-next/styles/index.css` (theater-deep-freeze rules + spotlight CSS var on PIPS×MULT panel)
- `src-next/app/hud/theater/TheaterDirector.ts` (route deeper audio duck on held-breath)
- `src-next/audio/scoring.ts` (single sustained bell on hold-breath)

### Reduced motion
- Skip the saturate/brightness filters; keep audio duck + bell

### Out of scope
- Per-importance freeze depth (use same depth for all hold-breath beats; later iterations can scale by peak mult)
- Camera shake on freeze (intentionally absent — silence is the point)

---

## Sequencing + dependencies

Recommended implementation order to minimize churn:

1. **Move 5 (Held-breath freeze)** first — single beat handler, no new components. Validates the theater-freeze infrastructure can carry deeper variants.
2. **Move 3 (Mult tier rituals)** second — adds `onMultTierCross` event + orchestrator. Lower-level plumbing.
3. **Move 1 (Combo signatures)** third — new component + audio routing. Independent of mult tiers.
4. **Move 4 (Per-mod fire)** fourth — touches engine-side mod definitions + audio routing. Largest blast radius.
5. **Move 2 (Constellation draw)** last — most visual work, but isolated to its own component.

Each move is independently shippable; user can review after each.

---

## Verification plan (per move)

- **Combo signatures**: emit `combo-detect` beats with each comboLabel; visual + audio confirms per-combo cue.
- **Constellation draw**: emit `cross-target` beat with active constellation set; verify SVG polyline strokes in over 600ms and matches constellation shape.
- **Mult tier rituals**: emit `upgrade-mult` beats that cross each threshold; verify per-tier ritual fires once per cross (not on every beat).
- **Per-mod fire**: emit `upgrade-chip` beats with sourceType='mod' for each mod id; verify per-mod visual fires.
- **Held-breath freeze**: emit `hold-breath` beat; verify saturation drop + audio duck + bell tone, then `boom` releases.

DOM probes via `preview_eval` + console-quiet check.

---

## Out of scope (broader theater backlog)

Deferred for later passes (per user prioritization):
- TIER A polish (flipboard digits, per-rarity weight, encore stinger, resonance beam, adaptive music, diorama finale, hot streak, per-die personality, drained state, pip particle physics)
- TIER B delight (vocalizations, camera shake variety, synergy spark, trophy stamp, number-roll, auto-Why panel, scale-by-magnitude constellation seal, risk-bust telegraph, mute on freeze, dice afterimage)

Tasks file: `MEMORY.md` will track these as follow-up candidates after the user playtests the top 5.

---

## Open questions for user review

1. **Combo signatures**: are the per-combo flavor labels (drumroll for Three of a Kind, etc.) on-brand for the cosmic theme? Alternative: keep cosmic flavor across all (chimes, swells) and differentiate by rhythm/pitch only.
2. **Constellation draw**: does the constellation data have point arrays? If not, can you supply them per constellation, or want me to derive from existing glyphs?
3. **Mult tier thresholds**: are ×4/×8/×16/×32 the right gates? Should there be one earlier (e.g. ×2) for the first ramp signal?
4. **Per-mod fire**: which 8 mods are highest priority (top by play time)? Default suggested above; can swap if data shows different.
5. **Held-breath duration**: how long do you want the bell to ring? 400ms feels punchy, 800ms feels reverent. Currently held-breath durMs varies — should the bell match or always be fixed?
