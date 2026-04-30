# Star Forge Mod Visuals — Phase 5 (Generic Pulse Trigger) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a mod's `scoreBonus` / `multBonus` / `shardsBonus` (or face-conditional cousin) actually contributes during scoring, fire a 280ms accent-color pulse halo on the affected die. Covers the 7 non-pilot mods (Amplify, Sharpened, Gilded, Snake Eyes, High Roller, Even Keel, Mirror Pair).

**Architecture:** A new `onModFired` event with payload `{ dieIdx, modId, faceValue }` is emitted from the two scoring sites: `upgrades.ts` (for the 6 chip/mult mods) and `roll.ts` (for Gilded's shardsBonus). A new `pulse.ts` FX factory builds a short-lived accent-colored halo sprite + dispose handle. `Dice3D.ts` subscribes to `onModFired`, resolves the mod's `visual.triggerFx` — if `'pulse'`, fires the FX at the die's world position.

**Tech Stack:** TypeScript + React 18 + Three.js 0.169 + Vitest + jsdom. Existing `bus`/`dispatch` event infrastructure. No new dependencies.

**Spec source:** `docs/superpowers/specs/2026-04-29-star-forge-mod-visuals-design.md` — Section "Generic pulse — used by the other 7 mods" and the "Generic pulse trigger" subsection of Verification.

**Phases 1+2+3+4 already shipped on `main`.** Reuse: `webglDetect`, `buildDie`, `sharedRenderer`, `DieView`, `MOD_MATERIALS`, `ModDef.visual`, `getHaloTexture`, `resolveMod`. Phase 5 wires into the gameplay rendering path (`Dice3D.ts`), not `DieView` — gameplay still renders via `Dice3D` until Phase 7.

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `src-next/events/types.ts` | MODIFY | Add `onModFired: { dieIdx: number; modId: string; faceValue: number }` to `GameEventMap`. |
| `src-next/core/phases/upgrades.ts` | MODIFY | In `applyModScoring`, alongside the existing `onUpgradeTriggered` push (line 57-60), also push an `onModFired` event with the dieIdx, modId, and faceValue. Fires only when the mod actually contributes (the existing `dChips !== 0 \|\| dMult !== 0` gate). |
| `src-next/core/phases/upgrades.test.ts` (or co-located test) | NEW or MODIFY | Test that `applyModScoring` emits `onModFired` per contributing mod, with correct payload. Skip if test-file location conflicts; cover via existing pipeline tests. |
| `src-next/actions/handlers/roll.ts` | MODIFY | In the Gilded shardsBonus loop (around line 89-95), accumulate `onModFired` events for every die that has a `gilded` mod and emit them in the action's events array. |
| `src-next/render/three/modFx/pulse.ts` | NEW | Pure factory `firePulse(scene, position, accentColor) → dispose`. Builds a sprite halo at `position`, animates scale 1→1.6 + opacity 1→0 over 280ms, returns a dispose handle. Uses existing `getHaloTexture`. |
| `src-next/render/three/modFx/pulse.test.ts` | NEW | Tests: returns a sprite, sprite is added to the supplied scene, animation completes by 280ms, dispose removes sprite + frees material. |
| `src-next/render/three/Dice3D.ts` | MODIFY | Subscribe to `onModFired` in the constructor's existing `unsubscribers` block. Resolve the mod via `resolveMod` (or `lookupMod`), check `visual?.triggerFx === 'pulse'` — if so, fire `pulse.firePulse(scene, dieWorldPosition, accentColor)`. Pilots (`'loaded' \| 'pipCharge' \| 'backstop'`) skip — their phenomena ship in Phase 6. |

**Decomposition rationale:** Event type addition is a single-line change in `types.ts`. Emit and listener split because they exercise different test surfaces (scoring math vs render lifecycle). The pulse module is a pure FX factory — testable in isolation. The `Dice3D` listener is integration-level — verified manually in Task 6.

**Phase 5 explicitly defers:**
- Pilot trigger phenomena (Loaded morph, Pip Charge arcs, Backstop ring) — Phase 6.
- CSS dice migration (Phase 7).
- Reduced-motion collapse (the spec mandates it; will land alongside Phase 6 phenomena since they share the rAF infra).

---

## Task 1: Add `onModFired` event type

**Files:**
- Modify: `src-next/events/types.ts`

This task is just the type declaration — no behavior. Tests in subsequent tasks fail until the event is emitted, but the type addition itself is checked at compile time.

- [ ] **Step 1: Modify `src-next/events/types.ts`**

Find the `GameEventMap` block (around line 45-61):

```ts
export type GameEventMap = {
  onPing:              { msg: string };
  onRollStart:         { dice: DieSnapshot[]; lockedMask: boolean[] };
  onSimulationStart:   { request: SimulationRequest };
  onSimulationEnd:     { result: SimulationResult };
  onRollEnd:           { faces: number[]; metrics: SimMetrics };
  onScoreCalculated:   { combo: ComboId; chips: number; mult: number; total: number };
  onUpgradeTriggered:  { id: UpgradeId; phase: Phase; deltaChips: number; deltaMult: number };
  onComboDetected:     { combo: ComboId; tier: number };
  onBlindCleared:      { blindId: BlindId; ante: number };
  onBossRevealed:      { blindId: BlindId; ante: number };
  onShopOpened:        { offers: ShopOffer[] };
  onLockToggled:       { dieIdx: number; locked: boolean };
  onOfferBought:       { kind: ShopOffer['kind']; id: string; price: number };
  onScoreBeat:         { beat: Beat };
  onScoreSequenceBuilt: { sequence: ScoreSequence };
};
```

Add this entry — alphabetical placement near `onLockToggled` and `onOfferBought` is fine; or place near the other upgrade-y events. Recommend right after `onUpgradeTriggered`:

```ts
  onModFired:          { dieIdx: number; modId: string; faceValue: number };
```

The full block becomes:

```ts
export type GameEventMap = {
  onPing:              { msg: string };
  onRollStart:         { dice: DieSnapshot[]; lockedMask: boolean[] };
  onSimulationStart:   { request: SimulationRequest };
  onSimulationEnd:     { result: SimulationResult };
  onRollEnd:           { faces: number[]; metrics: SimMetrics };
  onScoreCalculated:   { combo: ComboId; chips: number; mult: number; total: number };
  onUpgradeTriggered:  { id: UpgradeId; phase: Phase; deltaChips: number; deltaMult: number };
  onModFired:          { dieIdx: number; modId: string; faceValue: number };
  onComboDetected:     { combo: ComboId; tier: number };
  onBlindCleared:      { blindId: BlindId; ante: number };
  onBossRevealed:      { blindId: BlindId; ante: number };
  onShopOpened:        { offers: ShopOffer[] };
  onLockToggled:       { dieIdx: number; locked: boolean };
  onOfferBought:       { kind: ShopOffer['kind']; id: string; price: number };
  onScoreBeat:         { beat: Beat };
  onScoreSequenceBuilt: { sequence: ScoreSequence };
};
```

- [ ] **Step 2: Run typecheck and tests**

Run: `npx tsc --noEmit`
Expected: No new error categories. Adding an entry to a union type is non-breaking.

Run: `npm test`
Expected: All 267 tests still pass — nothing emits or listens to `onModFired` yet.

- [ ] **Step 3: Commit**

```bash
git add src-next/events/types.ts
git commit -m "feat(events): add onModFired event type for per-mod scoring fires"
```

---

## Task 2: Pulse FX factory

**Files:**
- Create: `src-next/render/three/modFx/pulse.ts`
- Create: `src-next/render/three/modFx/pulse.test.ts`

**Design:** A function that mounts a halo sprite into the supplied scene at the supplied world position, animates it over 280ms (scale 1→1.6, opacity 0.9→0), and returns a `dispose` handle. The animation uses an internal rAF loop that auto-stops at 280ms; `dispose` short-circuits if called early. The shared `getHaloTexture` from `buildDie` is reused — not disposed by this factory.

- [ ] **Step 1: Write the failing test**

```ts
// src-next/render/three/modFx/pulse.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as THREE from 'three';
import { firePulse } from './pulse';

// jsdom canvas-2d stub — required because firePulse uses getHaloTexture()
// from buildDie, which paints to a 2d canvas.
beforeAll(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  (HTMLCanvasElement.prototype as any).__origGetContext = orig;
  HTMLCanvasElement.prototype.getContext = function (type: string) {
    if (type === '2d') {
      return {
        createRadialGradient: () => ({ addColorStop: () => {} }),
        fillRect: () => {},
        set fillStyle(_v: string) {},
      };
    }
    return null;
  } as any;
});

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = (HTMLCanvasElement.prototype as any).__origGetContext;
});

describe('firePulse', () => {
  it('adds a Sprite to the scene', () => {
    const scene = new THREE.Scene();
    const before = scene.children.length;
    firePulse(scene, new THREE.Vector3(0, 0, 0), '#7be3ff', 0.85);
    expect(scene.children.length).toBe(before + 1);
    const added = scene.children[scene.children.length - 1]!;
    expect(added.type).toBe('Sprite');
  });

  it('returns a dispose handle that removes the sprite from the scene', () => {
    const scene = new THREE.Scene();
    const handle = firePulse(scene, new THREE.Vector3(1, 2, 3), '#7be3ff', 0.85);
    expect(scene.children.length).toBe(1);
    handle.dispose();
    expect(scene.children.length).toBe(0);
  });

  it('positions the sprite at the supplied world position', () => {
    const scene = new THREE.Scene();
    firePulse(scene, new THREE.Vector3(1.5, -2, 0.7), '#7be3ff', 0.85);
    const sprite = scene.children[0] as THREE.Sprite;
    expect(sprite.position.x).toBeCloseTo(1.5);
    expect(sprite.position.y).toBeCloseTo(-2);
    expect(sprite.position.z).toBeCloseTo(0.7);
  });

  it('disposes material on auto-completion (280ms)', async () => {
    const scene = new THREE.Scene();
    firePulse(scene, new THREE.Vector3(), '#7be3ff', 0.85);
    const sprite = scene.children[0] as THREE.Sprite;
    const matDispose = vi.fn();
    (sprite.material as THREE.Material).dispose = matDispose as any;
    // Wait slightly longer than the 280ms animation duration.
    await new Promise((r) => setTimeout(r, 350));
    expect(matDispose).toHaveBeenCalled();
    expect(scene.children.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src-next/render/three/modFx/pulse.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `pulse.ts`**

```ts
// src-next/render/three/modFx/pulse.ts
import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type PulseHandle = {
  dispose: () => void;
};

const PULSE_DURATION_MS = 280;
// Halo size as fraction of die size — slightly larger than the die so the
// pulse reads as a flare around the die rather than on it.
const PULSE_SIZE_FACTOR = 1.4;
const SCALE_START = 1.0;
const SCALE_END = 1.6;
const OPACITY_START = 0.9;

/**
 * Fire a one-shot accent-colored halo pulse at a world position. Auto-disposes
 * after PULSE_DURATION_MS. Returns a handle that can dispose early.
 */
export function firePulse(
  scene: THREE.Scene,
  position: THREE.Vector3,
  accentColor: string,
  dieSize: number,
): PulseHandle {
  const mat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: accentColor,
    transparent: true,
    opacity: OPACITY_START,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(mat);
  const baseSize = dieSize * PULSE_SIZE_FACTOR;
  sprite.scale.set(baseSize, baseSize, 1);
  sprite.position.copy(position);
  scene.add(sprite);

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;
    const t = Math.min(1, dt / PULSE_DURATION_MS);
    // Ease-out cubic for both scale and fade.
    const eased = 1 - Math.pow(1 - t, 3);
    const scale = baseSize * (SCALE_START + (SCALE_END - SCALE_START) * eased);
    sprite.scale.set(scale, scale, 1);
    mat.opacity = OPACITY_START * (1 - eased);
    if (t >= 1) {
      doDispose();
      return;
    }
    rafHandle = requestAnimationFrame(step);
  }

  function doDispose(): void {
    if (disposed) return;
    disposed = true;
    if (rafHandle != null) cancelAnimationFrame(rafHandle);
    scene.remove(sprite);
    mat.dispose();
    // The shared halo texture is module-cached in buildDie.ts; do not dispose.
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src-next/render/three/modFx/pulse.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src-next/render/three/modFx/pulse.ts src-next/render/three/modFx/pulse.test.ts
git commit -m "feat(render): add firePulse — 280ms halo pulse FX"
```

---

## Task 3: Emit `onModFired` from `upgrades.ts`

**Files:**
- Modify: `src-next/core/phases/upgrades.ts`

The `applyModScoring` function already iterates `(face, dieIdx, modId)` triples and gates on contribution (`dChips !== 0 || dMult !== 0`). Add a second event push alongside the existing `onUpgradeTriggered` so render-layer subscribers can correlate fires to dice.

- [ ] **Step 1: Modify `applyModScoring`**

In `src-next/core/phases/upgrades.ts`, find the existing event push (around lines 57-60):

```ts
      if (dChips !== 0 || dMult !== 0) {
        chips += dChips;
        mult += dMult;
        events.push({
          type: 'onUpgradeTriggered',
          payload: { id: `mod:${id}@${i}`, phase: Phase.UPGRADES, deltaChips: dChips, deltaMult: dMult },
        });
      }
```

Replace with:

```ts
      if (dChips !== 0 || dMult !== 0) {
        chips += dChips;
        mult += dMult;
        events.push({
          type: 'onUpgradeTriggered',
          payload: { id: `mod:${id}@${i}`, phase: Phase.UPGRADES, deltaChips: dChips, deltaMult: dMult },
        });
        events.push({
          type: 'onModFired',
          payload: { dieIdx: i, modId: id, faceValue: face },
        });
      }
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All 267 tests still pass. Existing tests don't assert on the events array contents, so adding a new event entry doesn't break them.

- [ ] **Step 4: Commit**

```bash
git add src-next/core/phases/upgrades.ts
git commit -m "feat(scoring): emit onModFired from applyModScoring (chip/mult mods)"
```

---

## Task 4: Emit `onModFired` from `roll.ts` (Gilded shardsBonus)

**Files:**
- Modify: `src-next/actions/handlers/roll.ts`

Gilded's effect (`shardsBonus`) is computed in `roll.ts` outside the `applyModScoring` flow. Add per-die emission for any mod that contributes shards (currently only Gilded).

- [ ] **Step 1: Modify the shardsBonus loop**

In `src-next/actions/handlers/roll.ts`, find the existing block (around lines 89-95):

```ts
      let shardBonus = 0;
      for (const mods of workingState.round.diceMods) {
        for (const id of mods) {
          const def = lookupMod(id);
          if (def?.shardsBonus) shardBonus += def.shardsBonus;
        }
      }
```

Replace with:

```ts
      let shardBonus = 0;
      const modFiredEvents: GameEventEmission[] = [];
      const finalFaces = fakeResult.finalFaces;
      workingState.round.diceMods.forEach((mods, dieIdx) => {
        for (const id of mods) {
          const def = lookupMod(id);
          if (def?.shardsBonus) {
            shardBonus += def.shardsBonus;
            modFiredEvents.push({
              type: 'onModFired',
              payload: { dieIdx, modId: id, faceValue: finalFaces[dieIdx] ?? 0 },
            });
          }
        }
      });
```

(`fakeResult` is already in scope above this block — see line 75-87. `finalFaces` extraction makes the read explicit.)

- [ ] **Step 2: Add the import for `GameEventEmission`**

Find the existing imports at the top of `roll.ts`. Add:

```ts
import type { GameEventEmission } from '../../events/types';
```

(If `events/types` is already imported for something else, just add `GameEventEmission` to the existing import statement.)

- [ ] **Step 3: Wire `modFiredEvents` into the action's events output**

The action's events flow through `baseEvents` (around line 128 in roll.ts):

```ts
      const baseEvents = [...final.events];
```

It's returned at line 139 as `return { state: stateWithPending, events: baseEvents };`. Append the captured events to `baseEvents` by changing line 128 to:

```ts
      const baseEvents = [...final.events, ...modFiredEvents];
```

That's the only line to change for the wiring — `modFiredEvents` is already declared above by Step 1 of this task, and `baseEvents` flows directly into the action's return.

- [ ] **Step 4: Run typecheck + tests**

Run: `npx tsc --noEmit`
Expected: No new errors.

Run: `npm test`
Expected: All tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src-next/actions/handlers/roll.ts
git commit -m "feat(scoring): emit onModFired for Gilded (shardsBonus) per scoring die"
```

---

## Task 5: Wire `Dice3D` listener — fire pulse on `onModFired`

**Files:**
- Modify: `src-next/render/three/Dice3D.ts`

`Dice3D.ts` is the gameplay path renderer (5 dice). Already subscribes to `onScoreBeat` and `onSimulationEnd` in the constructor's `unsubscribers` push. Add a third subscription to `onModFired` that fires `pulse` for the corresponding die — gated on `triggerFx === 'pulse'` so pilot-trigger mods (Loaded, Pip Charge, Backstop) skip pulse and reserve their own phenomena for Phase 6.

- [ ] **Step 1: Add imports near the top of `Dice3D.ts`**

Find the existing imports. Add:

```ts
import { lookupMod } from '../../core/mods';
import { firePulse } from './modFx/pulse';
```

(`lookupMod` may already be imported indirectly via something else; if so, just add `firePulse`.)

- [ ] **Step 2: Add the subscription inside the constructor**

Find the existing `this.unsubscribers.push(...)` block in the constructor (around line 545-563 — has `store.subscribe(...)`, `bus.on('onSimulationEnd', ...)`, `bus.on('onScoreBeat', ...)`).

Append a new entry:

```ts
      bus.on('onModFired', ({ dieIdx, modId, faceValue }) => {
        const def = lookupMod(modId);
        const trigger = def?.visual?.triggerFx;
        const accent = def?.visual?.accentColor;
        // Pilot mods (loaded/pipCharge/backstop) get their own phenomena in
        // Phase 6 — skip generic pulse for them.
        if (trigger !== 'pulse' || !accent) return;
        const die = this.dice[dieIdx];
        if (!die) return;
        // Ignore unused face value for now — pulse position is the die's
        // current world position regardless. Future per-mod phenomena may
        // care about face.
        void faceValue;
        firePulse(this.scene, die.group.position.clone(), accent, /* dieSize */ 0.85);
      }),
```

(Note: `0.85` matches the `DIE_SIZE` constant at the top of `Dice3D.ts`. Could be replaced with that constant if it's in scope; otherwise the literal is fine here. Verify which is cleaner during implementation.)

- [ ] **Step 3: Run typecheck + full suite**

Run: `npx tsc --noEmit`
Expected: No new error categories.

Run: `npm test`
Expected: All tests still pass — Dice3D is integration code, not unit-tested for pulse behavior. Manual verification covers this in Task 6.

- [ ] **Step 4: Commit**

```bash
git add src-next/render/three/Dice3D.ts
git commit -m "feat(render): Dice3D fires firePulse on onModFired for triggerFx='pulse' mods"
```

---

## Task 6: Manual verification + acceptance check

**Acceptance criteria** (from spec — Generic pulse trigger):

- [ ] Mod with flat scoreBonus (Amplify): during scoring, die emits 280ms gold halo as chips count in.
- [ ] Halo color matches mod accent.
- [ ] Conditional mods only pulse when their condition fires (Snake Eyes only on face=1, etc.).
- [ ] Pilot mods (Loaded, Pip Charge, Backstop) do NOT pulse — they reserve for Phase 6.

**Steps:**

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` from the worktree (or via `preview_start` if using the harness).
Expected: Vite dev server prints a localhost URL.

- [ ] **Step 2: Navigate to gameplay round**

Open the page. Click `Begin Ascension` to start a run, navigate to the first round (or use the dev console's `screen` tab to jump to `round`). Reach a state where you can roll dice and play a hand.

- [ ] **Step 3: Attach Amplify to a die, roll + score**

Use the dev console to attach a mod to die 0 — apply path `round.diceMods` value `[["amplify"], [], [], [], []]`. Or navigate through normal gameplay to attach via shop/forge.

Roll the dice. Form any hand (e.g. all 5 dice contribute as a 5-of-a-kind or other). Play the hand.

Confirm:
- During the score animation, when die 0 ticks, a gold halo pulses around it (280ms, scale 1→1.6, fades out).
- The halo color matches `#f5c451` (Amplify's accent).

- [ ] **Step 4: Test conditional mod (Snake Eyes)**

Detach Amplify. Attach Snake Eyes to die 0. Roll until die 0 lands a 1. Play the hand.

Confirm:
- Die 0 pulses cyan (`#7be3ff`) on the score tick.

Roll again until die 0 lands a non-1 face. Play the hand.

Confirm:
- Die 0 does NOT pulse on the score tick (Snake Eyes only fires when face=1, and the spec says pulse only fires when the mod contributes).

- [ ] **Step 5: Test Mirror Pair**

Attach Mirror Pair to die 0 only. Roll until at least 2 dice share a face. Play the hand.

Confirm:
- Die 0 pulses lavender (`#e0c8ff`).

Roll until die 0's face is unique (no other die matches). Play the hand.

Confirm:
- Die 0 does NOT pulse.

- [ ] **Step 6: Test Gilded (shardsBonus path)**

Attach Gilded to die 0. Roll + play any hand.

Confirm:
- Die 0 pulses gold (`#f5c451`) on score.

- [ ] **Step 7: Confirm pilot mods skip pulse**

Attach Loaded to die 0 (face=1 → 6 transformation). Roll until die 0 lands a 1. Play.

Confirm:
- Die 0 does NOT generic-pulse — Loaded reserves its phenomenon for Phase 6.
- (The face still gets remapped to 6 — gameplay math is unaffected.)

Repeat with Backstop and Pip Charge.

- [ ] **Step 8: Run full automated suite**

Run: `npm test`, `npm run build`, `npx tsc --noEmit`.
Expected: tests pass; production build succeeds; no new typecheck errors.

- [ ] **Step 9: No commit needed**

If any tweak surfaced (e.g. pulse too short, halo too small, color too dim), tune the constants in `pulse.ts` (`PULSE_DURATION_MS`, `PULSE_SIZE_FACTOR`, `OPACITY_START`) and commit:

```bash
git add src-next/render/three/modFx/pulse.ts
git commit -m "tune(render): adjust pulse <param> — <one-line reason>"
```

Otherwise Phase 5 is complete.

---

## Verification (whole phase, automated)

Run from the worktree root:

- [ ] `npm test` → all tests pass (existing 267 + 4 new pulse = **271 expected**).
- [ ] `npx tsc --noEmit` → no new TypeScript error categories.
- [ ] `npm run build` → production build succeeds.

---

## Out of Scope (later phases)

- Pilot trigger phenomena (Loaded morph, Pip Charge electrical arcs, Backstop ceramic ring) — Phase 6.
- CSS dice migration to Three.js (Phase 7).
- `prefers-reduced-motion` collapse — lands alongside Phase 6 phenomena since they share the rAF infra. The pulse already auto-disposes on completion; for reduced-motion the duration would collapse to ~80ms with scale=1. Defer.

---

## Notes / Open Risks

- **Animation duration vs score-tick timing.** The score sequence (existing) ticks dice one at a time with a configurable delay. If two mods fire on the same die back-to-back (e.g. Amplify + Sharpened both on die 0), we'd get two overlapping pulses. They blend additively (the halo material is `AdditiveBlending`), which probably reads as a brighter pulse rather than two distinct ones. Acceptable — manual verify.
- **`onScoreBeat` ordering.** `onModFired` fires during scoring math (before `onScoreBeat` plays). If the player has paused the game between score-calculated and score-beat-played, the pulse fires the moment the math completes — possibly while the die is still in its rest pose, before the score-pop animation. Watch for this in manual verification. If it looks bad, the listener can be moved to fire on `onScoreBeat` with `kind: 'die-tick'` and look up which mods the die has — cheaper to wire but less spec-faithful.
- **Pilot exclusion list.** The listener gates on `triggerFx !== 'pulse'`. If a future mod is added to `MODS` without setting `visual.triggerFx`, the optional-chain returns undefined and the pulse skips. That's silent — a missing-visual mod gets no FX. Match the spec's "fallback safely on missing data" line. Verified by inspection.
- **Gilded's faceValue payload.** `roll.ts` uses `fakeResult.finalFaces` which is the post-physics, post-remap face. Gilded fires on every scoring die regardless of face, so the value is informational only — listener doesn't read it for pulse. Just noting that the value is post-remap (so e.g. a die with Loaded that started at 1 reports 6).
- **`firePulse`'s rAF runs even if the page is hidden.** rAF pauses naturally when the tab is backgrounded, so the pulse simply waits to complete when the user returns. No timer leak. Verified by browser semantics.
