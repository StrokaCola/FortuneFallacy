# Grounded-Constellation Re-Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-theme Fortune Fallacy's player-facing language and internal IDs from mystical/divinatory to grounded "casual probabilist" lexicon. Constellation names stay for combos; everything else becomes simulation-speak.

**Architecture:** Aggressive single-sweep rename. Internal symbols and player-facing strings change together so the code and the UI stay in sync. Save migrator handles old localStorage payloads. No mechanical changes — pure rename + copy.

**Tech Stack:** TypeScript, Vite, React 18, Zustand, Tailwind, Vitest. localStorage-based persistence (key `ff_next_save`).

**Spec:** [docs/superpowers/specs/2026-04-28-grounded-constellation-retheme-design.md](../specs/2026-04-28-grounded-constellation-retheme-design.md)

---

## File Structure (touched by this plan)

**Renamed (use `git mv` to preserve history):**
- `src-next/data/oracles.ts` → `src-next/data/catalysts.ts`
- `src-next/core/upgrades/oracles/` → `src-next/core/upgrades/catalysts/` (with all 6 files renamed inside)
- `src-next/core/runes/` → `src-next/core/mods/`
- `src-next/app/hud/OracleStrip.tsx` → `src-next/app/hud/CatalystStrip.tsx`
- `src-next/actions/handlers/oracle.ts` → `src-next/actions/handlers/catalyst.ts`

**Modified:**
- `src-next/data/blinds.ts` (boss ids, names, descriptions, debuff strings)
- `src-next/data/vouchers.ts` (`astral_plane` → `bench`)
- `src-next/data/vendor-lines.ts` (rewrite content + key `oracle` → `catalyst`)
- `src-next/core/runes/index.ts` → `src-next/core/mods/index.ts` (entry renames + type renames + applyFaceRemaps signature)
- `src-next/core/consumables/index.ts` (entry renames + type union)
- `src-next/core/round/debuffs.ts` (debuff string renames)
- `src-next/core/phases/upgrades.ts` (`hasDebuff('disable_oracles')` → `'disable_catalysts'`, `applyRuneScoring` → `applyModScoring`)
- `src-next/core/vouchers/index.ts` (`maxOracleSlots` → `maxCatalystSlots`, `maxRuneSlots` → `maxModSlots`, voucher id ref `astral_plane` → `bench`)
- `src-next/core/round/transitions.ts` (`s.run.oracles` → `s.run.catalysts`, `droppedOracles` → `droppedCatalysts`)
- `src-next/state/slices/run.ts` (`oracles` → `catalysts`)
- `src-next/state/slices/round.ts` (`diceRunes` → `diceMods`)
- `src-next/state/selectors.ts` (`selectOracles` → `selectCatalysts`)
- `src-next/state/persistence.ts` (call new migrator on load)
- `src-next/actions/types.ts` (`GRANT_ORACLE`/`REVOKE_ORACLE` → `GRANT_CATALYST`/`REVOKE_CATALYST`; `ATTACH_RUNE`/`DETACH_RUNE` → `ATTACH_MOD`/`DETACH_MOD`)
- `src-next/actions/dispatch.ts` (import from new handler path; routing keys)
- `src-next/actions/handlers/dice.ts` (action handler cases + `lookupRune` → `lookupMod`)
- `src-next/actions/handlers/shop.ts` (`ORACLE_IDS` → `CATALYST_IDS`; `kind: 'oracle'` → `kind: 'catalyst'`)
- `src-next/events/types.ts` (`ShopOffer.kind` union)
- `src-next/app/hud/LoadoutDock.tsx` (lookupOracle/Strip/labels + tarot/spectral check)
- `src-next/app/hud/BossReveal.tsx` ("arcanum" → "anomaly", "hex" → "effect", strip italic flavor)
- `src-next/app/hud/AstralHint.tsx` (label + body copy)
- `src-next/app/hud/ScoreMoment.tsx` (CONSTELLATION_NAMES: `LG_STRAIGHT: 'Lyra'`)
- `src-next/app/hud/TopBar.tsx` (`oracleSlots` prop → `catalystSlots`)
- `src-next/app/screens/Title.tsx` (tagline)
- `src-next/app/screens/Hub.tsx` ("Tribunal of Stars" → "Star Atlas"; sub-copy)
- `src-next/app/screens/Forge.tsx` (sub-tagline + RUNES import + colorMap keys + counters)
- `src-next/app/screens/Shop.tsx` (sub-tagline + offerMeta + lookupOracle import)
- `src-next/styles/index.css` (`--astral` → `--vector`)
- `tailwind.config.ts` (`astral` color → `vector`)
- `src-next/devtools/EventLogger.tsx` (`text-astral` → `text-vector`)
- `src-next/render/three/Dice3D.ts` (comment-only)

**Created:**
- `src-next/state/migrations/v1_retheme.ts` (save migrator)
- `src-next/state/migrations/v1_retheme.test.ts` (unit test)

---

## Conventions

- **Commits:** one per task with format `refactor(retheme): <short>`. Run `npm run build` + `npm test` (vitest) green before each commit. Use `git mv` for file moves. Never commit half-states.
- **Verification per task:** if a step touches public types or callers, run `npm run build` after the step. If it touches state shape, run `npm test`. End every task with `npm run dev` smoke for visible UI tasks (T8, T11, T12).
- **Find-replace safety:** prefer Grep + targeted Edit over global replace. Always re-grep after a rename to catch missed call-sites.
- **Caveman mode (user setting):** does NOT apply to this plan or to commit messages. Write code, comments, and commits in normal prose.

---

## Task 0: Verify clean working tree

**Files:** none

- [ ] **Step 1: Confirm we're on `main` and clean**

Run: `git -C C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2 status -sb`
Expected: `## main...origin/main` and no modifications.

If branches are required by team convention, create one now:
```bash
git -C C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2 checkout -b feat/retheme
```
Otherwise commit directly to `main` per recent project history (last 5 commits go to main).

- [ ] **Step 2: Confirm baseline build + tests pass**

