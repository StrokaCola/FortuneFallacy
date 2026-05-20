# Void Mode — Procgen Affixed Upgrades

## Context

FortuneFallacy2 is a Balatro-style dice roguelike with ~50 hand-authored catalysts (modifier cards), hand-authored consumables (vouchers/galaxies/spectrals), and 8 hand-authored constellations. All content is static TypeScript data files. The seeded Mulberry32 RNG drives shop draws and voidstorm selection but never *generates* content — it only picks from authored lists.

This spec introduces **Void Mode**: a hidden alternate run mode entered by clicking a faint black hole on the title screen. In Void Mode, every catalyst and consumable that appears in the run carries 1–3 procedurally generated affixes (prefix/suffix tags that modify base behavior). The intent is to multiply the effective content pool from ~50 base items into thousands of distinct rolled variants, giving returning players persistent novelty without forcing the team to hand-author more upgrades.

The fiction frames Void Mode as the gambler glimpsing past the curtain of probability — items in this timeline are warped, rewritten, occasionally cursed. Strictly ephemeral: nothing persists between Void runs except a daily "certified" seed used for leaderboard parity.

---

## Player-facing summary

- Faint, always-visible black hole on title screen. Slow rotation, gravitational lensing distortion over the starfield. Click → screen-warp dissolve → Void Mode title card.
- Void Mode plays like normal Lyra (default constellation), 4 antes, standard shop loop — but every catalyst and consumable rolled in the shop carries procgen affixes: extra effects, drawbacks, scaling riders, conditional triggers, rule warps.
- Items display generated names: `[Prefix] [Base name] [of Suffix]` (e.g. *Cracked Burst-Card of Sundering*).
- Aesthetic shift: violet/black accent palette (vs gold), accretion-disk ambient texture behind play area, one extra drone audio layer.
- HUD corner shows seed + run alias (e.g. "Echo 17"). Affix budget hidden — players infer power level from rarity color. (Void *tier* is v1-fixed at 1; tier escalation deferred to Phase 2.)
- Daily "certified seed" — single pre-sim-validated seed per UTC day, used for daily leaderboard. All other seeds are "wild" — variance accepted as feature.
- Nothing persists between Void runs. No codex, no inscription, no carry-over.

---

## Scope

### In scope (v1)

- Title-screen black hole rendering + click handler
- Void Mode entry flow + run state flag
- Affix data model (`AffixDef`, `AffixedItem`)
- Affix generator (seeded, budget-bounded)
- ~60 affix definitions at launch (12 scalar / 12 conditional / 8 persistent / 10 drawback / 10 synergy / 8 reality-warp)
- Naming generator (prefix/suffix pools + flavor templates)
- Affixed catalyst integration into existing scoring pipeline
- Affixed consumable integration (vouchers, galaxies, spectrals)
- Void-Mode tint overlay + accretion ambient on play scene
- One added Tone.js drone layer for Void Mode
- Daily certified seed mechanism + leaderboard category
- Lyra constellation support only

### Out of scope (v1)

- All other constellations (Mensa, Triumvirate, Argo, Fibonacci, Eclipse, Ophiuchus, Spark) — Phase 2
- Affixed blinds (trials/bosses) — Phase 2
- Codex / persistent affix sightings
- Inscription / carry-over to normal mode
- Recursive affixes, genetic catalysts, collapse mechanic, named-legend registry
- Procedural boss sigils
- Affixed dice faces (Forge integration)
- Tutorial/coachmarks for Void Mode (cold drop)
- Mobile-specific UI tuning beyond inherited responsive layout

---

## Architecture

### High-level data flow

```
Title screen
    └─ BlackHole component (renders) ─ click ─> startVoidRun(seed)
                                                    │
                                                    ▼
                                          RunStore { mode: 'void', voidSeed, voidTier }
                                                    │
              ┌─────────────────────────────────────┤
              ▼                                     ▼
       Shop draw                            Aesthetic layer
              │                                     │
              ▼                                     ▼
   catalystDraw + affixGenerator        VoidOverlay renders tint + accretion
              │                                     │
              ▼                                     ▼
       AffixedItem { base, affixes[], displayName, flavor }
              │
              ▼
   Scoring pipeline (existing phases)
              │
              ▼
   applyAffixes() phase runs alongside base catalyst effects
```

