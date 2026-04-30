# Star Forge Mod Visual System — Design Spec

**Topic:** Star Forge dice mod visual effects (idle aura + trigger burst) with full Three.js dice unification across the game.

**Status:** Brainstorm complete. Ready for writing-plans skill to produce per-phase implementation plan(s).

---

## Context

FortuneFallacy2 is a web-based dice roguelike (React + Three.js + Pixi.js + Tone.js) styled as a "grounded probabilist" cosmic simulation. The Star Forge screen lets players attach **mods** to individual dice (10 mod types, max 2 per die, 3 with `forged_links` voucher). Today, attaching mods produces **no visual effect on the die itself** — only a small badge icon in the die's corner. Dice render through two unrelated paths: **Three.js (`Dice3D.ts`)** during gameplay roll, and **CSS (`Die3DCSS.tsx`)** in the Forge, tray, and hold strip — so the same die looks like two different objects.

The user wants the game to (a) feel unique vs Balatro, (b) feel alive and science-themed with rich visual interactions, and (c) make Star Forge a tactile, meaningful screen — mods should *do something visible* to the die.

This spec covers Star Forge mod visuals as the first pass of a broader UI/UX uniqueness initiative. Subsequent passes (deferred): "alive feel" sweep (SFX, score popup motion, micro-interactions), theme/meaning copy pass.

---

## Goal

Each die's mods produce a unique science-themed visual signature on the die itself, in two layers:

1. **Idle aura** — die material/geometry mutates to embody the mod (legibility at a glance).
2. **Trigger burst** — die erupts into a phenomenon when the mod fires during scoring (payoff feedback).

Plus: unify all dice rendering to Three.js so the same die looks identical in the Forge, tray, hold strip, and during gameplay.

---

## Non-Goals (this spec)

- Attach ceremony FX (one-shot cinematic when mod fuses to die).
- Multi-die cross-effects (e.g. Mirror Pair phantom-twin across hand).
- Sound design / SFX for mod triggers (tracked in separate "alive feel" pass).
- Legendary tier mods (reserved for future expansion — they will get bigger trigger FX).
- Score popup motion, micro-interactions, theme copy pass (separate passes).

---

## Architecture

### Data shape

Extend `ModDef` in `src-next/core/mods/index.ts` with an optional `visual` block:

```ts
type ModDef = {
  // ...existing fields
  visual?: {
    materialKey: 'amplify' | 'sharpened' | 'gilded' | 'loaded' | 'snakeEyes'
              | 'highRoller' | 'backstop' | 'pipCharge' | 'evenKeel' | 'mirrorPair';
    accentColor: string;                           // hex; drives orbital + trigger tint
    geometricVariant?: 'asymmetric' | 'plated' | 'recessed';  // pilot 3 only
    triggerFx: 'loaded' | 'pipCharge' | 'backstop' | 'pulse'; // pilot or generic
  }
}
```

### New modules

- **`src-next/render/three/dieMaterials.ts`** — maps `materialKey` → Three.js material params (transmission, IOR, emissive, tint, sheen, roughness). Extends the existing 5-style system in `Dice3D.ts`. Mod material *layers over* base die-style, not replaces it.
- **`src-next/render/three/DieView.tsx`** — React wrapper component. Mounts a Three.js die at any target size. Replaces all `Die3DCSS` usages.
- **`src-next/render/three/modFx/`** — directory:
  - `loaded.ts`, `pipCharge.ts`, `backstop.ts` — pilot trigger phenomena. Each exports `fire(die, faceIndex, opts) => disposable`.
  - `pulse.ts` — generic shared trigger (used by other 7 mods).
- **`src-next/render/three/orbitalSatellite.ts`** — small orbiting mesh for secondary mod slot.

### Renderer strategy (multi-viewport unification)

Single shared `WebGLRenderer` instance + multi-viewport pattern:

- One offscreen renderer with one shared canvas. Per-die canvas as fallback only if multi-viewport pattern hits a snag in foundation phase.
- Each die's DOM placeholder anchors a viewport region; the shared renderer draws the die mesh into that region each frame.
- Shared material/geometry caches → no per-die GPU bloat.
- Existing `Dice3D.ts` gets refactored into a reusable `DieComponent` taking `{ size, mods, dieStyle, faceValue, idleTumble, viewportRef }` props.

