# Catalyst Vertical Slice — Design

**Status**: Approved (design phase)
**Date**: 2026-04-28
**Sub-project**: D-1 (first slice of sub-project D — modifiers + game juice)

## Goal

Add 5 new catalysts that demonstrate non-trivial mechanic types (scaling, trigger, counter, synergy, risk) and ship full juice (badges, telegraphs, chain-reactions, tinted slams, toasts). Showcase modifier depth + visceral feedback in one cohesive slice.

## Sibling sub-projects

D was originally framed as "modifiers + game juice" — too big for one spec. Decomposed:

- **D-1 (this spec)** — vertical slice: 5 new catalysts + full juice for them.
- D-2 — breadth pass: 10-20 new entries using existing mechanic types (mods, vouchers, consumables, bosses).
- D-3 — additional juice: scoring particles, screen shake, camera moves.

D-1 first because it proves the new mechanic-type architecture and the juice integration patterns that D-2 and D-3 will reuse.

## Locked design decisions

- **Slice shape** (Q1 d): vertical slice — 5 new catalysts + full juice.
- **Mechanic mix** (Q2 f): one catalyst from each of scaling / trigger / counter / synergy / risk families.
- **Roster** (Q3 + clarification): Compounding Bias, Last Throw, Patience Counter, Catalyst Bench, Shard Sink.
- **State architecture** (A): minimal — add 2 fields to `RunSlice` directly. Refactor to generic state map only when D-2 needs it.
- **Juice scope** (Section 3 c): full juice — badges + card pulse + Last Throw telegraph + Shard Sink deduct toast + Catalyst Bench chain-reaction pulse + Patience Counter magenta-tint slam.

## Roster

| # | Name | id | Family | Effect | Rarity |
|---|------|------|--------|--------|--------|
| 1 | **Compounding Bias** | `compounding_bias` | scaling | +0.05× mult permanently per blind cleared. Resets to 0 on bust. | uncommon |
| 2 | **Last Throw** | `last_throw` | trigger | When `state.round.handsLeft === 1` entering this hand → +25 chips. | common |
| 3 | **Patience Counter** | `patience_counter` | counter | Every 5th hand of run → ×3 mult (this hand only). | rare |
| 4 | **Catalyst Bench** | `catalyst_bench` | synergy | +1 mult per other catalyst owned. | uncommon |
| 5 | **Shard Sink** | `shard_sink` | risk | Auto-spend 1 shard pre-score → ×1.5 mult. Only fires if `shards >= 1`. | common |

Power floor: existing catalysts averaged ~+4 chips (Six Bias) to ~×2 mult (Stratifier). New roster fits the same range; long-game (Compounding Bias), burst (Patience Counter), and synergy (Catalyst Bench) lean stronger but have setup costs (time, slot count).

## Architecture

### State additions

Two fields on `RunSlice`, one transient flag on `RoundSlice`:

- `RunSlice.handsPlayed: number` — total hands scored across the run.
- `RunSlice.compoundingStacks: number` — count of cleared blinds since last bust.
- `RoundSlice.shardSinkPrimedThisHand: boolean` — transient flag: `true` IFF the current hand had a shard deducted by Shard Sink. Set in `SCORE_HAND` action handler before pipeline runs; reset to `false` at start of each `SCORE_HAND` (idempotent — handler always overwrites).

### `RunSlice` (`src-next/state/slices/run.ts`)