### Key new modules

| Path | Purpose |
|------|---------|
| `src-next/voidmode/affixes.ts` | The 60+ `AffixDef` records. Each declares family, budget cost, archetype gates, effect fn, name template, flavor pool. |
| `src-next/voidmode/affixGenerator.ts` | Seeded generator. Inputs: base item, RNG, budget. Outputs: `AffixedItem`. Respects archetype gates + slot rules. |
| `src-next/voidmode/nameGenerator.ts` | Prefix/suffix pools + Mythic mid-name slot. Pulls flavor fragments matched to affix tags. |
| `src-next/voidmode/voidRun.ts` | Void run lifecycle: entry, seed handling, tier resolution, exit. |
| `src-next/voidmode/dailySeed.ts` | UTC-day → seed mapping + certified-seed registry (manually populated post-sim). |
| `src-next/voidmode/balanceSim.ts` | Wraps existing sim harness; runs candidate-affixed items through k trials, filters out-of-band. Used pre-launch to validate the daily certified seed. |
| `src-next/components/BlackHole/BlackHole.tsx` | Title-screen render. 2D SVG lensing shader. Click handler. |
| `src-next/components/VoidOverlay/VoidOverlay.tsx` | Tint + accretion ambient overlay on play scene when `mode === 'void'`. |
| `src-next/audio/voidLayer.ts` | Single Tone.js drone stem, faded in on void run start. |

### Modified files

| Path | Change |
|------|--------|
| `src-next/data/catalysts.ts` | Add `archetypeTags` field to each catalyst (already partially tagged — extend) so affix gates can filter. |
| `src-next/core/shop/catalystDraw.ts` | When `mode === 'void'`, route shop catalysts through `affixGenerator`. |
| `src-next/core/consumables/*` | Same — wrap consumable rolls through generator when void. |
| `src-next/core/phases/` | Add `applyAffixes` phase before `combo detection`, after `face-read`. Runs each affixed item's affix effect fns. |
| `src-next/state/runStore.ts` (Zustand) | Add `mode: 'normal' \| 'void'`, `voidSeed`, `voidTier`, `dailyCertified: boolean`. |
| `src-next/components/TitleScreen.tsx` | Mount `<BlackHole />`. |
| `src-next/components/PlayScene.tsx` | Mount `<VoidOverlay />` when `mode === 'void'`. |
| `src-next/audio/index.ts` | Load + manage void drone layer. |
| `src-next/leaderboard/categories.ts` | Add `"void-daily"` category keyed on certified-seed-of-day. |

---

## Affix data model

```ts
type AffixFamily = 'scalar' | 'conditional' | 'persistent' | 'drawback' | 'synergy' | 'reality-warp';
type AffixSlot = 'prefix' | 'suffix';
type ArchetypeTag = 'combo' | 'face' | 'economy' | 'scaling' | 'mods' | 'timing' | 'utility' | 'collision' | 'risk';

interface AffixDef {
  id: string;                            // 'cracked', 'of-sundering', 'eternal', ...
  slot: AffixSlot;
  family: AffixFamily;
  budgetCost: number;                    // 1..5 positive, or negative for drawbacks (-2 typical)
  validOn: ArchetypeTag[];               // gate
  blockedOn?: ArchetypeTag[];            // optional negative gate
  weight: number;                        // RNG weight inside family
  nameTemplate: string;                  // 'Cracked', 'of Sundering'
  flavorTags: string[];                  // ['heat','decay'] — name-gen matches
  effect: (ctx: AffixContext) => void;   // mutates scoring state
}

interface AffixedItem<T> {
  base: T;                               // existing Catalyst | Consumable
  affixes: AffixDef[];                   // 1..3
  displayName: string;                   // generated
  flavor: string;                        // generated
  budgetSpent: number;
  rarityTier: 'normal' | 'magic' | 'rare' | 'mythic';
}
```

### Budget rules

- Item budget by base rarity: `common: 4`, `uncommon: 6`, `rare: 8`, `legendary: 10`, `mythic: 14`.
- Generator picks affixes until remaining budget < smallest affix cost in remaining valid pool.
- Slot limit: max 1 prefix + 1 suffix for non-Mythic. Mythic gets a mid-name slot (1 prefix + 1 mid + 1 suffix). 3 affixes max.
- Family limit: max 1 drawback per item. A drawback has *negative* budget cost (e.g. `-2`) — taking one **adds** 2 points to the remaining pool, letting a stronger upside affix fit alongside. Drawback is optional; generator decides per item by RNG roll weighted on rarity.