### Affected files (Three.js migration)

Replace all `Die3DCSS` usages:

- `src-next/app/screens/Forge.tsx` — central die (140px) + 6-die selector strip (56px).
- Tray and hold-strip components (audit during impl; grep `Die3DCSS` references).
- Anywhere else the CSS die appears in the codebase.

`Die3DCSS` is **kept** as the fallback path when WebGL is unavailable — not deleted.

---

## Per-Mod Idle Material (all 10)

Each mod = real-world phenomenon expressed via material params (and, for the pilot 3, a small geometry tweak). Material extends, not replaces, the player's chosen base die-style — the mod tints over.

| # | Mod | Phenomenon | Material spec | Accent | Geometry tier |
|---|-----|-----------|---------------|--------|---------------|
| 1 | **Amplify** | Sound-wave amplifier | Brushed brass finish, low transmission, ringing edge highlight; faint emissive on score | `#f5c451` gold | A (surface only) |
| 2 | **Sharpened** | Honed obsidian | Mirror-polish edges over high-roughness face; cool steel emissive | `#a4d4ff` ice | A |
| 3 | **Gilded** | Gold leaf plating | High metalness, gold sheen, warm IOR; pip lens warm-tinted | `#f5c451` gold | A |
| 4 | **Loaded** ⭐ | Asymmetric mass | Bronze-shifted body, deep sheen; **one face subtly bowed-heavy** (geometry); vertex-color gradient drifts toward weighted face | `#c87a4a` bronze | **B (asymmetric)** |
| 5 | **Snake Eyes** | Paired stars | Deep midnight blue body; two pinprick emissive pips on opposing faces faintly visible even when face hidden | `#7be3ff` cyan | A |
| 6 | **High Roller** | Plasma corona | Higher emissive base; faint outer glow halo. Reads "energetic" | `#ff7847` ember | A |
| 7 | **Backstop** ⭐ | Ceramic safety plate | Matte ceramic finish, milky transmission; **slightly thicker rim** (geometry) | `#9bd0a8` jade | **B (plated)** |
| 8 | **Pip Charge** ⭐ | Capacitor / electric charge | Dark glassy body, faint inner light pulse 0.5Hz; **pips slightly recessed like contact points** (geometry) | `#ffd84a` amber | **B (recessed)** |
| 9 | **Even Keel** | Gyroscopic balance | Polished symmetric finish; gentle counter-rotation idle; cool neutral | `#c0c8d8` silver | A |
| 10 | **Mirror Pair** | Reflective twin | Glassy chrome, mirror IOR; subtle ghost-doubled silhouette via outline shader | `#e0c8ff` lavender | A |

⭐ = pilot trigger phenomenon (next section).

Geometry tweaks (pilot 3 only) are **small mesh modifiers** layered onto existing rounded-box geometry, not custom geometries per mod.

All 10 must remain readable at 56px (Forge selector strip size) via accent color glow + existing badge icon.

---

## Pilot 3 Trigger Phenomena

Fires on Three.js dice during gameplay scoring only (Forge dice are idle, no triggers). All sequences respect `prefers-reduced-motion`: collapse to 80ms accent flash + emissive bump, no particles, no scale, no shake.

### Loaded — fires when face=1 lands and gets remapped to 6

Sequence (~550ms):

1. **0–120ms** — face-1 pip cluster condenses. Single pip emissive intensifies, pulses bright bronze.
2. **120–300ms** — pip "shifts under skin": additive halo sprite scales 1→2.5 then collapses; inner light traces from die center outward to the 6-pip positions on the face. Material vertex-color gradient briefly drifts heavy → unweighted.
3. **300–500ms** — new 6-pip face blooms in. Six pips fade-up emissive, brief halo per pip.
4. **500–550ms** — settle. Bronze edge accent flashes and decays.

Reads as: mass redistributing → die rolls true to 6.

### Pip Charge — fires per-die during score; duration scales with face value

Sequence (~100–500ms; ~80ms × face value):

1. **0–100ms** — faint amber glow gathers at die center (inner emissive ramp).
2. **100ms+** — electrical arc draws **pip-to-pip path on visible face** in sequence (1 arc segment per pip, ~80ms each). Face=6 → 5 segments → ~500ms total. Face=1 → single brief flash → ~100ms.
3. **Final pip** — halo pop; accent-color flying number ejects toward the score counter (reuses existing `flyToCounter` keyframe in `Particles.tsx`).