```bash
cd C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2
npm run build
npm test
```
Expected: build succeeds, all vitest tests pass. (If they don't, stop — fix or report before re-theming.)

---

## Task 1: Rune → Mod system rename (core)

**Files:**
- Move: `src-next/core/runes/` → `src-next/core/mods/`
- Modify: `src-next/core/mods/index.ts` (was `runes/index.ts`)

- [ ] **Step 1: Move the directory**

```bash
git mv src-next/core/runes src-next/core/mods
```

- [ ] **Step 2: Rename types and constants in `src-next/core/mods/index.ts`**

Replace the entire file content with:

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

export const MAX_MOD_SLOTS = 2;

export function lookupMod(id: string): ModDef | undefined {
  return MODS.find((m) => m.id === id);
}

export function applyFaceRemaps(faces: number[], diceMods: string[][]): number[] {
  return faces.map((face, i) => {
    const mods = diceMods[i] ?? [];
    let f = face;
    for (const id of mods) {
      const def = lookupMod(id);
      if (def?.faceRemap && f === def.faceRemap.from) f = def.faceRemap.to;
    }
    const minMod = mods.map(lookupMod).find((d) => d?.scoreMin != null);
    if (minMod?.scoreMin != null && f < minMod.scoreMin) f = minMod.scoreMin;
    return f;
  });
}
```

- [ ] **Step 3: Verify no other code in `src-next/core/mods/` directory**

Run: `ls src-next/core/mods/`
Expected: only `index.ts`.

- [ ] **Step 4: Find all importers of old `runes` path**

Run Grep:
- pattern: `from ['"][^'"]*core/runes`
- glob: `src-next/**/*.{ts,tsx}`

Expected hits (will be fixed in later tasks):
- `src-next/core/phases/upgrades.ts`
- `src-next/actions/handlers/dice.ts`
- `src-next/app/screens/Forge.tsx`
- `src-next/render/three/Dice3D.ts` (only a comment)
- possibly `src-next/core/round/debuffs.ts` (no, debuffs only references string)

For now, the build will be broken — that is expected. We'll fix importers in Task 2.

- [ ] **Step 5: Don't commit yet — broken build, fix in Task 2 first**

Skip commit. Continue to Task 2.

---

## Task 2: Update Rune → Mod importers

**Files:**
- Modify: `src-next/core/phases/upgrades.ts`
- Modify: `src-next/actions/handlers/dice.ts`
- Modify: `src-next/render/three/Dice3D.ts` (comment only)
- Modify: `src-next/state/slices/round.ts` (`diceRunes` → `diceMods`)
- Modify: `src-next/core/vouchers/index.ts` (`maxRuneSlots` → `maxModSlots`)

- [ ] **Step 1: Rename `diceRunes` → `diceMods` in round slice**

Edit `src-next/state/slices/round.ts`:
- Replace `diceRunes: string[][];` with `diceMods: string[][];`
- Replace `diceRunes: Array.from({ length: 5 }, () => [] as string[]),` with `diceMods: Array.from({ length: 5 }, () => [] as string[]),`

Note: also update the `lastScoringCtx` shape if it references runes (check by re-reading the file). It does not.

- [ ] **Step 2: Update `core/vouchers/index.ts`**

Replace function name `maxRuneSlots` with `maxModSlots`:

```ts
export function maxModSlots(s: GameState): number {
  return ownsVoucher(s, 'forged_links') ? 3 : 2;
}
```

(Voucher id `forged_links` keeps its value — only the function name changes here. The `astral_plane` reference will change in a later task.)

- [ ] **Step 3: Update `core/phases/upgrades.ts`**

Replace lines:
- `import { lookupRune } from '../runes';` → `import { lookupMod } from '../mods';`
- `const applyRuneScoring: PhaseFn = (ctx) => {` → `const applyModScoring: PhaseFn = (ctx) => {`
- `const diceRunes = ctx.state.round.diceRunes;` → `const diceMods = ctx.state.round.diceMods;`
- `const runes = diceRunes[i] ?? [];` → `const mods = diceMods[i] ?? [];`
- `for (const id of runes) {` → `for (const id of mods) {`
- `const def = lookupRune(id);` → `const def = lookupMod(id);`
- `id: \`rune:${id}@${i}\`` → `id: \`mod:${id}@${i}\``
- `next = applyRuneScoring(next);` → `next = applyModScoring(next);`

- [ ] **Step 4: Update `actions/handlers/dice.ts`**

Replace imports:
```ts
import { lookupMod } from '../../core/mods';
import { maxModSlots } from '../../core/vouchers';
```

Replace `ATTACH_RUNE`/`DETACH_RUNE` cases body — note action types still say `ATTACH_RUNE`/`DETACH_RUNE` until Task 4. For now only swap function calls:

```ts
case 'ATTACH_RUNE': {
  if (!lookupMod(a.runeId)) return { state: s, events: [] };
  const slots = s.round.diceMods[a.dieIdx];
  if (!slots || slots.length >= maxModSlots(s)) return { state: s, events: [] };
  const diceMods = s.round.diceMods.map((r, i) => (i === a.dieIdx ? [...r, a.runeId] : r));
  return { state: { ...s, round: { ...s.round, diceMods } }, events: [] };
}
case 'DETACH_RUNE': {
  const diceMods = s.round.diceMods.map((r, i) =>
    i === a.dieIdx ? r.filter((_, j) => j !== a.runeIdx) : r,
  );
  return { state: { ...s, round: { ...s.round, diceMods } }, events: [] };
}
```

- [ ] **Step 5: Update `render/three/Dice3D.ts` comment**

Replace:
- `//   • holdLinksGlow: wide soft halo (additive, low opacity, astral tint)` 
- with:
- `//   • holdLinksGlow: wide soft halo (additive, low opacity, vector tint)`

(Comment-only change; CSS token rename happens later but this comment uses the word now.)

- [ ] **Step 6: Build to verify rename**

Run: `npm run build`
Expected: build succeeds. If errors mention `runes`, find missed call-sites with Grep `runes\\b` over `src-next/`.

- [ ] **Step 7: Run tests**

Run: `npm test`
Expected: all green. Combo/scoring tests should still pass since mechanics unchanged.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(retheme): rename Rune system to Mod (system + dice slot key)"
```

---

## Task 3: Rename Rune action types and dispatch routing

**Files:**
- Modify: `src-next/actions/types.ts`
- Modify: `src-next/actions/dispatch.ts`
- Modify: `src-next/actions/handlers/dice.ts` (case strings + payload shape)
- Modify: `src-next/app/screens/Forge.tsx` (dispatch call)

- [ ] **Step 1: Update `actions/types.ts`**

Replace:
```ts
| { type: 'ATTACH_RUNE'; dieIdx: number; runeId: string }
| { type: 'DETACH_RUNE'; dieIdx: number; runeIdx: number }
```
with:
```ts
| { type: 'ATTACH_MOD'; dieIdx: number; modId: string }
| { type: 'DETACH_MOD'; dieIdx: number; modIdx: number }
```

- [ ] **Step 2: Update `actions/dispatch.ts` ROUTING keys**

Replace `ATTACH_RUNE: diceHandler,` with `ATTACH_MOD: diceHandler,`.
Replace `DETACH_RUNE: diceHandler,` with `DETACH_MOD: diceHandler,`.

- [ ] **Step 3: Update `actions/handlers/dice.ts` switch cases + field names**

Replace the rune cases with:
```ts
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
```

- [ ] **Step 4: Update `app/screens/Forge.tsx` dispatch calls**

Replace `dispatch({ type: 'ATTACH_RUNE', dieIdx: selectedDie, runeId: r.id })` with `dispatch({ type: 'ATTACH_MOD', dieIdx: selectedDie, modId: r.id })`.

Replace `dispatch({ type: 'DETACH_RUNE', dieIdx: selectedDie, runeIdx: idx })` with `dispatch({ type: 'DETACH_MOD', dieIdx: selectedDie, modIdx: idx })`.

(Other Forge.tsx changes — RUNES import, copy strings — happen in later tasks.)

- [ ] **Step 5: Build + test**

```bash
npm run build
npm test
```
Expected: green. If a `RUNE` literal type error remains, search `'ATTACH_RUNE'\\|'DETACH_RUNE'\\|runeId\\|runeIdx`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(retheme): rename ATTACH_RUNE/DETACH_RUNE actions to MOD"
```

---

## Task 4: Oracle → Catalyst system rename (core)

**Files:**
- Move: `src-next/data/oracles.ts` → `src-next/data/catalysts.ts`
- Move: `src-next/core/upgrades/oracles/` → `src-next/core/upgrades/catalysts/` (whole dir)
- Modify: contents of moved files

- [ ] **Step 1: Move data file**

```bash
git mv src-next/data/oracles.ts src-next/data/catalysts.ts
```

- [ ] **Step 2: Move oracles upgrade dir**

```bash
git mv src-next/core/upgrades/oracles src-next/core/upgrades/catalysts
```

- [ ] **Step 3: Rewrite `src-next/data/catalysts.ts`**

Replace entire file content with:

```ts
export type CatalystMeta = {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  rarity: 'common' | 'uncommon' | 'rare';
};

export const CATALYST_META: CatalystMeta[] = [
  { id: 'stratifier',     name: 'Stratifier',     icon: '👁',  color: '#cc88ff', desc: 'Full House → Mult ×2',          rarity: 'uncommon' },
  { id: 'chaos_theory',   name: 'Chaos Theory',   icon: '∞',   color: '#44ddff', desc: 'Straights → +5 Mult',           rarity: 'uncommon' },
  { id: 'six_bias',       name: 'Six Bias',       icon: '📈',  color: '#b088ff', desc: 'Each 6 → +4 Chips',             rarity: 'common'   },
  { id: 'twin_sample',    name: 'Twin Sample',    icon: '🔢',  color: '#ff9944', desc: 'Two Pair → Chips ×2',           rarity: 'uncommon' },
  { id: 'cold_hand',      name: 'Cold Hand',      icon: '💬',  color: '#c0c8ff', desc: 'Chance → +4 Mult',              rarity: 'common'   },
  { id: 'entropy_index',  name: 'Entropy Index',  icon: '◈',   color: '#a080c0', desc: 'Each unique face → ×1.25 Mult', rarity: 'rare'    },
];

export function lookupCatalyst(id: string): CatalystMeta | undefined {
  return CATALYST_META.find((c) => c.id === id);
}
```

(Note: this file does NOT yet expose backwards-compat aliases. Importers will be updated in later tasks before commit.)

---

## Task 5: Rename catalyst entry files + ids

**Files:**
- Move + edit: `src-next/core/upgrades/catalysts/theOracle.ts` → `stratifier.ts`
- Move + edit: `src-next/core/upgrades/catalysts/prophet.ts` → `sixBias.ts`
- Move + edit: `src-next/core/upgrades/catalysts/foolsFortune.ts` → `twinSample.ts`
- Move + edit: `src-next/core/upgrades/catalysts/silverTongue.ts` → `coldHand.ts`
- Move + edit: `src-next/core/upgrades/catalysts/entropyStone.ts` → `entropyIndex.ts`
- Edit (no move): `src-next/core/upgrades/catalysts/chaosTheory.ts` (id unchanged)
- Modify: `src-next/core/upgrades/catalysts/index.ts`

- [ ] **Step 1: Rename theOracle.ts → stratifier.ts and update id**

```bash
git mv src-next/core/upgrades/catalysts/theOracle.ts src-next/core/upgrades/catalysts/stratifier.ts
```

Edit the file: replace both occurrences of `'the_oracle'` with `'stratifier'`. The full new content:

```ts
import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'stratifier',
  phase: Phase.UPGRADES,
  priority: 100,
  apply: (ctx) => {
    if (ctx.combo?.id !== 'full_house') return ctx;
    const newMult = ctx.mult * 2;
    return {
      ...ctx,
      mult: newMult,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: {
            id: 'stratifier',
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

- [ ] **Step 2: Rename prophet.ts → sixBias.ts**

```bash
git mv src-next/core/upgrades/catalysts/prophet.ts src-next/core/upgrades/catalysts/sixBias.ts
```

Edit: replace both `'prophet'` ids with `'six_bias'`.

- [ ] **Step 3: Rename foolsFortune.ts → twinSample.ts**

```bash
git mv src-next/core/upgrades/catalysts/foolsFortune.ts src-next/core/upgrades/catalysts/twinSample.ts
```

Edit: replace both `'fools_fortune'` ids with `'twin_sample'`.

- [ ] **Step 4: Rename silverTongue.ts → coldHand.ts**

```bash
git mv src-next/core/upgrades/catalysts/silverTongue.ts src-next/core/upgrades/catalysts/coldHand.ts
```

Edit: replace both `'silver_tongue'` ids with `'cold_hand'`.

- [ ] **Step 5: Rename entropyStone.ts → entropyIndex.ts**

```bash
git mv src-next/core/upgrades/catalysts/entropyStone.ts src-next/core/upgrades/catalysts/entropyIndex.ts
```

Edit: replace both `'entropy_stone'` ids with `'entropy_index'`.

- [ ] **Step 6: chaosTheory.ts — id unchanged, no changes needed**

Verify: `grep -n "chaos_theory" src-next/core/upgrades/catalysts/chaosTheory.ts`
Expected: still says `id: 'chaos_theory'`. No edit.

- [ ] **Step 7: Replace `src-next/core/upgrades/catalysts/index.ts`**

```ts
import './stratifier';
import './chaosTheory';
import './sixBias';
import './twinSample';
import './coldHand';
import './entropyIndex';

export const CATALYST_IDS = [
  'stratifier', 'chaos_theory', 'six_bias',
  'twin_sample', 'cold_hand', 'entropy_index',
] as const;
export type CatalystId = typeof CATALYST_IDS[number];
```

- [ ] **Step 8: Don't commit yet — importers still broken**

Continue to Task 6.

---

## Task 6: Update Oracle → Catalyst importers (state, actions, UI)

**Files:**
- Modify: `src-next/state/slices/run.ts`
- Modify: `src-next/state/selectors.ts`
- Modify: `src-next/actions/types.ts`
- Modify: `src-next/actions/dispatch.ts`
- Move + edit: `src-next/actions/handlers/oracle.ts` → `catalyst.ts`
- Modify: `src-next/actions/handlers/shop.ts`
- Modify: `src-next/events/types.ts`
- Modify: `src-next/core/round/transitions.ts`
- Modify: `src-next/core/vouchers/index.ts`
- Modify: `src-next/core/round/debuffs.ts`
- Modify: `src-next/core/phases/upgrades.ts`

- [ ] **Step 1: Rename run slice field**

Edit `src-next/state/slices/run.ts`:

Replace `oracles: string[];` with `catalysts: string[];` (keep both occurrences — type and initializer in sync):

```ts
export type RunSlice = {
  seed: number;
  shards: number;
  ante: number;
  goalIdx: number;
  catalysts: string[];
  vouchers: string[];
  consumables: string[];
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
});
```

- [ ] **Step 2: Update `state/selectors.ts`**

Replace `export const selectOracles    = (s: GameState) => s.run.oracles;` with `export const selectCatalysts = (s: GameState) => s.run.catalysts;`.

- [ ] **Step 3: Update `actions/types.ts`**

Replace:
```ts
| { type: 'GRANT_ORACLE'; id: string }
| { type: 'REVOKE_ORACLE'; id: string }
```
with:
```ts
| { type: 'GRANT_CATALYST'; id: string }
| { type: 'REVOKE_CATALYST'; id: string }
```

- [ ] **Step 4: Move + edit oracle handler**

```bash
git mv src-next/actions/handlers/oracle.ts src-next/actions/handlers/catalyst.ts
```

Replace contents of `src-next/actions/handlers/catalyst.ts`:

```ts
import type { ActionHandler } from './types';

export const catalystHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'GRANT_CATALYST': {
      if (s.run.catalysts.includes(a.id)) return { state: s, events: [] };
      return {
        state: { ...s, run: { ...s.run, catalysts: [...s.run.catalysts, a.id] } },
        events: [],
      };
    }
    case 'REVOKE_CATALYST':
      return {
        state: { ...s, run: { ...s.run, catalysts: s.run.catalysts.filter((x) => x !== a.id) } },
        events: [],
      };
    default:
      return { state: s, events: [] };
  }
};
```

- [ ] **Step 5: Update `actions/dispatch.ts`**

Replace `import { oracleHandler } from './handlers/oracle';` with `import { catalystHandler } from './handlers/catalyst';`.

Replace `import '../core/upgrades/oracles';` with `import '../core/upgrades/catalysts';`.

In ROUTING:
```ts
GRANT_CATALYST: catalystHandler,
REVOKE_CATALYST: catalystHandler,
```

- [ ] **Step 6: Update `actions/handlers/shop.ts`**

Replace:
- `import { ORACLE_IDS } from '../../core/upgrades/oracles';` → `import { CATALYST_IDS } from '../../core/upgrades/catalysts';`

In `rollOffers`:
- `const oracleIds = shuffle([...ORACLE_IDS]).slice(0, 2);` → `const catalystIds = shuffle([...CATALYST_IDS]).slice(0, 2);`
- `const offers: ShopOffer[] = oracleIds.map((id) => ({ kind: 'oracle' as const, id, price: 5 }));` → `const offers: ShopOffer[] = catalystIds.map((id) => ({ kind: 'catalyst' as const, id, price: 5 }));`

In `BUY_OFFER` case:
- `const oracles = offer.kind === 'oracle' ? [...s.run.oracles, offer.id] : s.run.oracles;` → `const catalysts = offer.kind === 'catalyst' ? [...s.run.catalysts, offer.id] : s.run.catalysts;`
- In the returned state object: `oracles, consumables, vouchers` → `catalysts, consumables, vouchers`

- [ ] **Step 7: Update `events/types.ts`**

Replace:
```ts
export type ShopOffer = {
  kind: 'oracle' | 'voucher' | 'consumable';
  id: string;
  price: number;
};
```
with:
```ts
export type ShopOffer = {
  kind: 'catalyst' | 'voucher' | 'consumable';
  id: string;
  price: number;
};
```

- [ ] **Step 8: Update `core/round/transitions.ts`**

Replace `s.run.oracles` with `s.run.catalysts` (4 occurrences in `bustBlind`).
Replace local var `droppedOracles` with `droppedCatalysts`.

In the `bustBlind` partial-credit branch:
```ts
const droppedCatalysts = s.run.catalysts.length > 0 ? s.run.catalysts.slice(1) : [];
// ...
run: { ...s.run, catalysts: droppedCatalysts, goalIdx: nextGoal, ante: nextAnte },
```

- [ ] **Step 9: Update `core/vouchers/index.ts`**

Replace function `maxOracleSlots` with `maxCatalystSlots`:

```ts
export function maxCatalystSlots(s: GameState): number {
  return ownsVoucher(s, 'astral_plane') ? 7 : 6;
}
```

(Voucher id `astral_plane` will be renamed in Task 8 — leave it for now.)

- [ ] **Step 10: Update `core/round/debuffs.ts`**

Replace the Debuff union element `'disable_oracles'` with `'disable_catalysts'`. Full file:

```ts
import { BOSS_BLINDS } from '../../data/blinds';
import type { GameState } from '../../state/store';