### Archetype gates (sample)

- `family: 'scalar'` + `affects: chips` → only valid on `validOn: ['combo','face','scaling']`
- `family: 'drawback'` + `affects: discards` → blocked on `economy` (economy already cares about discards, double-up not interesting)
- `family: 'reality-warp'` → max 1 per shop refresh (rare, expensive — 5 budget)

---

## Affix families — 60+ at launch

Inventory targets per family (rough — final list during impl):

### Scalar (12)
- "+X% chips on Pair" / "Two Pair" / "Three of a Kind" / "Straight" / "Flush" / "Full House" / "Four of a Kind" / "Straight Flush"
- "+X mult per discard remaining"
- "+X mult per hand remaining"
- "+X chips per dollar held / 10"
- "+X mult per catalyst owned"

### Conditional (12)
- "On Wild roll: +5 mult this hand"
- "Every 3rd activation: triggers twice"
- "First combo each ante: free / +50%"
- "On Blank face: refund 1 die roll"
- "On boss blind: +X% mult"
- "After 5 rolls this trial: +X chips permanent for trial"
- "On reroll: keep one face value as Wild"
- "On exact combo target: +X gold"
- "Whenever discards used: +1 chip per disc"
- "On consecutive identical rolls: +mult"
- "If your hand size is even / odd: +X"
- "On trial start: deal 1 extra die that vanishes after first roll"

### Persistent (8)
- "Stores 1 mult per discard used; pays out at boss"
- "Stores 1 chip per face read; pays out on full house"
- "Counter increments per ante; +X mult × counter"
- "Banks unused rolls; spends at +X gold each next shop"
- "Echo: at trial end, re-fires last triggered combo bonus once"
- "Memory: remembers strongest combo this ante, adds 25% next ante"
- "Phase: every 2 trials, swaps prefix↔suffix effects"
- "Shadow: copies the lowest-tier catalyst's effect at half strength"

### Drawback (10)  — negative budget cost (refund 2)
- "+50% mult / -20% chips"
- "Triggers double / disables after 5 uses"
- "Free reroll once per ante / disables on full house"
- "+X mult / costs 1 die for the trial"
- "Doubles next combo / next combo can't be straight"
- "Cuts shop prices 25% / no rerolls in shop"
- "Refunds discards / disables consumables this ante"
- "+X mult / lose 1 random face from random die after each trial"
- "+X chips / -X gold every ante"
- "Free at shop / curses one other catalyst with random debuff"

### Synergy (10)
- "If you own another Cosmic catalyst: +X"
- "Stacks with Fibonacci catalysts: each adds 10% to this"
- "If you own a drawback-affixed catalyst: this triggers twice"
- "If all your dice are non-standard (forged): +X mult"
- "If hand contains the seed digit: +X chips" (cute seed-aware affix)
- "For each consumable held: +1 mult"
- "If shop reroll count > 3 this ante: +X"
- "If you've used 0 discards this trial: +X mult"
- "If you've used 0 hands this trial except this one: +X chips × 5"
- "For each affix on this item beyond the first: +5% chips" (recursive-flavored without recursion)

### Reality-warp (8) — rare, 5 budget
- "Wild dice count as 0 chips but +5 mult"
- "Discards refund money equal to dice value × 2"
- "On boss: skip Second Wind once"
- "Treat one Pair as Three of a Kind for scoring"
- "Inverts all chip/mult priorities for one combo per trial"
- "Re-rolls a random face on every die at trial start"
- "On entering shop: get one Mythic-rarity offer slot at full cost"
- "Combos with adjacent face values count as Straight"

---

## Naming generator

### Prefix pool (sample, ~20)
Cracked, Sundered, Eternal, Hollow, Twilit, Sealed, Burning, Hungering, Whispering, Echoing, Frayed, Wandering, Spectral, Murmuring, Bleak, Phasing, Knotted, Coiled, Drowned, Misremembered

