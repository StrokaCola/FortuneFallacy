# Dice Reorder + Build-Crafting Mods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add player-controlled scoring order via 3D drag-and-drop in the hold strip, plus 3 new order-aware mods (Vanguard, Capstone, Conduit) that make ordering meaningful.

**Architecture:** New `state.round.scoringOrder: number[]` tracks scoring sequence. New `REORDER_HOLD` action mutates it. `applyModScoring` iterates `scoringOrder` (instead of natural array order), threading position index to per-mod field reads. `Dice3D.ts` raycast handler distinguishes drag from click via 6px movement threshold; drag projects pointer onto a `THREE.Plane` at hold strip Y; drop computes target slot and dispatches `REORDER_HOLD`. Visual feedback: dragged die lifts + glows + scales; ghost-slot sprite at candidate drop position; cursor states.

**Tech Stack:** TypeScript + React 18 + Three.js 0.169 + Vitest + jsdom. No new dependencies.

**Spec source:** `docs/superpowers/specs/2026-04-30-dice-reorder-build-craft-design.md`.

**Phases 1-7 of Star Forge mod-visuals + Alive Feel Sweep already shipped on `main`.** 13 mods exist today; this plan adds 3 more (16 total).

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `src-next/state/slices/round.ts` | MODIFY | Add `scoringOrder: number[]` field to `RoundSlice` + initial value `[0, 1, 2, 3, 4]`. |
| `src-next/actions/types.ts` | MODIFY | Add `REORDER_HOLD` action variant. |
| `src-next/actions/handlers/dice.ts` | MODIFY | Handle `REORDER_HOLD`; update `TOGGLE_LOCK` to keep scoringOrder in sync. |
| `src-next/actions/handlers/roll.ts` | MODIFY | Reset `scoringOrder` to `[0, 1, 2, 3, 4]` on `ROLL_REQUESTED`. |
| `src-next/actions/handlers/dice.test.ts` | NEW or MODIFY | Tests for REORDER_HOLD validation, lock/unlock sync, roll-reset. |
| `src-next/core/mods/index.ts` | MODIFY | Extend `ModDef` with `firstBonus`/`lastBonus`/`chainMult`. Add 3 new mods to MODS + MOD_IDS. |
| `src-next/core/phases/upgrades.ts` | MODIFY | `applyModScoring` iterates `state.round.scoringOrder`; reads new mod fields. |
| `src-next/core/phases/upgrades.test.ts` | NEW | Tests for order-driven iteration + 3 new mod effects. |
| `src-next/render/three/dieMaterials.ts` | MODIFY | Add 3 new MOD_MATERIALS entries (vanguard/capstone/conduit). |
| `src-next/render/three/Dice3D.ts` | MODIFY | Pointer drag detection + threshold + drag follow + drop-snap + visual feedback (lift/scale/glow + ghost sprite + cursor). |
| `src-next/render/three/dragSlot.ts` | NEW | Pure helper: `computeDropSlot(pointerX, slotXs)` returns nearest-slot index. Extracted for testability since Three.js scene is hard to unit-test in jsdom. |
| `src-next/render/three/dragSlot.test.ts` | NEW | Tests for slot-snap math. |

**Decomposition rationale:** State + action are scoped to one slice + handlers. Scoring engine update is one function. Drag UX touches `Dice3D.ts` but the slot-math is extracted as a pure helper for testability. Mod definitions + materials are the pattern from Phases 2 + 6.

**Phasing:** Tasks 1-3 = state + math (purely logical, no UX). Tasks 4-6 = drag UX. Task 7 = visual polish for new mods. Task 8 = end-to-end verify.

---

## Task 1: State + REORDER_HOLD action

**Files:**
- Modify: `src-next/state/slices/round.ts`
- Modify: `src-next/actions/types.ts`
- Modify: `src-next/actions/handlers/dice.ts`
- Modify: `src-next/actions/handlers/roll.ts`
- Modify or Create: `src-next/actions/handlers/dice.test.ts`

### Step 1: Write the failing test

In `src-next/actions/handlers/dice.test.ts` (file may already exist with TOGGLE_LOCK tests; if not, create), add:

```ts
import { describe, it, expect } from 'vitest';
import { diceHandler } from './dice';
import { initialRoundSlice } from '../../state/slices/round';
import type { GameState } from '../../state/store';

const baseState = (): GameState => ({
  run: { seed: 1, shards: 0, ante: 1, goalIdx: 0, catalysts: [], vouchers: [], consumables: [], handsPlayed: 0, compoundingStacks: 0 },
  round: { ...initialRoundSlice() },
  shop: { open: false, offers: [], rerollCost: 5 },
  meta: { playerName: '', unlocks: [], highScores: [] },
  ui: { screen: 'round', paused: false },
} as GameState);

describe('REORDER_HOLD', () => {
  it('initializes scoringOrder to [0,1,2,3,4]', () => {
    const s = baseState();
    expect(s.round.scoringOrder).toEqual([0, 1, 2, 3, 4]);
  });

  it('replaces scoringOrder with newOrder when valid', () => {
    const s = baseState();
    const r = diceHandler({ type: 'REORDER_HOLD', newOrder: [4, 0, 2, 1, 3] }, s);
    expect(r.state.round.scoringOrder).toEqual([4, 0, 2, 1, 3]);
  });

  it('rejects newOrder with wrong length (no-op)', () => {
    const s = baseState();
    const r = diceHandler({ type: 'REORDER_HOLD', newOrder: [0, 1] }, s);
    expect(r.state.round.scoringOrder).toEqual([0, 1, 2, 3, 4]);
  });

  it('rejects newOrder with duplicates (no-op)', () => {
    const s = baseState();
    const r = diceHandler({ type: 'REORDER_HOLD', newOrder: [0, 0, 1, 2, 3] }, s);
    expect(r.state.round.scoringOrder).toEqual([0, 1, 2, 3, 4]);
  });

  it('rejects newOrder containing unlocked die idx (no-op)', () => {
    const s = baseState();
    // Unlock die 2 first.
    const sUnlocked = { ...s, round: { ...s.round, dice: s.round.dice.map((d, i) => i === 2 ? { ...d, locked: false } : d) } };
    // Try to reorder including die 2.
    const r = diceHandler({ type: 'REORDER_HOLD', newOrder: [0, 1, 2, 3, 4] }, sUnlocked);
    // scoringOrder was synced when die 2 was unlocked, so the reject case here is when length doesn't match locked count.
    // Simpler: try newOrder with die 2 (unlocked). Length is 5 but locked count is 4.
    expect(r.state.round.scoringOrder.length).not.toBe(5); // initial may have had 5 but unlock should drop to 4
  });
});
```