export type Debuff =
  | 'no_rerolls'
  | 'disable_catalysts'
  | 'auto_unlock_after_roll'
  | 'hand_size_cap_4'
  | 'no_mod_transforms_on_ones';

export function activeDebuffs(s: GameState): Set<Debuff> {
  if (!s.round.isBoss || !s.round.blindId) return new Set();
  const def = BOSS_BLINDS.find((b) => b.id === s.round.blindId);
  return new Set((def?.debuffs ?? []) as Debuff[]);
}

export function hasDebuff(s: GameState, d: Debuff): boolean {
  return activeDebuffs(s).has(d);
}
```

(The `BOSS_BLINDS` data still has `disable_oracles` and `no_rune_transforms_on_ones` strings — those will be updated in Task 9. Until then there's a runtime mismatch on boss-debuff lookup. That's fine because builds typecheck against the union and we fix the data before re-running boss-active rounds.)

- [ ] **Step 11: Update `core/phases/upgrades.ts`**

Replace `if (!hasDebuff(ctx.state, 'disable_oracles')) {` with `if (!hasDebuff(ctx.state, 'disable_catalysts')) {`.

Replace `const owned = new Set(ctx.state.run.oracles);` with `const owned = new Set(ctx.state.run.catalysts);`.

- [ ] **Step 12: Build to verify**

```bash
npm run build
```
Expected: succeeds. If errors mention `oracles`, `selectOracles`, `lookupOracle`, or `ORACLE_IDS`, find call-sites with Grep and fix in Task 7.

- [ ] **Step 13: Don't commit — UI consumers still broken**

Continue to Task 7.

---

## Task 7: Update Oracle → Catalyst UI consumers

**Files:**
- Move + edit: `src-next/app/hud/OracleStrip.tsx` → `CatalystStrip.tsx`
- Modify: `src-next/app/hud/LoadoutDock.tsx`
- Modify: `src-next/app/hud/TopBar.tsx`
- Modify: `src-next/app/screens/Hub.tsx`
- Modify: `src-next/app/screens/Forge.tsx`
- Modify: `src-next/app/screens/Shop.tsx`
- Modify: `src-next/app/screens/Round.tsx` (only if it imports OracleStrip)

- [ ] **Step 1: Find all importers of OracleStrip**

Run Grep:
- pattern: `OracleStrip`
- path: `src-next/`

Expected: at least its own file plus one importer in a screen (likely `Round.tsx`).

- [ ] **Step 2: Move + rewrite the strip component**

```bash
git mv src-next/app/hud/OracleStrip.tsx src-next/app/hud/CatalystStrip.tsx
```

Replace contents of `CatalystStrip.tsx`:

```tsx
import { useStore, type GameState } from '../../state/store';
import { lookupCatalyst } from '../../data/catalysts';

const selectCatalysts = (s: GameState) => s.run.catalysts;

export function CatalystStrip() {
  const catalysts = useStore(selectCatalysts);
  if (catalysts.length === 0) return null;

  return (
    <div style={{
      position: 'absolute', top: 142, left: 18,
      display: 'flex', gap: 8, zIndex: 4,
    }}>
      {catalysts.map((id, i) => {
        const c = lookupCatalyst(id);
        if (!c) return null;
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
            }}>
              <div className="f-mono uc" style={{ fontSize: 8, letterSpacing: '0.18em', color: '#bba8ff' }}>catalyst</div>
              <div style={{ fontSize: 28, color: c.color, filter: `drop-shadow(0 0 6px ${c.color})` }}>{c.icon}</div>
              <div className="f-mono uc" style={{ fontSize: 7, letterSpacing: '0.14em', color: c.color, textAlign: 'center', lineHeight: 1.2 }}>
                {c.name.split(' ').pop()}
              </div>
            </div>
            <div className="tip">{c.desc}</div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Update Round.tsx (or whichever importer Step 1 found)**

Replace import `OracleStrip` with `CatalystStrip` and the JSX usage `<OracleStrip />` with `<CatalystStrip />`. Use Grep results from Step 1 to confirm path.

- [ ] **Step 4: Update LoadoutDock.tsx**

Replace:
- `import { selectOracles } from '../../state/selectors';` → `import { selectCatalysts } from '../../state/selectors';`
- `import { lookupOracle } from '../../data/oracles';` → `import { lookupCatalyst } from '../../data/catalysts';`

Replace local variables and loops:
- `const oracles = useStore(selectOracles);` → `const catalysts = useStore(selectCatalysts);`
- `oracles.length === 0 && consumables.length === 0` → `catalysts.length === 0 && consumables.length === 0`
- `oracles.map((id, i) => {` → `catalysts.map((id, i) => {`
- `const o = lookupOracle(id);` → `const c = lookupCatalyst(id);`
- everywhere `o.color`, `o.icon`, `o.name`, `o.desc` referenced for that loop → use `c.` accordingly

(Important: there's a separate `c` index variable in the consumables loop — name the catalyst loop variable `cat` instead of `c` to avoid shadowing. Use `cat` for the catalyst meta and update its property accesses.)

Reference replacement (catalyst loop only):
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
      <span className="tip">{cat.name} — {cat.desc}</span>
    </div>
  );
})}
```

(Inner `key={\`o-${i}\`}` keeps an `o-` prefix for React reconciliation continuity; that's just an internal key string, not user-visible. Optional: rename to `cat-${i}` for clarity, but not required.)

- [ ] **Step 5: Update TopBar.tsx — rename `oracleSlots` prop to `catalystSlots`**

Read the file first to find the prop type. Likely:

```tsx
oracleSlots: { used: number; max: number };
```

Replace with `catalystSlots: { used: number; max: number };` in the props interface, and rename internal usage in the JSX. The HUD label `oracle` (if rendered) should become `catalyst`.

If the file renders a small label with text like `oracle slots` or similar, update to `catalyst slots`.

(Read the file in this step before editing — its body wasn't fully shown in this plan. If it does not render a string for oracle, only the prop name needs updating.)

- [ ] **Step 6: Update Hub.tsx callers**

Replace import `selectOracles` with `selectCatalysts`. Replace `const oracles = useStore(selectOracles);` with `const catalysts = useStore(selectCatalysts);`. Replace prop pass `oracleSlots={{ used: oracles.length, max: 6 }}` with `catalystSlots={{ used: catalysts.length, max: 6 }}`.

(Headings + sub-copy are changed in Task 12 — don't touch them yet.)

- [ ] **Step 7: Update Forge.tsx**

Replace:
- `import { RUNES, lookupRune } from '../../core/runes';` → `import { MODS, lookupMod } from '../../core/mods';`
- `import { maxRuneSlots } from '../../core/vouchers';` → `import { maxModSlots } from '../../core/vouchers';`
- `import { selectAnte, selectShards, selectOracles } from '../../state/selectors';` → `import { selectAnte, selectShards, selectCatalysts } from '../../state/selectors';`
- `const selectDiceRunes = (s: GameState) => s.round.diceRunes;` → `const selectDiceMods = (s: GameState) => s.round.diceMods;`
- `const selectMaxRune = (s: GameState) => maxRuneSlots(s);` → `const selectMaxMod = (s: GameState) => maxModSlots(s);`
- `const diceRunes = useStore(selectDiceRunes);` → `const diceMods = useStore(selectDiceMods);`
- `const oracles = useStore(selectOracles);` → `const catalysts = useStore(selectCatalysts);`
- `const maxSlots = useStore(selectMaxRune);` → `const maxSlots = useStore(selectMaxMod);`
- `const slots = diceRunes[selectedDie] ?? [];` → `const slots = diceMods[selectedDie] ?? [];`
- `const selectedRunes = slots.map(lookupRune)` → `const selectedMods = slots.map(lookupMod)`
- in the JSX `runes={selectedRunes}` for `Die3DCSS` → check that prop's name. If the component prop is also named `runes`, leave it for now (out of scope) and add a TODO comment, OR rename in this same task. Read the `Die3DCSS` component to decide. Recommended: rename the `Die3DCSS` prop too (`runes` → `mods`) to keep consistency. See `src-next/app/visual/Die3DCSS.tsx` — update its props type and consumers. That's a small additional file to edit.
- Replace the inline colorMap keys: `snake_cult: '#9577ff'` → `snake_eyes: '#9577ff'`; `blessed: '#bba8ff'` → `backstop: '#bba8ff'`.
- Replace the iteration variable: `RUNES.map((r, i)` → `MODS.map((r, i)` (keep `r` as the iter name, that's fine).
- Counters: `oracles {oracles.length}/6` → `catalysts {catalysts.length}/6`.
- Counters: `{slots.length}/{maxSlots} runes` → `{slots.length}/{maxSlots} mods`.
- `◈ rune codex` → `◈ mod codex`.

(Sub-tagline `◇ etch the cosmos ◇` and heading `The Star Forge` are rewritten in Task 12.)

- [ ] **Step 8: Update Shop.tsx**

Replace:
- `import { lookupOracle } from '../../data/oracles';` → `import { lookupCatalyst } from '../../data/catalysts';`
- `selectOracles` → `selectCatalysts`
- `oracles` → `catalysts` in props
- `if (kind === 'oracle')` → `if (kind === 'catalyst')`
- `kindLabel: 'oracle'` → `kindLabel: 'catalyst'`
- inside the `'catalyst'` branch: `const o = lookupOracle(id);` → `const c = lookupCatalyst(id);` and update field accesses

Heading `The Celestial Bazaar` and sub-tagline updates happen in Task 12.

- [ ] **Step 9: Update Die3DCSS prop (optional but recommended)**

Read `src-next/app/visual/Die3DCSS.tsx`. If it has a prop `runes`, rename to `mods`. Update both the type and the body. This affects the only known consumer (`Forge.tsx`). If the prop is referenced elsewhere, Grep-check first.

- [ ] **Step 10: Build + test**

```bash
npm run build
npm test
```
Expected: green. If `oracles`, `runes`, or `lookupOracle` errors remain, run `Grep` over `src-next/` for missed call-sites.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor(retheme): rename Oracle system to Catalyst (data, state, actions, UI)"
```

---

## Task 8: Rename voucher `astral_plane` → `bench`

**Files:**
- Modify: `src-next/data/vouchers.ts`
- Modify: `src-next/core/vouchers/index.ts`

- [ ] **Step 1: Update voucher data**

Edit `src-next/data/vouchers.ts`:

```ts
export const VOUCHERS: VoucherDef[] = [
  { id: 'bench',        name: 'Bench',        description: '+1 catalyst slot', price: 8 },
  { id: 'forged_links', name: 'Forged Links', description: '+1 mod slot per die', price: 8 },
  { id: 'shard_streak', name: 'Shard Streak', description: '+1 shard per cleared blind', price: 6 },
];
```

- [ ] **Step 2: Update voucher voucher lookup**

Edit `src-next/core/vouchers/index.ts`:

Replace `return ownsVoucher(s, 'astral_plane') ? 7 : 6;` with `return ownsVoucher(s, 'bench') ? 7 : 6;`.

- [ ] **Step 3: Build + test**

```bash
npm run build
npm test
```
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(retheme): rename Astral Plane voucher to Bench"
```

---

## Task 9: Rename boss blinds + debuff strings

**Files:**
- Modify: `src-next/data/blinds.ts`

- [ ] **Step 1: Replace BOSS_BLINDS with new planet/moon names**

Replace the entire `BOSS_BLINDS` array (and only that array — leave `BLIND_DEFS`, `ANTE_BASE_TARGETS`, `targetForBlind`, `blindDefAt`, `pickBoss` intact):

```ts
export const BOSS_BLINDS: BossBlind[] = [
  { id: 'pluto', name: 'Pluto', icon: '🐍', color: '#44bb66',
    description: 'Demoted. 1s refuse to transform.', debuffs: ['no_mod_transforms_on_ones'],
    sigil: {
      viewBox: '0 0 100 100',
      paths: [
        // TODO art pass — sigil designed for tarot name "The Serpent"
        'M 20 20 Q 50 10 80 30 Q 90 60 60 70 Q 30 75 20 50 Q 25 30 50 30',
        'M 50 30 L 50 50',
        'M 35 80 L 65 80',
      ],
    },
  },
  { id: 'ceres', name: 'Ceres', icon: '🃏', color: '#ffaa44',
    description: 'Belt-bound. Hand capped at 4.', debuffs: ['hand_size_cap_4'],
    sigil: {
      viewBox: '0 0 100 100',
      paths: [
        // TODO art pass — sigil designed for tarot name "The Fool"
        'M 50 10 L 90 80 L 10 80 Z',
        'M 50 30 L 50 65',
        'M 30 75 L 70 75',
      ],
    },
  },
  { id: 'triton', name: 'Triton', icon: '🏰', color: '#aa6644',
    description: 'Single flyby. No rerolls.', debuffs: ['no_rerolls'],
    sigil: {
      viewBox: '0 0 100 100',
      paths: [
        // TODO art pass — sigil designed for tarot name "The Tower"
        'M 25 90 L 25 30 L 75 30 L 75 90',
        'M 35 30 L 35 90 M 50 30 L 50 90 M 65 30 L 65 90',
        'M 20 30 L 80 30 L 75 20 L 25 20 Z',
        'M 40 10 L 50 0 L 60 10 Z',
      ],
    },
  },
  { id: 'phobos', name: 'Phobos', icon: '👹', color: '#cc2244',
    description: 'Orbit decays. Locks release on roll.', debuffs: ['auto_unlock_after_roll'],
    sigil: {
      viewBox: '0 0 100 100',
      paths: [
        // TODO art pass — sigil designed for tarot name "The Devil"
        'M 50 8 L 90 78 L 10 78 Z',
        'M 50 92 L 10 22 L 90 22 Z',
        'M 50 35 L 50 65 M 35 50 L 65 50',
      ],
    },
  },
  { id: 'callisto', name: 'Callisto', icon: '⚜', color: '#aa66ff',
    description: 'Cratered silence. Catalysts inert.', debuffs: ['disable_catalysts'],
    sigil: {
      viewBox: '0 0 100 100',
      paths: [
        // TODO art pass — sigil designed for tarot name "The High Priestess"
        'M 50 10 a 40 40 0 1 0 0 80 a 40 40 0 1 0 0 -80',
        'M 30 50 a 20 20 0 1 0 40 0 a 20 20 0 1 0 -40 0',
        'M 50 22 L 50 78 M 22 50 L 78 50',
      ],
    },
  },
];
```

- [ ] **Step 2: Build + test**

```bash
npm run build
npm test
```
Expected: green. The boss-debuff strings now match the renamed Debuff union from Task 6.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(retheme): rename bosses to Pluto/Ceres/Triton/Phobos/Callisto"
```

---

## Task 10: Rename consumable type union + entries

**Files:**
- Modify: `src-next/core/consumables/index.ts`
- Modify: `src-next/app/hud/LoadoutDock.tsx`
- Modify: `src-next/app/screens/Shop.tsx`

- [ ] **Step 1: Rewrite `core/consumables/index.ts`**

Keep `apply` bodies (mechanics unchanged); rewrite ids, names, type union:

```ts
import type { GameState } from '../../state/store';
import type { GameEventEmission } from '../../events/types';

export type ConsumableDef = {
  id: string;
  type: 'calibration' | 'resource';
  name: string;
  icon: string;
  description: string;
  requiresTarget: boolean;
  targetType?: 'die' | 'catalyst';
  apply: (s: GameState, targets: number[]) => { state: GameState; events: GameEventEmission[] };
};

export const CONSUMABLES: ConsumableDef[] = [
  {
    id: 'pin_six',
    type: 'calibration',
    name: 'Pin Six',
    icon: '☽',
    description: 'Set one die to face 6.',
    requiresTarget: true,
    targetType: 'die',
    apply: (s, [idx]) => {
      if (idx == null || !s.round.dice[idx]) return { state: s, events: [] };
      const dice = s.round.dice.map((d, i) => (i === idx ? { ...d, face: 6 } : d));
      return { state: { ...s, round: { ...s.round, dice } }, events: [] };
    },
  },
  {
    id: 'pin_one',
    type: 'calibration',
    name: 'Pin One',
    icon: '☀',
    description: 'Set one die to face 1.',
    requiresTarget: true,
    targetType: 'die',
    apply: (s, [idx]) => {
      if (idx == null || !s.round.dice[idx]) return { state: s, events: [] };
      const dice = s.round.dice.map((d, i) => (i === idx ? { ...d, face: 1 } : d));
      return { state: { ...s, round: { ...s.round, dice } }, events: [] };
    },
  },
  {
    id: 'shard_drop',
    type: 'resource',
    name: 'Shard Drop',
    icon: '◇',
    description: '+5 shards.',
    requiresTarget: false,
    apply: (s) => ({
      state: { ...s, run: { ...s.run, shards: s.run.shards + 5 } },
      events: [],
    }),
  },
  {
    id: 'roll_token',
    type: 'resource',
    name: 'Roll Token',
    icon: '◈',
    description: '+1 hand.',
    requiresTarget: false,
    apply: (s) => ({
      state: { ...s, round: { ...s.round, handsLeft: s.round.handsLeft + 1 } },
      events: [],
    }),
  },
];

export function lookupConsumable(id: string): ConsumableDef | undefined {
  return CONSUMABLES.find((c) => c.id === id);
}
```

(Note: `targetType: 'oracle'` would be stale if any consumable used it; in current data none do, but the union is updated anyway.)

- [ ] **Step 2: Update `LoadoutDock.tsx` accent check**

Replace `const accent = def.type === 'tarot' ? '#cc88ff' : '#f5c451';` with `const accent = def.type === 'calibration' ? '#cc88ff' : '#f5c451';`.

- [ ] **Step 3: Update `Shop.tsx` offerMeta**

Replace `color: c?.type === 'tarot' ? '#cc88ff' : '#7be3ff',` with `color: c?.type === 'calibration' ? '#cc88ff' : '#7be3ff',`.

Replace `kindLabel: c?.type ?? 'tarot',` with `kindLabel: c?.type ?? 'calibration',`.

- [ ] **Step 4: Build + test**

```bash
npm run build
npm test
```
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(retheme): rename consumables to Pin/Shard Drop/Roll Token + calibration/resource types"
```

---

## Task 11: Rewrite vendor lines

**Files:**
- Modify: `src-next/data/vendor-lines.ts`

- [ ] **Step 1: Replace vendor-lines.ts contents**

Replace entirely:

```ts
type Kind = 'catalyst' | 'voucher' | 'consumable';

const LINES: Record<Kind | 'default', string[]> = {
  catalyst: [
    "Bias the curve.",
    "Hot tip — the catalyst remembers.",
    "Tilt the table. Quietly.",
  ],
  voucher: [
    "Brass tokens. Bureaucratic. Useful.",
    "Permit's good through end of run.",
  ],
  consumable: [
    "Single use. Plan twice.",
    "Spend it once. Spend it well.",
  ],
  default: [
    "House doesn't refund.",
  ],
};

export function vendorLine(kind?: string): string {
  const arr = LINES[(kind as Kind) ?? 'default'] ?? LINES.default;
  return arr[Math.floor(Math.random() * arr.length)]!;
}
```

- [ ] **Step 2: Find vendorLine callers and confirm `kind` arg matches new keys**

Run Grep:
- pattern: `vendorLine\\(`
- path: `src-next/`

Expected: callers pass `'oracle'`, `'voucher'`, or `'consumable'`. The `'oracle'` callers must now pass `'catalyst'`. Update them.

- [ ] **Step 3: Build + test**

```bash
npm run build
npm test
```
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(retheme): rewrite vendor lines + key 'oracle' -> 'catalyst'"
```

---

## Task 12: Rewrite player-facing copy in screens + HUD

**Files:**
- Modify: `src-next/app/screens/Title.tsx`
- Modify: `src-next/app/screens/Hub.tsx`
- Modify: `src-next/app/screens/Forge.tsx`
- Modify: `src-next/app/screens/Shop.tsx`
- Modify: `src-next/app/hud/AstralHint.tsx` (rename in Task 14? No — copy only here)
- Modify: `src-next/app/hud/BossReveal.tsx`
- Modify: `src-next/app/hud/ScoreMoment.tsx`

- [ ] **Step 1: Title.tsx tagline**

Replace `◇ a roguelike of dice and divination ◇` with `◇ the gambler's fallacy, weaponized ◇`.

Leave the `Begin Ascension` button text and `seed ⟨LYRA-VII⟩` version line unchanged.

- [ ] **Step 2: Hub.tsx heading + sub-copy**

Replace `The Tribunal of Stars` with `Star Atlas`.

Replace `Three blinds bar your ascension. Each cleared blind grants shards and admittance to the Bazaar.` with `Three blinds gate the run. Clear them for shards and shop access.`

Replace `◇ choose your trial ◇` with `◇ choose your blind ◇` (drop "trial" — feels mystical).

- [ ] **Step 3: Forge.tsx sub-tagline**

Replace `◇ etch the cosmos ◇` with `◇ etch a mod ◇`. Keep `The Star Forge` heading.

- [ ] **Step 4: Shop.tsx sub-tagline + heading**

Replace `◇ between the stars ◇` with `◇ exchange ◇`.

Keep `The Celestial Bazaar` (celestial = grounded astronomy term, not banned). If user later wants a swap, easy follow-up. (The spec accepts this.)

- [ ] **Step 5: AstralHint.tsx label + body**

Edit:
- `◇ astral hint` → `◇ tip`
- Body `Click any die to lock it for the next roll. Highlighted dice form a constellation — your scoring pattern.` → `Click any die to lock for the next roll. Highlighted dice mark the scoring pattern — Lyra, Orion, etc.`

(Filename rename from `AstralHint.tsx` to `Tip.tsx` is optional — leaving the file name as-is keeps git history simpler. The user-facing label is what matters. The component export name `AstralHint` is internal; keep it for now.)

- [ ] **Step 6: BossReveal.tsx labels**

- Replace `arcanum` with `anomaly` (one occurrence in JSX).
- Replace `hex` (label above the description) with `effect`.
- Note: the description text `"{def.description}"` displays the new planet-name flavor automatically.

- [ ] **Step 7: ScoreMoment.tsx constellation polish**

Edit `CONSTELLATION_NAMES`:
- `LG_STRAIGHT: 'The Lyre',` → `LG_STRAIGHT: 'Lyra',`

Other entries unchanged.

- [ ] **Step 8: Build + test**

```bash
npm run build
npm test
```
Expected: green.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(retheme): rewrite player-facing copy in screens + HUD"
```

---

## Task 13: CSS / Tailwind token rename `astral` → `vector`

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src-next/styles/index.css`
- Modify: `src-next/app/hud/ScorePanel.tsx`
- Modify: `src-next/devtools/EventLogger.tsx`

- [ ] **Step 1: Update Tailwind config**

Edit `tailwind.config.ts`. Replace:
```ts
astral:  '#7be3ff',
```
with:
```ts
vector:  '#7be3ff',
```

(Hex unchanged.)

- [ ] **Step 2: Update CSS variable**

Edit `src-next/styles/index.css`. Replace `--astral:#7be3ff;` with `--vector:#7be3ff;`. Replace any `var(--astral)` references with `var(--vector)` (lines 83 and 101 from earlier inventory).

- [ ] **Step 3: Find all `text-astral` / `bg-astral` / `ring-astral` usages**

Run Grep:
- pattern: `\\b(text|bg|ring|border)-astral\\b`
- path: `src-next/`

Expected hits: `src-next/app/hud/ScorePanel.tsx`, `src-next/devtools/EventLogger.tsx`, possibly more.

- [ ] **Step 4: Replace each usage**

Use targeted Edit to swap `*-astral` → `*-vector` in each file the Grep returned.

- [ ] **Step 5: Build + dev smoke**

```bash
npm run build
```
Expected: build green.

```bash
npm run dev
```
Open the localhost URL. Confirm no broken styling on screens that used `text-astral` (top-bar score panel, devtools logger).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(retheme): rename Tailwind/CSS token astral -> vector"
```

---

## Task 14: Save migrator + unit test

**Files:**
- Create: `src-next/state/migrations/v1_retheme.ts`
- Create: `src-next/state/migrations/v1_retheme.test.ts`
- Modify: `src-next/state/persistence.ts`

- [ ] **Step 1: Create migrator**

Create `src-next/state/migrations/v1_retheme.ts`:

```ts
const CATALYST_ID_MAP: Record<string, string> = {
  the_oracle: 'stratifier',
  prophet: 'six_bias',
  fools_fortune: 'twin_sample',
  silver_tongue: 'cold_hand',
  entropy_stone: 'entropy_index',
  // chaos_theory unchanged
};

const MOD_ID_MAP: Record<string, string> = {
  snake_cult: 'snake_eyes',
  blessed: 'backstop',
};

const VOUCHER_ID_MAP: Record<string, string> = {
  astral_plane: 'bench',
};

const CONSUMABLE_ID_MAP: Record<string, string> = {
  the_moon: 'pin_six',
  the_sun: 'pin_one',
  shard_strike: 'shard_drop',
  the_world: 'roll_token',
};

const CONSUMABLE_TYPE_MAP: Record<string, string> = {
  tarot: 'calibration',
  spectral: 'resource',
};

const BOSS_ID_MAP: Record<string, string> = {
  the_serpent: 'pluto',
  the_fool: 'ceres',
  the_tower: 'triton',
  the_devil: 'phobos',
  the_high_priestess: 'callisto',
};

export function migrateRetheme(saved: any): any {
  if (!saved || typeof saved !== 'object') return saved;
  const next = { ...saved };

  // run.oracles -> run.catalysts
  if (next.run && Array.isArray(next.run.oracles) && !Array.isArray(next.run.catalysts)) {
    next.run = {
      ...next.run,
      catalysts: next.run.oracles.map((id: string) => CATALYST_ID_MAP[id] ?? id),
    };
    delete next.run.oracles;
  }

  // run.vouchers — id remap
  if (next.run && Array.isArray(next.run.vouchers)) {
    next.run = {
      ...next.run,
      vouchers: next.run.vouchers.map((id: string) => VOUCHER_ID_MAP[id] ?? id),
    };
  }

  // run.consumables — id remap
  if (next.run && Array.isArray(next.run.consumables)) {
    next.run = {
      ...next.run,
      consumables: next.run.consumables.map((id: string) => CONSUMABLE_ID_MAP[id] ?? id),
    };
  }

  // round.diceRunes -> round.diceMods
  if (next.round && Array.isArray(next.round.diceRunes) && !Array.isArray(next.round.diceMods)) {
    next.round = {
      ...next.round,
      diceMods: next.round.diceRunes.map((arr: string[]) =>
        arr.map((id) => MOD_ID_MAP[id] ?? id),
      ),
    };
    delete next.round.diceRunes;
  }

  // round.blindId — boss id remap (only if it matches a known old id)
  if (next.round && typeof next.round.blindId === 'string' && BOSS_ID_MAP[next.round.blindId]) {
    next.round = { ...next.round, blindId: BOSS_ID_MAP[next.round.blindId] };
  }

  return next;
}
```

- [ ] **Step 2: Create unit test**

Create `src-next/state/migrations/v1_retheme.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { migrateRetheme } from './v1_retheme';

describe('migrateRetheme', () => {
  it('returns input unchanged for null/undefined', () => {
    expect(migrateRetheme(null)).toBe(null);
    expect(migrateRetheme(undefined)).toBe(undefined);
  });

  it('renames run.oracles -> run.catalysts and remaps ids', () => {
    const old = {
      run: {
        oracles: ['the_oracle', 'prophet', 'chaos_theory'],
        vouchers: ['astral_plane'],
        consumables: ['the_moon', 'shard_strike'],
      },
    };
    const m = migrateRetheme(old);
    expect(m.run.catalysts).toEqual(['stratifier', 'six_bias', 'chaos_theory']);
    expect(m.run.oracles).toBeUndefined();
    expect(m.run.vouchers).toEqual(['bench']);
    expect(m.run.consumables).toEqual(['pin_six', 'shard_drop']);
  });

  it('renames round.diceRunes -> round.diceMods and remaps mod ids', () => {
    const old = {
      round: {
        diceRunes: [['snake_cult', 'amplify'], ['blessed'], []],
      },
    };
    const m = migrateRetheme(old);
    expect(m.round.diceMods).toEqual([['snake_eyes', 'amplify'], ['backstop'], []]);
    expect(m.round.diceRunes).toBeUndefined();
  });

  it('remaps boss blindId', () => {
    const m = migrateRetheme({ round: { blindId: 'the_devil' } });
    expect(m.round.blindId).toBe('phobos');
  });

  it('leaves new-shape data alone (idempotent)', () => {
    const fresh = {
      run: { catalysts: ['stratifier'], vouchers: ['bench'], consumables: ['pin_six'] },
      round: { diceMods: [['amplify']] },
    };
    expect(migrateRetheme(fresh)).toEqual(fresh);
  });

  it('preserves unknown ids verbatim', () => {
    const old = { run: { oracles: ['unknown_oracle'], vouchers: [], consumables: [] } };
    const m = migrateRetheme(old);
    expect(m.run.catalysts).toEqual(['unknown_oracle']);
  });
});
```

- [ ] **Step 3: Run the test, expect FAIL on first run**

```bash
npx vitest run src-next/state/migrations/v1_retheme.test.ts
```

Expected: tests pass on first run because the migrator is already implemented. (This is a refactor migrator, not TDD on logic — the test exists to lock behavior, not to drive design.)

If a test fails, fix the migrator. Re-run until green.

- [ ] **Step 4: Wire migrator into `persistence.ts`**

Edit `src-next/state/persistence.ts`. Add import:

```ts
import { migrateRetheme } from './migrations/v1_retheme';
```

Update `loadSaved`:

```ts
export function loadSaved(): SavedState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return migrateRetheme(parsed) as SavedState;
  } catch {
    return null;
  }
}
```

(Migrator is idempotent — running it on already-migrated data is a no-op.)

- [ ] **Step 5: Build + run all tests**

```bash
npm run build
npm test
```
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(retheme): save migrator for retheme rename + unit test"
```

---

## Task 15: Final sweep + visual smoke + cleanup

**Files:** none (verification only, plus comment cleanup)

- [ ] **Step 1: Sweep for remaining banned words**

Run Grep over `src-next/`:
- pattern: `\\b(blessing|curse|fate|destiny|omen|invoke|ritual|divination|prophecy|arcane|mystic|sacred|hex)\\b`
- output_mode: `content`
- `-i`: true

Expected: only matches in dev-only comments (e.g. boss SVG `// TODO art pass — sigil designed for tarot name "The Tower"`). No matches in player-facing strings or active type names.

If a player-facing match is found, edit it.

- [ ] **Step 2: Sweep for stale `oracle`/`rune`/`astral` references**

Run Grep over `src-next/` for each:
- `\\boracle\\b` — should hit only `astral_plane→bench` already done, leftover comments, or maybe `targetType?: 'oracle'` (now `'catalyst'` after Task 10).
- `\\brune\\b` — should hit only TODO comments or filenames in tests if any. Should not hit active code.
- `\\bastral\\b` — should hit only the TODO comments and leaderboard `'Wanderer'` default. (`Wanderer` is fine.)

Fix any active-code stragglers.

- [ ] **Step 3: Re-run full test suite**

```bash
npm test
```
Expected: green.

- [ ] **Step 4: Build production bundle**

```bash
npm run build
```
Expected: succeeds with no warnings about missing imports.

- [ ] **Step 5: Visual dev smoke**

```bash
npm run dev
```

Open `http://localhost:5173` (or whatever port Vite reports). Walk through:

1. **Title screen** — confirm tagline reads "the gambler's fallacy, weaponized". Begin Ascension button works.
2. **Hub screen** — heading reads "Star Atlas". Sub-copy mentions blinds + shop, no "ascension". Three blind cards render with normal names ("Small Blind", "Big Blind", "Boss Blind").
3. **Round screen** — Tip overlay reads "◇ tip" with body referencing "Lyra, Orion, etc." Catalyst strip (top-left) shows nothing initially. Lock a die, roll, score — no `text-astral` color regression on score panel.
4. **Score animation** — large straight should display "Lyra" not "The Lyre".
5. **Forge screen** — sub-tagline reads "◇ etch a mod ◇". Right panel reads "◈ mod codex". Snake Eyes / Backstop entries visible. Attaching/detaching mods works.
6. **Shop screen** — sub-tagline reads "◇ exchange ◇". Offer cards show "catalyst" / "voucher" / "calibration" / "resource" labels (not "oracle" / "tarot" / "spectral").
7. **Boss reveal** — trigger by reaching a boss blind. Confirm "boss blind" / "anomaly NN · ante N" / "effect" labels and a planet/moon name (Pluto/Ceres/Triton/Phobos/Callisto) with description.
8. **localStorage migration** — open devtools, set localStorage `ff_next_save` to a hand-crafted old payload:
   ```json
   {"run":{"oracles":["the_oracle","prophet"],"vouchers":["astral_plane"],"consumables":["the_moon"],"shards":10,"ante":1,"goalIdx":0,"seed":1},"round":{"active":false,"diceRunes":[["snake_cult"],[],[],[],[]]},"meta":{"playerName":"test","highScores":[]},"ui":{"screen":"title"}}
   ```
   Reload. Confirm the run state shows catalysts: stratifier, six_bias; voucher: bench; consumable: pin_six; mods: snake_eyes. (Use devtools to inspect Zustand state.)

- [ ] **Step 6: Remove placeholder TODO comments if user prefers**

(Optional.) The `// TODO art pass — sigil designed for tarot name "X"` comments in `data/blinds.ts` are intentional flags for the future art pass, per spec. Leave them.

- [ ] **Step 7: Final commit (only if any cleanup happened)**

If Step 1 or 2 found stragglers and you fixed them:

```bash
git add -A
git commit -m "refactor(retheme): final sweep cleanup"
```

If no stragglers, skip — no empty commit.

- [ ] **Step 8: Push (if user requests)**

`git push` is intentionally NOT in this plan. The user pushes when ready.

---

## Self-Review

**1. Spec coverage:**

- ✅ System renames (Oracle→Catalyst, Rune→Mod, Arcanum→Anomaly, Astral→Vector) — Tasks 1-7, 12, 13.
- ✅ Verb sweep — covered in copy rewrites (Task 12) + sweep (Task 15).
- ✅ Combo polish (The Lyre→Lyra) — Task 12 step 7.
- ✅ Catalyst entry rewrites with flavor — Tasks 4, 5.
- ✅ Mod entry renames (Snake Cult→Snake Eyes, Blessed→Backstop) — Task 1.
- ✅ Voucher rename (Astral Plane→Bench) — Task 8.
- ✅ Consumable type union + entry rename — Task 10.
- ✅ Boss anomalies (planets/moons) + descriptions — Task 9.
- ✅ Sigil orphan placeholder + TODO comments — Task 9.
- ✅ Title tagline — Task 12.
- ✅ Hub heading — Task 12.
- ✅ Forge sub-tagline + counters — Tasks 7, 12.
- ✅ Shop sub-tagline — Task 12.
- ✅ HUD strings (AstralHint, BossReveal, ScoreMoment) — Task 12.
- ✅ Vendor lines — Task 11.
- ✅ Tailwind / CSS token rename — Task 13.
- ✅ Save migrator + test — Task 14.
- ✅ Acceptance criteria smoke test — Task 15.

Note: catalyst flavor text from the spec ("Three plus two. The shape pays.", etc.) is NOT applied in the data — `CatalystMeta` only has `desc` (the mechanical effect). Adding flavor would require either an extra `flavor?: string` field or replacing `desc`. The spec presents flavor as optional. **Decision:** add an optional `flavor` field to `CatalystMeta` AND populate per-spec — see the addendum below.

**ADDENDUM TO TASK 4 (apply during Task 4 Step 3):** Add a `flavor?: string` field to `CatalystMeta` and populate:

```ts
export type CatalystMeta = {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  flavor?: string;
  rarity: 'common' | 'uncommon' | 'rare';
};

export const CATALYST_META: CatalystMeta[] = [
  { id: 'stratifier',     name: 'Stratifier',     icon: '👁',  color: '#cc88ff',
    desc: 'Full House → Mult ×2',          flavor: 'Three plus two. The shape pays.', rarity: 'uncommon' },
  { id: 'chaos_theory',   name: 'Chaos Theory',   icon: '∞',   color: '#44ddff',
    desc: 'Straights → +5 Mult',           flavor: 'Order from disorder. +5 for the trick.', rarity: 'uncommon' },
  { id: 'six_bias',       name: 'Six Bias',       icon: '📈',  color: '#b088ff',
    desc: 'Each 6 → +4 Chips',             flavor: 'Instrument loaded. Top of range pays.', rarity: 'common'   },
  { id: 'twin_sample',    name: 'Twin Sample',    icon: '🔢',  color: '#ff9944',
    desc: 'Two Pair → Chips ×2',           flavor: 'Both samples agree. Confidence doubled.', rarity: 'uncommon' },
  { id: 'cold_hand',      name: 'Cold Hand',      icon: '💬',  color: '#c0c8ff',
    desc: 'Chance → +4 Mult',              flavor: "No pattern? The book says you're due. The book is wrong, but you score anyway.", rarity: 'common'   },
  { id: 'entropy_index',  name: 'Entropy Index',  icon: '◈',   color: '#a080c0',
    desc: 'Each unique face → ×1.25 Mult', flavor: 'Variety paid in compounding interest.', rarity: 'rare'    },
];
```

The `flavor` field is currently unused by HUD/Shop. Wiring it into the tooltip (`<span className="tip">{c.name} — {c.desc}</span>` in `LoadoutDock`) is **out of scope** for this plan — leave it as data and surface it in a later UI tweak if the user wants it. This matches the spec's stance ("Optional flavor text").

**2. Placeholder scan:** No `TBD`/`TODO` in plan content. The intentional `// TODO art pass` comments in source code are explicit deferrals per spec, not plan placeholders.

**3. Type consistency:**
- `lookupMod` (Task 1) used in Tasks 2, 7. ✅
- `lookupCatalyst` (Task 4) used in Task 7. ✅
- `selectCatalysts` (Task 6) used in Task 7. ✅
- `MAX_MOD_SLOTS` (Task 1) — referenced in `core/runes/index.ts` originally; check if anything imports it. Not currently imported (Forge.tsx uses `maxModSlots` from vouchers). ✅
- Action type names `ATTACH_MOD`/`DETACH_MOD` (Task 3) consistent with handler usage (Task 3). ✅
- `ShopOffer.kind` `'catalyst'` (Task 6 Step 7) matches `kind: 'catalyst' as const` in Task 6 Step 6 and `if (kind === 'catalyst')` in Task 7 Step 8. ✅

No drift detected.

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-04-28-grounded-constellation-retheme.md`.
