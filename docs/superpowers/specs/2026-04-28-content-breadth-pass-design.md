# Content Breadth Pass — Design

**Status**: Approved (design phase)
**Date**: 2026-04-28
**Sub-project**: D-2 (of 4 — see decomposition; D-2 first slice of D's content sweep)

## Goal

Add 10 new content entries spanning all 4 modifier categories (3 mods, 3 vouchers, 2 consumables, 2 bosses). Free-form mechanic design — small new fields are acceptable. Single design doc, single PR, four per-category commits.

## Sibling sub-projects

D was decomposed into D-1 (catalyst vertical slice — shipped), D-2 (this — content breadth), D-3 (additional juice — particles/shake/camera, queued).

## Locked design decisions

- **Slice shape** (Q1 a): balanced batch — 3 mods + 3 vouchers + 2 consumables + 2 bosses = 10 entries.
- **Mechanic discipline** (Q2 c): free-form. Small new fields permitted.
- **Packaging** (Approach C): one spec, one plan, one PR, four per-category commits inside.

## Roster (full)

### Mods (3)

| id | name | icon | desc | rarity | new field |
|----|------|------|------|--------|-----------|
| `pip_charge`  | Pip Charge  | ⫶ | +chips equal to face × 2 per scoring die | rare      | `chipPerPip: number` |
| `even_keel`   | Even Keel   | ⚖ | +2 mult if face is even (2/4/6)         | uncommon  | `evenFaceMult: number` |
| `mirror_pair` | Mirror Pair | ⚉ | +3 mult per other die in hand sharing this face | uncommon | `pairBonus: number` |

### Vouchers (3)

| id | name | description | price | mechanic |
|----|------|-------------|-------|----------|
| `open_mic`     | Open Mic     | +1 hand per round           | 8 | new helper `extraHandsPerRound(s)` |
| `free_refresh` | Free Refresh | Shop rerolls cost 0          | 8 | new helper `freeShopReroll(s)` |
| `capacity`     | Capacity     | +1 consumable slot (max 5)   | 6 | new helper `maxConsumableSlots(s)` |

### Consumables (2)

| id | type | name | icon | description |
|----|------|------|------|-------------|
| `pin_three`    | calibration | Pin Three    | ☷ | Set one die to face 3. |
| `spare_reroll` | resource    | Spare Reroll | ↻ | +1 reroll this round. |

### Bosses (2 — new debuff strings)

| id | name | icon | description | new debuff |
|----|------|------|-------------|-----------|
| `eris`  | Eris  | ⯰ | Catalysts inert on first hand. | `disable_catalysts_first_hand` |
| `sedna` | Sedna | ⯲ | Mod slots capped at 1.          | `mod_slots_capped_1` |

## Architecture

### Mod field additions

`src-next/core/mods/index.ts`, `ModDef`:

```ts
chipPerPip?: number;       // chips contribution = chipPerPip × face per scoring die
evenFaceMult?: number;     // +mult per scoring die where face is even
pairBonus?: number;        // +mult per other die in hand sharing this die's face
```

### `applyModScoring` extensions (`src-next/core/phases/upgrades.ts`)

Inside the per-die loop, after existing checks (`scoreBonus`, `multBonus`, `snakeEyes`, `highFaceMult`):

```ts
if (def.chipPerPip) dChips += def.chipPerPip * face;
if (def.evenFaceMult && face % 2 === 0) dMult += def.evenFaceMult;
if (def.pairBonus) {
  const matches = faces.filter((f) => f === face).length - 1; // exclude self
  if (matches > 0) dMult += def.pairBonus * matches;
}
```

Mod ordering: existing fields applied first (so `loaded` 1→6 remap fires in `applyFaceRemaps` BEFORE scoring; by the time `applyModScoring` runs, `face` already reflects the remap). `pip_charge` on a face-1 die that was Loaded-remapped to 6 produces +12 chips. Documented as intentional.

### Voucher helpers (`src-next/core/vouchers/index.ts`)

```ts
import { hasDebuff } from '../round/debuffs';

export function extraHandsPerRound(s: GameState): number {
  return ownsVoucher(s, 'open_mic') ? 1 : 0;
}
export function freeShopReroll(s: GameState): boolean {
  return ownsVoucher(s, 'free_refresh');
}
export function maxConsumableSlots(s: GameState): number {
  return ownsVoucher(s, 'capacity') ? 5 : 4;
}

// Existing maxModSlots — extended:
export function maxModSlots(s: GameState): number {
  if (hasDebuff(s, 'mod_slots_capped_1')) return 1;
  return ownsVoucher(s, 'forged_links') ? 3 : 2;
}
```

### Consumable cap migration

Drop `MAX_CONSUMABLES = 4` literal in `src-next/state/slices/run.ts`. Replace usages with `maxConsumableSlots(s)`:

- `src-next/actions/handlers/shop.ts` `BUY_OFFER` consumable branch
- `src-next/actions/handlers/consumable.ts` `GRANT_CONSUMABLE`

Grep confirms 2 sites currently reference `MAX_CONSUMABLES` or hardcode `< 4`.

### Boss debuff additions

`src-next/core/round/debuffs.ts` `Debuff` union:

```ts
export type Debuff =
  | 'no_rerolls'
  | 'disable_catalysts'
  | 'auto_unlock_after_roll'
  | 'hand_size_cap_4'
  | 'no_mod_transforms_on_ones'
  | 'disable_catalysts_first_hand'   // NEW (Eris)
  | 'mod_slots_capped_1';            // NEW (Sedna)
```

### Eris first-hand catalyst gate (`core/phases/upgrades.ts`)

```ts
const isFirstHand = ctx.state.round.handsLeft === ctx.state.round.handsMax;
const catalystsBlocked =
  hasDebuff(ctx.state, 'disable_catalysts') ||
  (isFirstHand && hasDebuff(ctx.state, 'disable_catalysts_first_hand'));
if (!catalystsBlocked) {
  // existing catalyst loop
}
```

First hand definition: `handsLeft === handsMax`. Rerolls don't change handsLeft, so reroll-then-score on first hand still triggers the gate.

### Sedna mod-slot cap

Already covered in the extended `maxModSlots` above. When Sedna is the active boss, `maxModSlots(s)` returns 1 regardless of `forged_links` voucher.

### `startBlind` extra hands wiring (`src-next/core/round/transitions.ts`)

```ts
const baseHandsMax = 3;
const extraHands = extraHandsPerRound(s);
const handsMax = baseHandsMax + extraHands;
return {
  state: {
    // ...
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
};
```

### Shop reroll cost (`src-next/actions/handlers/shop.ts`)

```ts
case 'OPEN_SHOP': {
  const offers = rollOffers(s.run.vouchers);
  const rerollCost = freeShopReroll(s) ? 0 : 5;
  return {
    state: { ...s, shop: { ...s.shop, open: true, offers, rerollCost }, ... },
    // ...
  };
}
```

## Files touched

| Path | Change |
|------|--------|
| `src-next/core/mods/index.ts` | +3 fields, +3 entries |
| `src-next/core/phases/upgrades.ts` | extend `applyModScoring`; add Eris first-hand gate |
| `src-next/data/vouchers.ts` | +3 entries |
| `src-next/core/vouchers/index.ts` | +3 helpers; extend `maxModSlots` |
| `src-next/core/round/transitions.ts` | `startBlind` adds extra hands; resets handsMax with voucher |
| `src-next/state/slices/run.ts` | drop `MAX_CONSUMABLES` literal (or keep + deprecate) |
| `src-next/actions/handlers/shop.ts` | `OPEN_SHOP` reads `freeShopReroll`; `BUY_OFFER` cap reads helper |
| `src-next/actions/handlers/consumable.ts` | `GRANT_CONSUMABLE` cap reads helper |
| `src-next/core/consumables/index.ts` | +2 entries (Pin Three, Spare Reroll) |
| `src-next/data/blinds.ts` | +2 boss entries (Eris, Sedna) |
| `src-next/core/round/debuffs.ts` | Debuff union +2 strings |
| `src-next/core/mods/index.test.ts` | +3 mod tests |
| `src-next/core/vouchers/index.test.ts` | NEW — voucher helper tests |
| `src-next/core/round/transitions.test.ts` | extend with open_mic + bosses |
| `src-next/actions/handlers/shop.test.ts` | NEW or extend — free_refresh test |

## Tests

Per-category, ~12-15 new total. Final ~210/210 (was 197 + ~13).

**Mods (3 tests)** — extend `core/mods/index.test.ts`:
- Pip Charge: face 3 die produces +6 chips (3 × 2).
- Even Keel: face 4 → +2 mult; face 3 → +0.
- Mirror Pair: faces `[3,3,3,5,5]` with mirror_pair on die 0 → matches = 2 → +6 mult.

**Vouchers (3 tests)** — new `core/vouchers/index.test.ts`:
- `extraHandsPerRound` returns 1 if `open_mic` owned, 0 otherwise.
- `maxConsumableSlots` returns 5 if `capacity` owned, 4 otherwise.
- `maxModSlots` returns 1 if `mod_slots_capped_1` debuff active (overrides forged_links).

**Transitions (2 tests)** — extend:
- `startBlind` with open_mic → handsMax = 4.
- `startBlind` without open_mic → handsMax = 3.

**Shop (2 tests)** — extend:
- `OPEN_SHOP` with free_refresh → rerollCost = 0.
- `BUY_OFFER` consumable cap honors `maxConsumableSlots(s)` (4 vs 5).

**Consumables (2 tests)** — extend:
- `pin_three` sets target die face to 3.
- `spare_reroll` increments `rerollsLeft` by 1.

**Bosses (2 tests)** — extend transitions or new file:
- Eris boss + first hand → catalyst pipeline skipped (integration check).
- Sedna boss + forged_links voucher → `maxModSlots` returns 1.

## Non-goals

- New mechanic categories beyond what these 10 entries demonstrate.
- Mod synergy primitives.
- Voucher tier/upgrade chains.
- Boss debuff escalation by ante.
- Boss sigil art polish (TODO comments — same orphan-placeholder approach as Pluto/Ceres/Triton/Phobos/Callisto).
- Boss icon polish (⯰/⯲ may render as boxes on some fonts; accept fallback).
- Save migration — new ids only appear in fresh saves.
- Rebalancing existing roster.
- D-3 juice (separate slice).

## Risks

| Risk | Mitigation |
|------|-----------|
| Pip Charge × Even Keel × Mirror Pair stacking on one die unbounded | 2 mod slots per die cap; numbers chosen so worst-case stack ~+15 mult per die. Acceptable. |
| `MAX_CONSUMABLES` literal swap misses a site | Grep for `MAX_CONSUMABLES` and `< 4` (consumables.length); replace each. Test cap pre/post Capacity. |
| Eris first-hand gate triggered after reroll | First hand defined as `handsLeft === handsMax`. Reroll doesn't decrement handsLeft. So reroll-then-score still on first hand → debuff applies until score happens. Player expectation matches. |
| Sedna mod-cap doesn't force-detach existing mods | Cap enforced at attach time (`ATTACH_MOD`); existing attached mods stay. First-attach during Sedna sees cap=1. Documented. |
| Eris/Sedna icons (⯰/⯲) may not render | Real Unicode (U+2BF0, U+2BF2) but lesser-known. Fallback: box. User can swap to alternatives (⛓, ❄, etc.) in a follow-up if rendering is bad. |
| Open Mic at 8 shards undercosted (+1 hand = ~33% more scoring) | Acknowledged; tune in playtest. Ship at 8; adjust later. |
| Pip Charge × Loaded interaction (1 → 6 remap, then +12 chips) double-dips | `applyFaceRemaps` runs first; `applyModScoring` sees post-remap face. Documented as intended. |
| New boss debuffs collide with future debuff additions | Debuff union additive; future bosses add new strings to union. No collision. |

## Acceptance

- 10 new entries deployed (3 mods + 3 vouchers + 2 consumables + 2 bosses).
- 3 new mod fields, 3 new voucher helpers, 2 new debuff strings.
- Build green; ~210/210 tests pass.
- Existing 197 tests untouched.
- Manual smoke: equip each mod, see effect; buy each voucher, see passive; use each consumable; reach Eris/Sedna boss, see debuff fire.
- Single PR with 4 per-category commits on `feat/d2-content-breadth`:
  1. Mods + their tests
  2. Vouchers + their tests + cap helpers
  3. Consumables + their tests
  4. Bosses + debuff strings + Eris gate + Sedna cap + their tests