Reads as: pips load up like capacitors discharging into score.

### Backstop — fires only when raw face score < 4 (rescue moment)

Sequence (~650ms):

1. **0–150ms** — die rim flashes ceramic-jade emissive. Subtle camera-space shake on die only (3px, 2 cycles).
2. **150–400ms** — plate "slams up": ceramic ring expands from die center outward (reuses existing `ringExpand` keyframe, jade-tinted). Pip count visually clicks up to 4 (extra pips fade in via emissive bloom).
3. **400–650ms** — settle. Rim emissive decays. Quiet exhale.

Reads as: safety net catches low roll, score floor enforced. Tactile relief beat.

### Generic pulse — used by the other 7 mods

- 280ms accent-color halo: scale 1→1.6, fade out, with edge brightness lift.
- Cheap shared module. Color-coded by mod accent.
- Always fires when the mod's `scoreBonus` / `multBonus` / `shardsBonus` contributes during scoring.

---

## Stacking Rules

- **Slot 0 (primary)** → die `materialKey` + `geometricVariant`.
- **Slot 1 (secondary)** → small **orbital satellite mesh** (~12% die diameter) circling die. Glyph icon + accent-color emissive. 8s rotation in a 3D plane tilted ~15°. Reuses orbit math from existing CSS keyframe but in 3D space.
- **Slot 2 (tertiary, only with `forged_links` voucher)** → secondary becomes a **rim-overlay band** (thin ring of accent color welded to die equator); tertiary takes the orbital slot.

Order of attach matters → player-meaningful choice.

**Legibility check at small sizes:** If satellite is too noisy at <80px, hide satellite and show only badge icon (existing system).

---

## Reduced Motion, Errors, Fallbacks

### `prefers-reduced-motion`

- Idle die tumble: disabled (CSS already respects it; replicate in Three.js path).
- Trigger phenomena: collapsed to 80ms accent flash + emissive bump.
- Orbital satellite: static (no rotation), still visible.
- Material mutation: unchanged (passive visual, no motion).

### Error / fallback handling

- **WebGL unavailable / context lost** → fall back to enhanced `Die3DCSS` everywhere. Detect at app boot via probe canvas; expose boolean flag in app state.
- **Mod with no `visual` block** (legacy / missing data) → render base die with badge only. No crash.
- **Material cache miss** → log dev warning, fall back to default die style. Game continues.
- **Trigger FX module load fail** → skip FX; scoring math still runs. FX is purely cosmetic.

---

## Performance Budget

- Worst case ~12 dice simultaneously visible (Forge selector 6 + central 1 + edge cases). Single shared canvas with multi-viewport, instanced where possible.
- Idle dice tumble at low FPS (15fps) when off-focus or out-of-viewport — pause animation otherwise.
- Mobile / low-end fallback: detect WebGL caps; if poor, swap to enhanced `Die3DCSS`.
- Target: 60fps on mid laptop with Forge open (6 selector + central + 2 orbital satellites). 60fps during gameplay roll with 5 mod-laden dice + active triggers.

---

## Implementation Phasing (build order)

Each phase = a separately-plannable, separately-shippable increment. The writing-plans skill should produce **separate implementation plans per phase** rather than one giant plan.

1. **Foundation** — `DieView` component + multi-viewport renderer. Verify perf at 12-die worst case. Swap Forge central die first as proof-of-concept (dev flag toggleable).
2. **Material system** — `dieMaterials.ts` with all 10 mod material specs. Wire `ModDef.visual.materialKey`. All 10 idle states ship.
3. **Stacking** — orbital satellite mesh + rim-overlay logic. Test 2-mod and 3-mod combos.
4. **Pilot geometry** — Loaded asymmetry, Backstop rim-thicken, Pip Charge pip-recess. Three small mesh modifiers.
5. **Generic pulse trigger** — shared 280ms halo module. Wire into scoring pipeline. Other 7 mods light up.
6. **Pilot trigger phenomena** — Loaded, Pip Charge, Backstop full sequences (one per sub-phase).
7. **Migration sweep** — replace remaining `Die3DCSS` usages (tray, hold). Remove dev flag. Keep `Die3DCSS` as fallback only.

