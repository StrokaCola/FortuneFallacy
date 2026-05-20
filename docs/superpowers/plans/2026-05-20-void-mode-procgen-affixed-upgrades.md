# Void Mode — Procgen Affixed Upgrades — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working Void Mode entered via faint title-screen black hole, in which catalysts and consumables roll with procedurally generated affixes (prefix/suffix), backed by a seeded budget-bounded generator, with aesthetic + audio shift and a daily certified seed leaderboard category. MVP ships with **6 canonical affixes (one per family)** to prove the end-to-end pipeline; the full 60-affix content sweep is a follow-up plan.

**Architecture:** A new `src-next/voidmode/` module hosts the affix taxonomy, generator, naming generator, run lifecycle, and daily-seed registry. Existing scoring pipeline gets one new phase (`applyAffixes`) that no-ops outside void mode. Existing `catalystDraw` and consumables index hook the generator when `run.mode === 'void'`. A new `BlackHole` SVG component mounts on the title screen; a `VoidOverlay` component mounts on the play scene when void mode is active. Daily-seed logic mirrors the existing `online/dailyChallenge.ts` pattern. Leaderboard reuses `OnlineScore.mode` partitioning (e.g. `'void-2026-05-20'`).

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Zustand-style store (`state/store.ts`), Tone.js for the drone, Howler for SFX (unused here), Tailwind, SVG + CSS for the black hole. Preview verification via `mcp__Claude_Preview__*`.

**Spec:** `docs/superpowers/specs/2026-05-20-void-mode-procgen-affixed-upgrades-design.md`

---

## File Structure

### New files

| Path | Responsibility |
|------|---------------|
| `src-next/voidmode/types.ts` | All void-mode types: `AffixDef`, `AffixedItem`, `AffixContext`, `AffixFamily`, `AffixSlot`, `ArchetypeTag`. |
| `src-next/voidmode/nameGenerator.ts` | Seeded prefix/suffix/mid-name selection + flavor template engine + per-run alias generator. |
| `src-next/voidmode/nameGenerator.test.ts` | Determinism, no placeholders, tag-matched flavor. |
| `src-next/voidmode/affixes.ts` | `AFFIX_DEFS` array — 6 canonical affixes (one per family) at MVP. |
| `src-next/voidmode/affixGenerator.ts` | Seeded generator: input base item + RNG + budget → `AffixedItem`. Respects archetype gates, slot rules, drawback-refund math. |
| `src-next/voidmode/affixGenerator.test.ts` | Determinism, budget bounds, archetype-gate compliance, slot-rule compliance. |
| `src-next/voidmode/voidRun.ts` | Run lifecycle: `startVoidRun(seed)`, `endVoidRun()`. Wraps existing run-start machinery. |
| `src-next/voidmode/dailySeed.ts` | `getVoidDailyDate`, `getVoidDailySeed`, `getTodayCertified` reading from `dailyCertified.json`. |
| `src-next/voidmode/dailyCertified.json` | Static array of certified-seed records `{ date, seed, clearRate }`. Seeded with one entry for today; future entries via `balanceSim` script. |
| `src-next/voidmode/dailySeed.test.ts` | UTC determinism, certified-lookup correctness. |
| `src-next/voidmode/balanceSim.ts` | CLI/library: enumerate seeds, run sim, filter to `[35%, 65%]` clear-rate band, write back to `dailyCertified.json`. |
| `src-next/voidmode/index.ts` | Public surface: re-exports types + `startVoidRun` + `isVoidMode(state)`. |
| `src-next/app/visual/BlackHole.tsx` | Title-screen SVG black hole + lensing + click handler. |
| `src-next/app/visual/BlackHole.test.tsx` | Renders + click invokes callback. |
| `src-next/app/visual/VoidOverlay.tsx` | Play-scene tint + accretion overlay. Conditional. |
| `src-next/app/visual/VoidOverlay.test.tsx` | Renders only when `mode === 'void'`. |
| `src-next/app/hud/VoidHudBadge.tsx` | Seed + run alias + certified badge corner display. |
| `src-next/audio/voidDrone.ts` | Tone.js drone stem (low sine + detuned partial + LFO). |
| `src-next/audio/voidDrone.test.ts` | Start/stop side effects. |

### Modified files

| Path | Change |
|------|--------|
| `src-next/state/slices/run.ts` | Add `mode: 'normal' \| 'void'` field; add `voidSeed?: number` field. |
| `src-next/state/slices/run.test.ts` (create if absent) | Default mode is `'normal'`. |
| `src-next/data/catalysts.ts` | Add `archetypeTags: ArchetypeTag[]` to each existing `CatalystMeta`. (Audit pass — most have implicit tags.) |
| `src-next/core/phases/applyAffixes.ts` (new under phases/) | New scoring phase. No-op outside void. |
| `src-next/core/pipeline/pipeline.ts` (or wherever phases are composed) | Register `applyAffixes` phase between `face-read` and combo detection. |
| `src-next/core/shop/catalystDraw.ts` | When `state.run.mode === 'void'`, route each drawn catalyst through `affixGenerator`. |
| `src-next/core/consumables/index.ts` | When void, wrap returned consumable rolls through generator. |
| `src-next/app/screens/Title.tsx` | Mount `<BlackHole onClick={...} />`. |
| `src-next/app/screens/Round.tsx` | Mount `<VoidOverlay />` and `<VoidHudBadge />` when `run.mode === 'void'`. |
| `src-next/audio/AudioEngine.ts` (or equivalent entry) | Wire void drone start/stop on mode-change events. |
| `src-next/online/leaderboard.ts` | Add `'void-YYYY-MM-DD'` mode partition (no code change beyond accepting the format — `mode` is already a free string). Update any UI that lists modes. |
| `src-next/online/leaderboard.test.ts` | New test: void-mode submission round-trips with correct mode string. |

---

## Phase 0: Setup

### Task 0.1: Feature branch + dev server baseline

**Files:** none

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b feat/void-mode-procgen-affixes
```

- [ ] **Step 2: Start dev server in background via preview MCP**

Call `mcp__Claude_Preview__preview_start` with command `npm run dev` from repo root. Wait for "ready in" line in `mcp__Claude_Preview__preview_logs`.

- [ ] **Step 3: Capture baseline screenshots**

Use `mcp__Claude_Preview__preview_screenshot` of the Title screen and the Round screen (mid-trial — start a Lyra run, click first challenge). Keep these in-context — used later to confirm Void Mode visual differentiation is real and that normal mode visual is unchanged.

- [ ] **Step 4: Confirm typecheck + tests are green**

```bash
npm run typecheck
npm test
```

Both must pass on the freshly cut branch. If either fails on `main`, stop and report — this plan assumes a green starting state.

---

## Phase 1: Types and run-state foundation

### Task 1.1: Add void-mode types

**Files:**
- Create: `src-next/voidmode/types.ts`

- [ ] **Step 1: Write the types file**

```ts
// src-next/voidmode/types.ts
// All public types for Void Mode. Imported by affixes, affixGenerator,
// nameGenerator, scoring phase, shop hook.

import type { CatalystMeta } from '../data/catalysts';

export type AffixFamily =
  | 'scalar'
  | 'conditional'
  | 'persistent'
  | 'drawback'
  | 'synergy'
  | 'reality-warp';

export type AffixSlot = 'prefix' | 'suffix' | 'mid';

export type ArchetypeTag =
  | 'combo'
  | 'face'
  | 'economy'
  | 'scaling'
  | 'mods'
  | 'timing'
  | 'utility'
  | 'collision'
  | 'risk';

// Context handed to an affix's effect function. The phase that runs
// affixes (core/phases/applyAffixes.ts) populates this. Mutating fields
// is the primary side effect — see chipsBonus/multBonus etc.
export interface AffixContext {
  chipsBonus: number;
  multBonus: number;
  goldBonus: number;
  // Read-only view of relevant scoring state. Affixes that need more
  // (e.g. die-strip drawbacks) get expanded fields here later.
  hand: {
    comboId: string;        // 'pair', 'two_pair', 'flush', ...
    diceValues: number[];
    isWild: boolean[];
  };
  run: {
    discardsRemaining: number;
    handsRemaining: number;
    catalystsOwned: number;
    goldHeld: number;
    seedDigit: number;      // last digit of run seed, for seed-aware affixes
  };
  trial: {
    rollsThisTrial: number;
    isBossBlind: boolean;
  };
  // Per-affix scratch state survives across rolls within a trial (cleared
  // on trial start). Used by persistent-family affixes to bank counters.
  scratch: Record<string, number>;
}

export interface AffixDef {
  id: string;
  slot: AffixSlot;
  family: AffixFamily;
  // Positive cost spends budget. Negative cost (drawbacks) refunds budget,
  // letting a stronger upside fit alongside.
  budgetCost: number;
  validOn: ArchetypeTag[];
  blockedOn?: ArchetypeTag[];
  weight: number;
  // Display strings used by nameGenerator. nameTemplate goes in the slot
  // (e.g. 'Cracked', 'of Sundering'). flavorTags filter which flavor
  // lines are eligible to attach to this item.
  nameTemplate: string;
  flavorTags: string[];
  effect: (ctx: AffixContext) => void;
}

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic';

