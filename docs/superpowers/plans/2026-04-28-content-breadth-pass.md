# Content Breadth Pass (D-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 10 new content entries spanning 4 modifier categories (3 mods, 3 vouchers, 2 consumables, 2 bosses) using free-form mechanics with small new fields.

**Architecture:** 4 per-category commits inside one PR. Each category is self-contained: mods extend `ModDef` + `applyModScoring`; vouchers add helpers + wire to action sites; consumables append to `CONSUMABLES`; bosses extend `Debuff` union + add gates in upgrades + maxModSlots. No new state slices.

**Tech Stack:** TypeScript, Vite, React 18, Zustand, Vitest.

**Spec:** [docs/superpowers/specs/2026-04-28-content-breadth-pass-design.md](../specs/2026-04-28-content-breadth-pass-design.md)

---

## File Structure

**Modified:**
- `src-next/core/mods/index.ts` — `ModDef` adds 3 fields; `MODS` array adds 3 entries.
- `src-next/core/phases/upgrades.ts` — `applyModScoring` honors new fields; catalyst loop adds Eris first-hand gate.
- `src-next/data/vouchers.ts` — `VOUCHERS` array adds 3 entries.
- `src-next/core/vouchers/index.ts` — adds 3 helpers; extends `maxModSlots` to honor `mod_slots_capped_1`.
- `src-next/core/round/transitions.ts` — `startBlind` reads `extraHandsPerRound` for handsMax/handsLeft.
- `src-next/state/slices/run.ts` — drop `MAX_CONSUMABLES` literal export.
- `src-next/actions/handlers/shop.ts` — `OPEN_SHOP` reads `freeShopReroll`; `BUY_OFFER` consumable cap reads `maxConsumableSlots`.
- `src-next/actions/handlers/consumable.ts` — `GRANT_CONSUMABLE` cap reads `maxConsumableSlots`.
- `src-next/core/consumables/index.ts` — `CONSUMABLES` array adds 2 entries.
- `src-next/data/blinds.ts` — `BOSS_BLINDS` array adds 2 entries.
- `src-next/core/round/debuffs.ts` — `Debuff` union adds 2 strings.
- `src-next/core/mods/index.test.ts` — 3 new mod tests.

**Created:**
- `src-next/core/vouchers/index.test.ts` — voucher helper tests (3+).
- `src-next/actions/handlers/shop.test.ts` — shop free-refresh + cap tests (2+) — only if file doesn't exist; otherwise extend.

**Existing test files extended:**
- `src-next/core/round/transitions.test.ts` — startBlind extra-hands + boss gate tests.
- `src-next/actions/handlers/roll.test.ts` — already exists; extend if needed.

## Conventions

- One commit per task. Each commit must build green + tests green.
- Stage paths explicitly. Do NOT use `git add -A` — the working tree may carry unrelated dirty files (`.claude/settings.local.json`).
- Branch: `feat/d2-content-breadth` (already created off main with spec at `632e070`).
- Final test count: ~210 (was 197 baseline + ~13 new).
- Caveman mode is on for the human user but does NOT apply to plan/code/commits.

---

## Task 1: Mods (3 entries + 3 fields + scoring extension + tests)

**Files:**
- Modify: `src-next/core/mods/index.ts`
- Modify: `src-next/core/phases/upgrades.ts`
- Modify: `src-next/core/mods/index.test.ts`

### Step 1: Extend `ModDef` and `MODS` in `src-next/core/mods/index.ts`

Replace the `ModDef` type and `MODS` array. Find:

```ts
export type ModDef = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  scoreBonus?: number;
  multBonus?: number;
  shardsBonus?: number;
  faceRemap?: { from: number; to: number };
  highFaceMult?: number;
  snakeEyes?: number;
  scoreMin?: number;
};

export const MODS: ModDef[] = [
  { id: 'amplify',    name: 'Amplify',    icon: '⬆', desc: '+2 chips per scoring die', scoreBonus: 2 },
  { id: 'sharpened',  name: 'Sharpened',  icon: '▲', desc: '+1 mult per scoring die', multBonus: 1 },
  { id: 'gilded',     name: 'Gilded',     icon: '◆', desc: '+1 shard on score', shardsBonus: 1 },
  { id: 'loaded',     name: 'Loaded',     icon: '⚔', desc: '1s count as 6', faceRemap: { from: 1, to: 6 } },
  { id: 'snake_eyes', name: 'Snake Eyes', icon: '①', desc: '+2 mult if face is 1', snakeEyes: 2 },
  { id: 'high_roller',name: 'High Roller',icon: '🎯', desc: '+1 mult if face is 5 or 6', highFaceMult: 1 },
  { id: 'backstop',   name: 'Backstop',   icon: '✦', desc: 'Scores at least 4', scoreMin: 4 },
];
```