---

## Critical Files

- `src-next/core/mods/index.ts` — extend `ModDef` with `visual` block. Add `visual` entry to all 10 existing mod defs.
- `src-next/render/three/Dice3D.ts` — refactor into reusable `DieComponent`.
- `src-next/render/three/dieMaterials.ts` — **NEW**.
- `src-next/render/three/DieView.tsx` — **NEW**.
- `src-next/render/three/modFx/{loaded,pipCharge,backstop,pulse}.ts` — **NEW**.
- `src-next/render/three/orbitalSatellite.ts` — **NEW**.
- `src-next/app/screens/Forge.tsx` — swap `Die3DCSS` → `DieView`.
- `src-next/app/visual/Die3DCSS.tsx` — kept as fallback, no change.
- `src-next/styles/index.css` — no new keyframes needed; trigger FX reuses existing `ringExpand`, `orbit`, `flyToCounter`.
- Tray and hold-strip components — swap `Die3DCSS` → `DieView` (paths to be confirmed during impl phase).

---

## Verification

After each phase, run the relevant subset:

### Foundation phase
- Forge central die renders at 140px in Three.js.
- Side-by-side compare with old CSS version (toggle dev flag). No FPS drop on a mid laptop.
- WebGL fallback path works (force-disable WebGL → CSS dice render).

### Material system
- For each of 10 mods: attach to a die in Forge → idle die displays correct material per spec table.
- Stack identical mod twice (e.g. 2× Sharpened) → primary applies, secondary becomes orbital satellite.
- All 10 mods readable at selector-strip 56px size (badge + accent glow visible).

### Pilot geometry
- Loaded die: weighted face visible from rotation. Subtle, not exaggerated.
- Backstop die: rim plate visibly thicker than baseline.
- Pip Charge die: pips visibly recessed.

### Generic pulse trigger
- Mod that grants flat `scoreBonus` (Amplify): during scoring, die emits 280ms gold halo as chips count in.
- Halo color matches mod accent.

### Pilot trigger phenomena
- **Loaded**: roll/force a 1 → see condense → halo → 6-pip bloom sequence. Final face displays as 6.
- **Pip Charge**: hand including a face=6 die → see 5 arc segments traced pip-to-pip; face=2 visibly shorter sequence.
- **Backstop**: force a 1 with Backstop attached → ceramic ring expansion + face "clicks" up to 4.

### Reduced motion
- OS toggle "reduce motion" → all triggers collapse to flash. No shake, no particles, no scaling animations.

### Stacking
- 2 mods on die: primary material + orbital satellite both visible.
- 3 mods (with `forged_links` voucher): rim-band added; orbital still rotates.

### Cross-screen consistency
- Same die in Forge, tray, gameplay roll → identical material + orbital. No "two different dice" effect.

### Performance
- Forge open with 6-die selector + central die + 2 orbital satellites: 60fps mid laptop.
- Gameplay roll with 5 mod-laden dice + active triggers: no frame drops during scoring sequence.

---

## Open Questions / Risks

- **WebGL context limit** — naively one canvas per die hits browser caps. Mitigated via single shared canvas + multi-viewport, but pattern needs validation in foundation phase.
- **CSS-to-Three.js parity at small sizes** — selector strip 56px dice may not benefit from full Three.js; orbital satellite may need to hide. Validate in stacking phase.
- **Mesh modifier path for pilot geometry** — small mesh tweaks need Three.js geometry surgery; `RoundedBoxGeometry` may need replacement or post-processing.
- **Existing 5 die-styles + 10 mod materials = 50 combinations** — verify none clash visually; document any pairings to avoid.
- **Load-time impact** — 10 material specs + 4 trigger FX modules + orbital satellite = bundle bloat. Lazy-load FX modules per-mod.

---

## Future Work (deferred)

- **Legendary tier mods** — bigger trigger phenomena, special idle auras. Reserved scope.
- **Attach ceremony FX** — Forge "fuse" moment cinematic.
- **Mirror Pair cross-die effect** — phantom-twin face highlight across hand.
- **SFX for mod triggers** — separate "alive feel" pass.
- **Score popup orbital motion** — separate "alive feel" pass.
- **Theme copy / scientific naming pass** — separate pass.
