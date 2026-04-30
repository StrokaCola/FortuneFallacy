# Dice Reorder + Build-Crafting Mods — Design Spec

**Topic:** Add player-controlled scoring order via 3D drag-and-drop in the hold strip, plus 3 new order-aware mods (Vanguard, Capstone, Conduit) that make ordering meaningful.

**Status:** Brainstorm complete. Ready for writing-plans.

---

## Context

Star Forge mod-visuals (Phases 1-7) and Alive Feel Sweep already shipped. Game has 13 mods today (10 chip/mult/face mods + 3 pilot trigger mods), comprehensive SFX, animated Forge codex, orbital score popup, button juice, etc.

Player request: make gameplay more compelling — add real strategic depth via build-crafting (option C from initial scope) plus dice drag-and-drop for scoring order control. The two combine: drag-reorder is the UI mechanism; new order-aware mods make order matter mathematically.

User chose option B from sub-decision: drag-reorder + 2-3 order-aware mods (skip A's cosmetic-only, skip C's adjacency-synergies, skip D's no-reorder). Hold-strip-only drag (option A from UI scope question). Raycast-based 3D drag (option L — most ambitious). State via `scoringOrder` array (option B for data shape).

---

## Goal

1. Players can drag-and-drop locked dice in the 3D hold strip to set the order in which they score.
2. 3 new mods fire bonuses based on scoring position: **Vanguard** (first-die bonus), **Capstone** (last-die bonus), **Conduit** (chain bonus per prior die).
3. Scoring math iterates dice in player-controlled order; visual score sequence reflects that order.

---

## Non-Goals

- Reorder of unlocked tray dice (locked-only via hold strip).
- Synergy effects between adjacent mods (deferred — separate "build identity" pass).
- Position-based mods beyond the 3 picked.
- Touchscreen drag (mouse only first; touch can follow in future).
- Reorder during physics roll (only after dice settle in hold).
- Compress/shuffle other held dice live during drag (Phase 1 = ghost-slot indicator only; live reflow on drop).
- New `ModDef.visual` field types beyond what Phase 2 defined.

---

## Architecture

### State + Action

**New state field on `RoundState`:**
```ts
scoringOrder: number[];   // dieIdx in scoring sequence; defaults to [0,1,2,3,4]
```

**Reset rules:**
- `ROLL_REQUESTED` → reset to canonical `[0, 1, 2, 3, 4]` (5 dice always; unlocked dice rejoin natural order).
- `TOGGLE_LOCK` lock → append dieIdx to scoringOrder (maintains current relative order).
- `TOGGLE_LOCK` unlock → remove dieIdx from scoringOrder.
- Initialized to `[0, 1, 2, 3, 4]` in round-init code.

**New action `REORDER_HOLD`:**
```ts
{ type: 'REORDER_HOLD', newOrder: number[] }
```
Reducer validates: every entry is a currently-locked die idx; length matches locked count; no duplicates. Replaces `state.round.scoringOrder` with the new array. No-op + dev warning on validation failure.

### 3 New Mods

Extend `ModDef` with:
```ts
firstBonus?: number;   // chips bonus when this die is first in scoring order
lastBonus?: number;    // chips bonus when this die is last
chainMult?: number;    // mult bonus per prior die scored (chainMult × position)
```

3 mods added to `MODS`:

| id | Name | Icon | Effect | Accent |
|----|------|------|--------|--------|
| `vanguard` | Vanguard | ◀ | +5 chips if scored first | `#ff7847` orange |
| `capstone` | Capstone | ▶ | +10 chips if scored last | `#5be8a4` jade green |
| `conduit` | Conduit | ⫸ | +1 mult per die scored before this one | `#bba8ff` lavender |

All 3 added to `MOD_IDS`. Each gets a `visual` block (materialKey + accent + triggerFx='pulse'). Each gets a `MOD_MATERIALS` entry:
- `vanguard` — bright orange flame finish (urgency, lead).
- `capstone` — deep teal/jade plated (capping, completion).
- `conduit` — purple electric thread finish (chain, energy flow).

### Scoring Engine

**Modify `applyModScoring` in `src-next/core/phases/upgrades.ts`** to iterate by scoring order:

```ts
const order = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
const scoringDice = order.filter((idx) => idx >= 0 && idx < faces.length);
for (let pos = 0; pos < scoringDice.length; pos++) {
  const i = scoringDice[pos]!;
  const face = faces[i]!;
  const mods = diceMods[i] ?? [];
  for (const id of mods) {
    const def = lookupMod(id);
    // existing per-mod logic...
    if (def.firstBonus && pos === 0) dChips += def.firstBonus;
    if (def.lastBonus && pos === scoringDice.length - 1) dChips += def.lastBonus;
    if (def.chainMult && pos > 0) dMult += def.chainMult * pos;
    // existing onModFired emission gate
  }
}
```

The `onModFired` event payload is unchanged. Position info is implicit (the order in which `onModFired` fires for the hand).

### 3D Drag-Reorder UX

**Where:** `src-next/render/three/Dice3D.ts`. The existing `attachClick` does pointerdown raycast for TOGGLE_LOCK. Extend pointer handling to distinguish drag from click.

**Pointer flow:**
1. **`pointerdown`** on a held die (locked, in scoringOrder) → record `dragStart = { dieIdx, screenX, screenY, time }`. Don't toggle lock yet.
2. **`pointermove`** → if `dragStart` exists AND screen-space delta > 6px AND the die is in scoringOrder → enter drag mode (`isDragging = true`). Cancel any pending lock toggle.
3. While dragging:
   - Project pointer ray onto a `THREE.Plane` at `y = HOLD_Y + 0.5` (slightly above hold strip).
   - Override dragged die's group position to follow projected pointer.
   - Determine candidate drop slot by X coordinate vs other held dice's slot positions.
   - Spawn/update a ghost-slot sprite at the candidate drop position (accent color = mod's accent or cyan).
4. **`pointerup`**:
   - If NOT dragging → existing TOGGLE_LOCK behavior (click).
   - If dragging → snap die back to grid Y, dispose ghost sprite, dispatch `REORDER_HOLD` with the new order computed from drop position.

**Cancel rules:**
- `pointerleave` on canvas → cancel drag, snap back to original slot, no dispatch.
- ESC key → same.
- A roll/play-hand event bus dispatch while dragging → forced cancel.

**State during drag** (Dice3D class fields):
```ts
private dragStart: { dieIdx: number; screenX: number; screenY: number; time: number } | null = null;
private isDragging = false;
private dragOriginalSlotX = 0;     // for cancel-snap-back
private dragGhostSlot: number | null = null;
private dragGhostSprite: THREE.Sprite | null = null;
```

### Visual Feedback During Drag

**Dragged die (while dragging):**
- Y position lifted by +0.6 above hold strip (smooth lerp on entering drag).
- Scale 1.15× (feels grabbed).
- Body emissive boost in mod's accent color (or cyan default).
- Subtle drop-shadow sprite below on hold strip plane (additive blending).

**Ghost-slot indicator:**
- Faint sprite at the candidate drop X-position on hold strip line.
- Pulses at 0.6Hz to draw the eye.
- Spawned when drag enters new candidate slot; updated as candidate changes.

**Other held dice:**
- Stay at grid positions (no live reflow). Ghost slot communicates intended swap. Dice reflow on drop (after `REORDER_HOLD` triggers `syncDice`).

**Cursor states:**
- Hover over held die → `cursor: grab`.
- During drag → `cursor: grabbing`.
- Set imperatively on canvas style attribute.

**Cancel feedback:**
- Drop outside hold strip OR ESC → die slides back to original slot in 200ms.
- Ghost sprite disposes.

**Snap-on-drop:**
- Die's lifted Y returns to HOLD_Y over 150ms.
- Ghost sprite disposes.
- After `REORDER_HOLD` dispatch, `syncDice` triggers — other dice reflow to new positions over 280ms (existing lerp infra).

**Reduced motion (`.reduce-motion` html class):**
- Drag is functional but no lift, no scale, no emissive boost, no ghost-slot pulse — direct position-following only. Drop snaps without lerp.

---

## Implementation Phasing

8 sub-tasks, dependency-ordered:

1. **State + REORDER_HOLD action** — add `scoringOrder` field, action variant, reducer logic, lock/unlock sync. Tests for state transitions.
2. **Scoring engine update** — `applyModScoring` iterates scoringOrder. Stub field reads (no-op since mods don't yet have these fields). Tests for order-driven iteration.
3. **3 new mods + ModDef extension** — extend ModDef, add Vanguard/Capstone/Conduit, update MOD_IDS. Tests for mod presence + visual contract.
4. **Pointer drag detection** — extend `attachClick` in Dice3D.ts with pointermove + drag-vs-click threshold. Track dragStart/isDragging state. Tests for drag-vs-click distinction.
5. **Drag follow-pointer + drop-snap** — project pointer onto drag plane, override dragged die position, compute target slot on drop, dispatch REORDER_HOLD. Tests for slot-snap math (extracted to pure helper for testability).
6. **Visual feedback during drag** — lift, scale, glow on dragged die; ghost-slot sprite; cursor updates. Reduced-motion path.
7. **MOD_MATERIALS entries** for the 3 new mods. Match Phase 2 pattern.
8. **Manual verification** — drag all 5 held dice into different orders, attach Vanguard/Capstone/Conduit, verify scoring correctness, observe ghost slot, test cancel via ESC, reduced-motion path.

Tasks 1-3 ship cleanly first (state + math). Tasks 4-6 add drag UX. Tasks 7-8 polish + verify.

---

## Critical Files

- `src-next/state/slices/round.ts` — add `scoringOrder` field + reset on roll.
- `src-next/actions/types.ts` — `REORDER_HOLD` action variant.
- `src-next/actions/handlers/dice.ts` — handle REORDER_HOLD; lock/unlock keep scoringOrder in sync.
- `src-next/actions/handlers/dice.test.ts` — tests for the above.
- `src-next/core/mods/index.ts` — extend ModDef, add 3 new mods, MOD_IDS.
- `src-next/core/phases/upgrades.ts` — applyModScoring iterates scoringOrder.
- `src-next/render/three/dieMaterials.ts` — 3 new MOD_MATERIALS entries.
- `src-next/render/three/Dice3D.ts` — drag detection, follow-pointer, drop-snap, visual feedback.
- `src-next/render/three/Dice3D.test.ts` (NEW or extend) — drag-vs-click + slot-snap math.

---

## Verification

**Automated tests:**
- `dice.test.ts` — REORDER_HOLD validates input; lock/unlock keeps scoringOrder in sync; reset on roll.
- `upgrades.test.ts` (extend) — Vanguard at pos 0; Capstone at last; Conduit scales by position. Test with scoringOrder=[3,1,4,0,2] to verify position-0 die is dieIdx 3.
- `mods/index.test.ts` (extend) — 13 mods total → 16; all have visual; MOD_IDS sync.
- Dice3D.ts drag/drop math — extract pure function `computeDropSlot(pointerX, slotXs)` and test directly.

**Manual end-to-end:**
- Lock all 5 dice. Drag leftmost held die to rightmost slot. Drop. Other dice reflow to new positions in ~280ms.
- Click (no drag) on a held die — TOGGLE_LOCK still works.
- Attach Vanguard to die 0. Lock + reorder so die 0 is first. Play. Confirm +5 chips on die 0's score-tick.
- Attach Capstone to die 0. Reorder so die 0 is last. Confirm +10 chips.
- Attach Conduit to die 0. Reorder so die 0 is position 4 (last of 5). Confirm +4 mult.
- Toggle OS reduced-motion → drag still works, no glow/scale/lift, functional.
- Press ESC mid-drag → die snaps back, no reorder dispatched.

**Acceptance:**
- All existing 298 tests pass.
- ~10 new tests pass.
- Production build clean.
- No console errors during drag/drop/score.
- Reduced-motion path verified.

---

## Open Questions / Risks

- **Drag in jsdom test environment.** Three.js raycasting + pointer events are hard to unit-test. Plan extracts pure-function helpers (`computeDropSlot`, drag-vs-click threshold check) so logic is testable; integration drag is verified manually.
- **Conflict with existing physics simulation.** Physics roll uses `Rapier` simulation. Held dice are NOT in active physics — they use lerp positioning. Drag overrides this lerp safely (sets position directly). When drag ends, lerp resumes from new position.
- **Scoring sequence visualization.** Existing `onScoreBeat` emits `kind: 'die-tick'` per scoring die. With reordered scoring, the die-ticks fire in scoringOrder (since `applyModScoring` iterates that way). Visual score-pop animations should already follow.
- **`onModFired` event ordering.** Phase 5 deferred-pulse-queue per die-idx — works for the new order since events are still tagged by `dieIdx`, just emitted in a different sequence.
- **Conduit + Mirror Pair stacking.** Mirror Pair adds mult per matching face; Conduit adds mult per prior position. Both fire on the same die — bonuses stack additively. Powerful at late positions; may need balancing pass after manual play.
- **Vanguard/Capstone with N=1.** If only 1 die is locked + scored, both first AND last apply (position 0 = first AND last). Spec accepts this (both fire). Could feel exploit-y; flag for tuning.

---

## Future Work (deferred)

- Cross-mod adjacency synergies (Sharpened+High Roller adjacent = bonus, etc.).
- Live reflow of other held dice during drag (currently ghost-only).
- Touch drag support (currently mouse only).
- Position-based mod expansions (third/middle bonuses, "Bookend" pattern).
- Migrate hold strip rendering from Dice3D.ts to DieView (Phase 7 sweep continuation).
- Drag-reorder of unlocked tray dice (currently hold-only).