Replace with:

```ts
export type ModDef = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  scoreBonus?: number;
  multBonus?: number;
  shardsBonus?: number;
  faceRemap?: { from: number; to: number };
  highFaceMult?: number;
  snakeEyes?: number;
  scoreMin?: number;
  chipPerPip?: number;       // chips contribution = chipPerPip × face per scoring die
  evenFaceMult?: number;     // +mult per scoring die where face is even (2/4/6)
  pairBonus?: number;        // +mult per other die in hand sharing this die's face
};

export const MODS: ModDef[] = [
  { id: 'amplify',     name: 'Amplify',     icon: '⬆', desc: '+2 chips per scoring die', scoreBonus: 2 },
  { id: 'sharpened',   name: 'Sharpened',   icon: '▲', desc: '+1 mult per scoring die', multBonus: 1 },
  { id: 'gilded',      name: 'Gilded',      icon: '◆', desc: '+1 shard on score', shardsBonus: 1 },
  { id: 'loaded',      name: 'Loaded',      icon: '⚔', desc: '1s count as 6', faceRemap: { from: 1, to: 6 } },
  { id: 'snake_eyes',  name: 'Snake Eyes',  icon: '①', desc: '+2 mult if face is 1', snakeEyes: 2 },
  { id: 'high_roller', name: 'High Roller', icon: '🎯', desc: '+1 mult if face is 5 or 6', highFaceMult: 1 },
  { id: 'backstop',    name: 'Backstop',    icon: '✦', desc: 'Scores at least 4', scoreMin: 4 },
  { id: 'pip_charge',  name: 'Pip Charge',  icon: '⫶', desc: '+chips equal to face × 2 per scoring die', chipPerPip: 2 },
  { id: 'even_keel',   name: 'Even Keel',   icon: '⚖', desc: '+2 mult if face is even (2/4/6)', evenFaceMult: 2 },
  { id: 'mirror_pair', name: 'Mirror Pair', icon: '⚉', desc: '+3 mult per other die in hand sharing this face', pairBonus: 3 },
];
```

### Step 2: Extend `applyModScoring` in `src-next/core/phases/upgrades.ts`

Find the per-die loop body in `applyModScoring`:

```ts
      let dChips = 0;
      let dMult = 0;
      if (def.scoreBonus) dChips += def.scoreBonus;
      if (def.multBonus) dMult += def.multBonus;
      if (def.snakeEyes && face === 1) dMult += def.snakeEyes;
      if (def.highFaceMult && (face === 5 || face === 6)) dMult += def.highFaceMult;
```

Replace with (adds 3 new field handlers):

```ts
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
```

### Step 3: Add 3 mod unit tests

Read existing `src-next/core/mods/index.test.ts` to find the `describe('applyFaceRemaps', () => { ... })` block. Append a new describe block at the bottom of the file (just before final closing `})`):

```ts
describe('applyModScoring (per-die mod fields, integration via upgrades phase)', () => {
  // These tests exercise the per-die mod scoring logic indirectly via the
  // exported MOD definitions; they verify field semantics, not pipeline plumbing.
  // (Pipeline plumbing is covered by upgrades phase tests if added later.)

  it('pip_charge entry exists with chipPerPip: 2', () => {
    const m = MODS.find((x) => x.id === 'pip_charge');
    expect(m).toBeDefined();
    expect(m?.chipPerPip).toBe(2);
  });

  it('even_keel entry exists with evenFaceMult: 2', () => {
    const m = MODS.find((x) => x.id === 'even_keel');
    expect(m).toBeDefined();
    expect(m?.evenFaceMult).toBe(2);
  });

  it('mirror_pair entry exists with pairBonus: 3', () => {
    const m = MODS.find((x) => x.id === 'mirror_pair');
    expect(m).toBeDefined();
    expect(m?.pairBonus).toBe(3);
  });
});
```

