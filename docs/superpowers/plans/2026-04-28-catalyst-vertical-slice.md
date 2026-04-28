# Catalyst Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 new catalysts (Compounding Bias, Last Throw, Patience Counter, Catalyst Bench, Shard Sink) spanning scaling/trigger/counter/synergy/risk mechanic families, plus full juice (badges, card pulse, telegraph, deduct toast, chain-reaction, magenta-tint slam).

**Architecture:** Catalyst registry pattern unchanged — new catalysts plug into existing `Phase.UPGRADES`. Two new persistent fields on `RunSlice` (`handsPlayed`, `compoundingStacks`) plus one transient flag on `RoundSlice` (`shardSinkPrimedThisHand`). `Beat.mult-slam` extended with optional `tint`. HUD changes localized to `CatalystStrip`, `LoadoutDock`, plus a small new `ShardDeductToast` component.

**Tech Stack:** TypeScript, Vite, React 18, Zustand, Vitest.

**Spec:** [docs/superpowers/specs/2026-04-28-catalyst-vertical-slice-design.md](../specs/2026-04-28-catalyst-vertical-slice-design.md)

---

## File Structure

**Created:**
- `src-next/core/upgrades/catalysts/compoundingBias.ts` — registers `compounding_bias` catalyst.
- `src-next/core/upgrades/catalysts/lastThrow.ts` — registers `last_throw` catalyst.
- `src-next/core/upgrades/catalysts/patienceCounter.ts` — registers `patience_counter` catalyst.
- `src-next/core/upgrades/catalysts/catalystBench.ts` — registers `catalyst_bench` catalyst.
- `src-next/core/upgrades/catalysts/shardSink.ts` — registers `shard_sink` catalyst + exports `shardSinkActive(state)` helper.
- `src-next/core/upgrades/catalysts/compoundingBias.test.ts` — unit tests.
- `src-next/core/upgrades/catalysts/lastThrow.test.ts` — unit tests.
- `src-next/core/upgrades/catalysts/patienceCounter.test.ts` — unit tests.
- `src-next/core/upgrades/catalysts/catalystBench.test.ts` — unit tests.
- `src-next/core/upgrades/catalysts/shardSink.test.ts` — unit tests + helper test.
- `src-next/core/round/transitions.test.ts` — new test file for `compoundingStacks` mutation.
- `src-next/actions/handlers/roll.test.ts` — new test file for `handsPlayed` + Shard Sink mutation.
- `src-next/app/hud/ShardDeductToast.tsx` — small floating-toast component.

**Modified:**
- `src-next/state/slices/run.ts` — add `handsPlayed`, `compoundingStacks` fields.
- `src-next/state/slices/round.ts` — add `shardSinkPrimedThisHand` field.
- `src-next/state/migrations/v1_retheme.ts` — default-fill new fields.
- `src-next/state/migrations/v1_retheme.test.ts` — new test for default-fill.
- `src-next/data/catalysts.ts` — append 5 new entries with `flavor`.
- `src-next/core/upgrades/catalysts/index.ts` — side-effect imports + extend `CATALYST_IDS`.
- `src-next/actions/handlers/roll.ts` — `SCORE_HAND` increments `handsPlayed`, applies Shard Sink deduction + flag.
- `src-next/core/round/transitions.ts` — `clearBlind` increments `compoundingStacks`; `bustBlind` (both branches) resets to 0.
- `src-next/core/scoring/types.ts` — extend `Beat` `mult-slam` with `tint?: 'gold' | 'magenta'`.
- `src-next/core/scoring/adapter.ts` — extend `MinimalScoringCtx` with `events` field; tag Patience Counter mult-slam with `tint: 'magenta'`.
- `src-next/core/scoring/sequence.ts` — pass through `tint` field on synthesized mult-slam beats.
- `src-next/app/hud/ScoreMoment.tsx` — render mult-slam tint variants.
- `src-next/app/hud/CatalystStrip.tsx` — stack/counter badges, card-pulse, Last Throw telegraph, Catalyst Bench chain-reaction.
- `src-next/app/hud/LoadoutDock.tsx` — stack/counter badges (compact variant).
- `src-next/app/screens/Round.tsx` — mount `<ShardDeductToast />`.
- `src-next/styles/index.css` — `mat-pulse-fire`, `mat-telegraph-warn`, `mat-chain-pulse` keyframes.

## Conventions

- **Multiple commits**, one per task. Each commit must build green + tests green.
- **Stage paths explicitly** — do NOT use `git add -A` (`.claude/settings.local.json` is dirty in working tree and must NOT be swept in).
- Caveman mode is on for the human user but does NOT apply to plan/code/commits.
- Total tests should grow from 139 to ~157.

---

## Task 1: State additions + migrator

**Files:**
- Modify: `src-next/state/slices/run.ts`
- Modify: `src-next/state/slices/round.ts`
- Modify: `src-next/state/migrations/v1_retheme.ts`
- Modify: `src-next/state/migrations/v1_retheme.test.ts`

- [ ] **Step 1: Add fields to `RunSlice`**

Edit `src-next/state/slices/run.ts`. Replace the type + initializer:

```ts
export type RunSlice = {
  seed: number;
  shards: number;
  ante: number;
  goalIdx: number;
  catalysts: string[];
  vouchers: string[];
  consumables: string[];
  handsPlayed: number;
  compoundingStacks: number;
};

export const MAX_CONSUMABLES = 4;

export const initialRunSlice = (): RunSlice => ({
  seed: Math.floor(Math.random() * 0xFFFFFFFF),
  shards: 0,
  ante: 1,
  goalIdx: 0,
  catalysts: [],
  vouchers: [],
  consumables: [],
  handsPlayed: 0,
  compoundingStacks: 0,
});
```

- [ ] **Step 2: Add field to `RoundSlice`**

Edit `src-next/state/slices/round.ts`. Replace the type + initializer:

```ts
import type { DieSnapshot } from '../../events/types';

export type RoundSlice = {
  active: boolean;
  blindId: string | null;
  blindIndex: number;
  isBoss: boolean;
  target: number;
  score: number;
  handsLeft: number;
  handsMax: number;
  rerollsLeft: number;
  dice: DieSnapshot[];
  hand: number[];
  handInProgress: boolean;
  scoring: boolean;
  chainLen: number;
  chainTier: number;
  diceMods: string[][];
  shardSinkPrimedThisHand: boolean;
  lastScoringCtx?: {
    combo: { id: string; tier: number } | null;
    chips: number;
    mult: number;
    chain: { mult: number };
    total: number;
    state: { round: { dice: Array<{ face: number }> } };
  } | null;
  pendingRoundEnd?: 'clear' | 'bust' | null;
  pendingScoreDelta?: number | null;
};

export const initialRoundSlice = (): RoundSlice => ({
  active: false,
  blindId: null,
  blindIndex: 0,
  isBoss: false,
  target: 0,
  score: 0,
  handsLeft: 3,
  handsMax: 3,
  rerollsLeft: 2,
  dice: Array.from({ length: 5 }, (_, id) => ({ id, face: 1, locked: false })),
  hand: [],
  handInProgress: false,
  scoring: false,
  chainLen: 0,
  chainTier: -1,
  diceMods: Array.from({ length: 5 }, () => [] as string[]),
  shardSinkPrimedThisHand: false,
});
```

- [ ] **Step 3: Default-fill new fields in migrator**

Edit `src-next/state/migrations/v1_retheme.ts`. Append two new branches inside `migrateRetheme` BEFORE the final `return next;`:

Find the line `// round.blindId — boss id remap (only if it matches a known old id)` and after the closing `}` of that block (around line 88), but before `return next;`, insert:

```ts
  // run.handsPlayed default
  const run5 = next.run as Record<string, unknown> | undefined;
  if (run5 && typeof run5.handsPlayed !== 'number') {
    next.run = { ...run5, handsPlayed: 0 };
  }

  // run.compoundingStacks default
  const run6 = next.run as Record<string, unknown> | undefined;
  if (run6 && typeof run6.compoundingStacks !== 'number') {
    next.run = { ...run6, compoundingStacks: 0 };
  }

  // round.shardSinkPrimedThisHand default
  const round3 = next.round as Record<string, unknown> | undefined;
  if (round3 && typeof round3.shardSinkPrimedThisHand !== 'boolean') {
    next.round = { ...round3, shardSinkPrimedThisHand: false };
  }
```

- [ ] **Step 4: Add migrator test for default-fill**

Edit `src-next/state/migrations/v1_retheme.test.ts`. Append a new test inside the existing `describe('migrateRetheme', () => { ... })` block (just before its closing `});`):

```ts
  it('defaults handsPlayed, compoundingStacks, shardSinkPrimedThisHand when missing', () => {
    const old = {
      run: { catalysts: [], vouchers: [], consumables: [] },
      round: { diceMods: [[], [], [], [], []] },
    };
    const m = migrateRetheme(old) as { run: { handsPlayed: number; compoundingStacks: number }; round: { shardSinkPrimedThisHand: boolean } };
    expect(m.run.handsPlayed).toBe(0);
    expect(m.run.compoundingStacks).toBe(0);
    expect(m.round.shardSinkPrimedThisHand).toBe(false);
  });

  it('preserves existing handsPlayed and compoundingStacks values', () => {
    const fresh = {
      run: { catalysts: [], vouchers: [], consumables: [], handsPlayed: 12, compoundingStacks: 3 },
      round: { diceMods: [], shardSinkPrimedThisHand: true },
    };
    const m = migrateRetheme(fresh) as { run: { handsPlayed: number; compoundingStacks: number }; round: { shardSinkPrimedThisHand: boolean } };
    expect(m.run.handsPlayed).toBe(12);
    expect(m.run.compoundingStacks).toBe(3);
    expect(m.round.shardSinkPrimedThisHand).toBe(true);
  });
```

- [ ] **Step 5: Run tests, expect green**

```bash
cd C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2
npx vitest run src-next/state/migrations/v1_retheme.test.ts
npm test
```

Expected: migrator suite 8/8 (was 6, +2 new). Full suite 141/141 (was 139, +2). If existing scoring tests fail because they reference the old `RunSlice` / `RoundSlice` shape, those tests likely use partial state objects which TypeScript won't catch — only runtime behavior. Investigate any failures.

- [ ] **Step 6: Build**

```bash
npm run build
```

Expected: green. The new fields are required on `RunSlice`/`RoundSlice` so any consumer creating partial slices via `{ ...slice, /* missing field */ }` will fail typecheck (vite build runs tsc). If errors mention missing `handsPlayed`/`compoundingStacks`/`shardSinkPrimedThisHand`, those are call-sites that need updates. Common spots:
- `src-next/actions/handlers/dice.ts` `RESET_ROUND` returns `initialRoundSlice()` — already covered by the new initializer.
- `src-next/core/round/transitions.ts` `startBlind` returns `initialRoundSlice()` — also covered.
- Any test that constructs a partial state — fix by adding missing fields with default values.

- [ ] **Step 7: Commit**

```bash
git add src-next/state/slices/run.ts src-next/state/slices/round.ts src-next/state/migrations/v1_retheme.ts src-next/state/migrations/v1_retheme.test.ts
git diff --cached --stat
git commit -m "feat(state): add handsPlayed, compoundingStacks, shardSinkPrimedThisHand fields"
```

Verify `.claude/settings.local.json` not in `git diff --cached --stat` before committing.

---

## Task 2: 5 catalyst data entries + registration

**Files:**
- Modify: `src-next/data/catalysts.ts` — append 5 entries.
- Create: `src-next/core/upgrades/catalysts/compoundingBias.ts`
- Create: `src-next/core/upgrades/catalysts/lastThrow.ts`
- Create: `src-next/core/upgrades/catalysts/patienceCounter.ts`
- Create: `src-next/core/upgrades/catalysts/catalystBench.ts`
- Create: `src-next/core/upgrades/catalysts/shardSink.ts`
- Modify: `src-next/core/upgrades/catalysts/index.ts`
- Create: 5 test files (one per catalyst).