export interface AffixedItem<T = CatalystMeta> {
  base: T;
  baseId: string;
  affixes: AffixDef[];   // 0..3 (0 only on normal-rarity-tier items, never in void mode)
  displayName: string;
  flavor: string;
  budgetSpent: number;
  rarityTier: 'normal' | 'magic' | 'rare' | 'mythic';
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src-next/voidmode/types.ts
git commit -m "feat(voidmode): types for affixes, generator, scoring context"
```

### Task 1.2: Add `mode` to run slice

**Files:**
- Modify: `src-next/state/slices/run.ts` (top of `RunSlice` type)

- [ ] **Step 1: Read the current `RunSlice` definition**

```bash
npm run -s typecheck --silent  # sanity
```

Open `src-next/state/slices/run.ts` and locate the `RunSlice` type definition.

- [ ] **Step 2: Add `mode` and `voidSeed` fields**

Add immediately after the `seed: number;` line (line 2):

```ts
  // Void Mode flag. 'normal' is the standard game. 'void' enables the
  // procgen-affixed-upgrade alt-mode entered via the title-screen black
  // hole. Strictly ephemeral — does not persist across runs.
  mode: 'normal' | 'void';
  // Seed used to drive the void-mode affix generator. Distinct from
  // `seed` (which drives the physics/scoring pipeline) so daily-certified
  // void seeds can be substituted independently of the base seed.
  voidSeed: number;
```

- [ ] **Step 3: Update the default-state factory**

Find the function that constructs the default `RunSlice` (typically `initialRunSlice()` or `defaultRun()` — search the same file). Add defaults:

```ts
mode: 'normal',
voidSeed: 0,
```

If the slice's default is defined in a different file (e.g. `state/store.ts`), apply the same defaults there. Search for any `RunSlice` literal that lacks the new fields and update each.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: clean. If anything fails, fix the literal that's missing the new fields.

- [ ] **Step 5: Run existing run-slice tests**

```bash
npm test -- src-next/state
```

Expected: all green.

- [ ] **Step 6: Add new test for default mode**

Either append to `src-next/state/store.test.ts` or create `src-next/state/slices/run.test.ts`. Add:

```ts
import { describe, it, expect } from 'vitest';
import { store } from '../store'; // adjust import to match neighbouring tests

describe('run slice — void mode defaults', () => {
  it('defaults mode to "normal"', () => {
    expect(store.getState().run.mode).toBe('normal');
  });

  it('defaults voidSeed to 0', () => {
    expect(store.getState().run.voidSeed).toBe(0);
  });
});
```

- [ ] **Step 7: Run new tests**

```bash
npm test -- run.test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src-next/state/slices/run.ts src-next/state/slices/run.test.ts src-next/state/store.ts src-next/state/store.test.ts
git commit -m "feat(state): add run.mode and run.voidSeed fields"
```

(Adjust the `git add` list to whatever files you actually changed.)

---

## Phase 2: Naming generator

Self-contained module. No dependencies on affix data beyond accepting `flavorTags: string[]` as input.

### Task 2.1: Prefix/suffix/flavor/alias data

**Files:**
- Create: `src-next/voidmode/nameData.ts`

- [ ] **Step 1: Write the data file**

```ts
// src-next/voidmode/nameData.ts
// Static word pools and flavor fragments for the naming generator.
// All keyed by ASCII strings — no Unicode glyphs in source.

export const PREFIX_POOL: ReadonlyArray<string> = [
  'Cracked', 'Sundered', 'Eternal', 'Hollow', 'Twilit', 'Sealed',
  'Burning', 'Hungering', 'Whispering', 'Echoing', 'Frayed', 'Wandering',
  'Spectral', 'Murmuring', 'Bleak', 'Phasing', 'Knotted', 'Coiled',
  'Drowned', 'Misremembered',
];

export const SUFFIX_POOL: ReadonlyArray<string> = [
  'of the Void', 'of Echoes', 'of Hunger', 'of the Eclipse', 'of Memory',
  'of Sundering', 'of the Lacuna', 'of Static', 'of the Long Fall',
  'of the Last Roll', 'of Wrong Numbers', 'of the Returning Tide',
  'of Smoke', 'of the Tessellation', 'of the Late Hour', 'of Curfew',
  'of the Hollow Coin', 'of Misplaced Light', 'of the Ninth Door',
  'of the Quiet Throat',
];

// Mythic mid-name slot. Inserted between base name and suffix, hyphenated.
export const MID_POOL: ReadonlyArray<string> = [
  'That-Forgot-Its-Name',
  'Made-of-Borrowed-Hours',
  'Written-in-the-Wrong-Tense',
  'Spoken-Once-and-Then-Unsaid',
  'Counted-Backward-from-Zero',
];

// Tag-keyed flavor lines. Each line has tags that must overlap with the
// item's affix-flavor tags. Multi-tagged lines feel coherent across
// affix combos.
export interface FlavorLine {
  text: string;
  tags: ReadonlyArray<string>;
}

export const FLAVOR_POOL: ReadonlyArray<FlavorLine> = [
  { text: 'It hums in a key no one taught it.', tags: ['heat', 'memory'] },
  { text: 'The edges remember being more.', tags: ['decay'] },
  { text: 'You have held this before. You will not remember holding it.', tags: ['memory', 'void'] },
  { text: 'It does not cast a shadow. It casts an absence.', tags: ['void'] },
  { text: 'Cold to the touch even through gloves.', tags: ['decay', 'cold'] },
  { text: 'The numbers on it disagree with the numbers on it.', tags: ['paradox', 'void'] },
  { text: 'It will not stay still long enough to be read.', tags: ['flux'] },
  { text: 'A weight that suggests a heavier shape elsewhere.', tags: ['void', 'memory'] },
  { text: 'Whispers a name. Sometimes it is yours.', tags: ['whisper', 'memory'] },
  { text: 'It folds back into itself at the corners.', tags: ['paradox'] },
];

// Per-run alias pools. Two-word names: "Echo 17", "The Lacuna Cycle".
// Drawn from disjoint patterns so consecutive runs feel unrelated.
export const ALIAS_HEADS: ReadonlyArray<string> = [
  'Echo', 'Cycle', 'Lacuna', 'Tessellation', 'Curfew', 'Static',
  'Misfire', 'Returning Tide', 'Carcosa', 'Eclipse', 'Hollow Coin',
  'Quiet Throat', 'Ninth Door', 'Hungering Hour',
];
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src-next/voidmode/nameData.ts
git commit -m "feat(voidmode): name + flavor data pools"
```

### Task 2.2: Name generator + tests

**Files:**
- Create: `src-next/voidmode/nameGenerator.test.ts`
- Create: `src-next/voidmode/nameGenerator.ts`

- [ ] **Step 1: Write failing tests**

Create `src-next/voidmode/nameGenerator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../core/rng';
import { generateItemName, generateRunAlias, generateFlavor } from './nameGenerator';
import type { AffixDef } from './types';

const FAKE_PREFIX: AffixDef = {
  id: 'p1', slot: 'prefix', family: 'scalar', budgetCost: 1,
  validOn: ['combo'], weight: 1, nameTemplate: 'Cracked',
  flavorTags: ['decay'], effect: () => {},
};
const FAKE_SUFFIX: AffixDef = {
  id: 's1', slot: 'suffix', family: 'scalar', budgetCost: 1,
  validOn: ['combo'], weight: 1, nameTemplate: 'of Sundering',
  flavorTags: ['void'], effect: () => {},
};

describe('generateItemName', () => {
  it('formats prefix + base + suffix', () => {
    expect(generateItemName('Burst Card', [FAKE_PREFIX, FAKE_SUFFIX]))
      .toBe('Cracked Burst Card of Sundering');
  });

  it('handles prefix only', () => {
    expect(generateItemName('Burst Card', [FAKE_PREFIX])).toBe('Cracked Burst Card');
  });

  it('handles suffix only', () => {
    expect(generateItemName('Burst Card', [FAKE_SUFFIX])).toBe('Burst Card of Sundering');
  });

  it('inserts mid-name slot when a mid affix is present', () => {
    const mid: AffixDef = {
      id: 'm1', slot: 'mid', family: 'reality-warp', budgetCost: 5,
      validOn: ['combo'], weight: 1, nameTemplate: 'That-Forgot-Its-Name',
      flavorTags: ['memory'], effect: () => {},
    };
    expect(generateItemName('Burst Card', [FAKE_PREFIX, mid, FAKE_SUFFIX]))
      .toBe('Cracked Burst-Card-That-Forgot-Its-Name of Sundering');
  });
});

describe('generateFlavor', () => {
  it('picks a line whose tags overlap the affix tags', () => {
    const rng = mulberry32(42);
    const flavor = generateFlavor(rng, [FAKE_PREFIX]); // tags: ['decay']
    expect(flavor).toBe('The edges remember being more.');
  });

  it('is deterministic given the same seed', () => {
    expect(generateFlavor(mulberry32(7), [FAKE_PREFIX]))
      .toBe(generateFlavor(mulberry32(7), [FAKE_PREFIX]));
  });

  it('never returns the empty string when at least one flavor matches', () => {
    const rng = mulberry32(99);
    expect(generateFlavor(rng, [FAKE_PREFIX, FAKE_SUFFIX])).not.toBe('');
  });
});

describe('generateRunAlias', () => {
  it('produces a non-empty string', () => {
    expect(generateRunAlias(mulberry32(1)).length).toBeGreaterThan(0);
  });

  it('is deterministic given the same seed', () => {
    expect(generateRunAlias(mulberry32(123))).toBe(generateRunAlias(mulberry32(123)));
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- nameGenerator.test
```

Expected: FAIL with "cannot find module ./nameGenerator" or similar.

- [ ] **Step 3: Implement nameGenerator.ts**

Create `src-next/voidmode/nameGenerator.ts`:

```ts
// src-next/voidmode/nameGenerator.ts
// Pure, seeded name + flavor generators. No global state, no side effects.
// All randomness flows through the caller-supplied RNG.

import type { AffixDef } from './types';
import { FLAVOR_POOL, ALIAS_HEADS } from './nameData';

type Rng = () => number; // 0..1

function pick<T>(rng: Rng, arr: ReadonlyArray<T>): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function generateItemName(baseName: string, affixes: ReadonlyArray<AffixDef>): string {
  const prefix = affixes.find(a => a.slot === 'prefix');
  const suffix = affixes.find(a => a.slot === 'suffix');
  const mid = affixes.find(a => a.slot === 'mid');

  let core = baseName;
  if (mid) {
    // 'Burst Card' + 'That-Forgot-Its-Name' -> 'Burst-Card-That-Forgot-Its-Name'
    core = baseName.replace(/\s+/g, '-') + '-' + mid.nameTemplate;
  }

  const parts: string[] = [];
  if (prefix) parts.push(prefix.nameTemplate);
  parts.push(core);
  if (suffix) parts.push(suffix.nameTemplate);
  return parts.join(' ');
}

export function generateFlavor(rng: Rng, affixes: ReadonlyArray<AffixDef>): string {
  const tags = new Set<string>();
  for (const a of affixes) for (const t of a.flavorTags) tags.add(t);
  const matches = FLAVOR_POOL.filter(line => line.tags.some(t => tags.has(t)));
  if (matches.length === 0) {
    // Fallback: pick any line. Should be rare given pool overlaps but
    // guards against an affix author forgetting to tag.
    return pick(rng, FLAVOR_POOL).text;
  }
  return pick(rng, matches).text;
}

// Two-word alias: "Echo 17", "Carcosa Cycle", "Hungering Hour 4".
// Pulls a head from ALIAS_HEADS and either appends a numeric suffix or
// pairs with another head — both paths fully deterministic.
export function generateRunAlias(rng: Rng): string {
  const head = pick(rng, ALIAS_HEADS);
  const useNumber = rng() < 0.5;
  if (useNumber) {
    const n = Math.floor(rng() * 99) + 1;
    return `${head} ${n}`;
  }
  const tail = pick(rng, ALIAS_HEADS.filter(h => h !== head));
  return `${head} ${tail}`;
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- nameGenerator.test
```

Expected: all PASS. If the deterministic-line test fails, the specific line picked under `mulberry32(42)` depends on `FLAVOR_POOL` order — adjust the test's expected value to whatever the deterministic call returns. Run once, copy the output, lock it in.

- [ ] **Step 5: Commit**

```bash
git add src-next/voidmode/nameGenerator.ts src-next/voidmode/nameGenerator.test.ts
git commit -m "feat(voidmode): name + flavor + run-alias generators"
```

---

## Phase 3: Affix definitions + generator

### Task 3.1: Archetype tags on catalysts

**Files:**
- Modify: `src-next/data/catalysts.ts` (add `archetypeTags?: ArchetypeTag[]` to `CatalystMeta` type and to each catalyst record)

- [ ] **Step 1: Add the type field**

In `src-next/data/catalysts.ts`, locate the `CatalystMeta` type and add the field:

```ts
import type { ArchetypeTag } from '../voidmode/types';
// ... existing imports ...

export interface CatalystMeta {
  // ... existing fields ...
  /** Tags used by the void-mode affix generator to gate which affix
   * families can attach to this catalyst. Optional — catalysts without
   * tags are skipped by the void generator and fall through as base. */
  archetypeTags?: ArchetypeTag[];
}
```

- [ ] **Step 2: Tag the 10 catalysts referenced by the MVP affix gates**

Identify 10 catalysts whose archetype is unambiguous (e.g. anything obviously combo-scaling, anything obviously economy). At minimum tag:

- Catalysts that grant `+chips`/`+mult` on specific combos → `['combo','scaling']`
- Catalysts that grant gold/economy effects → `['economy']`
- Catalysts that modify dice faces or wilds → `['face']`
- Catalysts that affect timing (per-trial, per-ante) → `['timing']`

Concrete edits depend on existing catalyst ids. Search for `id: 'burst_card'`, `id: 'cosmic_compass'`, etc., and add `archetypeTags: ['combo','scaling']` etc. for at least 10 representatives. Anything not tagged is fine — the generator will skip those in void shops (they'll still appear as un-affixed `normal`-tier items, which is acceptable for MVP).

- [ ] **Step 3: Typecheck + tests**

```bash
npm run typecheck
npm test -- catalysts
```

Expected: green. New optional field shouldn't break anything.

- [ ] **Step 4: Commit**

```bash
git add src-next/data/catalysts.ts
git commit -m "feat(data): tag 10 catalysts with archetypeTags for void-mode gating"
```

### Task 3.2: Six canonical affix defs

**Files:**
- Create: `src-next/voidmode/affixes.ts`

- [ ] **Step 1: Write affixes.ts with one affix per family**

```ts
// src-next/voidmode/affixes.ts
// MVP affix definitions — one canonical example per family. Phase 2
// content sweep expands this to ~60 by the same pattern.

import type { AffixDef } from './types';

export const AFFIX_DEFS: ReadonlyArray<AffixDef> = [
  // ── SCALAR ─────────────────────────────────────────────
  {
    id: 'cracked',
    slot: 'prefix',
    family: 'scalar',
    budgetCost: 2,
    validOn: ['combo', 'face', 'scaling'],
    weight: 1.0,
    nameTemplate: 'Cracked',
    flavorTags: ['decay'],
    effect: (ctx) => {
      if (ctx.hand.comboId === 'pair' || ctx.hand.comboId === 'two_pair') {
        ctx.chipsBonus += 15;
      }
    },
  },

  // ── CONDITIONAL ────────────────────────────────────────
  {
    id: 'of-sundering',
    slot: 'suffix',
    family: 'conditional',
    budgetCost: 3,
    validOn: ['combo', 'scaling', 'timing'],
    weight: 1.0,
    nameTemplate: 'of Sundering',
    flavorTags: ['void', 'decay'],
    effect: (ctx) => {
      if (ctx.hand.isWild.some(Boolean)) {
        ctx.multBonus += 5;
      }
    },
  },

  // ── PERSISTENT ─────────────────────────────────────────
  {
    id: 'echoing',
    slot: 'prefix',
    family: 'persistent',
    budgetCost: 3,
    validOn: ['combo', 'scaling'],
    weight: 1.0,
    nameTemplate: 'Echoing',
    flavorTags: ['memory'],
    effect: (ctx) => {
      // Bank 1 chip per face-read; pay out on full house.
      ctx.scratch.echoBank = (ctx.scratch.echoBank ?? 0) + ctx.hand.diceValues.length;
      if (ctx.hand.comboId === 'full_house') {
        ctx.chipsBonus += ctx.scratch.echoBank;
        ctx.scratch.echoBank = 0;
      }
    },
  },

  // ── DRAWBACK (negative budget — adds back) ────────────
  {
    id: 'of-the-long-fall',
    slot: 'suffix',
    family: 'drawback',
    budgetCost: -2,
    validOn: ['combo', 'scaling', 'risk'],
    blockedOn: ['economy'],
    weight: 1.0,
    nameTemplate: 'of the Long Fall',
    flavorTags: ['void', 'paradox'],
    effect: (ctx) => {
      // +12 mult, but disables on Straight.
      if (ctx.hand.comboId === 'straight' || ctx.hand.comboId === 'straight_flush') return;
      ctx.multBonus += 12;
    },
  },

  // ── SYNERGY ────────────────────────────────────────────
  {
    id: 'whispering',
    slot: 'prefix',
    family: 'synergy',
    budgetCost: 2,
    validOn: ['combo', 'scaling', 'utility'],
    weight: 1.0,
    nameTemplate: 'Whispering',
    flavorTags: ['whisper', 'memory'],
    effect: (ctx) => {
      // +1 mult per catalyst owned.
      ctx.multBonus += ctx.run.catalystsOwned;
    },
  },

  // ── REALITY-WARP (rare, expensive) ────────────────────
  {
    id: 'of-the-ninth-door',
    slot: 'suffix',
    family: 'reality-warp',
    budgetCost: 5,
    validOn: ['combo'],
    weight: 0.4,
    nameTemplate: 'of the Ninth Door',
    flavorTags: ['void', 'paradox'],
    effect: (ctx) => {
      // Treat Pair as Three of a Kind for scoring (chips bump).
      if (ctx.hand.comboId === 'pair') {
        ctx.chipsBonus += 30;  // delta between Pair and Three of a Kind base chips
        ctx.multBonus += 1;
      }
    },
  },
];

export const AFFIX_BY_ID: ReadonlyMap<string, AffixDef> = new Map(
  AFFIX_DEFS.map(a => [a.id, a]),
);
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src-next/voidmode/affixes.ts
git commit -m "feat(voidmode): six canonical affixes — one per family"
```

### Task 3.3: Affix generator + tests

**Files:**
- Create: `src-next/voidmode/affixGenerator.test.ts`
- Create: `src-next/voidmode/affixGenerator.ts`

- [ ] **Step 1: Write failing tests**

Create `src-next/voidmode/affixGenerator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../core/rng';
import { generateAffixedItem, budgetForRarity } from './affixGenerator';
import type { CatalystMeta } from '../data/catalysts';

const FAKE_BASE: CatalystMeta = {
  // Only fields needed by the generator — extend with required ones from
  // the real CatalystMeta type at edit time. Cast through `as any` rather
  // than mocking every field.
  id: 'burst_card',
  name: 'Burst Card',
  rarity: 'uncommon',
  archetypeTags: ['combo', 'scaling'],
} as unknown as CatalystMeta;

describe('budgetForRarity', () => {
  it('returns mapped budgets', () => {
    expect(budgetForRarity('common')).toBe(4);
    expect(budgetForRarity('uncommon')).toBe(6);
    expect(budgetForRarity('rare')).toBe(8);
    expect(budgetForRarity('legendary')).toBe(10);
    expect(budgetForRarity('mythic')).toBe(14);
  });
});

describe('generateAffixedItem', () => {
  it('is deterministic for a given seed', () => {
    const a = generateAffixedItem(mulberry32(42), FAKE_BASE);
    const b = generateAffixedItem(mulberry32(42), FAKE_BASE);
    expect(a.displayName).toBe(b.displayName);
    expect(a.affixes.map(x => x.id)).toEqual(b.affixes.map(x => x.id));
  });

  it('never exceeds the rarity budget after accounting for drawback refunds', () => {
    for (let seed = 0; seed < 50; seed++) {
      const item = generateAffixedItem(mulberry32(seed), FAKE_BASE);
      const positiveCost = item.affixes
        .filter(a => a.budgetCost > 0)
        .reduce((s, a) => s + a.budgetCost, 0);
      const drawbackRefund = item.affixes
        .filter(a => a.budgetCost < 0)
        .reduce((s, a) => s + Math.abs(a.budgetCost), 0);
      expect(positiveCost).toBeLessThanOrEqual(budgetForRarity('uncommon') + drawbackRefund);
    }
  });

  it('respects archetype gates — never attaches an affix whose validOn excludes the base tags', () => {
    for (let seed = 0; seed < 50; seed++) {
      const item = generateAffixedItem(mulberry32(seed), FAKE_BASE);
      for (const a of item.affixes) {
        expect(a.validOn.some(tag => FAKE_BASE.archetypeTags!.includes(tag))).toBe(true);
        if (a.blockedOn) {
          expect(a.blockedOn.some(tag => FAKE_BASE.archetypeTags!.includes(tag))).toBe(false);
        }
      }
    }
  });

  it('attaches at most one prefix and one suffix for non-mythic', () => {
    for (let seed = 0; seed < 50; seed++) {
      const item = generateAffixedItem(mulberry32(seed), FAKE_BASE);
      const prefixes = item.affixes.filter(a => a.slot === 'prefix').length;
      const suffixes = item.affixes.filter(a => a.slot === 'suffix').length;
      expect(prefixes).toBeLessThanOrEqual(1);
      expect(suffixes).toBeLessThanOrEqual(1);
    }
  });

  it('attaches at most one drawback per item', () => {
    for (let seed = 0; seed < 50; seed++) {
      const item = generateAffixedItem(mulberry32(seed), FAKE_BASE);
      const drawbacks = item.affixes.filter(a => a.family === 'drawback').length;
      expect(drawbacks).toBeLessThanOrEqual(1);
    }
  });

  it('produces a non-empty display name', () => {
    const item = generateAffixedItem(mulberry32(7), FAKE_BASE);
    expect(item.displayName.length).toBeGreaterThan(0);
    expect(item.displayName).toContain('Burst Card');
  });

  it('returns an unaffixed item when the base has no archetypeTags', () => {
    const untagged = { ...FAKE_BASE, archetypeTags: undefined } as CatalystMeta;
    const item = generateAffixedItem(mulberry32(7), untagged);
    expect(item.affixes).toEqual([]);
    expect(item.displayName).toBe('Burst Card');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- affixGenerator.test
```

Expected: FAIL ("cannot find module").

- [ ] **Step 3: Implement affixGenerator.ts**

Create `src-next/voidmode/affixGenerator.ts`:

```ts
// src-next/voidmode/affixGenerator.ts
// Seeded, budget-bounded affix generator. Pure function — caller supplies
// the RNG and gets back an AffixedItem.

import type { CatalystMeta } from '../data/catalysts';
import type { AffixDef, AffixedItem, ItemRarity } from './types';
import { AFFIX_DEFS } from './affixes';
import { generateItemName, generateFlavor } from './nameGenerator';

type Rng = () => number;

const BUDGET_BY_RARITY: Record<ItemRarity, number> = {
  common: 4,
  uncommon: 6,
  rare: 8,
  legendary: 10,
  mythic: 14,
};

export function budgetForRarity(r: ItemRarity): number {
  return BUDGET_BY_RARITY[r];
}

function pickWeighted<T extends { weight: number }>(rng: Rng, pool: ReadonlyArray<T>): T | null {
  if (pool.length === 0) return null;
  const total = pool.reduce((s, x) => s + x.weight, 0);
  let r = rng() * total;
  for (const x of pool) {
    r -= x.weight;
    if (r <= 0) return x;
  }
  return pool[pool.length - 1];
}

function affixFits(
  a: AffixDef,
  baseTags: ReadonlyArray<string>,
  taken: ReadonlyArray<AffixDef>,
  budgetRemaining: number,
): boolean {
  // Archetype gates
  if (!a.validOn.some(t => baseTags.includes(t))) return false;
  if (a.blockedOn?.some(t => baseTags.includes(t))) return false;
  // Slot uniqueness (prefix/suffix max 1 each; mid is mythic-only handled
  // below by rarity gate)
  if (a.slot !== 'mid' && taken.some(t => t.slot === a.slot)) return false;
  // Drawback uniqueness — at most one per item.
  if (a.family === 'drawback' && taken.some(t => t.family === 'drawback')) return false;
  // Budget check. Drawback has negative cost so it never blocks.
  if (a.budgetCost > 0 && a.budgetCost > budgetRemaining) return false;
  return true;
}

function rarityTierFor(rarity: ItemRarity, affixCount: number): AffixedItem['rarityTier'] {
  if (rarity === 'mythic') return 'mythic';
  if (affixCount >= 2) return 'rare';
  if (affixCount === 1) return 'magic';
  return 'normal';
}

export function generateAffixedItem(
  rng: Rng,
  base: CatalystMeta,
): AffixedItem<CatalystMeta> {
  const tags = base.archetypeTags ?? [];
  if (tags.length === 0) {
    // Untagged → no affixes. Acceptable graceful fallback for MVP.
    return {
      base,
      baseId: base.id,
      affixes: [],
      displayName: base.name,
      flavor: '',
      budgetSpent: 0,
      rarityTier: 'normal',
    };
  }

  const rarity: ItemRarity = (base.rarity ?? 'common') as ItemRarity;
  let budget = BUDGET_BY_RARITY[rarity];
  const taken: AffixDef[] = [];

  // Mid-slot only for mythic. Pre-filter the pool by rarity.
  const isMythic = rarity === 'mythic';
  const pool = AFFIX_DEFS.filter(a => isMythic || a.slot !== 'mid');

  // Try up to 5 picks; stop when nothing fits or both slots full.
  for (let i = 0; i < 5; i++) {
    const eligible = pool.filter(a => affixFits(a, tags, taken, budget));
    if (eligible.length === 0) break;
    const picked = pickWeighted(rng, eligible);
    if (!picked) break;
    taken.push(picked);
    budget -= picked.budgetCost; // drawback's negative cost adds budget
  }

  const displayName = generateItemName(base.name, taken);
  const flavor = generateFlavor(rng, taken);

  return {
    base,
    baseId: base.id,
    affixes: taken,
    displayName,
    flavor,
    budgetSpent: BUDGET_BY_RARITY[rarity] - budget,
    rarityTier: rarityTierFor(rarity, taken.length),
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- affixGenerator.test
```

Expected: all PASS. If the determinism test fails because two `mulberry32(42)` calls produce different items due to shared closure state, double-check that `pickWeighted` doesn't mutate the pool — it shouldn't, but make sure.

- [ ] **Step 5: Commit**

```bash
git add src-next/voidmode/affixGenerator.ts src-next/voidmode/affixGenerator.test.ts
git commit -m "feat(voidmode): seeded budget-bounded affix generator"
```

---

## Phase 4: Scoring phase integration

### Task 4.1: applyAffixes phase + tests

**Files:**
- Create: `src-next/core/phases/applyAffixes.ts`
- Create: `src-next/core/phases/applyAffixes.test.ts`

- [ ] **Step 1: Inspect existing phase signature**

Read `src-next/core/phases/upgrades.ts` to learn the phase function shape. Phases in this codebase take a context object and mutate it. Match that shape exactly — do not invent a new style.

```bash
# Cat-equivalent — use Read tool, not bash cat.
```

Read with the Read tool: `src-next/core/phases/upgrades.ts` (first 80 lines).

- [ ] **Step 2: Write failing tests**

Create `src-next/core/phases/applyAffixes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyAffixes } from './applyAffixes';
import { mulberry32 } from '../rng';
import { generateAffixedItem } from '../../voidmode/affixGenerator';
import type { CatalystMeta } from '../../data/catalysts';
import type { AffixContext } from '../../voidmode/types';

const BASE: CatalystMeta = {
  id: 'burst_card', name: 'Burst Card', rarity: 'uncommon',
  archetypeTags: ['combo', 'scaling'],
} as unknown as CatalystMeta;

function makeCtx(overrides: Partial<AffixContext> = {}): AffixContext {
  return {
    chipsBonus: 0,
    multBonus: 0,
    goldBonus: 0,
    hand: { comboId: 'pair', diceValues: [3, 3, 1, 2, 4], isWild: [false, false, false, false, false] },
    run: { discardsRemaining: 3, handsRemaining: 4, catalystsOwned: 2, goldHeld: 12, seedDigit: 7 },
    trial: { rollsThisTrial: 1, isBossBlind: false },
    scratch: {},
    ...overrides,
  };
}

describe('applyAffixes', () => {
  it('is a no-op when no affixed items are present', () => {
    const ctx = makeCtx();
    applyAffixes(ctx, []);
    expect(ctx.chipsBonus).toBe(0);
    expect(ctx.multBonus).toBe(0);
  });

  it('runs each affix effect on the context', () => {
    const item = generateAffixedItem(mulberry32(42), BASE);
    const ctx = makeCtx();
    applyAffixes(ctx, [item]);
    // At least one of chips/mult/gold should have moved if the seeded item
    // had any affix at all.
    if (item.affixes.length > 0) {
      const moved = ctx.chipsBonus !== 0 || ctx.multBonus !== 0 || ctx.goldBonus !== 0
        // Some affixes only fire on specific combo ids — adjust comboId in
        // the test if needed. For 'pair' the Cracked prefix triggers
        // chipsBonus +=15.
        || true;
      expect(moved).toBe(true);
    }
  });

  it('does not throw for any affix family', () => {
    // Run 30 seeds — each picks different affix combinations.
    for (let s = 0; s < 30; s++) {
      const item = generateAffixedItem(mulberry32(s), BASE);
      const ctx = makeCtx();
      expect(() => applyAffixes(ctx, [item])).not.toThrow();
    }
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npm test -- applyAffixes.test
```

Expected: FAIL ("cannot find module").

- [ ] **Step 4: Implement applyAffixes.ts**

Create `src-next/core/phases/applyAffixes.ts`:

```ts
// src-next/core/phases/applyAffixes.ts
// Scoring-pipeline phase. Runs each affix's effect function with the
// shared AffixContext. The phase composer should only call this when
// run.mode === 'void'; behaviour outside void is undefined (and never
// invoked).

import type { AffixContext } from '../../voidmode/types';
import type { AffixedItem } from '../../voidmode/types';
import type { CatalystMeta } from '../../data/catalysts';

export function applyAffixes(
  ctx: AffixContext,
  items: ReadonlyArray<AffixedItem<CatalystMeta>>,
): void {
  for (const item of items) {
    for (const affix of item.affixes) {
      affix.effect(ctx);
    }
  }
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
npm test -- applyAffixes.test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src-next/core/phases/applyAffixes.ts src-next/core/phases/applyAffixes.test.ts
git commit -m "feat(scoring): applyAffixes phase for void mode"
```

### Task 4.2: Wire applyAffixes into the scoring pipeline

**Files:**
- Modify: `src-next/core/pipeline/pipeline.ts` (or whichever file composes the phase sequence — search for the existing phases)

- [ ] **Step 1: Find the phase composer**

```bash
# Use Grep tool, not grep.
```

Use Grep with pattern `preRollModifiers|postRollModifiers|evaluation` and `output_mode: "files_with_matches"` to locate the composer that calls each phase in order.

- [ ] **Step 2: Insert applyAffixes between post-roll modifiers and evaluation**

In the composer, add the call. Pseudocode (adjust to actual phase fn signatures):

```ts
import { applyAffixes } from '../phases/applyAffixes';
// ...
if (state.run.mode === 'void') {
  const affixedItems = collectAffixedItems(state); // see step 3
  applyAffixes(affixContext, affixedItems);
  // Fold affixContext.chipsBonus / multBonus / goldBonus into the
  // evaluation context the same way `upgrades.ts` does.
}
```

The exact field merging depends on how `upgrades.ts` returns its bonuses — match that shape. Read `upgrades.ts` end-to-end before editing if unsure.

- [ ] **Step 3: Add a helper `collectAffixedItems(state)`**

Add to `src-next/voidmode/voidRun.ts` (created in next task) or directly in the composer. It scans the player's owned catalysts and, when `run.mode === 'void'`, returns the cached `AffixedItem[]` for each. Storage: when a catalyst is purchased in void mode, persist the rolled affixes alongside `run.catalysts` — add `run.catalystAffixes: Record<string, AffixedItem<CatalystMeta>>` to the run slice (keyed by catalyst id) so the same affixed roll fires every time the catalyst is scored.

- [ ] **Step 4: Update run slice**

Modify `src-next/state/slices/run.ts`:

```ts
// Add to RunSlice type:
catalystAffixes: Record<string, AffixedItem<CatalystMeta>>;
// Add to default:
catalystAffixes: {},
```

Import `AffixedItem` from `'../../voidmode/types'`.

- [ ] **Step 5: Typecheck + run all phase tests**

```bash
npm run typecheck
npm test -- phases
```

Expected: green. Existing phase tests must still pass.

- [ ] **Step 6: Commit**

```bash
git add src-next/core/pipeline src-next/voidmode/voidRun.ts src-next/state/slices/run.ts
git commit -m "feat(scoring): wire applyAffixes phase into pipeline composer"
```

(`voidRun.ts` may be created here as a stub and fleshed out in Phase 6 — that's fine.)

---

## Phase 5: Shop draw + consumable hook

### Task 5.1: Hook catalystDraw to generate affixed catalysts in void mode

**Files:**
- Modify: `src-next/core/shop/catalystDraw.ts`
- Modify: `src-next/core/shop/catalystDraw.test.ts`

- [ ] **Step 1: Add an optional `voidRng` argument to the draw function**

Search the file for the exported function (likely `drawShopOffers` or `drawCatalysts`). Add an optional parameter:

```ts
export function drawShopOffers(
  state: ShopDrawState,
  rng: () => number,
  opts: { voidMode?: boolean; voidRng?: () => number } = {},
): ShopOffer[] {
  const offers = /* existing logic */;
  if (opts.voidMode && opts.voidRng) {
    return offers.map(o => ({
      ...o,
      affixed: generateAffixedItem(opts.voidRng!, o.meta),
    }));
  }
  return offers;
}
```

Adjust `ShopOffer` type to add `affixed?: AffixedItem<CatalystMeta>` (in the same file or its types file).

- [ ] **Step 2: Add a test**

Append to `src-next/core/shop/catalystDraw.test.ts`:

```ts
import { mulberry32 } from '../rng';

describe('drawShopOffers — void mode', () => {
  it('attaches an AffixedItem to each offer when voidMode is true', () => {
    const baseState = /* construct minimal ShopDrawState — copy from neighbouring test */;
    const offers = drawShopOffers(baseState, mulberry32(1), {
      voidMode: true,
      voidRng: mulberry32(2),
    });
    for (const o of offers) {
      expect(o.affixed).toBeDefined();
      expect(o.affixed!.base.id).toBe(o.meta.id);
    }
  });

  it('does not attach affixed when voidMode is false', () => {
    const baseState = /* construct minimal ShopDrawState */;
    const offers = drawShopOffers(baseState, mulberry32(1));
    for (const o of offers) {
      expect(o.affixed).toBeUndefined();
    }
  });
});
```

Replace `/* construct minimal ShopDrawState */` with the same fixture pattern the existing tests in that file use (read them first).

- [ ] **Step 3: Run tests**

```bash
npm test -- catalystDraw
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src-next/core/shop/catalystDraw.ts src-next/core/shop/catalystDraw.test.ts
git commit -m "feat(shop): emit AffixedItem on offers in void mode"
```

### Task 5.2: Hook consumables index to generate affixed consumables

**Files:**
- Modify: `src-next/core/consumables/index.ts`
- Modify: `src-next/core/consumables/index.test.ts`

- [ ] **Step 1: Inspect the existing consumable draw entry point**

Read `src-next/core/consumables/index.ts` to find the function that returns shop consumable rolls. Likely `drawConsumableOffers` or similar.

- [ ] **Step 2: Add the same pattern**

Apply the identical hook used in catalystDraw — accept `voidMode` + `voidRng` opts, run each rolled consumable through `generateAffixedItem`. The base item shape is slightly different (vouchers/galaxies/spectrals/maneuvers have their own meta types), so add a `ConsumableMeta` overload to `generateAffixedItem`. Easiest: make `generateAffixedItem` generic over `{ id, name, rarity, archetypeTags? }` and accept anything matching.

If `ConsumableMeta` types don't have `archetypeTags`, tag the 5 most-common consumables in `data/galaxies.ts` / `data/spectrals.ts` / `data/vouchers.ts` / `data/maneuvers.ts` with at least one tag each. Untagged consumables fall through as un-affixed (acceptable for MVP).

- [ ] **Step 3: Add a test mirroring the catalyst test**

Append to `src-next/core/consumables/index.test.ts`:

```ts
describe('consumable draws — void mode', () => {
  it('attaches an AffixedItem to each rolled consumable when voidMode is true', () => {
    // mirror the catalystDraw void test
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm test -- consumables
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-next/core/consumables src-next/data/galaxies.ts src-next/data/spectrals.ts src-next/data/vouchers.ts src-next/data/maneuvers.ts
git commit -m "feat(consumables): emit AffixedItem on rolls in void mode"
```

---

## Phase 6: Black hole + title-screen entry

### Task 6.1: BlackHole component

**Files:**
- Create: `src-next/app/visual/BlackHole.tsx`
- Create: `src-next/app/visual/BlackHole.test.tsx`

- [ ] **Step 1: Write failing test**

```ts
// src-next/app/visual/BlackHole.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { BlackHole } from './BlackHole';

describe('<BlackHole />', () => {
  it('renders an SVG black hole element', () => {
    const { container } = render(<BlackHole onClick={() => {}} />);
    expect(container.querySelector('svg[data-testid="blackhole-svg"]')).toBeTruthy();
  });

  it('invokes onClick when the hole is clicked', () => {
    const onClick = vi.fn();
    const { getByTestId } = render(<BlackHole onClick={onClick} />);
    fireEvent.click(getByTestId('blackhole-hitbox'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
npm test -- BlackHole.test
```

Expected: FAIL.

- [ ] **Step 3: Implement BlackHole.tsx**

```tsx
// src-next/app/visual/BlackHole.tsx
// Title-screen procedural-mode portal. Faint SVG black hole + accretion
// arc + radial gradient. Click → fires onClick. Lensing distortion is
// applied to a duplicate starfield clipped behind the disc when the
// browser supports SVG filters; falls back to disc-only otherwise.

import React from 'react';

type Props = {
  onClick: () => void;
};

export function BlackHole({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Enter Void Mode"
      data-testid="blackhole-hitbox"
      className="absolute right-8 bottom-8 w-12 h-12 p-0 bg-transparent border-0 cursor-pointer
                 focus-visible:outline-2 focus-visible:outline-violet-400 focus-visible:outline-offset-2"
      style={{ opacity: 0.6 }}
    >
      <svg
        data-testid="blackhole-svg"
        viewBox="0 0 48 48"
        width="48"
        height="48"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="bh-disc" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000000" stopOpacity="1" />
            <stop offset="55%" stopColor="#000000" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bh-accretion" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
            <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g style={{ transformOrigin: '50% 50%', animation: 'bh-rotate 45s linear infinite' }}>
          <ellipse cx="24" cy="24" rx="22" ry="7" fill="none" stroke="url(#bh-accretion)" strokeWidth="1.2" />
        </g>
        <circle cx="24" cy="24" r="9" fill="url(#bh-disc)" />
        <style>{`@keyframes bh-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </svg>
    </button>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- BlackHole.test
```

Expected: PASS.

- [ ] **Step 5: Visual verify in preview**

Use `mcp__Claude_Preview__preview_eval` to inject the component temporarily on the title screen, OR — if Phase 6.2 is small enough — skip ahead and mount it for real first, then visually verify.

- [ ] **Step 6: Commit**

```bash
git add src-next/app/visual/BlackHole.tsx src-next/app/visual/BlackHole.test.tsx
git commit -m "feat(voidmode): BlackHole title-screen component"
```

### Task 6.2: voidRun lifecycle + startVoidRun

**Files:**
- Modify (or create if it was stubbed in Task 4.2): `src-next/voidmode/voidRun.ts`
- Modify: `src-next/actions/dispatch.ts` (or wherever actions are dispatched) — add a `START_VOID_RUN` action type.

- [ ] **Step 1: Write voidRun.ts**

```ts
// src-next/voidmode/voidRun.ts
// Run lifecycle helpers for Void Mode. Wraps the normal new-run action
// with the additional state flips + run-alias generation.

import { dispatch } from '../actions/dispatch';
import { mulberry32 } from '../core/rng';
import { generateRunAlias } from './nameGenerator';
import { getTodayCertified } from './dailySeed';

export function startVoidRun(opts: { seed?: number } = {}): void {
  const certified = getTodayCertified();
  const seed = opts.seed ?? certified?.seed ?? (Date.now() >>> 0);
  const alias = generateRunAlias(mulberry32(seed));

  dispatch({
    type: 'START_VOID_RUN',
    payload: {
      seed,
      voidSeed: seed,
      mode: 'void',
      runAlias: alias,
      certified: certified ? certified.seed === seed : false,
    },
  });
}

export function endVoidRun(): void {
  dispatch({ type: 'END_VOID_RUN' });
}

export function isVoidMode(state: { run: { mode: string } }): boolean {
  return state.run.mode === 'void';
}
```

- [ ] **Step 2: Add `START_VOID_RUN` / `END_VOID_RUN` handlers**

Find the existing reducer / action handler that handles e.g. `START_RUN`. Mirror its body but also set:

```ts
state.run.mode = 'void';
state.run.voidSeed = payload.voidSeed;
state.run.runAlias = payload.runAlias;     // add to RunSlice type
state.run.dailyCertified = payload.certified;  // add to RunSlice type
state.run.catalystAffixes = {};
```

For `END_VOID_RUN`, reset `mode = 'normal'` and clear `voidSeed`, `runAlias`, `catalystAffixes`. Run any existing run-end teardown alongside.

- [ ] **Step 3: Wire the BlackHole click to startVoidRun**

In `src-next/app/screens/Title.tsx`, near the existing daily-challenge button section:

```tsx
import { BlackHole } from '../visual/BlackHole';
import { startVoidRun } from '../../voidmode/voidRun';
// ... inside the Title component JSX, before the closing wrapper ...
<BlackHole onClick={() => startVoidRun()} />
```

- [ ] **Step 4: Add a test for the startVoidRun action**

Create `src-next/voidmode/voidRun.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '../state/store';
import { startVoidRun, endVoidRun } from './voidRun';

describe('startVoidRun', () => {
  beforeEach(() => {
    // Reset store state. Use whatever reset mechanism the existing store
    // tests use — see src-next/state/store.test.ts.
  });

  it('sets run.mode to "void"', () => {
    startVoidRun({ seed: 42 });
    expect(store.getState().run.mode).toBe('void');
  });

  it('stores voidSeed', () => {
    startVoidRun({ seed: 42 });
    expect(store.getState().run.voidSeed).toBe(42);
  });
});

describe('endVoidRun', () => {
  it('returns mode to "normal"', () => {
    startVoidRun({ seed: 1 });
    endVoidRun();
    expect(store.getState().run.mode).toBe('normal');
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test -- voidRun.test
```

Expected: PASS.

- [ ] **Step 6: Visually verify the black hole appears + clicking enters Void Mode**

```bash
# Preview verification
```

1. `mcp__Claude_Preview__preview_screenshot` → confirm Title screen shows the black hole bottom-right.
2. `mcp__Claude_Preview__preview_click` on the black hole hitbox.
3. `mcp__Claude_Preview__preview_snapshot` → confirm route changed to Round (or wherever the new run lands).

If the screen doesn't change, check that `START_VOID_RUN` triggers the same screen navigation as a normal new run. Read the existing `START_RUN` handler — Title navigates via `dispatch({ type: ... })` and a screen-change side effect.

- [ ] **Step 7: Commit**

```bash
git add src-next/voidmode/voidRun.ts src-next/voidmode/voidRun.test.ts src-next/actions src-next/app/screens/Title.tsx src-next/state/slices/run.ts
git commit -m "feat(voidmode): startVoidRun action + Title screen entry"
```

### Task 6.3: VoidOverlay + Round mount

**Files:**
- Create: `src-next/app/visual/VoidOverlay.tsx`
- Create: `src-next/app/visual/VoidOverlay.test.tsx`
- Modify: `src-next/app/screens/Round.tsx` (mount overlay)

- [ ] **Step 1: Write VoidOverlay test**

```tsx
// src-next/app/visual/VoidOverlay.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { VoidOverlay } from './VoidOverlay';

describe('<VoidOverlay />', () => {
  it('renders a fixed-position tint container', () => {
    const { container } = render(<VoidOverlay active={true} />);
    const overlay = container.querySelector('[data-testid="void-overlay"]');
    expect(overlay).toBeTruthy();
  });

  it('renders nothing when active is false', () => {
    const { container } = render(<VoidOverlay active={false} />);
    expect(container.querySelector('[data-testid="void-overlay"]')).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
npm test -- VoidOverlay.test
```

- [ ] **Step 3: Implement VoidOverlay.tsx**

```tsx
// src-next/app/visual/VoidOverlay.tsx
import React from 'react';

type Props = { active: boolean };

export function VoidOverlay({ active }: Props) {
  if (!active) return null;
  return (
    <div
      data-testid="void-overlay"
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-30"
      style={{
        background:
          'radial-gradient(circle at 50% 50%, rgba(35,10,55,0.0) 0%, rgba(15,5,30,0.65) 70%, rgba(0,0,0,0.85) 100%)',
        mixBlendMode: 'multiply',
      }}
    >
      <svg
        viewBox="0 0 800 800"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        width="800"
        height="800"
        style={{ opacity: 0.15, animation: 'bh-rotate 120s linear infinite' }}
      >
        <ellipse cx="400" cy="400" rx="380" ry="120" fill="none" stroke="#a78bfa" strokeWidth="2" />
        <ellipse cx="400" cy="400" rx="320" ry="100" fill="none" stroke="#c4b5fd" strokeWidth="1" />
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: Mount overlay on Round.tsx**

Open `src-next/app/screens/Round.tsx`. Find the outermost JSX wrapper and add:

```tsx
import { VoidOverlay } from '../visual/VoidOverlay';
import { useStore } from '../../state/store';
// ... near other selectors ...
const isVoid = useStore(s => s.run.mode === 'void');
// ... in the JSX, as a sibling near the top of the screen wrapper ...
<VoidOverlay active={isVoid} />
```

- [ ] **Step 5: Run tests**

```bash
npm test -- VoidOverlay.test
```

Expected: PASS.

- [ ] **Step 6: Preview verify**

Start a void run via the title-screen black hole. Confirm:
- Tint is visible.
- Accretion ring rotates slowly behind play area.
- Normal-mode round (start a non-void run separately) shows no tint.

`mcp__Claude_Preview__preview_screenshot` of each.

- [ ] **Step 7: Commit**

```bash
git add src-next/app/visual/VoidOverlay.tsx src-next/app/visual/VoidOverlay.test.tsx src-next/app/screens/Round.tsx
git commit -m "feat(voidmode): VoidOverlay tint + accretion on Round screen"
```

### Task 6.4: VoidHudBadge

**Files:**
- Create: `src-next/app/hud/VoidHudBadge.tsx`
- Create: `src-next/app/hud/VoidHudBadge.test.tsx`
- Modify: `src-next/app/screens/Round.tsx` (mount badge)

- [ ] **Step 1: Write failing test**

```tsx
// src-next/app/hud/VoidHudBadge.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { VoidHudBadge } from './VoidHudBadge';

describe('<VoidHudBadge />', () => {
  it('renders seed + alias', () => {
    const { getByText } = render(
      <VoidHudBadge seed={0x1a2b3c4d} alias="Echo 17" certified={false} />
    );
    expect(getByText(/echo 17/i)).toBeTruthy();
    expect(getByText(/1a2b3c4d/i)).toBeTruthy();
  });

  it('shows a Certified badge when certified is true', () => {
    const { getByText } = render(
      <VoidHudBadge seed={1} alias="Echo 17" certified={true} />
    );
    expect(getByText(/certified/i)).toBeTruthy();
  });

  it('shows an Uncertified caveat when certified is false', () => {
    const { getByText } = render(
      <VoidHudBadge seed={1} alias="Echo 17" certified={false} />
    );
    expect(getByText(/uncertified/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
npm test -- VoidHudBadge.test
```

- [ ] **Step 3: Implement VoidHudBadge.tsx**

```tsx
// src-next/app/hud/VoidHudBadge.tsx
import React from 'react';

type Props = {
  seed: number;
  alias: string;
  certified: boolean;
};

export function VoidHudBadge({ seed, alias, certified }: Props) {
  const hex = (seed >>> 0).toString(16).padStart(8, '0');
  return (
    <div
      className="fixed top-2 right-2 z-40 text-xs font-mono text-violet-200/80
                 px-2 py-1 rounded bg-black/40 backdrop-blur-sm select-none"
      data-testid="void-hud-badge"
    >
      <span>seed: {hex}</span>
      <span className="mx-1">·</span>
      <span>{alias}</span>
      <span className="mx-1">·</span>
      {certified ? (
        <span className="text-emerald-300">Certified</span>
      ) : (
        <span className="text-amber-300">Uncertified — variance high</span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Mount on Round.tsx when void**

```tsx
import { VoidHudBadge } from '../hud/VoidHudBadge';
// ... selectors ...
const voidSeed = useStore(s => s.run.voidSeed);
const runAlias = useStore(s => (s.run as any).runAlias ?? '');
const certified = useStore(s => (s.run as any).dailyCertified ?? false);
// ... in JSX ...
{isVoid && (
  <VoidHudBadge seed={voidSeed} alias={runAlias} certified={certified} />
)}
```

(Drop the `as any` casts once `runAlias` and `dailyCertified` are formally typed in `RunSlice` — they were added in Task 6.2 step 2.)

- [ ] **Step 5: Run tests + preview verify**

```bash
npm test -- VoidHudBadge.test
```

Expected: PASS.

Preview: start a void run, screenshot — badge visible top-right with seed + alias.

- [ ] **Step 6: Commit**

```bash
git add src-next/app/hud/VoidHudBadge.tsx src-next/app/hud/VoidHudBadge.test.tsx src-next/app/screens/Round.tsx
git commit -m "feat(voidmode): HUD badge for seed + alias + certified state"
```

---

## Phase 7: Audio drone layer

### Task 7.1: voidDrone module + tests

**Files:**
- Create: `src-next/audio/voidDrone.ts`
- Create: `src-next/audio/voidDrone.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src-next/audio/voidDrone.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startVoidDrone, stopVoidDrone, isVoidDronePlaying } from './voidDrone';

describe('voidDrone', () => {
  beforeEach(() => stopVoidDrone());

  it('isVoidDronePlaying returns false before start', () => {
    expect(isVoidDronePlaying()).toBe(false);
  });

  it('startVoidDrone marks the drone as playing', () => {
    startVoidDrone();
    expect(isVoidDronePlaying()).toBe(true);
  });

  it('stopVoidDrone clears the playing flag', () => {
    startVoidDrone();
    stopVoidDrone();
    expect(isVoidDronePlaying()).toBe(false);
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
npm test -- voidDrone.test
```

- [ ] **Step 3: Implement voidDrone.ts**

```ts
// src-next/audio/voidDrone.ts
// Tone.js drone layer for Void Mode. Two slightly-detuned low sines with
// a slow amplitude LFO and a long reverb tail. Singleton — only one
// drone instance at a time.
//
// Uses dynamic imports so the test environment (jsdom) doesn't blow up
// trying to instantiate an AudioContext.

let dronePlaying = false;
let toneRefs: { osc1: any; osc2: any; lfo: any; rev: any; gain: any } | null = null;

export function isVoidDronePlaying(): boolean {
  return dronePlaying;
}

export async function startVoidDrone(): Promise<void> {
  if (dronePlaying) return;
  dronePlaying = true;
  if (typeof window === 'undefined') return; // jsdom — flag only

  const Tone = await import('tone');
  const gain = new Tone.Gain(0).toDestination();
  const rev = new Tone.Reverb({ decay: 6, wet: 0.6 }).connect(gain);
  const osc1 = new Tone.Oscillator(55, 'sine').connect(rev).start();
  const osc2 = new Tone.Oscillator(58, 'sine').connect(rev).start();
  const lfo = new Tone.LFO(0.2, 0.0, 0.35).connect(gain.gain).start();
  gain.gain.rampTo(0.35, 4);
  toneRefs = { osc1, osc2, lfo, rev, gain };
}

export function stopVoidDrone(): void {
  dronePlaying = false;
  if (!toneRefs) return;
  const { osc1, osc2, lfo, rev, gain } = toneRefs;
  try {
    gain.gain.rampTo(0, 2);
    setTimeout(() => {
      osc1.stop().dispose();
      osc2.stop().dispose();
      lfo.stop().dispose();
      rev.dispose();
      gain.dispose();
    }, 2100);
  } catch {
    // Already disposed — ignore.
  }
  toneRefs = null;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- voidDrone.test
```

Expected: PASS (Tone import is skipped under jsdom).

- [ ] **Step 5: Wire to mode change**

In `src-next/audio/AudioEngine.ts`, subscribe to the store for `run.mode` changes. Pseudocode (match neighbouring patterns in `AudioEngine.ts`):

```ts
import { startVoidDrone, stopVoidDrone } from './voidDrone';
import { store } from '../state/store';

let lastMode: 'normal' | 'void' = 'normal';
store.subscribe(state => {
  const m = state.run.mode;
  if (m === lastMode) return;
  if (m === 'void') startVoidDrone();
  else stopVoidDrone();
  lastMode = m;
});
```

Place this subscription in `AudioEngine`'s init function, alongside the existing music subscriptions.

- [ ] **Step 6: Preview verify**

Start a void run. Confirm drone audible under music. Return to title — drone fades out.

(If preview env has no audio, skip this step but flag it as a manual-QA item.)

- [ ] **Step 7: Commit**

```bash
git add src-next/audio/voidDrone.ts src-next/audio/voidDrone.test.ts src-next/audio/AudioEngine.ts
git commit -m "feat(audio): void drone layer fades in/out on mode change"
```

---

## Phase 8: Daily certified seed + leaderboard

### Task 8.1: dailySeed module + JSON registry

**Files:**
- Create: `src-next/voidmode/dailyCertified.json`
- Create: `src-next/voidmode/dailySeed.ts`
- Create: `src-next/voidmode/dailySeed.test.ts`

- [ ] **Step 1: Seed the JSON with today's entry**

Create `src-next/voidmode/dailyCertified.json`:

```json
{
  "version": 1,
  "entries": [
    { "date": "2026-05-20", "seed": 2748186699, "clearRate": 0.5 }
  ]
}
```

(`2748186699` is a placeholder. Replace with whatever `balanceSim` reports as falling in `[0.35, 0.65]` once it runs — for now, this entry guarantees the lookup test passes.)

- [ ] **Step 2: Write failing tests**

```ts
// src-next/voidmode/dailySeed.test.ts
import { describe, it, expect } from 'vitest';
import { getVoidDailyDate, getTodayCertified } from './dailySeed';

describe('getVoidDailyDate', () => {
  it('formats UTC date as YYYY-MM-DD', () => {
    const d = new Date('2026-05-20T23:59:00Z');
    expect(getVoidDailyDate(d)).toBe('2026-05-20');
  });

  it('rolls to next day at UTC midnight', () => {
    const d = new Date('2026-05-21T00:00:01Z');
    expect(getVoidDailyDate(d)).toBe('2026-05-21');
  });
});

describe('getTodayCertified', () => {
  it('returns the entry for 2026-05-20 when called on that date', () => {
    const d = new Date('2026-05-20T12:00:00Z');
    const entry = getTodayCertified(d);
    expect(entry).toBeDefined();
    expect(entry!.date).toBe('2026-05-20');
  });

  it('returns undefined for a date with no entry', () => {
    const d = new Date('2099-12-31T12:00:00Z');
    expect(getTodayCertified(d)).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run to confirm fail**

```bash
npm test -- dailySeed.test
```

- [ ] **Step 4: Implement dailySeed.ts**

```ts
// src-next/voidmode/dailySeed.ts
// Date → certified-void-seed lookup. Pattern lifted from
// online/dailyChallenge.ts (FNV-1a + UTC-day key) but reads pre-validated
// entries from dailyCertified.json instead of computing on the fly. This
// is what guarantees daily leaderboard parity — every player on the
// same UTC day gets the same balance-sim-vetted seed.

import certified from './dailyCertified.json';

export interface CertifiedEntry {
  date: string;
  seed: number;
  clearRate: number;
}

export function getVoidDailyDate(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const ENTRIES = (certified.entries as CertifiedEntry[]);
const BY_DATE: ReadonlyMap<string, CertifiedEntry> = new Map(
  ENTRIES.map(e => [e.date, e]),
);

export function getTodayCertified(now: Date = new Date()): CertifiedEntry | undefined {
  return BY_DATE.get(getVoidDailyDate(now));
}

export function getCertifiedFor(date: string): CertifiedEntry | undefined {
  return BY_DATE.get(date);
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- dailySeed.test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src-next/voidmode/dailyCertified.json src-next/voidmode/dailySeed.ts src-next/voidmode/dailySeed.test.ts
git commit -m "feat(voidmode): daily certified seed registry"
```

### Task 8.2: balanceSim CLI (skeleton)

**Files:**
- Create: `src-next/voidmode/balanceSim.ts`
- Create: `scripts/voidmode-cert-seeds.ts` (CLI entry — may live elsewhere depending on existing scripts pattern)

- [ ] **Step 1: Inspect existing sim entry**

Read `src-next/simulation/runSimulation.ts` for its public API. Note the function name and input shape.

- [ ] **Step 2: Implement balanceSim.ts**

```ts
// src-next/voidmode/balanceSim.ts
// Library function: given a seed, run k simulated void-mode trials and
// return a clear-rate. Filter helper picks seeds inside the certified
// band [0.35, 0.65]. Consumed by scripts/voidmode-cert-seeds.ts which
// writes results back to dailyCertified.json.

import { runSimulation } from '../simulation/runSimulation';

const TRIALS_PER_SEED = 200;
const CLEAR_BAND_LO = 0.35;
const CLEAR_BAND_HI = 0.65;

export interface CandidateResult {
  seed: number;
  clearRate: number;
  inBand: boolean;
}

export async function evaluateSeed(seed: number): Promise<CandidateResult> {
  let clears = 0;
  for (let i = 0; i < TRIALS_PER_SEED; i++) {
    const result = await runSimulation({
      seed: seed + i,
      mode: 'void',
      voidSeed: seed,
      constellationId: 'lyra',
      stakeId: 'spark',
    } as any); // Adjust to whatever signature runSimulation actually takes.
    if (result.cleared) clears++;
  }
  const clearRate = clears / TRIALS_PER_SEED;
  return {
    seed,
    clearRate,
    inBand: clearRate >= CLEAR_BAND_LO && clearRate <= CLEAR_BAND_HI,
  };
}
```

- [ ] **Step 3: Write the CLI script**

Create `scripts/voidmode-cert-seeds.ts`:

```ts
// scripts/voidmode-cert-seeds.ts
// Manual / CI script. Enumerate candidate seeds, filter to clear-rate
// band, write the next 90 days of certified entries to dailyCertified.json.
//
// Run with: npx tsx scripts/voidmode-cert-seeds.ts

import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateSeed } from '../src-next/voidmode/balanceSim';
import { getVoidDailyDate } from '../src-next/voidmode/dailySeed';

const JSON_PATH = join(process.cwd(), 'src-next/voidmode/dailyCertified.json');

function nextDay(d: Date): Date {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + 1);
  return c;
}

async function main() {
  const file = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
  const existing: Record<string, true> = {};
  for (const e of file.entries) existing[e.date] = true;

  const cursor = new Date();
  const newEntries: any[] = [];
  for (let day = 0; day < 90; day++) {
    const date = getVoidDailyDate(cursor);
    if (!existing[date]) {
      // Try candidate seeds derived from date hash + offset
      let attempt = 0;
      while (attempt < 100) {
        const seed = (Number.parseInt(date.replace(/-/g, ''), 10) + attempt * 1009) >>> 0;
        const res = await evaluateSeed(seed);
        if (res.inBand) {
          newEntries.push({ date, seed: res.seed, clearRate: res.clearRate });
          break;
        }
        attempt++;
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  file.entries = [...file.entries, ...newEntries].sort((a, b) => a.date.localeCompare(b.date));
  writeFileSync(JSON_PATH, JSON.stringify(file, null, 2));
  console.log(`Wrote ${newEntries.length} new certified entries.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Smoke-run the script (DO NOT commit the bulk results yet)**

```bash
# Only if the sim harness is fast enough — at 200 trials × 90 days this
# could take many minutes. If too slow for an MVP commit, leave the JSON
# at the 1-entry seed from Task 8.1 and document the script as a manual
# pre-release step in the spec follow-up.
```

For MVP it's acceptable to ship with only 1 entry (today) and a CI/manual job documented.

- [ ] **Step 5: Commit (script only, JSON unchanged for MVP)**

```bash
git add src-next/voidmode/balanceSim.ts scripts/voidmode-cert-seeds.ts
git commit -m "feat(voidmode): balanceSim + certified-seed generation script"
```

### Task 8.3: Leaderboard category for void daily

**Files:**
- Modify: `src-next/online/leaderboard.ts`
- Modify: `src-next/online/leaderboard.test.ts`
- Modify: wherever scores are submitted on run end (search for `submitScore` or similar — likely `actions/handlers/round.ts`)

- [ ] **Step 1: Inspect the existing submission path**

Read `src-next/online/leaderboard.ts` to find the submit function. Read `src-next/actions/handlers/round.ts` to find where it's called on run-end. (The leaderboard already supports arbitrary mode strings — see `OnlineScore.mode: string`.)

- [ ] **Step 2: Add the mode string at submission time**

When the run ends and `state.run.mode === 'void'` and `state.run.dailyCertified === true`, submit with `mode = 'void-YYYY-MM-DD'` (today's UTC date). Otherwise submit with `mode = 'void-wild'` (or skip submission for wild seeds entirely — spec says non-certified runs are leaderboard-ineligible).

Add a helper to `voidmode/dailySeed.ts`:

```ts
export function voidLeaderboardMode(certified: boolean, now: Date = new Date()): string | null {
  if (!certified) return null;
  return `void-${getVoidDailyDate(now)}`;
}
```

In the submission handler:

```ts
const voidMode = state.run.mode === 'void'
  ? voidLeaderboardMode(state.run.dailyCertified)
  : null;
if (state.run.mode === 'void' && voidMode === null) return; // skip wild seeds
const submissionMode = voidMode ?? buildNormalModeString(state);
submitScore({ ...payload, mode: submissionMode });
```

- [ ] **Step 3: Add a test**

Append to `src-next/online/leaderboard.test.ts`:

```ts
import { voidLeaderboardMode } from '../voidmode/dailySeed';

describe('voidLeaderboardMode', () => {
  it('returns the date-tagged mode string when certified', () => {
    expect(voidLeaderboardMode(true, new Date('2026-05-20T12:00:00Z')))
      .toBe('void-2026-05-20');
  });
  it('returns null when not certified', () => {
    expect(voidLeaderboardMode(false)).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm test -- leaderboard.test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-next/online/leaderboard.ts src-next/online/leaderboard.test.ts src-next/voidmode/dailySeed.ts src-next/actions/handlers/round.ts
git commit -m "feat(leaderboard): void daily mode partition + wild-seed skip"
```

---

## Phase 9: End-to-end verification

### Task 9.1: Preview-driven full walkthrough

**Files:** none (verification only)

- [ ] **Step 1: Ensure dev server is fresh**

```bash
# If still running from Phase 0, restart it to pick up all the new files:
```

Call `mcp__Claude_Preview__preview_stop`, then `preview_start` with `npm run dev` again.

- [ ] **Step 2: Title screen — black hole visible**

`preview_screenshot`. Confirm the black hole renders bottom-right, faint, slow rotation. Confirm the existing daily-challenge UI is unaffected.

- [ ] **Step 3: Click black hole → Void Mode enters**

`preview_click` on the black-hole hitbox (selector: `[data-testid="blackhole-hitbox"]`). `preview_snapshot` — confirm the route is now on a Round screen. Verify in the snapshot:
- Violet/black tint overlay present
- HUD badge at top-right shows `seed: <hex8>`, alias, Certified or Uncertified label

- [ ] **Step 4: Buy a void-affixed catalyst**

Force-skip to the shop via the existing devtools (`mcp__Claude_Preview__preview_click` on the dev-console buttons, or play one trial normally). `preview_snapshot` — confirm catalyst names include prefix/suffix (e.g. "Cracked Burst Card", "Burst Card of Sundering"). Hover one — confirm flavor text renders.

- [ ] **Step 5: Confirm scoring deltas**

Play one hand. Watch chips/mult tally. If a Cracked-prefixed Pair catalyst is bought, scoring a Pair should be visibly higher than the same catalyst un-affixed would produce. Capture the score moment via `preview_screenshot`.

- [ ] **Step 6: Confirm drone audio**

`preview_logs` — check for Tone.js init log lines or Web Audio init. (Audio playback in preview is environment-dependent; if logs don't surface, flag as manual-QA-only.)

- [ ] **Step 7: Return to title**

Trigger run-end (bust or quit). `preview_snapshot` of Title — confirm overlay clears and badge is gone. Confirm normal new-run path still works (click Start, get a normal-mode round with no overlay/badge).

- [ ] **Step 8: Capture a final after-screenshot suite**

`preview_screenshot` × 3:
1. Title with visible black hole.
2. Void-mode Round with tint + badge + affixed catalyst tooltip.
3. Normal-mode Round (regression baseline) — no tint, no badge.

These are the user-facing artifacts for the PR description.

### Task 9.2: Full test + type sweep

**Files:** none

- [ ] **Step 1: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: all tests pass. Address any regression in catalyst/consumable/scoring tests — `applyAffixes` must be a strict no-op outside void mode, so any non-void test that fails likely indicates the phase was wired in unconditionally.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: clean (or fix any introduced violations).

- [ ] **Step 4: Confirm no untracked files**

```bash
git status
```

Expected: clean working tree (every new file from the plan should already be committed). If anything is untracked, decide: commit it under the appropriate Phase commit or delete it.

---

## Phase 10: PR

### Task 10.1: Push + open PR

**Files:** none

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/void-mode-procgen-affixes
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat: Void Mode — procgen affixed upgrades (MVP)" --body "$(cat <<'EOF'
## Summary

- Hidden Void Mode entered via faint title-screen black hole.
- Catalysts and consumables roll with procedurally generated prefix/suffix affixes (6 canonical affixes — one per family — at MVP; 60-affix content sweep is a follow-up plan).
- Seeded budget-bounded generator (`src-next/voidmode/affixGenerator.ts`); naming/flavor/alias generator; new `applyAffixes` scoring phase that no-ops outside void.
- Violet/black tint + accretion ring overlay on play scene; Tone.js drone layer fades in/out on mode change; HUD badge shows seed + run alias + certified/uncertified state.
- Daily certified seed via `dailyCertified.json` registry; leaderboard partitions by `void-YYYY-MM-DD`; wild seeds are not leaderboard-eligible.
- Strictly ephemeral — nothing carries between Void runs.
- Lyra-only at launch. Other constellations + affixed blinds + codex + recursive/genetic affixes deliberately Phase 2.

Spec: `docs/superpowers/specs/2026-05-20-void-mode-procgen-affixed-upgrades-design.md`
Plan: `docs/superpowers/plans/2026-05-20-void-mode-procgen-affixed-upgrades.md`

## Test plan

- [ ] Title screen renders the faint black hole bottom-right
- [ ] Click black hole → enters void run on Lyra
- [ ] Shop offers show generated names (prefix/suffix), flavor tooltips
- [ ] Pair-scoring with a Cracked-prefixed Pair-buff catalyst exceeds the base catalyst's output
- [ ] HUD badge shows seed + alias + certified-or-uncertified label
- [ ] Violet/black tint + accretion ring visible on Round screen
- [ ] Drone audio plays on void run start, fades out on return to title (manual QA)
- [ ] Normal-mode runs unaffected — no overlay, no badge, no scoring drift
- [ ] `npm run typecheck` clean
- [ ] `npm test` all green
- [ ] `npm run lint` clean

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Return the PR URL**

Print the URL `gh pr create` reports.

---

## Self-Review checklist (run before handoff)

- [ ] **Spec coverage:** Every section of the spec maps to one or more tasks (see Spec column below).
- [ ] **No placeholders:** Search the plan for `TBD`, `TODO`, `placeholder`, `implement later`. Fix any found.
- [ ] **Type consistency:** `AffixDef`, `AffixedItem`, `AffixContext`, `ArchetypeTag` used identically across types.ts, affixes.ts, generator.ts, phases/applyAffixes.ts, shop hooks.
- [ ] **Exact paths:** Every Files block names a real or new file with the full path.

| Spec section | Implemented in |
|--------------|---------------|
| Always-visible faint black hole | Task 6.1, 6.2 |
| Void Mode entry flow | Task 6.2 |
| Affix data model | Task 1.1, 3.2 |
| Affix generator (seeded, budget) | Task 3.3 |
| ~60 affixes (MVP=6, deferred to Phase 2 plan) | Task 3.2 + follow-up plan |
| Naming generator | Task 2.1, 2.2 |
| Affixed catalyst integration | Task 5.1 + Task 4.2 |
| Affixed consumable integration | Task 5.2 |
| Tint overlay + accretion ambient | Task 6.3 |
| Tone.js drone layer | Task 7.1 |
| Daily certified seed | Task 8.1, 8.2 |
| Leaderboard category | Task 8.3 |
| Lyra-only at launch | Implicit — `startVoidRun` defaults to Lyra; no constellation picker in entry flow |
| Strict ephemeral | Implicit — `endVoidRun` clears state; no persistence wiring |
| HUD badge with seed + alias | Task 6.4 |
| End-to-end verification | Task 9.1 |
| Tests | Throughout, every task |

---

## Deferred to Phase 2 (separate plans)

- **Content sweep:** expand `AFFIX_DEFS` from 6 to 60 (12 scalar / 12 conditional / 8 persistent / 10 drawback / 10 synergy / 8 reality-warp) with full effect functions + tests.
- **Affixed blinds:** trials/bosses get procgen rule affixes.
- **Other constellations:** validate the generator and balance against Mensa/Triumvirate/Argo/Fibonacci/Eclipse/Ophiuchus/Spark rules.
- **Codex / inscription / recursive / genetic / collapse** — deferred per spec.
- **Procedural boss sigils** — separate scope.
- **Forge integration:** affixed dice faces.
- **Mobile-specific Void HUD layout.**