```ts
export type RunSlice = {
  seed: number;
  shards: number;
  ante: number;
  goalIdx: number;
  catalysts: string[];
  vouchers: string[];
  consumables: string[];
  handsPlayed: number;        // increments on every SCORE_HAND
  compoundingStacks: number;  // +1 per blind cleared, resets to 0 on bust
};

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

Both fields always update regardless of whether the relevant catalyst is owned — simpler than gated mutation, and the cost is two integers per save.

### State mutation sites

- **`actions/handlers/roll.ts` SCORE_HAND**:
  - Pre-pipeline: if `shardSinkActive(s)` is true, build `workingState = { ...s, run: { ...s.run, shards: s.run.shards - 1 } }` and pass to `runRollPipelineUpToSim`. Otherwise pass `s`.
  - Post-pipeline: `baseState.run.handsPlayed = s.run.handsPlayed + 1` (use the pre-deduction handsPlayed, increment exactly once per hand).
- **`core/round/transitions.ts`**:
  - `clearBlind`: include `compoundingStacks: s.run.compoundingStacks + 1` in the new run object.
  - `bustBlind` (BOTH branches — soft-bust partial-credit AND hard-bust): include `compoundingStacks: 0` in the new run object.

### Save migrator (`src-next/state/migrations/v1_retheme.ts`)

Add field defaults:

```ts
// inside migrateRetheme, after run-key remaps:
if (run3 && (typeof (run3 as Record<string, unknown>).handsPlayed !== 'number')) {
  next.run = { ...(next.run as Record<string, unknown>), handsPlayed: 0 };
}
const run4 = next.run as Record<string, unknown> | undefined;
if (run4 && (typeof run4.compoundingStacks !== 'number')) {
  next.run = { ...run4, compoundingStacks: 0 };
}
```

### New catalyst entries (`src-next/data/catalysts.ts`)

Append to `CATALYST_META`:

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

Plus update `CATALYST_IDS` array in `src-next/core/upgrades/catalysts/index.ts` and add side-effect imports for the 5 new entry files.

### Per-catalyst implementation

Each catalyst lives in its own `core/upgrades/catalysts/<name>.ts` file. Phase priorities chosen to interact correctly with each other and existing catalysts.

| Catalyst | priority | Phase | Apply rule |
|----------|--------:|-------|-----------|
| Last Throw | 30 | UPGRADES | If `state.round.handsLeft === 1`: `chips += 25` |
| Catalyst Bench | 30 | UPGRADES | `mult += otherCatalystCount` |
| Compounding Bias | 80 | UPGRADES | If stacks > 0: `mult *= (1 + stacks * 0.05)` |
| Shard Sink | 90 | UPGRADES | If `shardSinkActive(state)`: `mult *= 1.5` |
| Patience Counter | 150 | UPGRADES | If `(handsPlayed + 1) % 5 === 0`: `mult *= 3` |

#### `compoundingBias.ts`

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

#### `lastThrow.ts`

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

#### `patienceCounter.ts`

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
    // handsPlayed is incremented AFTER this hand. Current hand number = handsPlayed + 1.
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

#### `catalystBench.ts`

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

#### `shardSink.ts`

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

**Atomicity contract**: `roll.ts SCORE_HAND` is the single decision point. Pseudocode for the SCORE_HAND case:

```ts
const primed = shardSinkActive(s);
const shardsAfter = primed ? s.run.shards - 1 : s.run.shards;
const workingState: GameState = {
  ...s,
  run: { ...s.run, shards: shardsAfter },
  round: { ...s.round, shardSinkPrimedThisHand: primed },
};
const baseCtx = runRollPipelineUpToSim(workingState);
// ... existing pipeline + state-assembly logic ...
// In the final baseState, set round.shardSinkPrimedThisHand back to false
// (it was a one-hand transient; resetting prevents stale reads if no future
// SCORE_HAND fires before persistence saves).
```

Decision + deduction + flag set happen in one state transform. Catalyst.apply only reads the flag.

## Juice scope (full)

### Stack-count + counter badges

`src-next/app/hud/CatalystStrip.tsx` — extend the per-catalyst card to render a small overlay badge for two specific catalysts:

- **Compounding Bias**: badge shows current `state.run.compoundingStacks` (e.g. `+3`).
- **Patience Counter**: badge shows `(state.run.handsPlayed % 5)` `/5` (e.g. `3/5`).

Same overlay pattern in `src-next/app/hud/LoadoutDock.tsx` for the small icons there.

Implementation: small subscription to relevant selectors. Conditional render only when catalyst is owned.

### Card-pulse on `onUpgradeTriggered`

CatalystStrip subscribes to `bus.on('onUpgradeTriggered', ...)`. When `payload.id` matches a rendered catalyst, briefly add a CSS class (`mat-pulse-fire`) for ~300ms that pulses the card's box-shadow + scale. Reuses existing `chipPop` keyframes pattern.

### Last Throw telegraph (pre-roll warn)

When `state.round.handsLeft === 1` AND `state.round.active` AND Last Throw is owned, the Last Throw card on CatalystStrip pulses red continuously (slow heartbeat) until the hand resolves. Reuses existing `pulse-glow` keyframes; conditional on the state selector.

### Shard Sink deduct toast

New tiny component `src-next/app/hud/ShardDeductToast.tsx`. Subscribes to `bus.on('onUpgradeTriggered', ...)`. When `payload.id === 'shard_sink'`, render `−1 ◇` floating up from the TopBar shards icon for ~600ms. Uses existing `flying-number` particle pattern.

Note: the deduction itself happens BEFORE scoring (in roll.ts), but the toast fires when the catalyst.apply event hits the bus during the upgrade phase. Visually the toast appears overlapping the cast-swell beat — close enough to feel atomic.

### Catalyst Bench chain-reaction

When `onUpgradeTriggered` fires for `catalyst_bench`, `CatalystStrip` schedules a sequential pulse: every other owned catalyst card pulses gold once, ~80ms apart. Total duration ~80ms × N. Visual chain-reaction "the bench is paying me".

Implementation: array of timers in CatalystStrip's effect. When trigger event fires, snapshot the other-catalyst array, schedule per-card pulses.

### Patience Counter magenta-tint slam

`src-next/core/scoring/types.ts` `Beat` union — extend `mult-slam` with optional `tint?: 'gold' | 'magenta' | undefined`:

```ts
| { kind: 'mult-slam';    t: number; label: string; multiplier: number; pitchSemis: number; ampScale: number; tint?: 'gold' | 'magenta' }
```

**Implementation**: extend `Beat` `mult-slam` with optional `tint?: 'gold' | 'magenta'`. Adapter (`src-next/core/scoring/adapter.ts`) scans `lastScoringCtx.events` for any `onUpgradeTriggered` with `payload.id === 'patience_counter'`. If found, the synthesized mult-slam representing Patience Counter's contribution carries `tint: 'magenta'`. ScoreMoment renders the slam with magenta border + glow when `tint === 'magenta'`.

Caveat: the adapter currently builds `mults` from the final `mult` and `chain.mult` values. To carry per-mult tint, the adapter needs richer info than the current `MinimalScoringCtx` provides. Cheapest path: extend `MinimalScoringCtx` with an `events` field (already lives on the round.lastScoringCtx via the SCORE_HAND assembly) and have the adapter read it.

### Files touched

| Path | Change |
|------|--------|
| `src-next/state/slices/run.ts` | +2 fields |
| `src-next/state/slices/round.ts` | +1 field (`shardSinkPrimedThisHand`) |
| `src-next/state/migrations/v1_retheme.ts` | default-fill new fields |
| `src-next/state/migrations/v1_retheme.test.ts` | new test |
| `src-next/actions/handlers/roll.ts` | `SCORE_HAND` increments `handsPlayed`, applies Shard Sink deduction + flag |
| `src-next/core/round/transitions.ts` | `clearBlind` increments `compoundingStacks`; `bustBlind` resets |
| `src-next/data/catalysts.ts` | +5 entries with optional `flavor` |
| `src-next/core/upgrades/catalysts/compoundingBias.ts` | new |
| `src-next/core/upgrades/catalysts/lastThrow.ts` | new |
| `src-next/core/upgrades/catalysts/patienceCounter.ts` | new |
| `src-next/core/upgrades/catalysts/catalystBench.ts` | new |
| `src-next/core/upgrades/catalysts/shardSink.ts` | new (with `shardSinkActive` helper) |
| `src-next/core/upgrades/catalysts/index.ts` | side-effect imports + extend `CATALYST_IDS` |
| `src-next/app/hud/CatalystStrip.tsx` | stack/counter badges + card-pulse + telegraph + chain-reaction |
| `src-next/app/hud/LoadoutDock.tsx` | small badges (compact card variant) |
| `src-next/app/hud/ShardDeductToast.tsx` | new component (mounted alongside CatalystStrip) |
| `src-next/app/screens/Round.tsx` | mount `<ShardDeductToast />` |
| `src-next/core/scoring/types.ts` | extend `mult-slam` with optional `tint` |
| `src-next/core/scoring/adapter.ts` | tag Patience Counter slam with `tint: 'magenta'` |
| `src-next/app/hud/ScoreMoment.tsx` | render mult-slam tint variants |
| `src-next/styles/index.css` | `mat-pulse-fire`, `mat-telegraph-warn`, `mat-chain-pulse` keyframes |

Per-catalyst test files: `compoundingBias.test.ts`, `lastThrow.test.ts`, `patienceCounter.test.ts`, `catalystBench.test.ts`, `shardSink.test.ts`.

Plus mutation tests:
- `src-next/core/round/transitions.test.ts` (extend or new)
- `src-next/actions/handlers/roll.test.ts` (extend or new)

## Tests

Per-catalyst suites (one per file):

**compoundingBias.test.ts**
- stacks=0 returns ctx unchanged.
- stacks=3 multiplies mult by 1.15.
- emits onUpgradeTriggered with deltaMult = newMult - ctx.mult.

**lastThrow.test.ts**
- handsLeft=2 returns ctx unchanged.
- handsLeft=1 adds 25 chips.
- handsLeft=0 returns ctx unchanged (terminal/edge case).

**patienceCounter.test.ts**
- handsPlayed=3 (this is 4th hand) returns ctx unchanged.
- handsPlayed=4 (5th hand) multiplies mult by 3.
- handsPlayed=9 (10th hand) multiplies mult by 3.

**catalystBench.test.ts**
- 0 other catalysts: returns ctx unchanged.
- 3 other catalysts: mult += 3.
- Owned alongside `catalyst_bench`: filters self-id, doesn't double-count.

**shardSink.test.ts**
- `shardSinkActive(state)` helper: catalysts=[shard_sink], shards=0 → false; shards=1 → true; catalysts=[] → false.
- apply when `shardSinkPrimedThisHand=false` → no-op.
- apply when `shardSinkPrimedThisHand=true` → mult *= 1.5.

**State mutation tests**:

`transitions.test.ts`:
- `clearBlind` sets `run.compoundingStacks = oldStacks + 1`.
- `bustBlind` (soft branch — partial-credit): `run.compoundingStacks = 0`.
- `bustBlind` (hard branch): `run.compoundingStacks = 0`.

`roll.test.ts` (extend or new):
- `SCORE_HAND` increments `run.handsPlayed` by 1.
- `SCORE_HAND` with Shard Sink owned + shards≥1: deducts 1 shard, sets `shardSinkPrimedThisHand: true`.
- `SCORE_HAND` with Shard Sink owned + shards=0: no shard deduction, `shardSinkPrimedThisHand: false`.
- `SCORE_HAND` without Shard Sink: no shard deduction.

**Migrator test** (extend `v1_retheme.test.ts`):
- Old save without `handsPlayed` field → migrator defaults to 0.
- Old save without `compoundingStacks` field → migrator defaults to 0.
- New-shape save with both fields → migrator passes through unchanged.

Total new tests: ~18-20 (5 catalyst suites × 3-ish + ~5 mutation + ~3 migrator).

## Non-goals

- Mod, voucher, consumable, boss content additions (deferred to D-2).
- New SFX files. Reuse existing bank with pitch/amp variants where helpful.
- New particle classes. Reuse existing particles (chip-burst, shockwave, flying numbers).
- AudioEngine changes.
- Scoring sequence pacing changes (already polished in sub-project A).
- Rebalancing existing 6 catalysts.
- Full ShopOffer rebalance (rarities included; pool sizes unchanged).
- Generalized stateful-catalyst registry (deferred until D-2 or later, when the count justifies it).
- Chain-aware intensity / multi-hand combos beyond `handsPlayed` integer.

## Risks

| Risk | Mitigation |
|------|-----------|
| Catalyst Bench self-counting bug | Filter `id !== 'catalyst_bench'` in apply; explicit unit test |
| Shard Sink condition drift between roll.ts and apply | Single `shardSinkActive(state)` helper used by handler; transient `shardSinkPrimedThisHand` flag set by handler, read by apply |
| Patience Counter timing off-by-one | Documented in code comment; tests cover 4th-vs-5th-hand explicitly |
| Compounding stacks not reset on bust | `bustBlind` covers BOTH soft-bust (partial-credit) AND hard-bust branches; tested |
| Old saves missing new fields | Migrator defaults to 0; tested |
| Patience Counter ×3 stacks oddly with chain mult | Phase priority 150 (last in catalyst chain); chain-mult applied later in `scoring` phase. Should compose correctly — to verify with an integration test if one exists, otherwise rely on unit tests for each pipeline stage. |
| Card-pulse animation conflicts with existing CatalystStrip animation | Unique animation names (`mat-pulse-fire`, etc.); CSS class scoped |
| Mult-slam `tint` field break existing consumers | Optional field; ScoreMoment defaults to existing color if undefined |
| Adapter detecting Patience Counter trigger via events scan is fragile | Doc the convention; alternative is to pass tint via beat-build args. Keep simple: scan events array for `id: 'patience_counter'` |

## Acceptance

- Build green.
- ~157 tests pass (139 baseline + 18 new).
- Existing 132 tests still pass (no regressions).
- Save migrator round-trips a v0.2.0-era save (no `handsPlayed`/`compoundingStacks`) without crash.
- Dev-server visual check: equip each new catalyst (via devtools/console grant), score a hand, observe juice (badge update, card pulse, telegraph, toast, chain reaction, magenta slam).
- Single PR / commit chain on `main`. No breaking changes to consumer APIs (ScoreMoment, AudioEngine).