### Suffix pool (sample, ~20)
of the Void, of Echoes, of Hunger, of the Eclipse, of Memory, of Sundering, of the Lacuna, of Static, of the Long Fall, of the Last Roll, of Wrong Numbers, of the Returning Tide, of Smoke, of the Tessellation, of the Late Hour, of Curfew, of the Hollow Coin, of Misplaced Light, of the Ninth Door, of the Quiet Throat

### Mythic mid-name slot
Inserts between base and suffix, hyphenated:
- `Catalyst-That-Forgot-Its-Name`
- `Catalyst-Made-of-Borrowed-Hours`
- `Catalyst-Written-in-the-Wrong-Tense`

### Flavor template

Per item: pick 1 flavor line from a tag-filtered pool. Affix's `flavorTags` filter which flavor lines are eligible.

Sample pool (tag-keyed):
- tag: `heat` → "It hums in a key no one taught it."
- tag: `decay` → "The edges remember being more."
- tag: `memory` → "You have held this before. You will not remember holding it."
- tag: `void` → "It does not cast a shadow. It casts an absence."

Aim for ~30 flavor lines at launch, multi-tag so combinations feel coherent.

### Per-run alias

Seed → deterministic 2-word run name: `"Echo 17"`, `"The Lacuna Cycle"`, `"Carcosa Mode"`, `"Misfire of the Returning Tide"`. Shown in HUD + share string. Drawn from disjoint name pools (adjective+number, "The X Cycle", "X of the Y", etc.). Pure flavor, no mechanical effect.

---

## Balance

### Approach

- "Wildly variable" target accepted. No requirement that every seed clears.
- Existing simulation harness (`src-next/simulation/runSimulation.ts`) wraps a candidate seed → runs 200 trials → emits clear-rate, avg-mult, avg-chips per ante.
- New `balanceSim.ts` extends harness: enumerate next 90 UTC daily seeds → sim each → pick the seed whose clear-rate falls inside `[35%, 65%]` band → mark certified → record into `dailySeed.ts` registry.
- Run as a CI/local script ahead of release. Output checked into repo as static JSON. No runtime simulation cost to players.
- Wild seeds (non-certified) are not sim-validated. Caveat shown in HUD: `"Uncertified seed — variance high"`.

### Affix budget tuning anchor

- First-pass anchor: identical to existing catalyst rarity power tier. A `magic` rarity affixed item should feel like the existing `uncommon` catalyst was, not like a buff.
- Iterate via sim if clear-rate at parity stake drops below 20% even on certified seeds.

---

## Black hole visual

### Approach

- **Implementation:** 2D SVG + CSS filter for gravitational-lens distortion. Avoid Three.js cost on title screen (initial load weight already a concern per company review doc).
- **Layers:**
  1. Static starfield background (existing title BG).
  2. SVG: black disc (~40px diameter at 1080p), radial gradient → transparent edges.
  3. SVG: accretion arc — thin curved gradient strokes, slow rotate via CSS `@keyframes` (45s/rotation).
  4. SVG `<feDisplacementMap>` filter applied to a copy of the starfield clipped behind the disc — distorts star positions inward radially. Faint.
- **Always visible:** opacity ~0.6. No glow. No pulse. Players notice on second look.
- **Click target:** disc + accretion arc (slight expanded hitbox for accessibility).
- **Click feedback:** 600ms transition — disc grows + lens distortion intensifies + starfield desaturates → fade to Void title card "Void Tier 1" / seed name / today's certified label if applicable.

### Mobile

- Hitbox respects min 44×44 px tap target (a11y).
- Lensing filter degraded gracefully on browsers without SVG filter support — just the disc + arc, no lens.

---

## Aesthetic overlay (in-run)