(Note: the "rejects newOrder containing unlocked die" test is approximate — the real validation is "length matches current locked count + only locked die idxs". Adjust the test to match the implementation's exact validation.)

### Step 2: Run test to verify it fails

Run: `npm test -- src-next/actions/handlers/dice.test.ts`
Expected: FAIL — `scoringOrder` field doesn't exist; `REORDER_HOLD` action variant doesn't exist.

### Step 3: Add `scoringOrder` to RoundSlice

In `src-next/state/slices/round.ts`, find the `RoundSlice` type (around line 3-34). Add a new field:

```ts
  scoringOrder: number[];
```

In `initialRoundSlice()` (around line 36-56), add:

```ts
  scoringOrder: [0, 1, 2, 3, 4],
```

The full updated type looks like:
```ts
export type RoundSlice = {
  active: boolean;
  // ...existing fields
  diceMods: string[][];
  scoringOrder: number[];   // NEW: dieIdx in scoring sequence
  // ...rest
};
```

### Step 4: Add `REORDER_HOLD` action variant

In `src-next/actions/types.ts`, find the `Action` union. Add:

```ts
  | { type: 'REORDER_HOLD'; newOrder: number[] }
```

before the closing `;`.

### Step 5: Implement REORDER_HOLD + lock/unlock sync in `dice.ts`

Replace the entire `src-next/actions/handlers/dice.ts` with:

```ts
import type { ActionHandler } from './types';
import { initialRoundSlice } from '../../state/slices/round';
import { lookupMod } from '../../core/mods';
import { maxModSlots } from '../../core/vouchers';

function lockedIdxs(dice: { locked: boolean }[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < dice.length; i++) if (dice[i]!.locked) out.push(i);
  return out;
}

export const diceHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'TOGGLE_LOCK': {
      const target = s.round.dice[a.dieIdx];
      if (!target) return { state: s, events: [] };
      const newLocked = !target.locked;
      const dice = s.round.dice.map((d, i) =>
        i === a.dieIdx ? { ...d, locked: newLocked } : d,
      );
      // Sync scoringOrder: append on lock, remove on unlock.
      let scoringOrder = s.round.scoringOrder ?? [];
      if (newLocked) {
        if (!scoringOrder.includes(a.dieIdx)) scoringOrder = [...scoringOrder, a.dieIdx];
      } else {
        scoringOrder = scoringOrder.filter((i) => i !== a.dieIdx);
      }
      return {
        state: { ...s, round: { ...s.round, dice, scoringOrder } },
        events: [{ type: 'onLockToggled', payload: { dieIdx: a.dieIdx, locked: newLocked } }],
      };
    }
    case 'RESET_ROUND':
      return { state: { ...s, round: initialRoundSlice() }, events: [] };
    case 'ATTACH_MOD': {
      if (!lookupMod(a.modId)) return { state: s, events: [] };
      const slots = s.round.diceMods[a.dieIdx];
      if (!slots || slots.length >= maxModSlots(s)) return { state: s, events: [] };
      const diceMods = s.round.diceMods.map((r, i) => (i === a.dieIdx ? [...r, a.modId] : r));
      return { state: { ...s, round: { ...s.round, diceMods } }, events: [] };
    }
    case 'DETACH_MOD': {
      const diceMods = s.round.diceMods.map((r, i) =>
        i === a.dieIdx ? r.filter((_, j) => j !== a.modIdx) : r,
      );
      return { state: { ...s, round: { ...s.round, diceMods } }, events: [] };
    }
    case 'REORDER_HOLD': {
      const locked = lockedIdxs(s.round.dice);
      const valid =
        a.newOrder.length === locked.length &&
        new Set(a.newOrder).size === a.newOrder.length &&
        a.newOrder.every((idx) => locked.includes(idx));
      if (!valid) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[REORDER_HOLD] invalid newOrder', a.newOrder, 'locked=', locked);
        }
        return { state: s, events: [] };
      }
      return {
        state: { ...s, round: { ...s.round, scoringOrder: a.newOrder } },
        events: [],
      };
    }
    default:
      return { state: s, events: [] };
  }
};
```

### Step 6: Reset scoringOrder on ROLL_REQUESTED

In `src-next/actions/handlers/roll.ts`, find the `ROLL_REQUESTED` case (around line 10-32). The handler builds a `workingState` for the simulation. After unlocking dice on first-roll (line 12-14), update workingState to reset `scoringOrder` so it matches the canonical order.

Find:
```ts
    case 'ROLL_REQUESTED': {
      const isFirstRoll = !s.round.firstRollDone;
      const dice = isFirstRoll
        ? s.round.dice.map((d) => ({ ...d, locked: false }))
        : s.round.dice;
      const workingState = {
```

Inside the workingState construction, add `scoringOrder` reset. Look for the workingState object literal — it likely spreads `s.round` then overrides specific fields. Add to the override:

```ts
        scoringOrder: dice.map((d, i) => (d.locked ? i : -1)).filter((i) => i >= 0),
```

(This recomputes scoringOrder to be the locked-dice indices in canonical order. After unlock-on-first-roll, this becomes `[]`. After a reroll, it stays whatever was already locked.)

If the workingState object isn't directly visible, search for `dice,` followed by other field overrides — that's where you add `scoringOrder`.

### Step 7: Run tests + typecheck

Run: `npm test -- src-next/actions/handlers/dice.test.ts`
Expected: PASS, all REORDER_HOLD tests + existing TOGGLE_LOCK tests.

Run: `npm test`
Expected: All tests pass (298 baseline + new = ~302+).

Run: `npx tsc --noEmit`
Expected: No new errors.

### Step 8: Commit

```bash
git add src-next/state/slices/round.ts src-next/actions/types.ts src-next/actions/handlers/dice.ts src-next/actions/handlers/dice.test.ts src-next/actions/handlers/roll.ts
git commit -m "feat(state): add scoringOrder + REORDER_HOLD action with lock/unlock sync"
```

---

## Task 2: applyModScoring iterates scoringOrder

**Files:**
- Modify: `src-next/core/phases/upgrades.ts`
- Create: `src-next/core/phases/upgrades.test.ts`

### Step 1: Write the failing test

```ts
// src-next/core/phases/upgrades.test.ts
import { describe, it, expect } from 'vitest';
import { upgrades } from './upgrades';
import { Phase } from '../pipeline/types';
import { initialRoundSlice } from '../../state/slices/round';
import type { PipelineCtx } from '../pipeline/types';
import type { GameState } from '../../state/store';

function makeCtx(faces: number[], diceMods: string[][], scoringOrder: number[]): PipelineCtx {
  const state = {
    run: { seed: 1, shards: 0, ante: 1, goalIdx: 0, catalysts: [], vouchers: [], consumables: [], handsPlayed: 0, compoundingStacks: 0 },
    round: {
      ...initialRoundSlice(),
      diceMods,
      scoringOrder,
    },
    shop: { open: false, offers: [], rerollCost: 5 },
    meta: { playerName: '', unlocks: [], highScores: [] },
    ui: { screen: 'round' as const, paused: false },
  } as GameState;
  return {
    state,
    chips: 0,
    mult: 1,
    events: [],
    sim: { finalFaces: faces, restPositions: [], settleMs: [], peakVelocity: 0, collisionCount: 0, bounceHeights: [], frames: [] },
  } as PipelineCtx;
}

describe('applyModScoring with scoringOrder', () => {
  it('iterates dice in scoringOrder', () => {
    // 3 dice, only first 3 used. Scoring order [2,0,1].
    const ctx = makeCtx([4, 5, 6, 1, 1], [['amplify'], [], []], [2, 0, 1]);
    const out = upgrades(ctx);
    // Each Amplify gives +2 chips. Only die 0 has Amplify. Should fire once.
    expect(out.chips).toBe(2);
  });

  it('does not iterate dice not in scoringOrder', () => {
    const ctx = makeCtx([4, 5, 6, 1, 1], [['amplify'], ['amplify'], ['amplify']], [0]);
    const out = upgrades(ctx);
    // Only die 0 in scoringOrder; only its Amplify fires.
    expect(out.chips).toBe(2);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- src-next/core/phases/upgrades.test.ts`
Expected: FAIL — currently iterates `faces.length`, not scoringOrder.

### Step 3: Modify `applyModScoring` in `src-next/core/phases/upgrades.ts`

Find the existing `applyModScoring` function (around line 29-65). Replace the body of the function:

```ts
const applyModScoring: PhaseFn = (ctx) => {
  const faces = ctx.sim?.finalFaces ?? [];
  const diceMods = ctx.state.round.diceMods;
  const fallbackOrder = faces.map((_, i) => i);
  const order = ctx.state.round.scoringOrder ?? fallbackOrder;
  // Filter to valid indices in case scoringOrder references stale dice.
  const scoringDice = order.filter((idx) => idx >= 0 && idx < faces.length);

  let chips = ctx.chips;
  let mult = ctx.mult;
  const events = [...ctx.events];

  for (let pos = 0; pos < scoringDice.length; pos++) {
    const i = scoringDice[pos]!;
    const face = faces[i]!;
    const mods = diceMods[i] ?? [];
    for (const id of mods) {
      const def = lookupMod(id);
      if (!def) continue;
      let dChips = 0;
      let dMult = 0;
      if (def.scoreBonus) dChips += def.scoreBonus;
      if (def.multBonus) dMult += def.multBonus;
      if (def.snakeEyes && face === 1) dMult += def.snakeEyes;
      if (def.highFaceMult && (face === 5 || face === 6)) dMult += def.highFaceMult;
      if (def.chipPerPip) dChips += def.chipPerPip * face;
      if (def.evenFaceMult && face % 2 === 0) dMult += def.evenFaceMult;
      if (def.pairBonus) {
        const matches = faces.filter((f) => f === face).length - 1;
        if (matches > 0) dMult += def.pairBonus * matches;
      }
      // NEW: order-aware fields. Stub reads (no mods have these yet — Task 3 adds them).
      if (def.firstBonus && pos === 0) dChips += def.firstBonus;
      if (def.lastBonus && pos === scoringDice.length - 1) dChips += def.lastBonus;
      if (def.chainMult && pos > 0) dMult += def.chainMult * pos;
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
    }
  }
  return { ...ctx, chips, mult, events };
};
```

### Step 4: Run tests to verify they pass

Run: `npm test -- src-next/core/phases/upgrades.test.ts`
Expected: PASS, 2 new tests.

Run: `npm test`
Expected: All tests pass.

### Step 5: Commit

```bash
git add src-next/core/phases/upgrades.ts src-next/core/phases/upgrades.test.ts
git commit -m "feat(scoring): applyModScoring iterates scoringOrder; reads firstBonus/lastBonus/chainMult"
```

---

## Task 3: 3 new mods + ModDef extension

**Files:**
- Modify: `src-next/core/mods/index.ts`
- Modify: `src-next/core/mods/index.test.ts`

### Step 1: Add tests for new mods

In `src-next/core/mods/index.test.ts`, append to the existing test file:

```ts
describe('order-aware mods', () => {
  it('vanguard mod exists with firstBonus: 5', () => {
    const m = MODS.find((x) => x.id === 'vanguard');
    expect(m).toBeDefined();
    expect(m?.firstBonus).toBe(5);
  });

  it('capstone mod exists with lastBonus: 10', () => {
    const m = MODS.find((x) => x.id === 'capstone');
    expect(m).toBeDefined();
    expect(m?.lastBonus).toBe(10);
  });

  it('conduit mod exists with chainMult: 1', () => {
    const m = MODS.find((x) => x.id === 'conduit');
    expect(m).toBeDefined();
    expect(m?.chainMult).toBe(1);
  });

  it('all 3 new mods have visual blocks with valid materialKey + accent', () => {
    const ids = ['vanguard', 'capstone', 'conduit'];
    for (const id of ids) {
      const m = MODS.find((x) => x.id === id);
      expect(m?.visual?.materialKey).toBe(id);
      expect(m?.visual?.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(m?.visual?.triggerFx).toBe('pulse');
    }
  });

  it('MODS has 16 entries total (13 prior + 3 new)', () => {
    expect(MODS.length).toBe(16);
  });

  it('MOD_IDS includes the 3 new ids', () => {
    expect(MOD_IDS).toContain('vanguard');
    expect(MOD_IDS).toContain('capstone');
    expect(MOD_IDS).toContain('conduit');
  });
});
```

(If `MODS` and `MOD_IDS` aren't already imported, add them to the existing import line at the top.)

### Step 2: Run test to verify it fails

Run: `npm test -- src-next/core/mods/index.test.ts`
Expected: FAIL — new mods don't exist.

### Step 3: Extend `ModDef` and add 3 new mods

In `src-next/core/mods/index.ts`, find the `ModDef` type. Add 3 new optional fields:

```ts
  firstBonus?: number;
  lastBonus?: number;
  chainMult?: number;
```

Find the `MOD_IDS` const. Append the 3 new ids:

```ts
export const MOD_IDS = [
  'amplify',
  // ...existing 13 ids
  'vanguard',
  'capstone',
  'conduit',
] as const;
```

Find the `MODS` array. Append 3 new entries:

```ts
  {
    id: 'vanguard', name: 'Vanguard', icon: '◀',
    desc: '+5 chips if scored first',
    firstBonus: 5,
    visual: { materialKey: 'vanguard', accentColor: '#ff7847', triggerFx: 'pulse' },
  },
  {
    id: 'capstone', name: 'Capstone', icon: '▶',
    desc: '+10 chips if scored last',
    lastBonus: 10,
    visual: { materialKey: 'capstone', accentColor: '#5be8a4', triggerFx: 'pulse' },
  },
  {
    id: 'conduit', name: 'Conduit', icon: '⫸',
    desc: '+1 mult per die scored before this one',
    chainMult: 1,
    visual: { materialKey: 'conduit', accentColor: '#bba8ff', triggerFx: 'pulse' },
  },
```

### Step 4: Run tests + typecheck

Run: `npm test -- src-next/core/mods/index.test.ts`
Expected: PASS, 6 new tests.

Run: `npm test`
Expected: All tests pass.

Run: `npx tsc --noEmit`
Expected: TypeScript may complain that `ModMaterialKey` doesn't include `vanguard`/`capstone`/`conduit`. Task 7 (MOD_MATERIALS) fixes this. For now, if the typecheck fails on those keys, that's expected — proceed to Task 7 next OR temporarily mark the visual.materialKey type as `string` (revert in Task 7).

A cleaner ordering: do Task 7 (materials) BEFORE Task 3 (mods), so the materialKey union includes the new ids before mods reference them. Alternatively, add the materials in this same task. For simplicity, this plan does Task 7 separately — typecheck will surface the gap, and the next task closes it.

### Step 5: Commit

```bash
git add src-next/core/mods/index.ts src-next/core/mods/index.test.ts
git commit -m "feat(mods): add Vanguard/Capstone/Conduit + ModDef order-aware fields"
```

---

## Task 4: Pointer drag detection in Dice3D

**Files:**
- Modify: `src-next/render/three/Dice3D.ts`
- Create: `src-next/render/three/dragSlot.ts`
- Create: `src-next/render/three/dragSlot.test.ts`

### Step 1: Write the failing test for dragSlot helper

```ts
// src-next/render/three/dragSlot.test.ts
import { describe, it, expect } from 'vitest';
import { computeDropSlot } from './dragSlot';

describe('computeDropSlot', () => {
  it('returns 0 when pointer is closest to first slot', () => {
    expect(computeDropSlot(-2.5, [-2.0, -1.0, 0.0, 1.0, 2.0])).toBe(0);
  });

  it('returns last index when pointer is closest to last slot', () => {
    expect(computeDropSlot(2.4, [-2.0, -1.0, 0.0, 1.0, 2.0])).toBe(4);
  });

  it('returns middle index when pointer is closest to middle slot', () => {
    expect(computeDropSlot(0.1, [-2.0, -1.0, 0.0, 1.0, 2.0])).toBe(2);
  });

  it('handles single-slot case', () => {
    expect(computeDropSlot(99, [0])).toBe(0);
  });

  it('handles empty slots (returns -1)', () => {
    expect(computeDropSlot(0, [])).toBe(-1);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- src-next/render/three/dragSlot.test.ts`
Expected: FAIL — module not found.

### Step 3: Implement `dragSlot.ts`

```ts
// src-next/render/three/dragSlot.ts

/**
 * Given a pointer X coordinate (world or screen, doesn't matter as long as
 * slot Xs are in the same space) and an array of slot X positions, return
 * the index of the nearest slot. Returns -1 if slots is empty.
 */
export function computeDropSlot(pointerX: number, slotXs: number[]): number {
  if (slotXs.length === 0) return -1;
  let bestIdx = 0;
  let bestDist = Math.abs(pointerX - slotXs[0]!);
  for (let i = 1; i < slotXs.length; i++) {
    const d = Math.abs(pointerX - slotXs[i]!);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- src-next/render/three/dragSlot.test.ts`
Expected: PASS, 5 tests.

### Step 5: Add drag detection to `Dice3D.ts`

In `src-next/render/three/Dice3D.ts`, add new private fields to the `Dice3D` class (find the existing field declarations near the top of the class body, around lines 175-190):

```ts
  // Drag-reorder state (Phase: dice reorder).
  private dragStart: { dieIdx: number; screenX: number; screenY: number; time: number } | null = null;
  private isDragging = false;
  private dragOriginalSlotX = 0;
  private dragGhostSlot: number | null = null;
  private dragGhostSprite: THREE.Sprite | null = null;
  private dragPlane: THREE.Plane | null = null;
  private onPointerMove: ((ev: PointerEvent) => void) | null = null;
  private onPointerUp: ((ev: PointerEvent) => void) | null = null;
```

Find the existing `attachClick()` method. The current implementation only handles `pointerdown`. Replace its body with drag-detection-aware logic. New full method:

```ts
  private attachClick(): void {
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -HOLD_Y);

    this.onPointerDown = (ev: PointerEvent) => {
      // Skip if any die is mid-roll/playback.
      if (this.dice.some((d) => d.playback != null || d.rolling)) return;

      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);

      const groups = this.dice.map((d) => d.group);
      const hits = this.raycaster.intersectObjects(groups, true);
      if (hits.length === 0) return;

      let obj: THREE.Object3D | null = hits[0]!.object;
      while (obj && !groups.includes(obj as THREE.Group)) obj = obj.parent;
      if (!obj) return;

      const idx = groups.indexOf(obj as THREE.Group);
      if (idx < 0) return;

      // Record drag start (for click-vs-drag discrimination).
      this.dragStart = {
        dieIdx: idx,
        screenX: ev.clientX,
        screenY: ev.clientY,
        time: performance.now(),
      };
    };

    this.onPointerMove = (ev: PointerEvent) => {
      if (!this.dragStart) return;
      const dx = ev.clientX - this.dragStart.screenX;
      const dy = ev.clientY - this.dragStart.screenY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (!this.isDragging && dist > 6) {
        // Enter drag mode if the die is locked (in scoringOrder).
        const die = this.dice[this.dragStart.dieIdx];
        if (!die || !die.locked) {
          this.dragStart = null;
          return;
        }
        this.isDragging = true;
        this.dragOriginalSlotX = die.group.position.x;
        this.canvas.style.cursor = 'grabbing';
      }
      if (this.isDragging) {
        // Project pointer onto drag plane, follow.
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const target = new THREE.Vector3();
        if (this.dragPlane && this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
          const die = this.dice[this.dragStart.dieIdx];
          if (die) {
            die.group.position.x = target.x;
            // Y stays at HOLD_Y (we'll add lift in Task 6).
          }
        }
      }
    };

    this.onPointerUp = (_ev: PointerEvent) => {
      if (!this.dragStart) return;
      if (this.isDragging) {
        // Drag end: compute drop slot, dispatch REORDER_HOLD.
        const draggedIdx = this.dragStart.dieIdx;
        const draggedDie = this.dice[draggedIdx];
        if (draggedDie) {
          // Get current scoringOrder + slot Xs (excluding dragged die's current slot).
          const lockedDice = this.dice
            .map((d, i) => ({ d, i }))
            .filter((x) => x.d.locked && x.i !== draggedIdx);
          const slotXs: number[] = [];
          const currentOrder = store.getState().round.scoringOrder ?? [];
          // Compute the X for each locked-other die at its current order position.
          const otherInOrder = currentOrder.filter((i) => i !== draggedIdx);
          for (let pos = 0; pos < otherInOrder.length; pos++) {
            slotXs.push(this.holdSlotX(pos, otherInOrder.length + 1));
          }
          // Add a final slot at the end.
          slotXs.push(this.holdSlotX(otherInOrder.length, otherInOrder.length + 1));

          const slotIdx = computeDropSlot(draggedDie.group.position.x, slotXs);
          if (slotIdx >= 0) {
            const newOrder = [...otherInOrder];
            newOrder.splice(slotIdx, 0, draggedIdx);
            dispatch({ type: 'REORDER_HOLD', newOrder });
          }
        }
        this.isDragging = false;
        this.canvas.style.cursor = '';
      } else {
        // Click (no drag): toggle lock.
        const idx = this.dragStart.dieIdx;
        dispatch({ type: 'TOGGLE_LOCK', dieIdx: idx });
      }
      this.dragStart = null;
    };

    document.addEventListener('pointerdown', this.onPointerDown);
    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerup', this.onPointerUp);
  }
```

Add `import { computeDropSlot } from './dragSlot';` to the imports at the top of Dice3D.ts.

Update the `destroy()` method to remove the new pointer handlers. Find the existing destroy logic (around line 595-600):

```ts
  destroy(): void {
    if (this.rafHandle != null) cancelAnimationFrame(this.rafHandle);
    this.unsubscribers.forEach((u) => u());
    if (this.onPointerDown) document.removeEventListener('pointerdown', this.onPointerDown);
    if (this.onPointerMove) document.removeEventListener('pointermove', this.onPointerMove);
    if (this.onPointerUp) document.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.dispose();
  }
```

### Step 6: Run all tests + typecheck

Run: `npm test`
Expected: All tests pass.

Run: `npx tsc --noEmit`
Expected: No new error categories.

### Step 7: Commit

```bash
git add src-next/render/three/Dice3D.ts src-next/render/three/dragSlot.ts src-next/render/three/dragSlot.test.ts
git commit -m "feat(dice3d): pointer drag detection + drop-slot dispatch (REORDER_HOLD)"
```

---

## Task 5: Drag follow-pointer + drop-snap (already covered in Task 4)

Task 4 covers both drag detection AND drop-snap dispatch in one cohesive change. Skip Task 5 as a separate task — it's already done.

(Plan correction: original spec listed pointer detection and drop-snap as separate tasks. Combining them avoids partial-state commits where drag works but drop is broken.)

---

## Task 6: Visual feedback during drag

**Files:**
- Modify: `src-next/render/three/Dice3D.ts`

### Step 1: Add lift + scale + glow + ghost sprite

In `Dice3D.ts`, modify the `onPointerMove` handler (added in Task 4). Find the `if (this.isDragging) { ... }` block. Replace its body:

```ts
      if (this.isDragging) {
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const target = new THREE.Vector3();
        if (this.dragPlane && this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
          const die = this.dice[this.dragStart.dieIdx];
          if (die) {
            const reduced = document.documentElement.classList.contains('reduce-motion');
            die.group.position.x = target.x;
            die.group.position.y = reduced ? HOLD_Y : HOLD_Y + 0.6;        // lift
            die.group.position.z = HOLD_Z;
            const targetScale = reduced ? HOLD_SCALE : HOLD_SCALE * 1.15;
            die.group.scale.setScalar(targetScale);

            // Update ghost-slot sprite.
            const lockedOthers = this.dice
              .map((d, i) => ({ d, i }))
              .filter((x) => x.d.locked && x.i !== this.dragStart!.dieIdx);
            const order = store.getState().round.scoringOrder ?? [];
            const otherInOrder = order.filter((i) => i !== this.dragStart!.dieIdx);
            const slotXs: number[] = [];
            for (let pos = 0; pos < otherInOrder.length + 1; pos++) {
              slotXs.push(this.holdSlotX(pos, otherInOrder.length + 1));
            }
            const slotIdx = computeDropSlot(target.x, slotXs);
            this.updateGhostSlot(slotIdx, slotXs);
          }
        }
      }
```

Add a helper method to the class for ghost-sprite management:

```ts
  private updateGhostSlot(slotIdx: number, slotXs: number[]): void {
    if (slotIdx < 0 || slotIdx >= slotXs.length) {
      this.disposeGhostSlot();
      return;
    }
    if (this.dragGhostSlot === slotIdx && this.dragGhostSprite) {
      // Position update (same slot — no respawn needed).
      this.dragGhostSprite.position.x = slotXs[slotIdx]!;
      return;
    }
    this.disposeGhostSlot();
    const accent = '#7be3ff';     // Default cyan; future: read mod accent.
    const mat = new THREE.SpriteMaterial({
      map: getHaloTexture(),
      color: accent,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(slotXs[slotIdx]!, HOLD_Y - DIE_SIZE / 2 - 0.05, HOLD_Z);
    sprite.scale.set(DIE_SIZE * 1.4, DIE_SIZE * 1.4, 1);
    this.scene.add(sprite);
    this.dragGhostSprite = sprite;
    this.dragGhostSlot = slotIdx;
  }

  private disposeGhostSlot(): void {
    if (this.dragGhostSprite) {
      this.scene.remove(this.dragGhostSprite);
      const mat = this.dragGhostSprite.material as THREE.SpriteMaterial;
      mat.dispose();
      this.dragGhostSprite = null;
      this.dragGhostSlot = null;
    }
  }
```

In the `onPointerUp` handler (added in Task 4), call `this.disposeGhostSlot()` at the end:

```ts
    this.onPointerUp = (_ev: PointerEvent) => {
      if (!this.dragStart) return;
      if (this.isDragging) {
        // ...existing dispatch logic...
        this.disposeGhostSlot();
        this.isDragging = false;
        this.canvas.style.cursor = '';
      } else {
        const idx = this.dragStart.dieIdx;
        dispatch({ type: 'TOGGLE_LOCK', dieIdx: idx });
      }
      this.dragStart = null;
    };
```

Also handle ESC cancel + `pointerleave`. Add a new event listener in `attachClick()`:

```ts
    this.onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && this.isDragging) {
        this.cancelDrag();
      }
    };
    document.addEventListener('keydown', this.onKeyDown);

    this.onPointerLeave = () => {
      if (this.isDragging) this.cancelDrag();
    };
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
```

Add the `cancelDrag` method:

```ts
  private cancelDrag(): void {
    if (!this.dragStart || !this.isDragging) return;
    const die = this.dice[this.dragStart.dieIdx];
    if (die) {
      // Snap back: position handled by syncDice on next render frame.
      die.group.position.x = this.dragOriginalSlotX;
      die.group.position.y = HOLD_Y;
      die.group.scale.setScalar(HOLD_SCALE);
    }
    this.disposeGhostSlot();
    this.isDragging = false;
    this.canvas.style.cursor = '';
    this.dragStart = null;
  }
```

Add new fields:

```ts
  private onKeyDown: ((ev: KeyboardEvent) => void) | null = null;
  private onPointerLeave: (() => void) | null = null;
```

Update `destroy()` to remove these listeners too.

Also: hover cursor. In `onPointerMove`, before the drag-detection check, add a cursor-update branch:

```ts
    this.onPointerMove = (ev: PointerEvent) => {
      // Hover cursor: show 'grab' when over a held die (when not dragging).
      if (!this.isDragging && !this.dragStart) {
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const groups = this.dice.map((d) => d.group);
        const hits = this.raycaster.intersectObjects(groups, true);
        let hovered: THREE.Group | null = null;
        if (hits.length > 0) {
          let obj: THREE.Object3D | null = hits[0]!.object;
          while (obj && !groups.includes(obj as THREE.Group)) obj = obj.parent;
          hovered = obj as THREE.Group | null;
        }
        const idx = hovered ? groups.indexOf(hovered) : -1;
        const isLocked = idx >= 0 && this.dice[idx]?.locked;
        this.canvas.style.cursor = isLocked ? 'grab' : '';
      }
      // ...rest of drag-state handling
      if (!this.dragStart) return;
      const dx = ev.clientX - this.dragStart.screenX;
      // ...etc (existing drag logic from Task 4)
    };
```

### Step 2: Run tests + typecheck

Run: `npm test`
Expected: All tests still pass (visual feedback isn't unit-tested; verified manually in Task 8).

Run: `npx tsc --noEmit`
Expected: No new errors.

### Step 3: Commit

```bash
git add src-next/render/three/Dice3D.ts
git commit -m "feat(dice3d): drag visual feedback — lift/scale/glow + ghost slot + cursor + cancel"
```

---

## Task 7: MOD_MATERIALS entries for new mods

**Files:**
- Modify: `src-next/render/three/dieMaterials.ts`

### Step 1: Add 3 new entries to MOD_MATERIALS

In `src-next/render/three/dieMaterials.ts`, append to the `MOD_MATERIALS` const:

```ts
  // 14. Vanguard — Bright orange flame finish (urgency, lead).
  vanguard: {
    bodyTint: 0xff7847, bodyDeep: 0x6b1f08,
    edge: 0xffb074, halo: 0xff7847,
    transmission: 0.30, rough: 0.35, eIntensity: 1.8,
  },
  // 15. Capstone — Deep teal/jade plated (capping, completion).
  capstone: {
    bodyTint: 0x5be8a4, bodyDeep: 0x1f5a3e,
    edge: 0x9bf0c8, halo: 0x5be8a4,
    transmission: 0.25, rough: 0.40, eIntensity: 1.4,
    metalness: 0.3,
  },
  // 16. Conduit — Purple electric thread finish (chain, energy flow).
  conduit: {
    bodyTint: 0x8a6ad4, bodyDeep: 0x2e1d6b,
    edge: 0xe0c8ff, halo: 0xbba8ff,
    transmission: 0.18, rough: 0.30, eIntensity: 2.0,
  },
```

### Step 2: Run tests + typecheck

Run: `npm test`
Expected: All tests pass.

Run: `npx tsc --noEmit`
Expected: No new errors. The `Record<ModId, ModMaterialOverride>` type now requires entries for vanguard/capstone/conduit; this commit satisfies that.

### Step 3: Commit

```bash
git add src-next/render/three/dieMaterials.ts
git commit -m "feat(materials): add Vanguard/Capstone/Conduit mod materials"
```

---

## Task 8: Manual verification + acceptance check

**Acceptance criteria** (from spec):

- Drag-reorder works in 3D hold strip — drag moves die smoothly, ghost slot indicates target.
- Drop dispatches `REORDER_HOLD` and dice reflow to new positions.
- Click (no drag) on a held die still triggers `TOGGLE_LOCK`.
- Vanguard fires `+5 chips` only when scored first.
- Capstone fires `+10 chips` only when scored last.
- Conduit fires `+1 mult per prior position` (e.g. position 4 → +4 mult).
- ESC mid-drag cancels reorder.
- Reduced-motion path: drag still functional, no lift/scale/glow/ghost.

### Steps:

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` from the worktree.

- [ ] **Step 2: Reach round, lock all 5 dice**

Navigate to a round. Roll. Lock all 5 dice (or use dev console state-set to lock all).

- [ ] **Step 3: Drag a held die**

Click and drag the leftmost held die to the rightmost slot. Observe:
- Die lifts upward + scales up + glows.
- Ghost slot sprite appears at candidate drop position.
- Other held dice stay at their grid positions.

Drop. Observe:
- Die snaps to new slot.
- Other dice reflow to fill the gap (over ~280ms).

- [ ] **Step 4: Verify click still toggles lock**

Click (no drag) on a held die. Confirm it unlocks and slides back to tray.

- [ ] **Step 5: Test Vanguard mod**

Use dev console to attach Vanguard to die 0:
```js
// In dev console state tab:
// Path: round.diceMods
// Value: [["vanguard"], [], [], [], []]
```

Lock all dice. Drag die 0 to position 0 (first). Roll, play hand. Confirm score-tick animation includes +5 chips on die 0.

Drag die 0 to position 4 (last). Play. Confirm die 0 does NOT get +5 (Vanguard only fires at position 0).

- [ ] **Step 6: Test Capstone mod**

Detach Vanguard. Attach Capstone to die 0. Reorder so die 0 is last. Play. Confirm +10 chips on die 0's score-tick.

- [ ] **Step 7: Test Conduit mod**

Detach Capstone. Attach Conduit to die 0. Reorder so die 0 is at position 4 (last of 5). Play. Confirm +4 mult bonus on die 0's score-tick.

Move die 0 to position 0. Play. Confirm NO mult bonus from Conduit (position 0 = no prior dice).

- [ ] **Step 8: Test ESC cancel**

Start dragging a held die. Move it partway. Press ESC. Confirm:
- Die snaps back to original slot.
- No `REORDER_HOLD` dispatched (scoringOrder unchanged).

- [ ] **Step 9: Test reduced-motion**

Toggle OS "reduce motion". Drag a held die. Confirm:
- Drag still works (functional).
- No lift, no scale, no glow.
- No ghost slot pulse.

- [ ] **Step 10: Run full automated suite**

Run: `npm test`, `npm run build`, `npx tsc --noEmit`.
Expected: tests pass; production build succeeds; no new typecheck errors.

- [ ] **Step 11: No commit needed**

If any tweak needed (e.g. lift too high, ghost too dim), tune in `Dice3D.ts` and commit:

```bash
git add src-next/render/three/Dice3D.ts
git commit -m "tune(dice3d): adjust drag <param> — <reason>"
```

Otherwise this task is complete.

---

## Verification (whole feature, automated)

Run from the worktree root:

- [ ] `npm test` → all tests pass (existing 298 + ~10 new = **~308 expected**).
- [ ] `npx tsc --noEmit` → no new error categories.
- [ ] `npm run build` → production build succeeds.

---

## Out of Scope (future)

- Cross-mod adjacency synergies.
- Live reflow of other held dice during drag.
- Touch drag support.
- Position-based mod expansions (third/middle bonuses, "Bookend" pattern).
- Migrate hold strip rendering from Dice3D.ts to DieView (Phase 7 sweep continuation).
- Drag-reorder of unlocked tray dice.

---

## Notes / Open Risks

- **Three.js drag tests in jsdom.** Pure-function helper `computeDropSlot` is unit-tested. The integration drag flow is verified manually in Task 8.
- **Conflict with existing physics.** Held dice are NOT in active physics — Dice3D uses lerp positioning. Drag overrides this safely. When drag ends, lerp resumes from new position via `syncDice`.
- **Vanguard/Capstone with N=1 die.** Only 1 die scoring → position 0 = both first AND last. Both fire (extra exploit-y). Spec accepts this; flag for tuning.
- **Conduit + Mirror Pair stacking.** Both add mult; both fire on the same die. Powerful at late positions; may need balancing pass after manual play.
- **TypeScript ordering risk in Task 3.** Adding mods to MODS before extending MOD_MATERIALS may fail typecheck on `materialKey: 'vanguard'` (not yet a valid ModMaterialKey). Workaround: do Task 7 immediately after Task 3 (or before). The plan does Task 3 first to keep test-first discipline; Task 7 closes the gap one commit later.
- **`document.addEventListener` for pointer events.** Listening on `document` instead of `canvas` ensures drag continues if pointer leaves canvas mid-drag. Existing `attachClick` already used this pattern. `pointerleave` listener is on canvas (not document) for cancel behavior.
- **Drag while scoring is active.** If the user starts a drag during a score sequence, drop happens but the dispatched REORDER_HOLD doesn't affect mid-flight scoring (math already ran). The next hand uses the new order. Acceptable — score sequence is short.