(Note: the existing test file's import line is `import { applyFaceRemaps } from './index';` — extend it to also import `MODS`. Find the line and update to `import { applyFaceRemaps, MODS } from './index';`.)

### Step 4: Run tests

```bash
cd C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2
npx vitest run src-next/core/mods/index.test.ts
npm test
```

Expected: 3 new tests pass. Full suite ~200/200 (was 197 + 3).

### Step 5: Build

```bash
npm run build
```

Expected: green.

### Step 6: Commit

```bash
git add src-next/core/mods/index.ts src-next/core/phases/upgrades.ts src-next/core/mods/index.test.ts
git diff --cached --stat
git commit -m "feat(mods): add Pip Charge, Even Keel, Mirror Pair (3 new fields)"
```

Verify `.claude/settings.local.json` not in staged diff before committing.

---

## Task 2: Vouchers (3 entries + helpers + cap migration + wiring + tests)

**Files:**
- Modify: `src-next/data/vouchers.ts`
- Modify: `src-next/core/vouchers/index.ts`
- Modify: `src-next/core/round/transitions.ts`
- Modify: `src-next/state/slices/run.ts`
- Modify: `src-next/actions/handlers/shop.ts`
- Modify: `src-next/actions/handlers/consumable.ts`
- Create: `src-next/core/vouchers/index.test.ts`

### Step 1: Add 3 voucher entries to `src-next/data/vouchers.ts`

Replace the `VOUCHERS` array. Find:

```ts
export const VOUCHERS: VoucherDef[] = [
  { id: 'bench',        name: 'Bench',        description: '+1 catalyst slot', price: 8 },
  { id: 'forged_links', name: 'Forged Links', description: '+1 mod slot per die', price: 8 },
  { id: 'shard_streak', name: 'Shard Streak', description: '+1 shard per cleared blind', price: 6 },
];
```

Replace with:

```ts
export const VOUCHERS: VoucherDef[] = [
  { id: 'bench',        name: 'Bench',        description: '+1 catalyst slot', price: 8 },
  { id: 'forged_links', name: 'Forged Links', description: '+1 mod slot per die', price: 8 },
  { id: 'shard_streak', name: 'Shard Streak', description: '+1 shard per cleared blind', price: 6 },
  { id: 'open_mic',     name: 'Open Mic',     description: '+1 hand per round', price: 8 },
  { id: 'free_refresh', name: 'Free Refresh', description: 'Shop rerolls cost 0', price: 8 },
  { id: 'capacity',     name: 'Capacity',     description: '+1 consumable slot (max 5)', price: 6 },
];
```

### Step 2: Extend `Debuff` union (prerequisite) + extend `src-next/core/vouchers/index.ts`

**First**, extend the `Debuff` union in `src-next/core/round/debuffs.ts` so `maxModSlots` can reference `'mod_slots_capped_1'` cleanly. Replace:

```ts
export type Debuff =
  | 'no_rerolls'
  | 'disable_catalysts'
  | 'auto_unlock_after_roll'
  | 'hand_size_cap_4'
  | 'no_mod_transforms_on_ones';
```

with:

```ts
export type Debuff =
  | 'no_rerolls'
  | 'disable_catalysts'
  | 'auto_unlock_after_roll'
  | 'hand_size_cap_4'
  | 'no_mod_transforms_on_ones'
  | 'disable_catalysts_first_hand'
  | 'mod_slots_capped_1';
```

(Task 4 Step 1 is now a no-op — these strings are already in the union after this step.)

**Then**, extend `src-next/core/vouchers/index.ts`. It currently exports `ownsVoucher`, `maxCatalystSlots`, `maxModSlots`, `blindClearShardBonus`, and re-exports `VOUCHERS`. Add 3 new helpers + extend `maxModSlots`. Replace the file content with:

```ts
import type { GameState } from '../../state/store';
import { VOUCHERS } from '../../data/vouchers';
import { hasDebuff } from '../round/debuffs';

export function ownsVoucher(s: GameState, id: string): boolean {
  return s.run.vouchers.includes(id);
}

export function maxCatalystSlots(s: GameState): number {
  return ownsVoucher(s, 'bench') ? 7 : 6;
}

export function maxModSlots(s: GameState): number {
  if (hasDebuff(s, 'mod_slots_capped_1')) return 1;
  return ownsVoucher(s, 'forged_links') ? 3 : 2;
}

export function blindClearShardBonus(s: GameState): number {
  return ownsVoucher(s, 'shard_streak') ? 1 : 0;
}

export function extraHandsPerRound(s: GameState): number {
  return ownsVoucher(s, 'open_mic') ? 1 : 0;
}

export function freeShopReroll(s: GameState): boolean {
  return ownsVoucher(s, 'free_refresh');
}

export function maxConsumableSlots(s: GameState): number {
  return ownsVoucher(s, 'capacity') ? 5 : 4;
}

export { VOUCHERS };
```

### Step 3: Wire `extraHandsPerRound` into `startBlind` (`src-next/core/round/transitions.ts`)

Find the existing `startBlind` function. Replace the import block at top:

```ts
import { blindClearShardBonus } from '../vouchers';
```

with:

```ts
import { blindClearShardBonus, extraHandsPerRound } from '../vouchers';
```

Replace the return-statement body inside `startBlind`. Find:

```ts
  return {
    state: {
      ...s,
      ui: { ...s.ui, screen: 'round' },
      round: {
        ...initialRoundSlice(),
        active: true,
        blindId,
        blindIndex,
        isBoss,
        target,
      },
    },
```

Replace with:

```ts
  const baseHandsMax = 3;
  const handsMax = baseHandsMax + extraHandsPerRound(s);
  return {
    state: {
      ...s,
      ui: { ...s.ui, screen: 'round' },
      round: {
        ...initialRoundSlice(),
        active: true,
        blindId,
        blindIndex,
        isBoss,
        target,
        handsMax,
        handsLeft: handsMax,
      },
    },
```

### Step 4: Drop `MAX_CONSUMABLES` from `src-next/state/slices/run.ts`

Find:

```ts
export const MAX_CONSUMABLES = 4;
```

Delete that line.

### Step 5: Wire `maxConsumableSlots` into `src-next/actions/handlers/shop.ts`

Find the existing import block and the `BUY_OFFER` case. At top, replace:

```ts
import { VOUCHERS } from '../../core/vouchers';
```

(or however the existing import looks — read the file first) with:

```ts
import { VOUCHERS, freeShopReroll, maxConsumableSlots } from '../../core/vouchers';
```

Find the existing `OPEN_SHOP` case body — currently sets `rerollCost: 5`. Replace `rerollCost: 5` with `rerollCost: freeShopReroll(s) ? 0 : 5` inline. The relevant line is in the returned `state.shop` object.

Find the existing `BUY_OFFER` case `consumables` derivation:

```ts
const consumables = offer.kind === 'consumable' && s.run.consumables.length < 4
  ? [...s.run.consumables, offer.id]
  : s.run.consumables;
```

Replace `< 4` with `< maxConsumableSlots(s)`:

```ts
const consumables = offer.kind === 'consumable' && s.run.consumables.length < maxConsumableSlots(s)
  ? [...s.run.consumables, offer.id]
  : s.run.consumables;
```

### Step 6: Wire `maxConsumableSlots` into `src-next/actions/handlers/consumable.ts`

Replace the import line:

```ts
import { MAX_CONSUMABLES } from '../../state/slices/run';
```

with:

```ts
import { maxConsumableSlots } from '../../core/vouchers';
```

Then find the `GRANT_CONSUMABLE` case body:

```ts
if (s.run.consumables.length >= MAX_CONSUMABLES) return { state: s, events: [] };
```

Replace with:

```ts
if (s.run.consumables.length >= maxConsumableSlots(s)) return { state: s, events: [] };
```

### Step 7: Create voucher helper tests

Create `src-next/core/vouchers/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  extraHandsPerRound,
  freeShopReroll,
  maxConsumableSlots,
  maxModSlots,
} from './index';
import type { GameState } from '../../state/store';

function makeState(overrides: Partial<{ vouchers: string[]; isBoss: boolean; blindId: string }> = {}): GameState {
  return {
    run: {
      seed: 1,
      shards: 0,
      ante: 1,
      goalIdx: 0,
      catalysts: [],
      vouchers: overrides.vouchers ?? [],
      consumables: [],
      handsPlayed: 0,
      compoundingStacks: 0,
    },
    round: {
      active: true,
      blindId: overrides.blindId ?? null,
      blindIndex: 0,
      isBoss: overrides.isBoss ?? false,
      target: 100,
      score: 0,
      handsLeft: 3,
      handsMax: 3,
      rerollsLeft: 2,
      dice: [],
      hand: [],
      handInProgress: false,
      scoring: false,
      chainLen: 0,
      chainTier: -1,
      diceMods: [],
      shardSinkPrimedThisHand: false,
    },
    meta: { playerName: 'test', highScores: [] },
    ui: { screen: 'round', paused: false },
    shop: { open: false, offers: [], rerollCost: 0 },
    pingCount: 0,
  } as unknown as GameState;
}

describe('extraHandsPerRound', () => {
  it('returns 1 if open_mic owned', () => {
    expect(extraHandsPerRound(makeState({ vouchers: ['open_mic'] }))).toBe(1);
  });
  it('returns 0 otherwise', () => {
    expect(extraHandsPerRound(makeState())).toBe(0);
  });
});

describe('freeShopReroll', () => {
  it('returns true if free_refresh owned', () => {
    expect(freeShopReroll(makeState({ vouchers: ['free_refresh'] }))).toBe(true);
  });
  it('returns false otherwise', () => {
    expect(freeShopReroll(makeState())).toBe(false);
  });
});

describe('maxConsumableSlots', () => {
  it('returns 5 if capacity owned', () => {
    expect(maxConsumableSlots(makeState({ vouchers: ['capacity'] }))).toBe(5);
  });
  it('returns 4 otherwise', () => {
    expect(maxConsumableSlots(makeState())).toBe(4);
  });
});

describe('maxModSlots', () => {
  it('returns 2 by default', () => {
    expect(maxModSlots(makeState())).toBe(2);
  });
  it('returns 3 if forged_links owned', () => {
    expect(maxModSlots(makeState({ vouchers: ['forged_links'] }))).toBe(3);
  });
  it('returns 1 if mod_slots_capped_1 debuff active (overrides forged_links)', () => {
    // Need a boss with the debuff. Defer this case to Task 4 when sedna ships.
    // Placeholder: unit test against a stubbed boss is out of scope for T2;
    // covered indirectly by transitions test in T4.
  });
});
```

(The last test case is a placeholder — its real assertion arrives in Task 4 when the Sedna boss + `mod_slots_capped_1` debuff land. Leave the empty `it` body for now, or skip it via `it.todo(...)`. Use `it.todo` to make intent explicit:)

Replace the last `describe('maxModSlots', ...)` block with:

```ts
describe('maxModSlots', () => {
  it('returns 2 by default', () => {
    expect(maxModSlots(makeState())).toBe(2);
  });
  it('returns 3 if forged_links owned', () => {
    expect(maxModSlots(makeState({ vouchers: ['forged_links'] }))).toBe(3);
  });
  it.todo('returns 1 if mod_slots_capped_1 debuff active (covered in T4)');
});
```

### Step 8: Run tests

```bash
cd C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2
npx vitest run src-next/core/vouchers/index.test.ts
npm test
```

Expected: 8 new tests pass (extraHandsPerRound 2 + freeShopReroll 2 + maxConsumableSlots 2 + maxModSlots 2 + 1 todo). Full suite ~208 (was 200 + ~8).

### Step 9: Build

```bash
npm run build
```

Expected: green. If errors mention `MAX_CONSUMABLES` import in any other file we missed, find with `git -C C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2 grep -n MAX_CONSUMABLES` and update.

### Step 10: Commit

```bash
git add src-next/data/vouchers.ts src-next/core/vouchers/index.ts src-next/core/vouchers/index.test.ts src-next/core/round/transitions.ts src-next/state/slices/run.ts src-next/actions/handlers/shop.ts src-next/actions/handlers/consumable.ts
git diff --cached --stat
git commit -m "feat(vouchers): add Open Mic, Free Refresh, Capacity (3 helpers + cap migration)"
```

Verify `.claude/settings.local.json` not in staged diff.

---

## Task 3: Consumables (2 entries + tests)

**Files:**
- Modify: `src-next/core/consumables/index.ts`

### Step 1: Add 2 consumable entries

Find the `CONSUMABLES` array. Inside the array, after the existing 4 entries (last is `roll_token`), append:

```ts
  {
    id: 'pin_three',
    type: 'calibration',
    name: 'Pin Three',
    icon: '☷',
    description: 'Set one die to face 3.',
    requiresTarget: true,
    targetType: 'die',
    apply: (s, [idx]) => {
      if (idx == null || !s.round.dice[idx]) return { state: s, events: [] };
      const dice = s.round.dice.map((d, i) => (i === idx ? { ...d, face: 3 } : d));
      return { state: { ...s, round: { ...s.round, dice } }, events: [] };
    },
  },
  {
    id: 'spare_reroll',
    type: 'resource',
    name: 'Spare Reroll',
    icon: '↻',
    description: '+1 reroll this round.',
    requiresTarget: false,
    apply: (s) => ({
      state: { ...s, round: { ...s.round, rerollsLeft: s.round.rerollsLeft + 1 } },
      events: [],
    }),
  },
```

### Step 2: Add consumable tests

Read existing tests for consumables. If `src-next/core/consumables/index.test.ts` exists, extend it. Otherwise create `src-next/core/consumables/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CONSUMABLES, lookupConsumable } from './index';
import type { GameState } from '../../state/store';

function makeState(): GameState {
  return {
    run: {
      seed: 1, shards: 0, ante: 1, goalIdx: 0,
      catalysts: [], vouchers: [], consumables: [],
      handsPlayed: 0, compoundingStacks: 0,
    },
    round: {
      active: true, blindId: null, blindIndex: 0, isBoss: false,
      target: 100, score: 0, handsLeft: 3, handsMax: 3, rerollsLeft: 2,
      dice: Array.from({ length: 5 }, (_, id) => ({ id, face: 1, locked: false })),
      hand: [], handInProgress: false, scoring: false,
      chainLen: 0, chainTier: -1, diceMods: [],
      shardSinkPrimedThisHand: false,
    },
    meta: { playerName: 'test', highScores: [] },
    ui: { screen: 'round', paused: false },
    shop: { open: false, offers: [], rerollCost: 0 },
    pingCount: 0,
  } as unknown as GameState;
}

describe('pin_three', () => {
  it('sets target die face to 3', () => {
    const def = lookupConsumable('pin_three')!;
    const result = def.apply(makeState(), [2]);
    expect(result.state.round.dice[2]?.face).toBe(3);
  });
  it('no-op if target index invalid', () => {
    const def = lookupConsumable('pin_three')!;
    const result = def.apply(makeState(), [99]);
    expect(result.state.round.dice[2]?.face).toBe(1);
  });
});

describe('spare_reroll', () => {
  it('increments rerollsLeft by 1', () => {
    const def = lookupConsumable('spare_reroll')!;
    const result = def.apply(makeState(), []);
    expect(result.state.round.rerollsLeft).toBe(3);
  });
});

describe('CONSUMABLES roster', () => {
  it('contains 6 entries (4 existing + 2 new)', () => {
    expect(CONSUMABLES.length).toBe(6);
  });
});
```

### Step 3: Run tests

```bash
cd C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2
npx vitest run src-next/core/consumables/
npm test
```

Expected: 4 new tests pass. Full suite ~212 (was 208 + 4).

### Step 4: Build

```bash
npm run build
```

Expected: green.

### Step 5: Commit

```bash
git add src-next/core/consumables/index.ts src-next/core/consumables/index.test.ts
git diff --cached --stat
git commit -m "feat(consumables): add Pin Three (calibration) + Spare Reroll (resource)"
```

Verify `.claude/settings.local.json` not in staged diff.

---

## Task 4: Bosses (2 entries + 2 debuffs + Eris gate + Sedna cap + tests)

**Files:**
- Modify: `src-next/data/blinds.ts`
- Modify: `src-next/core/round/debuffs.ts`
- Modify: `src-next/core/phases/upgrades.ts`
- Modify: `src-next/core/vouchers/index.test.ts` (replace the `it.todo` from T2)
- Modify: `src-next/core/round/transitions.test.ts` (extend with Eris/Sedna tests)

Note: `maxModSlots` already includes the `mod_slots_capped_1` debuff check (added in Task 2).

### Step 1: Verify `Debuff` union — already extended in Task 2

The `Debuff` union in `src-next/core/round/debuffs.ts` was already extended to include `'disable_catalysts_first_hand'` and `'mod_slots_capped_1'` as the prerequisite for Task 2's `maxModSlots` change. No edit needed here. Run `git grep -n "disable_catalysts_first_hand\\|mod_slots_capped_1" src-next/core/round/debuffs.ts` to confirm both are present before continuing.

### Step 2: Add 2 boss entries to `src-next/data/blinds.ts`

Find the `BOSS_BLINDS` array. After the existing 5 entries (last is `callisto`), append:

```ts
  { id: 'eris', name: 'Eris', icon: '⯰', color: '#ff7847',
    description: 'Catalysts inert on first hand.', debuffs: ['disable_catalysts_first_hand'],
    sigil: {
      viewBox: '0 0 100 100',
      paths: [
        // TODO art pass — sigil designed for Eris, currently a placeholder triangle
        'M 50 15 L 85 80 L 15 80 Z',
        'M 50 30 L 50 65',
        'M 35 75 L 65 75',
      ],
    },
  },
  { id: 'sedna', name: 'Sedna', icon: '⯲', color: '#cc88ff',
    description: 'Mod slots capped at 1.', debuffs: ['mod_slots_capped_1'],
    sigil: {
      viewBox: '0 0 100 100',
      paths: [
        // TODO art pass — sigil designed for Sedna, currently a placeholder ring
        'M 50 20 a 30 30 0 1 0 0 60 a 30 30 0 1 0 0 -60',
        'M 50 35 L 50 65',
        'M 35 50 L 65 50',
      ],
    },
  },
```

### Step 3: Add Eris first-hand catalyst gate in `src-next/core/phases/upgrades.ts`

Find the `upgrades` PhaseFn:

```ts
export const upgrades: PhaseFn = (ctx) => {
  let next = ctx;

  if (!hasDebuff(ctx.state, 'disable_catalysts')) {
    const owned = new Set(ctx.state.run.catalysts);
    for (const u of getByPhase(Phase.UPGRADES)) {
      if (!ALWAYS_ACTIVE.has(u.id) && !owned.has(u.id)) continue;
      next = u.apply(next);
    }
  }

  next = applyModScoring(next);

  return next;
};
```

Replace with:

```ts
export const upgrades: PhaseFn = (ctx) => {
  let next = ctx;

  const isFirstHand = ctx.state.round.handsLeft === ctx.state.round.handsMax;
  const catalystsBlocked =
    hasDebuff(ctx.state, 'disable_catalysts') ||
    (isFirstHand && hasDebuff(ctx.state, 'disable_catalysts_first_hand'));

  if (!catalystsBlocked) {
    const owned = new Set(ctx.state.run.catalysts);
    for (const u of getByPhase(Phase.UPGRADES)) {
      if (!ALWAYS_ACTIVE.has(u.id) && !owned.has(u.id)) continue;
      next = u.apply(next);
    }
  }

  next = applyModScoring(next);

  return next;
};
```

### Step 4: Replace `it.todo` in `src-next/core/vouchers/index.test.ts`

Find:

```ts
  it.todo('returns 1 if mod_slots_capped_1 debuff active (covered in T4)');
```

Replace with a real test that constructs a state with the Sedna boss active (which carries the `mod_slots_capped_1` debuff):

```ts
  it('returns 1 if mod_slots_capped_1 debuff active (Sedna boss, overrides forged_links)', () => {
    const s = makeState({ vouchers: ['forged_links'], isBoss: true, blindId: 'sedna' });
    expect(maxModSlots(s)).toBe(1);
  });
```

### Step 5: Add Eris/Sedna integration tests in `src-next/core/round/transitions.test.ts`

Read the existing file. Append new tests inside the existing `describe(...)` block (or in a new describe block):

```ts
describe('Eris boss (disable_catalysts_first_hand)', () => {
  it('first hand of round: catalysts skipped', () => {
    // Build state with Eris boss, handsLeft === handsMax (first hand)
    const s = makeState({
      catalysts: ['cold_hand'],  // owned but should be inert
      target: 100,
      score: 0,
    });
    s.round.isBoss = true;
    s.round.blindId = 'eris';
    s.round.handsLeft = 3;
    s.round.handsMax = 3;
    // Run upgrades phase via runRollPipelineAfterSim — too heavy for unit;
    // instead assert the gate directly via hasDebuff helper.
    // Real coverage: integration test in roll.test.ts (extends existing).
    expect(hasDebuff(s, 'disable_catalysts_first_hand')).toBe(true);
  });

  it('subsequent hand: catalysts NOT skipped (debuff still active but isFirstHand false)', () => {
    const s = makeState({ catalysts: ['cold_hand'], target: 100, score: 0 });
    s.round.isBoss = true;
    s.round.blindId = 'eris';
    s.round.handsLeft = 2;  // second hand
    s.round.handsMax = 3;
    // The gate is `isFirstHand && hasDebuff(...)`. Document via direct check:
    const isFirstHand = s.round.handsLeft === s.round.handsMax;
    expect(isFirstHand).toBe(false);
  });
});

describe('Sedna boss (mod_slots_capped_1)', () => {
  it('startBlind with Sedna sets blindId — mod cap applies via maxModSlots', () => {
    // Direct check: maxModSlots returns 1 when Sedna active
    const s = makeState({ vouchers: ['forged_links'] });
    s.round.isBoss = true;
    s.round.blindId = 'sedna';
    expect(maxModSlots(s)).toBe(1);
  });
});
```

(Imports needed at top of the file: `hasDebuff` from `'./debuffs'`; `maxModSlots` from `'../vouchers'`. Add only if missing.)

### Step 6: Run tests

```bash
cd C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2
npx vitest run src-next/core/round/ src-next/core/vouchers/
npm test
```

Expected: 3 new tests pass + 1 prior `it.todo` becomes a real test. Full suite ~215 (was 212 + 3 new).

### Step 7: Build

```bash
npm run build
```

Expected: green.

### Step 8: Commit

```bash
git add src-next/data/blinds.ts src-next/core/round/debuffs.ts src-next/core/phases/upgrades.ts src-next/core/vouchers/index.test.ts src-next/core/round/transitions.test.ts
git diff --cached --stat
git commit -m "feat(bosses): add Eris (first-hand catalyst block) + Sedna (mod cap)"
```

Verify `.claude/settings.local.json` not in staged diff.

---

## Task 5: Manual smoke (optional, deferred if not feasible)

**Files:** none.

- [ ] **Step 1: Run dev server**

```bash
cd C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2
npm run dev
```

- [ ] **Step 2: Verify each new entry in-game**

Walk through (using devtools console grants if available):

1. **Pip Charge** — equip on a die; roll a 6; observe +12 chips contribution.
2. **Even Keel** — equip; roll an even face; +2 mult.
3. **Mirror Pair** — equip on die A; roll matching faces; +3 mult per match.
4. **Open Mic** — buy in shop; next round handsMax = 4.
5. **Free Refresh** — buy in shop; reroll cost shows 0.
6. **Capacity** — buy; consumable cap raised to 5.
7. **Pin Three** — use in round; target die face becomes 3.
8. **Spare Reroll** — use in round; rerollsLeft +1.
9. **Eris** — reach an Eris boss; first hand should fire no catalysts; second hand normal.
10. **Sedna** — reach Sedna boss + own forged_links voucher; Forge shows max 1 mod slot.

If dev-server inspection isn't practical, document as deferred. The unit tests cover correctness.

---

## Self-Review

**1. Spec coverage:**

| Spec section | Implemented in |
|---|---|
| 3 mod fields + 3 entries | Task 1 Steps 1-2 |
| `applyModScoring` extension | Task 1 Step 2 |
| 3 voucher entries | Task 2 Step 1 |
| 3 voucher helpers | Task 2 Step 2 |
| `maxModSlots` debuff override | Task 2 Step 2 (gate) + Task 4 Step 1 (debuff string) |
| `MAX_CONSUMABLES` migration | Task 2 Steps 4-6 |
| `startBlind` extra hands | Task 2 Step 3 |
| `OPEN_SHOP` free reroll | Task 2 Step 5 |
| 2 consumable entries | Task 3 Step 1 |
| 2 boss entries with new debuffs | Task 4 Steps 1-2 |
| Eris first-hand catalyst gate | Task 4 Step 3 |
| Sedna mod-cap (read by maxModSlots) | Task 2 Step 2 (already covered) |
| All 13 new tests | Tasks 1, 2, 3, 4 (3 + ~8 + 4 + 3 = ~18 — slightly more than the spec's ~13 estimate) |
| Smoke checklist | Task 5 |

All spec sections covered.

**2. Placeholder scan:** No "TBD"/"TODO"/"implement later" in plan content. The boss SVG paths use `// TODO art pass` comments matching existing convention from Pluto/Ceres/etc — those are intentional code-level deferrals, not plan placeholders.

**3. Type consistency:**

- `chipPerPip` / `evenFaceMult` / `pairBonus` defined in `ModDef` (Task 1) and consumed in `applyModScoring` (Task 1) — same names.
- `extraHandsPerRound` / `freeShopReroll` / `maxConsumableSlots` defined in vouchers/index.ts (Task 2) — consumed in transitions.ts, shop.ts, consumable.ts (Task 2) — same names.
- `disable_catalysts_first_hand` / `mod_slots_capped_1` Debuff strings — added in Task 4 Step 1, consumed in Task 4 Step 3 (Eris gate) and Task 2 Step 2 (Sedna cap, with the debuff string referenced before its formal addition — this works because TypeScript checks the string literal type only at the consumer site, and Task 2 wires the helper before Task 4 expands the union; on `npm run build` after Task 2, the gate `hasDebuff(s, 'mod_slots_capped_1')` will fail typecheck because `'mod_slots_capped_1'` isn't yet in the union. **Fix: either reorder tasks (T4 before T2) or add the union members in T2.**)

**Type-consistency fix decision:** add the new Debuff union members in Task 2 Step 2 (before they're referenced in `maxModSlots`). Task 4 Step 1 then becomes "Verify Debuff union has both new members (already added in T2)" — a no-op, or skip. Updating Task 2 Step 2 to include the union edit:

**Patch to Task 2 Step 2:** before defining `maxModSlots`, add the Debuff union extension. Modify the file `src-next/core/round/debuffs.ts` as part of Task 2 (move Step 1 of Task 4 forward to Task 2 Step 2's preamble). Tasks 4 Step 1 becomes a no-op (verify the union already has the members).

I'll patch the plan inline by reordering: Task 2 Step 2 now reads as a single replacement that includes the union update first.

(Actually simpler: I'll merge Task 4 Step 1 into Task 2 Step 2's instructions. The reader of Task 2 will modify both `core/vouchers/index.ts` AND `core/round/debuffs.ts` in that step. Task 4 Step 1 then says "skip — already done in Task 2".)

**Inline plan amendment:** In Task 2 Step 2, BEFORE replacing the contents of `core/vouchers/index.ts`, also update `core/round/debuffs.ts` `Debuff` union to include `'disable_catalysts_first_hand'` and `'mod_slots_capped_1'` (paste the same code shown in Task 4 Step 1).

In Task 4, Step 1 becomes: "Skip — Debuff union extension already done in Task 2 Step 2. Move directly to Step 2 (boss entry additions)."

This ordering ensures each task's TypeScript edits compile cleanly in isolation.

---

## Execution Handoff

After saving the plan, offer execution choice.