- `<VoidOverlay>` component mounts as fixed-position layer above scene, below HUD.
- **Tint:** semi-transparent violet→black radial gradient. Reduces effective brightness by ~25%.
- **Accretion ambient:** large slow-rotating SVG accretion ring centered behind play area, opacity 0.15. Same animation primitive as title-screen disc.
- **Particle dimming:** existing dice-roll particle systems get a `voidMode` flag → bloom reduced 50%, palette shifts toward violet.
- **HUD corner badge:** `seed: <hex8>  •  echo 17` (or today's alias) — small mono font, top-right. Certified-seed badge appended when applicable.

---

## Audio overlay

- Single Tone.js drone stem: low sine (~55 Hz) + detuned partial (~58 Hz), slow LFO on amplitude (0.2 Hz), reverb tail ~6s.
- Fades in 4s on void run start.
- Does not replace existing music stems — layers underneath. Existing music keeps playing.
- Drone fades out on return to title.

---

## Daily certified seed

- UTC-day → deterministic seed. Stored as `{ date: '2026-05-21', seed: 'a3f8...', clearRate: 0.47, sigPrefix: 'sundered' }` in `src-next/voidmode/dailyCertified.json`.
- Generation script: runs balance sim over upcoming 90 days, fills gaps, recorded back to JSON, committed to repo. Manual gate.
- Leaderboard category `void-daily` accepts submissions only when `mode === 'void' && voidSeed === todayCertified`. Other void runs not leaderboard-eligible.
- HUD displays "Certified" badge when seed is today's certified.

---

## Verification

### Manual

1. `pnpm dev` (or repo equivalent — check `package.json`). Title screen renders. Black hole visible faintly at expected position.
2. Hover + click black hole. Verify lensing zoom transition + Void title card.
3. Start a void run on Lyra. Confirm:
   - Shop catalysts display generated names (prefix/base/suffix format).
   - Hovering an item shows generated flavor line.
   - HUD shows seed + run alias.
   - Tint overlay visible. Accretion ambient rotating slowly behind play area.
   - Drone audio audible under existing music stems.
4. Play through ante 1. Confirm affix effects fire — observe scoring changes consistent with hovered tooltip.
5. Confirm drawback affixes' downsides actually trigger (e.g. "next combo can't be straight" — try Straight, scores as base).
6. Confirm Mythic shop offer has 3 affixes + mid-name slot.
7. Click consumable from shop. Confirm voucher/galaxy/spectral also generates affixes.
8. Today's date matches certified seed JSON entry → confirm "Certified" badge shows.
9. Use wild seed (entered via dev console for now) → confirm "Uncertified — variance high" caveat shown.
10. End run, return to title. Confirm drone fades out, tint clears. Re-enter — confirm previous run state didn't persist.
11. Visual sanity on mobile viewport (Chrome devtools): black hole hitbox ≥ 44×44, lens filter degrades gracefully if needed.

### Automated

- New unit tests:
  - `affixGenerator.test.ts` — given seed S, budget B, archetype gates → deterministic output, no over-budget, respects slot rules.
  - `nameGenerator.test.ts` — flavor tags match affix tags; no empty strings; no template placeholders left in output.
  - `affixEffects.test.ts` — each of 60+ affixes has at least one test confirming effect runs without throwing for one canonical scoring context.
  - `dailySeed.test.ts` — UTC-day → seed mapping deterministic across timezones.
- Existing scoring-pipeline tests must still pass — `applyAffixes` phase must be a no-op when `mode !== 'void'`.

### Sim validation

- Run `balanceSim` over a fixed seed batch → snapshot clear-rate distribution → commit snapshot for regression detection. Future affix additions can't accidentally move the cert seed clear rate outside the `[35%, 65%]` band without an explicit snapshot update.

---

## Critical files to reference during implementation

- `src-next/data/catalysts.ts` — existing 50+ catalysts; needs archetypeTags audit.
- `src-next/core/rng.ts` — Mulberry32 PRNG. Reuse for affix generator.
- `src-next/core/phases/` — scoring pipeline; `applyAffixes` slots in here.
- `src-next/core/shop/catalystDraw.ts` — shop catalyst selection; hook void path here.
- `src-next/core/consumables/*` — voucher/galaxy/spectral handlers.
- `src-next/simulation/runSimulation.ts` — sim harness; balanceSim wraps this.
- `src-next/state/runStore.ts` — Zustand store; mode flag goes here.
- `src-next/components/TitleScreen.tsx` — black hole mounts here.
- `src-next/components/PlayScene.tsx` — overlay mounts here.
- `src-next/data/dice.ts` — for Lyra constellation reference.

---

## Phase 2 follow-ups (deliberately not in v1)

- Affixed blinds (trials/bosses)
- Remaining 7 constellations
- Codex / persistent affix sightings
- Inscription (carry-over to normal mode)
- Recursive / genetic / collapse affixes
- Procedural boss sigils
- Forge integration (affixed dice faces)
- Mobile-specific Void Mode HUD layout
- Multi-day daily-seed leaderboard streaks