The 5 entries depend on Task 1 state fields. They register in `Phase.UPGRADES` and read state directly. Each catalyst is independent of the others (no inter-catalyst dependencies except Catalyst Bench's `state.run.catalysts` count, which works regardless of order).

- [ ] **Step 1: Append 5 entries to `CATALYST_META`**

Edit `src-next/data/catalysts.ts`. Inside the `CATALYST_META` array (after the existing 6 entries, before the closing `];`), append:

```ts
  { id: 'compounding_bias', name: 'Compounding Bias', icon: '∆', color: '#88ddff',
    desc: 'Each cleared blind: +0.05× mult permanently. Resets on bust.',
    flavor: 'Variance bleeds out. Edge holds.', rarity: 'uncommon' },
  { id: 'last_throw', name: 'Last Throw', icon: '🔔', color: '#ff7847',
    desc: 'Last hand of round: +25 chips.',
    flavor: 'House always pays the closer.', rarity: 'common' },
  { id: 'patience_counter', name: 'Patience Counter', icon: '⏳', color: '#cc88ff',
    desc: 'Every 5th hand of run: ×3 mult (this hand only).',
    flavor: 'Wait. Then strike.', rarity: 'rare' },
  { id: 'catalyst_bench', name: 'Catalyst Bench', icon: '⌗', color: '#a080c0',
    desc: '+1 mult per other catalyst owned.',
    flavor: 'Crowded table tilts faster.', rarity: 'uncommon' },
  { id: 'shard_sink', name: 'Shard Sink', icon: '◈', color: '#f5c451',
    desc: 'Spend 1 shard before scoring: ×1.5 mult. Skips if 0 shards.',
    flavor: 'Pay to play. Pays back.', rarity: 'common' },
```

- [ ] **Step 2: Create `compoundingBias.ts`**

Create `src-next/core/upgrades/catalysts/compoundingBias.ts`:

```ts
import { register } from '../registry';
import { Phase } from '../../pipeline/types';

const BONUS_PER_STACK = 0.05;

register({
  id: 'compounding_bias',
  phase: Phase.UPGRADES,
  priority: 80,
  apply: (ctx) => {
    const stacks = ctx.state.run.compoundingStacks;
    if (stacks <= 0) return ctx;
    const newMult = ctx.mult * (1 + stacks * BONUS_PER_STACK);
    return {
      ...ctx,
      mult: newMult,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: {
            id: 'compounding_bias',
            phase: Phase.UPGRADES,
            deltaChips: 0,
            deltaMult: newMult - ctx.mult,
          },
        },
      ],
    };
  },
});
```

- [ ] **Step 3: Create `lastThrow.ts`**

Create `src-next/core/upgrades/catalysts/lastThrow.ts`:

```ts
import { register } from '../registry';
import { Phase } from '../../pipeline/types';

const CHIP_BONUS = 25;

register({
  id: 'last_throw',
  phase: Phase.UPGRADES,
  priority: 30,
  apply: (ctx) => {
    if (ctx.state.round.handsLeft !== 1) return ctx;
    return {
      ...ctx,
      chips: ctx.chips + CHIP_BONUS,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: {
            id: 'last_throw',
            phase: Phase.UPGRADES,
            deltaChips: CHIP_BONUS,
            deltaMult: 0,
          },
        },
      ],
    };
  },
});
```

- [ ] **Step 4: Create `patienceCounter.ts`**

Create `src-next/core/upgrades/catalysts/patienceCounter.ts`:

```ts
import { register } from '../registry';
import { Phase } from '../../pipeline/types';

const TRIGGER_INTERVAL = 5;
const MULT_VALUE = 3;

register({
  id: 'patience_counter',
  phase: Phase.UPGRADES,
  priority: 150,
  apply: (ctx) => {
    // handsPlayed is incremented AFTER this hand by the SCORE_HAND handler.
    // The current hand number = handsPlayed + 1.
    const isFifthHand = (ctx.state.run.handsPlayed + 1) % TRIGGER_INTERVAL === 0;
    if (!isFifthHand) return ctx;
    const newMult = ctx.mult * MULT_VALUE;
    return {
      ...ctx,
      mult: newMult,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: {
            id: 'patience_counter',
            phase: Phase.UPGRADES,
            deltaChips: 0,
            deltaMult: newMult - ctx.mult,
          },
        },
      ],
    };
  },
});
```

- [ ] **Step 5: Create `catalystBench.ts`**

Create `src-next/core/upgrades/catalysts/catalystBench.ts`:

```ts
import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'catalyst_bench',
  phase: Phase.UPGRADES,
  priority: 30,
  apply: (ctx) => {
    const others = ctx.state.run.catalysts.filter((id) => id !== 'catalyst_bench').length;
    if (others <= 0) return ctx;
    return {
      ...ctx,
      mult: ctx.mult + others,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: {
            id: 'catalyst_bench',
            phase: Phase.UPGRADES,
            deltaChips: 0,
            deltaMult: others,
          },
        },
      ],
    };
  },
});
```

- [ ] **Step 6: Create `shardSink.ts`**

Create `src-next/core/upgrades/catalysts/shardSink.ts`:

```ts
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import type { GameState } from '../../../state/store';

const MULT_VALUE = 1.5;

export function shardSinkActive(state: GameState): boolean {
  return state.run.catalysts.includes('shard_sink') && state.run.shards >= 1;
}

register({
  id: 'shard_sink',
  phase: Phase.UPGRADES,
  priority: 90,
  apply: (ctx) => {
    if (!ctx.state.round.shardSinkPrimedThisHand) return ctx;
    const newMult = ctx.mult * MULT_VALUE;
    return {
      ...ctx,
      mult: newMult,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: {
            id: 'shard_sink',
            phase: Phase.UPGRADES,
            deltaChips: 0,
            deltaMult: newMult - ctx.mult,
          },
        },
      ],
    };
  },
});
```

- [ ] **Step 7: Update `core/upgrades/catalysts/index.ts`**

Replace the file with:

```ts
import './stratifier';
import './chaosTheory';
import './sixBias';
import './twinSample';
import './coldHand';
import './entropyIndex';
import './compoundingBias';
import './lastThrow';
import './patienceCounter';
import './catalystBench';
import './shardSink';

export const CATALYST_IDS = [
  'stratifier', 'chaos_theory', 'six_bias',
  'twin_sample', 'cold_hand', 'entropy_index',
  'compounding_bias', 'last_throw', 'patience_counter',
  'catalyst_bench', 'shard_sink',
] as const;
export type CatalystId = typeof CATALYST_IDS[number];
```

- [ ] **Step 8: Create per-catalyst test files**

Create `src-next/core/upgrades/catalysts/compoundingBias.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { clearRegistry, getAll } from '../registry';
import { Phase, type PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';

function makeCtx(overrides: Partial<{ mult: number; runCompoundingStacks: number }> = {}): PipelineCtx {
  const state = {
    run: { compoundingStacks: overrides.runCompoundingStacks ?? 0 },
  } as unknown as GameState;
  return {
    state,
    chips: 0,
    mult: overrides.mult ?? 10,
    total: 0,
    events: [],
    rng: () => 0,
  };
}

describe('compounding_bias catalyst', () => {
  beforeEach(() => {
    clearRegistry();
    return import('./compoundingBias');
  });

  it('returns ctx unchanged when stacks = 0', () => {
    const def = getAll().find((u) => u.id === 'compounding_bias')!;
    const ctx = makeCtx({ runCompoundingStacks: 0, mult: 10 });
    const next = def.apply(ctx);
    expect(next.mult).toBe(10);
    expect(next.events.length).toBe(0);
  });

  it('multiplies mult by 1.15 when stacks = 3', () => {
    const def = getAll().find((u) => u.id === 'compounding_bias')!;
    const ctx = makeCtx({ runCompoundingStacks: 3, mult: 10 });
    const next = def.apply(ctx);
    expect(next.mult).toBeCloseTo(11.5);
  });

  it('emits onUpgradeTriggered when active', () => {
    const def = getAll().find((u) => u.id === 'compounding_bias')!;
    const ctx = makeCtx({ runCompoundingStacks: 1, mult: 10 });
    const next = def.apply(ctx);
    expect(next.events).toHaveLength(1);
    expect(next.events[0]?.type).toBe('onUpgradeTriggered');
  });
});
```

Create `src-next/core/upgrades/catalysts/lastThrow.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { clearRegistry, getAll } from '../registry';
import { Phase, type PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';

function makeCtx(handsLeft: number, chips = 50): PipelineCtx {
  const state = { round: { handsLeft } } as unknown as GameState;
  return { state, chips, mult: 1, total: 0, events: [], rng: () => 0 };
}

describe('last_throw catalyst', () => {
  beforeEach(() => {
    clearRegistry();
    return import('./lastThrow');
  });

  it('returns ctx unchanged when handsLeft != 1', () => {
    const def = getAll().find((u) => u.id === 'last_throw')!;
    expect(def.apply(makeCtx(2)).chips).toBe(50);
    expect(def.apply(makeCtx(0)).chips).toBe(50);
    expect(def.apply(makeCtx(3)).chips).toBe(50);
  });

  it('adds 25 chips when handsLeft = 1', () => {
    const def = getAll().find((u) => u.id === 'last_throw')!;
    const next = def.apply(makeCtx(1));
    expect(next.chips).toBe(75);
    expect(next.events).toHaveLength(1);
  });
});
```

Create `src-next/core/upgrades/catalysts/patienceCounter.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { clearRegistry, getAll } from '../registry';
import { Phase, type PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';

function makeCtx(handsPlayed: number, mult = 5): PipelineCtx {
  const state = { run: { handsPlayed } } as unknown as GameState;
  return { state, chips: 0, mult, total: 0, events: [], rng: () => 0 };
}

describe('patience_counter catalyst', () => {
  beforeEach(() => {
    clearRegistry();
    return import('./patienceCounter');
  });

  it('returns ctx unchanged on non-5th hands', () => {
    const def = getAll().find((u) => u.id === 'patience_counter')!;
    expect(def.apply(makeCtx(0)).mult).toBe(5);  // hand 1
    expect(def.apply(makeCtx(1)).mult).toBe(5);  // hand 2
    expect(def.apply(makeCtx(2)).mult).toBe(5);  // hand 3
    expect(def.apply(makeCtx(3)).mult).toBe(5);  // hand 4
  });

  it('multiplies mult by 3 on 5th hand', () => {
    const def = getAll().find((u) => u.id === 'patience_counter')!;
    expect(def.apply(makeCtx(4, 5)).mult).toBe(15);  // hand 5
  });

  it('multiplies mult by 3 on 10th hand', () => {
    const def = getAll().find((u) => u.id === 'patience_counter')!;
    expect(def.apply(makeCtx(9, 5)).mult).toBe(15);
  });

  it('multiplies mult by 3 on 15th hand', () => {
    const def = getAll().find((u) => u.id === 'patience_counter')!;
    expect(def.apply(makeCtx(14, 5)).mult).toBe(15);
  });
});
```

Create `src-next/core/upgrades/catalysts/catalystBench.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { clearRegistry, getAll } from '../registry';
import { Phase, type PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';

function makeCtx(catalysts: string[], mult = 1): PipelineCtx {
  const state = { run: { catalysts } } as unknown as GameState;
  return { state, chips: 0, mult, total: 0, events: [], rng: () => 0 };
}

describe('catalyst_bench catalyst', () => {
  beforeEach(() => {
    clearRegistry();
    return import('./catalystBench');
  });

  it('returns ctx unchanged when no other catalysts', () => {
    const def = getAll().find((u) => u.id === 'catalyst_bench')!;
    expect(def.apply(makeCtx([])).mult).toBe(1);
    expect(def.apply(makeCtx(['catalyst_bench'])).mult).toBe(1);  // only self
  });

  it('adds +1 mult per other catalyst', () => {
    const def = getAll().find((u) => u.id === 'catalyst_bench')!;
    expect(def.apply(makeCtx(['stratifier', 'six_bias', 'cold_hand'], 1)).mult).toBe(4);
  });

  it('does not double-count self when also owned', () => {
    const def = getAll().find((u) => u.id === 'catalyst_bench')!;
    expect(def.apply(makeCtx(['catalyst_bench', 'stratifier', 'six_bias'], 1)).mult).toBe(3);
  });
});
```

Create `src-next/core/upgrades/catalysts/shardSink.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { clearRegistry, getAll } from '../registry';
import { Phase, type PipelineCtx } from '../../pipeline/types';
import { shardSinkActive } from './shardSink';
import type { GameState } from '../../../state/store';

function makeCtx(primed: boolean, mult = 4): PipelineCtx {
  const state = { round: { shardSinkPrimedThisHand: primed } } as unknown as GameState;
  return { state, chips: 0, mult, total: 0, events: [], rng: () => 0 };
}

describe('shardSinkActive helper', () => {
  it('false when shard_sink not owned', () => {
    const state = { run: { catalysts: [], shards: 5 } } as unknown as GameState;
    expect(shardSinkActive(state)).toBe(false);
  });

  it('false when shards = 0', () => {
    const state = { run: { catalysts: ['shard_sink'], shards: 0 } } as unknown as GameState;
    expect(shardSinkActive(state)).toBe(false);
  });

  it('true when shard_sink owned and shards >= 1', () => {
    const state1 = { run: { catalysts: ['shard_sink'], shards: 1 } } as unknown as GameState;
    expect(shardSinkActive(state1)).toBe(true);
    const state5 = { run: { catalysts: ['shard_sink'], shards: 5 } } as unknown as GameState;
    expect(shardSinkActive(state5)).toBe(true);
  });
});

describe('shard_sink catalyst', () => {
  beforeEach(() => {
    clearRegistry();
    return import('./shardSink');
  });

  it('returns ctx unchanged when shardSinkPrimedThisHand = false', () => {
    const def = getAll().find((u) => u.id === 'shard_sink')!;
    expect(def.apply(makeCtx(false)).mult).toBe(4);
  });

  it('multiplies mult by 1.5 when primed', () => {
    const def = getAll().find((u) => u.id === 'shard_sink')!;
    expect(def.apply(makeCtx(true, 4)).mult).toBe(6);
  });
});
```

- [ ] **Step 9: Run tests**

```bash
cd C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2
npx vitest run src-next/core/upgrades/catalysts/
npm test
```

Expected: 5 new test files pass (~14 new tests). Full suite ~155/155 (was 141 from Task 1, +14).

- [ ] **Step 10: Build**

```bash
npm run build
```

Expected: green.

- [ ] **Step 11: Commit**

```bash
git add src-next/data/catalysts.ts src-next/core/upgrades/catalysts/
git diff --cached --stat
git commit -m "feat(catalysts): add 5 new catalysts (compounding_bias/last_throw/patience_counter/catalyst_bench/shard_sink)"
```

Verify `.claude/settings.local.json` not in staged diff before committing.

---

## Task 3: Action handler wiring

**Files:**
- Modify: `src-next/actions/handlers/roll.ts` — `SCORE_HAND` increments `handsPlayed`, applies Shard Sink deduction + flag.
- Modify: `src-next/core/round/transitions.ts` — `clearBlind` increments `compoundingStacks`; `bustBlind` (both branches) resets to 0.
- Create: `src-next/core/round/transitions.test.ts` — new test file.
- Create: `src-next/actions/handlers/roll.test.ts` — new test file.

- [ ] **Step 1: Update `core/round/transitions.ts`**

Edit `src-next/core/round/transitions.ts`:

In `clearBlind`, find the returned state's `run` object update (`run: { ...s.run, shards: ..., goalIdx: ..., ante: ... }`) and add `compoundingStacks: s.run.compoundingStacks + 1`:

```ts
run: {
  ...s.run,
  shards: s.run.shards + reward,
  goalIdx: nextGoal,
  ante: nextAnte,
  compoundingStacks: s.run.compoundingStacks + 1,
},
```

In `bustBlind` SOFT branch (the `if (s.round.target > 0 && s.round.score >= Math.floor(s.round.target * 0.75)) { ... }` block), the returned state's `run` update gets `compoundingStacks: 0`:

```ts
run: { ...s.run, catalysts: droppedCatalysts, goalIdx: nextGoal, ante: nextAnte, compoundingStacks: 0 },
```

In `bustBlind` HARD branch (the bottom `return { state: { ...s, ui: { ...s.ui, screen: 'hub' }, round: { ...s.round, active: false }, meta: { ...s.meta, highScores } }, events: [] };` block), no run update currently; add one:

```ts
return {
  state: {
    ...s,
    ui: { ...s.ui, screen: 'hub' },
    round: { ...s.round, active: false },
    run: { ...s.run, compoundingStacks: 0 },
    meta: { ...s.meta, highScores },
  },
  events: [],
};
```

- [ ] **Step 2: Update `actions/handlers/roll.ts` SCORE_HAND**

Edit `src-next/actions/handlers/roll.ts`. Add an import at the top:

```ts
import { shardSinkActive } from '../../core/upgrades/catalysts/shardSink';
```

Replace the `case 'SCORE_HAND'` block with this version (changes are at the top of the case body and inside the returned `baseState`):

```ts
    case 'SCORE_HAND': {
      const primed = shardSinkActive(s);
      const shardsAfter = primed ? s.run.shards - 1 : s.run.shards;
      const workingState = {
        ...s,
        run: { ...s.run, shards: shardsAfter },
        round: { ...s.round, shardSinkPrimedThisHand: primed },
      };
      const baseCtx = runRollPipelineUpToSim(workingState);
      const fakeResult = {
        finalFaces: workingState.round.dice.map((d) => d.face),
        restPositions: workingState.round.dice.map(() => ({ x: 0, y: 0, z: 0 })),
        settleMs: workingState.round.dice.map(() => 0),
        peakVelocity: 0,
        collisionCount: 0,
        bounceHeights: workingState.round.dice.map(() => 0),
      };
      const final = runRollPipelineAfterSim(baseCtx, fakeResult);
      let shardBonus = 0;
      for (const mods of workingState.round.diceMods) {
        for (const id of mods) {
          const def = lookupMod(id);
          if (def?.shardsBonus) shardBonus += def.shardsBonus;
        }
      }
      const newScore = workingState.round.score + final.total;
      const newHandsLeft = Math.max(0, workingState.round.handsLeft - 1);
      const baseState = {
        ...workingState,
        run: {
          ...workingState.run,
          shards: shardBonus > 0 ? workingState.run.shards + shardBonus : workingState.run.shards,
          handsPlayed: workingState.run.handsPlayed + 1,
        },
        round: {
          ...workingState.round,
          handsLeft: newHandsLeft,
          rerollsLeft: 2,
          scoring: true,
          pendingScoreDelta: final.total,
          chainLen: final.chain?.len ?? workingState.round.chainLen,
          chainTier: final.chain?.tier ?? workingState.round.chainTier,
          dice: workingState.round.dice.map((d) => ({ ...d, locked: false })),
          shardSinkPrimedThisHand: false,
          lastScoringCtx: {
            combo: final.combo ?? null,
            chips: final.chips ?? 0,
            mult: final.mult ?? 1,
            chain: { mult: final.chain?.mult ?? 1 },
            total: final.total ?? 0,
            state: { round: { dice: workingState.round.dice } },
          },
        },
      };
      const baseEvents = [...final.events];

      let pendingRoundEnd: 'clear' | 'bust' | null = null;
      if (workingState.round.active && newScore >= workingState.round.target && workingState.round.target > 0) {
        pendingRoundEnd = 'clear';
      } else if (workingState.round.active && newHandsLeft === 0 && newScore < workingState.round.target) {
        pendingRoundEnd = 'bust';
      }
      const stateWithPending = pendingRoundEnd
        ? { ...baseState, round: { ...baseState.round, pendingRoundEnd } }
        : baseState;
      return { state: stateWithPending, events: baseEvents };
    }
```

Key changes:
1. `primed` computed via `shardSinkActive(s)` BEFORE pipeline.
2. `workingState` has shards decremented (if primed) and `shardSinkPrimedThisHand` set.
3. Pipeline runs against `workingState`, not `s`.
4. `baseState.run.handsPlayed` is `workingState.run.handsPlayed + 1`.
5. `baseState.round.shardSinkPrimedThisHand` resets to `false` (consumed for this hand).

- [ ] **Step 3: Create `transitions.test.ts`**

Create `src-next/core/round/transitions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { clearBlind, bustBlind } from './transitions';
import type { GameState } from '../../state/store';

function makeState(overrides: Partial<{ shards: number; goalIdx: number; ante: number; compoundingStacks: number; score: number; target: number; isBoss: boolean; catalysts: string[]; vouchers: string[]; consumables: string[]; handsPlayed: number; }> = {}): GameState {
  return {
    run: {
      seed: 1,
      shards: overrides.shards ?? 0,
      ante: overrides.ante ?? 1,
      goalIdx: overrides.goalIdx ?? 0,
      catalysts: overrides.catalysts ?? [],
      vouchers: overrides.vouchers ?? [],
      consumables: overrides.consumables ?? [],
      handsPlayed: overrides.handsPlayed ?? 0,
      compoundingStacks: overrides.compoundingStacks ?? 0,
    },
    round: {
      active: true,
      blindId: 'small_blind',
      blindIndex: 0,
      isBoss: overrides.isBoss ?? false,
      target: overrides.target ?? 100,
      score: overrides.score ?? 100,
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

describe('clearBlind', () => {
  it('increments compoundingStacks by 1', () => {
    const s = makeState({ compoundingStacks: 2, score: 200, target: 100 });
    const result = clearBlind(s);
    expect(result.state.run.compoundingStacks).toBe(3);
  });
});

describe('bustBlind', () => {
  it('soft-bust branch resets compoundingStacks to 0', () => {
    const s = makeState({ compoundingStacks: 5, target: 100, score: 80, catalysts: ['cold_hand'] });
    const result = bustBlind(s);
    expect(result.state.run.compoundingStacks).toBe(0);
  });

  it('hard-bust branch resets compoundingStacks to 0', () => {
    const s = makeState({ compoundingStacks: 7, target: 100, score: 10 });
    const result = bustBlind(s);
    expect(result.state.run.compoundingStacks).toBe(0);
  });
});
```

(Use `as unknown as GameState` casts because the helper builds a partial state. If the test setup objects miss any fields the production code reads, supplement them.)

- [ ] **Step 4: Create `roll.test.ts`**

Create `src-next/actions/handlers/roll.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rollHandler } from './roll';
import type { GameState } from '../../state/store';

function makeState(overrides: Partial<{ shards: number; catalysts: string[]; handsPlayed: number; handsLeft: number; }> = {}): GameState {
  return {
    run: {
      seed: 1,
      shards: overrides.shards ?? 5,
      ante: 1,
      goalIdx: 0,
      catalysts: overrides.catalysts ?? [],
      vouchers: [],
      consumables: [],
      handsPlayed: overrides.handsPlayed ?? 0,
      compoundingStacks: 0,
    },
    round: {
      active: true,
      blindId: 'small_blind',
      blindIndex: 0,
      isBoss: false,
      target: 100,
      score: 0,
      handsLeft: overrides.handsLeft ?? 3,
      handsMax: 3,
      rerollsLeft: 2,
      dice: Array.from({ length: 5 }, (_, id) => ({ id, face: 3, locked: false })),
      hand: [],
      handInProgress: false,
      scoring: false,
      chainLen: 0,
      chainTier: -1,
      diceMods: [[], [], [], [], []],
      shardSinkPrimedThisHand: false,
    },
    meta: { playerName: 'test', highScores: [] },
    ui: { screen: 'round', paused: false },
    shop: { open: false, offers: [], rerollCost: 0 },
    pingCount: 0,
  } as unknown as GameState;
}

describe('SCORE_HAND', () => {
  it('increments handsPlayed by 1', () => {
    const s = makeState({ handsPlayed: 4 });
    const result = rollHandler({ type: 'SCORE_HAND' }, s);
    expect(result.state.run.handsPlayed).toBe(5);
  });

  it('deducts 1 shard and sets primed flag when shard_sink owned and shards >= 1', () => {
    const s = makeState({ catalysts: ['shard_sink'], shards: 5 });
    const result = rollHandler({ type: 'SCORE_HAND' }, s);
    // Shard count: started at 5, -1 from sink, +0 from gilded mods = 4
    expect(result.state.run.shards).toBe(4);
    // The flag is reset to false at end of hand (lifecycle: set during pipeline, reset post-pipeline)
    expect(result.state.round.shardSinkPrimedThisHand).toBe(false);
  });

  it('does not deduct shard when shard_sink not owned', () => {
    const s = makeState({ shards: 5 });
    const result = rollHandler({ type: 'SCORE_HAND' }, s);
    expect(result.state.run.shards).toBe(5);
  });

  it('does not deduct shard when shard_sink owned but shards = 0', () => {
    const s = makeState({ catalysts: ['shard_sink'], shards: 0 });
    const result = rollHandler({ type: 'SCORE_HAND' }, s);
    expect(result.state.run.shards).toBe(0);
    expect(result.state.round.shardSinkPrimedThisHand).toBe(false);
  });
});
```

(Note: this test also depends on the side-effect imports in `actions/dispatch.ts` which load the catalyst registry. If the test runs in isolation and the registry is empty, scoring may behave differently. Use `import '../../core/upgrades/catalysts'` at top of test if needed.)

- [ ] **Step 5: Run tests**

```bash
cd C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2
npx vitest run src-next/core/round/transitions.test.ts src-next/actions/handlers/roll.test.ts
npm test
```

Expected: 7 new tests pass. Full suite ~162/162.

- [ ] **Step 6: Build**

```bash
npm run build
```

Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src-next/core/round/transitions.ts src-next/core/round/transitions.test.ts src-next/actions/handlers/roll.ts src-next/actions/handlers/roll.test.ts
git diff --cached --stat
git commit -m "feat(state): wire SCORE_HAND + clearBlind/bustBlind for new catalyst state"
```

---

## Task 4: Tint plumbing for Patience Counter slam

**Files:**
- Modify: `src-next/core/scoring/types.ts` — extend `Beat` mult-slam with optional `tint`.
- Modify: `src-next/core/scoring/adapter.ts` — extend `MinimalScoringCtx` with events; tag Patience Counter mult-slam with tint.
- Modify: `src-next/core/scoring/sequence.ts` — pass tint through when emitting mult-slam beats.
- Modify: `src-next/app/hud/ScoreMoment.tsx` — render mult-slam tint variants.
- Modify: `src-next/state/slices/round.ts` — extend `lastScoringCtx` to include `events` field.
- Modify: `src-next/actions/handlers/roll.ts` — populate `events` in `lastScoringCtx`.

- [ ] **Step 1: Extend `Beat` type**

Edit `src-next/core/scoring/types.ts`. Replace the `mult-slam` arm in the `Beat` union:

```ts
  | { kind: 'mult-slam';    t: number; label: string; multiplier: number; pitchSemis: number; ampScale: number; tint?: 'gold' | 'magenta' }
```

Also extend `SequenceInput` `mults` type:

```ts
export type SequenceInput = {
  faces: number[];
  comboLabel: string;
  comboBonus: number;
  mults: { label: string; value: number; tint?: 'gold' | 'magenta' }[];
  finalTotal: number;
};
```

- [ ] **Step 2: Extend `lastScoringCtx` shape**

Edit `src-next/state/slices/round.ts`. Add `events` field:

```ts
lastScoringCtx?: {
  combo: { id: string; tier: number } | null;
  chips: number;
  mult: number;
  chain: { mult: number };
  total: number;
  events: Array<{ type: string; payload: { id: string; phase: number; deltaChips: number; deltaMult: number } }>;
  state: { round: { dice: Array<{ face: number }> } };
} | null;
```

- [ ] **Step 3: Populate `events` in `roll.ts` SCORE_HAND**

Edit `src-next/actions/handlers/roll.ts`. Inside `lastScoringCtx`, add events:

```ts
lastScoringCtx: {
  combo: final.combo ?? null,
  chips: final.chips ?? 0,
  mult: final.mult ?? 1,
  chain: { mult: final.chain?.mult ?? 1 },
  total: final.total ?? 0,
  events: final.events
    .filter((e) => e.type === 'onUpgradeTriggered')
    .map((e) => ({ type: e.type, payload: e.payload as any })),
  state: { round: { dice: workingState.round.dice } },
},
```

- [ ] **Step 4: Adapter — read events + tag tint**

Edit `src-next/core/scoring/adapter.ts`. Replace contents:

```ts
import type { SequenceInput } from './types';

type MinimalScoringCtx = {
  combo: { id: string; tier: number } | null;
  chips: number;
  mult: number;
  chain: { mult: number };
  total: number;
  events: Array<{ type: string; payload: { id: string; phase: number; deltaChips: number; deltaMult: number } }>;
  state: { round: { dice: Array<{ face: number }> } };
};

export function adaptScoringContext(ctx: MinimalScoringCtx): SequenceInput {
  const faces = ctx.state.round.dice.map((d) => d.face);
  const faceSum = faces.reduce((a, b) => a + b, 0);
  const comboBonus = Math.max(0, ctx.chips - faceSum);
  const comboLabel = (ctx.combo?.id ?? 'CHANCE').toUpperCase();
  const patienceTriggered = (ctx.events ?? []).some(
    (e) => e.type === 'onUpgradeTriggered' && e.payload.id === 'patience_counter',
  );
  const mults: SequenceInput['mults'] = [];
  if (ctx.mult !== 1) {
    mults.push({
      label: 'mult',
      value: ctx.mult,
      tint: patienceTriggered ? 'magenta' : undefined,
    });
  }
  if (ctx.chain.mult !== 1) mults.push({ label: 'chain', value: ctx.chain.mult });
  return {
    faces,
    comboLabel,
    comboBonus,
    mults,
    finalTotal: ctx.total,
  };
}
```

(Caveat: the `mult` slam is treated as the aggregate mult, not specifically Patience Counter's contribution. Since Patience Counter's ×3 dominates the final mult value when triggered, tagging the aggregate slam magenta is acceptable — the visual signal still reads as "Patience Counter fired". A more precise per-catalyst slam stream would require restructuring the adapter, which is deferred.)

- [ ] **Step 5: Sequence — emit tint on mult-slam beat**

Edit `src-next/core/scoring/sequence.ts`. Inside the main mult-slam loop (the `for (const m of input.mults) { ... }` block), add `tint: m.tint` to the emitted beat:

```ts
  for (const m of input.mults) {
    const before = running;
    running = Math.round(running * m.value);
    beats.push({
      kind: 'mult-slam',
      t,
      label: m.label,
      multiplier: m.value,
      pitchSemis: multSemis,
      ampScale: 1 + (multSemis - 12) * 0.1,
      tint: m.tint,
    });
    checkCross(before);
    multSemis += 2;
    t += multGap;
  }
```

- [ ] **Step 6: ScoreMoment — render tint variant**

Edit `src-next/app/hud/ScoreMoment.tsx`. Update the slam state shape and rendering. Replace `type SlamOverlay` definition:

```ts
type SlamOverlay = { id: number; label: string; multiplier: number; gold: boolean; tint?: 'gold' | 'magenta' };
```

In the `mult-slam` case of the bus listener:

```ts
case 'mult-slam': {
  const id = slamId++;
  setSlams((s) => [...s, { id, label: beat.label, multiplier: beat.multiplier, gold: crossed, tint: beat.tint }]);
  setTimeout(() => setSlams((s) => s.filter((x) => x.id !== id)), 600);
  break;
}
```

In the JSX rendering the slams, replace the `style` block to choose colors based on `tint`:

```tsx
{slams.map((s) => {
  const isMagenta = s.tint === 'magenta';
  const baseColor = isMagenta ? '#cc88ff' : (s.gold ? '#f5c451' : '#ff7847');
  return (
    <div key={s.id} className="f-mono" style={{
      padding: '8px 18px', borderRadius: 8,
      background: `${baseColor}20`,
      border: `2px solid ${baseColor}`,
      color: baseColor,
      fontSize: 28, fontWeight: 700,
      boxShadow: `0 0 24px ${baseColor}`,
      animation: 'boomPop 250ms cubic-bezier(0.2, 1.4, 0.5, 1)',
    }}>
      ×{s.multiplier}
    </div>
  );
})}
```

- [ ] **Step 7: Run tests**

```bash
cd C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2
npm test
```

Expected: full suite passes. Existing `sequence.test.ts` may need updates if it asserts mult-slam shape — verify by reading test failures. Tagging `tint` as optional means existing tests should pass unchanged.

- [ ] **Step 8: Build**

```bash
npm run build
```

- [ ] **Step 9: Commit**

```bash
git add src-next/core/scoring/types.ts src-next/core/scoring/adapter.ts src-next/core/scoring/sequence.ts src-next/state/slices/round.ts src-next/actions/handlers/roll.ts src-next/app/hud/ScoreMoment.tsx
git diff --cached --stat
git commit -m "feat(scoring): mult-slam tint passthrough for Patience Counter magenta"
```

---

## Task 5: HUD juice — badges, pulses, telegraph, chain reaction, deduct toast

**Files:**
- Modify: `src-next/app/hud/CatalystStrip.tsx` — stack badge, counter badge, card pulse on `onUpgradeTriggered`, Last Throw telegraph, Catalyst Bench chain-reaction.
- Modify: `src-next/app/hud/LoadoutDock.tsx` — small stack/counter badges (compact variant).
- Create: `src-next/app/hud/ShardDeductToast.tsx` — floating −1 ◇ on Shard Sink trigger.
- Modify: `src-next/app/screens/Round.tsx` — mount `<ShardDeductToast />`.
- Modify: `src-next/styles/index.css` — keyframes.

- [ ] **Step 1: Add keyframes to `styles/index.css`**

Append to `src-next/styles/index.css`:

```css
@keyframes mat-pulse-fire {
  0%   { transform: scale(1); box-shadow: 0 0 14px var(--gold); }
  50%  { transform: scale(1.08); box-shadow: 0 0 28px var(--gold), 0 0 56px var(--gold); }
  100% { transform: scale(1); box-shadow: 0 0 14px var(--gold); }
}

@keyframes mat-telegraph-warn {
  0%   { box-shadow: 0 0 14px var(--crimson); }
  50%  { box-shadow: 0 0 28px var(--crimson), 0 0 56px var(--crimson); }
  100% { box-shadow: 0 0 14px var(--crimson); }
}

@keyframes mat-chain-pulse {
  0%   { transform: scale(1); filter: brightness(1); }
  50%  { transform: scale(1.12); filter: brightness(1.5); }
  100% { transform: scale(1); filter: brightness(1); }
}

@keyframes shard-deduct-toast {
  0%   { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-30px); }
}
```

- [ ] **Step 2: Rewrite `CatalystStrip.tsx`**

Replace `src-next/app/hud/CatalystStrip.tsx` content:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useStore, type GameState } from '../../state/store';
import { lookupCatalyst } from '../../data/catalysts';
import { bus } from '../../events/bus';

const selectCatalysts = (s: GameState) => s.run.catalysts;
const selectCompoundingStacks = (s: GameState) => s.run.compoundingStacks;
const selectHandsPlayed = (s: GameState) => s.run.handsPlayed;
const selectHandsLeft = (s: GameState) => s.round.handsLeft;
const selectActive = (s: GameState) => s.round.active;

const PULSE_DURATION_MS = 320;
const CHAIN_PULSE_STEP_MS = 80;

export function CatalystStrip() {
  const catalysts = useStore(selectCatalysts);
  const compoundingStacks = useStore(selectCompoundingStacks);
  const handsPlayed = useStore(selectHandsPlayed);
  const handsLeft = useStore(selectHandsLeft);
  const roundActive = useStore(selectActive);

  // Map of catalyst id -> "currently pulsing" boolean.
  const [pulsing, setPulsing] = useState<Record<string, boolean>>({});
  const pulseTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const off = bus.on('onUpgradeTriggered', (payload: { id: string }) => {
      const id = payload.id;
      if (id === 'catalyst_bench') {
        // Chain-reaction: pulse each OTHER owned catalyst in sequence
        const others = catalysts.filter((c) => c !== 'catalyst_bench');
        others.forEach((otherId, i) => {
          setTimeout(() => {
            setPulsing((s) => ({ ...s, [otherId]: true }));
            const t = setTimeout(() => {
              setPulsing((s) => ({ ...s, [otherId]: false }));
            }, PULSE_DURATION_MS);
            pulseTimersRef.current[otherId] = t;
          }, i * CHAIN_PULSE_STEP_MS);
        });
        return;
      }
      // Simple pulse for the catalyst that just fired
      if (catalysts.includes(id)) {
        setPulsing((s) => ({ ...s, [id]: true }));
        if (pulseTimersRef.current[id]) clearTimeout(pulseTimersRef.current[id]);
        pulseTimersRef.current[id] = setTimeout(() => {
          setPulsing((s) => ({ ...s, [id]: false }));
        }, PULSE_DURATION_MS);
      }
    });
    return () => off();
  }, [catalysts]);

  if (catalysts.length === 0) return null;

  return (
    <div style={{
      position: 'absolute', top: 142, left: 18,
      display: 'flex', gap: 8, zIndex: 4,
    }}>
      {catalysts.map((id, i) => {
        const c = lookupCatalyst(id);
        if (!c) return null;
        const isPulsing = pulsing[id];
        const showLastThrowWarn = id === 'last_throw' && roundActive && handsLeft === 1;
        const animation = showLastThrowWarn
          ? 'mat-telegraph-warn 1s ease-in-out infinite'
          : isPulsing
          ? `mat-pulse-fire ${PULSE_DURATION_MS}ms ease-out`
          : undefined;
        return (
          <div key={i} className="has-tip" style={{ position: 'relative' }}>
            <div style={{
              width: 64, height: 88, borderRadius: 8,
              background: `linear-gradient(180deg, ${c.color}25, rgba(15,9,37,0.85))`,
              border: `1px solid ${c.color}80`,
              boxShadow: `0 0 14px ${c.color}40, inset 0 0 10px ${c.color}20`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 4px',
              cursor: 'help',
              animation,
            }}>
              <div className="f-mono uc" style={{ fontSize: 8, letterSpacing: '0.18em', color: '#bba8ff' }}>catalyst</div>
              <div style={{ fontSize: 28, color: c.color, filter: `drop-shadow(0 0 6px ${c.color})` }}>{c.icon}</div>
              <div className="f-mono uc" style={{ fontSize: 7, letterSpacing: '0.14em', color: c.color, textAlign: 'center', lineHeight: 1.2 }}>
                {c.name.split(' ').pop()}
              </div>
              {/* Compounding Bias stack badge */}
              {id === 'compounding_bias' && compoundingStacks > 0 && (
                <div style={{
                  position: 'absolute', top: 4, right: 4,
                  fontSize: 10, fontFamily: '"JetBrains Mono", monospace',
                  color: c.color, fontWeight: 700,
                  background: 'rgba(15,9,37,0.85)',
                  padding: '1px 4px', borderRadius: 4,
                  border: `1px solid ${c.color}80`,
                }}>
                  +{compoundingStacks}
                </div>
              )}
              {/* Patience Counter counter badge */}
              {id === 'patience_counter' && (
                <div style={{
                  position: 'absolute', top: 4, right: 4,
                  fontSize: 9, fontFamily: '"JetBrains Mono", monospace',
                  color: c.color, fontWeight: 700,
                  background: 'rgba(15,9,37,0.85)',
                  padding: '1px 4px', borderRadius: 4,
                  border: `1px solid ${c.color}80`,
                }}>
                  {handsPlayed % 5}/5
                </div>
              )}
            </div>
            <div className="tip">{c.desc}</div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Update `LoadoutDock.tsx` with compact badges**

Edit `src-next/app/hud/LoadoutDock.tsx`. Add selector imports + state reads:

```ts
import { selectCatalysts } from '../../state/selectors';
// (replace any existing `import { selectCatalysts ... }` line, or add fresh)
```

Add two new selectors near the existing local selectors:

```ts
const selectCompoundingStacks = (s: GameState) => s.run.compoundingStacks;
const selectHandsPlayed = (s: GameState) => s.run.handsPlayed;
```

Inside the component, read them:

```tsx
const compoundingStacks = useStore(selectCompoundingStacks);
const handsPlayed = useStore(selectHandsPlayed);
```

Inside the catalyst loop (`{catalysts.map((id, i) => { const cat = lookupCatalyst(id); ... })`), add badges next to the icon. Inside the `<span>` that renders the icon, wrap with a positioned container or add absolute-positioned overlays:

Replace the catalyst loop body:

```tsx
{catalysts.map((id, i) => {
  const cat = lookupCatalyst(id);
  if (!cat) return null;
  return (
    <div key={`o-${i}`} className="has-tip" style={{ position: 'relative' }}>
      <span style={{
        display: 'inline-grid', placeItems: 'center',
        width: 32, height: 32, borderRadius: 6,
        background: `${cat.color}25`,
        border: `1px solid ${cat.color}80`,
        fontSize: 18, color: cat.color,
        filter: `drop-shadow(0 0 4px ${cat.color})`,
      }}>{cat.icon}</span>
      {id === 'compounding_bias' && compoundingStacks > 0 && (
        <span style={{
          position: 'absolute', top: -4, right: -6,
          fontSize: 8, fontFamily: '"JetBrains Mono", monospace',
          color: cat.color, fontWeight: 700,
          background: 'rgba(15,9,37,0.9)',
          padding: '0 3px', borderRadius: 3,
        }}>+{compoundingStacks}</span>
      )}
      {id === 'patience_counter' && (
        <span style={{
          position: 'absolute', top: -4, right: -6,
          fontSize: 8, fontFamily: '"JetBrains Mono", monospace',
          color: cat.color, fontWeight: 700,
          background: 'rgba(15,9,37,0.9)',
          padding: '0 3px', borderRadius: 3,
        }}>{handsPlayed % 5}/5</span>
      )}
      <span className="tip">{cat.name} — {cat.desc}</span>
    </div>
  );
})}
```

- [ ] **Step 4: Create `ShardDeductToast.tsx`**

Create `src-next/app/hud/ShardDeductToast.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';

type Toast = { id: number; ts: number };
let toastId = 1;

export function ShardDeductToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const off = bus.on('onUpgradeTriggered', (payload: { id: string }) => {
      if (payload.id !== 'shard_sink') return;
      const id = toastId++;
      setToasts((t) => [...t, { id, ts: Date.now() }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 600);
    });
    return () => off();
  }, []);

  return (
    <>
      {toasts.map((t) => (
        <div key={t.id} style={{
          position: 'absolute',
          top: 32, right: 110,
          zIndex: 12, pointerEvents: 'none',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 14, fontWeight: 700,
          color: '#f5c451',
          textShadow: '0 0 10px #f5c451',
          animation: 'shard-deduct-toast 600ms ease-out forwards',
        }}>
          −1 ◇
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 5: Mount toast in `Round.tsx`**

Edit `src-next/app/screens/Round.tsx`. Add import:

```tsx
import { ShardDeductToast } from '../hud/ShardDeductToast';
```

In the JSX, near `<CatalystStrip />`, mount it:

```tsx
<CatalystStrip />
<ShardDeductToast />
```

- [ ] **Step 6: Run tests**

```bash
cd C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2
npm test
```

Expected: all tests still pass. HUD tests are non-existent, so no new test runs here — the code only adds visual layers.

- [ ] **Step 7: Build**

```bash
npm run build
```

Expected: green.

- [ ] **Step 8: Commit**

```bash
git add src-next/styles/index.css src-next/app/hud/CatalystStrip.tsx src-next/app/hud/LoadoutDock.tsx src-next/app/hud/ShardDeductToast.tsx src-next/app/screens/Round.tsx
git diff --cached --stat
git commit -m "feat(hud): catalyst juice — badges, pulse, telegraph, chain reaction, shard toast"
```

---

## Task 6: Smoke (manual)

**Files:** none.

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 2: Visual check (each catalyst)**

In the browser, open devtools console and grant each catalyst, score a hand, observe juice:

```js
// Grant each catalyst (paste in console)
__store__.getState && __store__.getState().run; // verify state shape
// If a `dispatch` global exists, use it; otherwise use the GRANT_CATALYST action via the existing dispatch import.
```

(If devtools doesn't expose a granting hook, use the existing devtools tab — there should be a way to fire `GRANT_CATALYST` from the panel. Check `src-next/devtools/` for the relevant tab.)

For each new catalyst, verify:
- **Compounding Bias** — clear a blind, badge updates from 0 to 1, etc. Mult should grow over scoring sequence.
- **Last Throw** — enter a hand with handsLeft = 1; card glows red (telegraph). Score; +25 chip burst on card pulse.
- **Patience Counter** — counter ticks up each hand. On 5th hand, magenta-tinted ×3 mult slam appears in ScoreMoment overlay.
- **Catalyst Bench** — own at least 2 other catalysts. Score; the other catalysts pulse gold sequentially.
- **Shard Sink** — own with shards ≥ 1. Score; −1 ◇ toast floats up from shards icon.

- [ ] **Step 3: Document any issues**

If juice doesn't fire as expected, fix and add a follow-up commit. If everything looks good, close out.

If dev-server smoke isn't practical, mark this task as deferred. The deterministic test suite covers correctness of the catalyst mechanics; visual verification is for juice quality.

---

## Self-Review

**1. Spec coverage:**

| Spec section | Implemented in |
|---|---|
| RunSlice fields | Task 1 Step 1 |
| RoundSlice transient flag | Task 1 Step 2 |
| Migrator default-fill | Task 1 Steps 3-4 |
| Compounding Bias entry + apply | Task 2 Steps 1-2, test in Step 8 |
| Last Throw entry + apply | Task 2 Steps 1, 3, test in Step 8 |
| Patience Counter entry + apply | Task 2 Steps 1, 4, test in Step 8 |
| Catalyst Bench entry + apply | Task 2 Steps 1, 5, test in Step 8 |
| Shard Sink entry + apply + helper | Task 2 Steps 1, 6, test in Step 8 |
| Catalyst index | Task 2 Step 7 |
| State mutation: handsPlayed | Task 3 Step 2 |
| State mutation: compoundingStacks | Task 3 Step 1 |
| State mutation: shardSinkPrimedThisHand | Task 3 Step 2 |
| transitions.test | Task 3 Step 3 |
| roll.test | Task 3 Step 4 |
| Beat tint extension | Task 4 Step 1 |
| Adapter tint detection | Task 4 Step 4 |
| Sequence tint passthrough | Task 4 Step 5 |
| ScoreMoment tint render | Task 4 Step 6 |
| Stack/counter badges | Task 5 Steps 2-3 |
| Card pulse on trigger | Task 5 Step 2 |
| Last Throw telegraph | Task 5 Step 2 |
| Catalyst Bench chain-reaction | Task 5 Step 2 |
| Patience Counter magenta slam | Task 4 (full chain) |
| Shard deduct toast | Task 5 Step 4-5 |
| CSS keyframes | Task 5 Step 1 |
| Smoke check | Task 6 |

All spec sections covered.

**2. Placeholder scan:** Each step has full code or commands. No "TBD" / "TODO" / "implement later" / "fill in details" patterns. The smoke task explicitly allows deferral if dev-server inspection isn't practical — that's a documented option, not a placeholder.

**3. Type consistency:**
- `shardSinkActive(state)` defined in Task 2 Step 6, imported in Task 3 Step 2.
- `Beat.mult-slam` extended in Task 4 Step 1, consumed in Task 4 Step 5 (sequence) + Task 4 Step 6 (ScoreMoment).
- `SequenceInput.mults[*].tint?` extended in Task 4 Step 1, populated in Task 4 Step 4 (adapter), consumed in Task 4 Step 5 (sequence).
- `lastScoringCtx.events` extended in Task 4 Step 2, populated in Task 4 Step 3, read in Task 4 Step 4 (adapter).
- Selectors `selectCompoundingStacks`, `selectHandsPlayed` defined in Task 5 Step 2 (CatalystStrip), reused in Task 5 Step 3 (LoadoutDock).
- All catalyst id strings consistent across data, registry, action handler, HUD.

**4. Test counts:**

| After task | Expected total | New tests added |
|------------|---------------:|----------------:|
| Task 1 | 141 | +2 (migrator) |
| Task 2 | ~155 | +14 (5 catalyst suites) |
| Task 3 | ~162 | +7 (transitions + roll) |
| Task 4 | ~162 | 0 (no new tests; type changes only) |
| Task 5 | ~162 | 0 (HUD changes; no new tests) |

Final ~162 (was 139 baseline + ~23 new).

If actual numbers differ (e.g. existing tests need updates due to type changes), reconcile in the relevant task before commit.

---

## Execution Handoff

After saving the plan, offer execution choice.
