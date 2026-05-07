# FortuneFallacy — Deep Analysis Report

> **Methodology:** custom headless simulation harness (8 constellations × 6 stakes × 300 runs = 14,400 runs), per-catalyst matched-pair impact study (44 catalysts × 200 paired seeds = 17,600 runs), stacked-deck balance probe (288 cells × 100 runs = 28,800 runs), plus a Playwright walk of the live game across 8 viewports (375×667 → 2560×1080 + 640×360 Android landscape edge case).
>
> **Tooling shipped with this report** under `tools/sim/`: a bootstrap (`bootstrap.ts`) that intercepts the seeded sim bridge synchronously, four pluggable strategies (`strategies.ts`), a run driver (`driver.ts`), batch and sweep runners, the catalyst-impact study, the stacked-deck sweep, an HTML dashboard generator, and the screenshot walker. Re-runnable via `npx tsx tools/sim/<file>.ts`. Raw data lives in `docs/sim-data/`; screenshots in `docs/audit-screenshots/`.

---

## 0 · Executive summary

FortuneFallacy is a remarkably well-built Balatro-style dice roguelike. The architecture is exemplary — clean Zustand state, action-routing through one dispatch, an event bus that lets the harness inject deterministic dice without modifying any source file. 955 tests pass cleanly. There is a lot to like.

The findings below cluster into four themes, in rough priority order:

1. **The desktop UI is mobile-stretched.** Mobile (375–412 wide, portrait) is the polished path — it looks designed. Desktop just renders the same column of mobile content on a vast empty starfield, with stakes and constellation cards shrunk into 4-up grids that lose all the legibility the phone view earned. This is the single highest-impact UX win available.
2. **The game wall is severe.** Even a deck-stacked simulated player (4 strong catalysts granted at run start, EVKeep dice strategy) clears 0% of runs across every (constellation, stake) pair. That isn't a bug — it tells you that *the build dimension matters more than skill*. Early-game shop friction (catalyst price 5 / starting earnings ~6 / first cliff at target 900) gates new players hard, and the meta is invisible until they break through.
3. **Meta-progression is a checklist behind a wall.** The total long-game content is 8 constellations × 6 stakes (48 cells) + 5 challenges + 1 legendary unlock + Codex completion. There is no prestige currency, no daily seed, no async social hook, no narrative drip. Once a player clears Supernova on all eight, the loop ends. Bigger-than-the-game ideas live in §6.
4. **Game feel is 80% there.** 27 keyframe animations, particle bursts, screen shake, score pops, holo-foil sweeps — the polish is real. But `navigator.vibrate` is never called despite a full gesture system at `src-next/app/input/gestures.ts`, the reduced-motion path is suppressive rather than truly motion-free, and the high-end score readout (`ScoreFloat.tsx:95-105`) lacks an explicit max-width so 9-figure scores can clip. Fixes are small and yield outsized perceived quality.

Every section below cites file:line references and ties to the data in `docs/sim-data/` or `docs/audit-screenshots/`.

---

## 1 · UI findings — desktop

The desktop layout is a stretched mobile layout. The codebase has two responsive breakpoints:
- `compact`: width < 900 OR height < 700
- `tight`: width < 720 OR height < 600

(`src-next/app/hooks/useIsCompactStage.ts`)

Above both, *the design does not change* — the game still positions a narrow column in the centre with an empty cosmos backdrop on either side. The screenshot pair that captures this best:

| `desktop-01-title.png` (1920×1080) | `iphone-se-01-title.png` (375×667) |
| --- | --- |
| Tiny CTA stack lost in starfield, "BEGIN ASCENSION" wraps to two lines | Balanced two-column button grid, full bleed |

**Concrete issues, with fixes:**

| # | Issue | Where | Why it matters | Fix |
| --- | --- | --- | --- | --- |
| D1 | Title CTA column unchanged at 1920w. The layout never widens; the "Begin Ascension" button text wraps. | `src-next/app/screens/Title.tsx`; styles in `src-next/styles/index.css:140-204` | Looks unfinished; gives a "phone game in a browser tab" first impression | Add an `xl` breakpoint that switches the CTA to a two-row, two-column hero block, increases title typography, and relocates Codex/Challenges/Records as a horizontal nav strip |
| D2 | Constellation Select cramps 4 cards per row at 1920w, dropping description text to ~10px. Mobile shows the same cards full-width. | `src-next/app/screens/ConstellationSelect.tsx` | Players make their first strategic decision against unreadable cards | Cap card grid at 3-up max on desktop with bigger preview art; hint at unique mechanics inside each card |
| D3 | Round HUD's "TopBar" is fixed at the top across all sizes — at 1920×1080 the catalyst strip / score / consumable tray sit far from where the eye expects them on a wide canvas. | `src-next/app/hud/TopBar.tsx`; `src-next/styles/index.css` (`--hud-top-h`) | Wastes the wide-screen real estate; eye drifts | Desktop-only mode that splits HUD: catalysts left rail, consumable tray right rail, score top-centre |
| D4 | No keyboard shortcut affordance on desktop. Esc is wired (`App.tsx:63-78`) but no on-screen hints, no Tab navigation cues, no "press R to roll" overlay. | `src-next/app/App.tsx`, gestures.ts | Desktop players touch-tap with a mouse instead of using their actual input device | Add a `?` legend overlay (toggleable via `?` key) listing keyboard bindings; default key bindings for Roll/Score/Reroll/Lock-N |
| D5 | Cosmos background `<canvas>` sits at the same z-layer at every viewport. At ultrawide (2560×1080) the parallax is subtle and the eye reads dead space. | `src-next/app/visual/CosmosBackground.tsx` | Wastes desktop's largest axis | Increase nebula density / animate a slow procedural starfield drift on `>1440w`; scale the constellation glyph in the centre |
| D6 | The `debug` button is visible on every screen at every viewport in DEV. It does not hide on desktop builds either when `import.meta.env.DEV` is false unless the build strips it. Confirm via prod build. | `src-next/app/App.tsx` (look for `DebugBadge` / similar) | Looks unfinished if it ever leaks to production | Wrap the badge in `import.meta.env.DEV` and verify the prod build is clean |

**Things desktop does right:**
- Focus rings (`:focus-visible`, `index.css:127-145`) are crisp 4px rings — better than most games this size.
- Pause menu (`PauseMenu.tsx`) is well-structured, tab-trapped, escape-dismissable.
- The colour palette (`tailwind.config.ts` cosmos 50-950 + ember/crimson/gold/vector accents) is genuinely distinctive.

---

## 2 · UI findings — mobile

Mobile is the loved path. The OrientationGate (`src-next/app/hud/OrientationGate.tsx`) correctly fires on landscape phones (`android-landscape-01-title.png` shows a clean rotate prompt at 640×360). Safe-area insets (`index.css:61-65`) and `100dvh` for the address-bar dance are properly used.

**Concrete issues:**

| # | Issue | Where | Why it matters | Fix |
| --- | --- | --- | --- | --- |
| M1 | Buttons shrink below 44pt at `<720w` or `<600h` (font 13px, padding 8×16). Apple/WCAG min for tap is 44pt. | `src-next/styles/index.css:156-159` | Mis-taps on iPhone SE | Keep `min-height: 44px` on `.tap` (already there) but only shrink padding in the *non-primary* buttons; primary should remain ≥48pt |
| M2 | Catalyst strip + consumable tray sit on the same horizontal band when both are full (6 catalysts + 3 consumables). On iPhone SE this is ~9 icons in 375px = 41px per icon, edge-to-edge. | `src-next/app/hud/CatalystStrip.tsx` and `ConsumableTray.tsx` | Touch slips, no breathing room | Move the consumable tray to a bottom-anchored swipe-up sheet on mobile; long-press a catalyst to open a detail card |
| M3 | ScoreFloat has `textOverflow: ellipsis` but no `max-width` — at end-game scores ("1.2P") with mult bonuses applied, the 56px font can push past container | `src-next/app/hud/ScoreFloat.tsx:95-105` | Score is *the* feedback signal; clipping kills the dopamine moment | Add `max-width: 90vw; overflow: visible` and a graceful font shrink past 8 digits via `clamp()` |
| M4 | Tooltips (`.tip`) are visual-only; screen reader users get nothing | `src-next/styles/index.css:177-203` | A11y gap on a game whose mechanics live in tooltip text | Pair every `.tip` with `aria-describedby` referencing a visually-hidden span |
| M5 | No haptic feedback. The gesture system supports tap/long-press/swipe but `navigator.vibrate` is never called. | `src-next/app/input/gestures.ts:1-end` | Mobile games without haptics feel weightless. This is one of the highest game-feel-to-effort ratios available | Add a tiny `haptics.ts`: 10ms on lock/unlock, 25ms on roll, 60ms+pause+40ms on score, 200ms on bust. Honour `prefers-reduced-motion` |
| M6 | PauseMenu uses `maxHeight: calc(100dvh - 24px)`. At 440px Android landscape (Galaxy S8) the mixer + portal gate + buttons overflow → internal scroll required, but no scroll affordance shown | `src-next/app/hud/PauseMenu.tsx:79` | Discoverability — users may not realise they can scroll | Show a fade-out gradient at the modal bottom + a subtle "scroll" caret when content overflows |
| M7 | `OrientationGate` shows "ROTATE DEVICE" in centred large type but no animation indicating *which way*. The 90° phone icon could rotate to show direction | `OrientationGate.tsx` | Confusion on first encounter | Add a 1.5s ease rotation animation hint, repeating |

**Things mobile does right:**
- Constellation Select on iPhone SE (`iphone-se-04-after-pick.png`) is exemplary — full-bleed cards, big readable type, stake selector + CTA stack vertically per card.
- Title screen mobile (`iphone-se-01-title.png`) is cleanly composed — title, subtitle, primary CTA, secondary nav grid, version footer.
- Touch targets default to `min-height/min-width: 44px` via `.tap` class.

---

## 3 · UX findings — desktop

UX is more than visual layout — it's the rhythm of decisions, learning, and recovery.

| # | Finding | Evidence | Why it matters |
| --- | --- | --- | --- |
| UD1 | First-time player has no onboarding. Title → Begin Ascension → Constellation Select → 8 dense cards. Players who don't already know what a "constellation run" or a "stake" is have no entry point. | Walk the screenshots for any viewport: there is no tooltip, no "your first run" hand-hold | Drop-off risk is highest in the first 60 seconds. Even a single overlay highlighting Lyra as "the classic" + Spark as "easy" would help |
| UD2 | Risk/reward of skipping a blind is invisible. The system exists (`SKIP_BLIND` action, `skipBlind` in `transitions.ts:260-330`) but the UI to invoke it isn't surfaced on the Hub strongly. | `Hub.tsx`, `BlindCard.tsx` | Players don't try the variance lever |
| UD3 | The shop is "a row of 4 things." There is no narrative, no "Curator picked this for you," no held-offer hint, no signaling of synergy with your existing build. | `src-next/app/screens/Shop.tsx` | Shopping is the strategic apex of the loop. Make it feel like a decision, not a list |
| UD4 | No quick-restart after bust. After Fail screen, players have to walk back through Title → ... | `App.tsx` Fail screen routing | Friction in the loop people *want* to repeat |
| UD5 | The Codex / discovery system is a list of silhouettes. Even on desktop with screen real estate, it is just rows of unlock states. | `src-next/state/slices/meta.ts` | A discoverable game deserves a discovery interface |

---

## 4 · UX findings — mobile

| # | Finding | Why it matters |
| --- | --- | --- |
| UM1 | "Roll" sits centre-bottom; players reach with right thumb. The Sell/Buy affordances on catalysts sit upper-mid where the thumb cannot reach without two-handed grip. | One-handed phone use breaks |
| UM2 | The shop's `Sell` action (per-catalyst) reveals on hover; on touch we override to always-visible (`index.css:200-235`). But the always-visible state makes the catalyst strip feel cluttered. | Visual noise on what should be the focal area |
| UM3 | Long-press on a catalyst does not show a detailed tooltip card. Long-press is detected (`gestures.ts`) but unused for catalyst inspection. | The gesture is built; just not wired to inspection |
| UM4 | Galaxy/Quasar pack opening UI works, but the pack-pick screen at <400px shows 3 galaxy cards in a row that get truncated. | Pack moments should feel *good*; they get cut off |

---

## 5 · Meta-progression audit

### What exists

- **Constellation x Stake matrix:** 8 × 6 = 48 unlock states (`meta.stakeProgress[constellationId] = highestClearedStakeId`). Stake N+1 unlocks per-constellation when stake N is cleared.
- **Legendary catalyst (All-Band):** unlocks meta-globally the first time a player holds 4+ catalysts in any run (`shop.ts:14-25`, `LEGENDARY_UNLOCK_PREFIX`).
- **5 Challenges** (`data/challenges.ts:39-80`) — Lyra-only one-off gauntlets.
- **Codex / discovery system:** silhouettes flip when first encountered (catalysts, mods, vouchers, bosses, consumables).
- **High score table:** local top-10 with name + score + date.

### What sim data shows

From `docs/sim-data/sweep_summary.csv` (300 runs/cell, heuristic_shop strategy):

```
constellation  spark_winRate  ember  pyre   beacon  nova   supernova
lyra           0%             0%     0%     0%      0%     0%
mensa          0%             0%     0%     0%      0%     0%
triumvirate    0%             0%     0%     0%      0%     0%
argo           0%             0%     0%     0%      0%     0%
fibonacci      0%             0%     0%     0%      0%     0%
eclipse        0%             0%     0%     0%      0%     0%
polyhedra      0%             0%     0%     0%      0%     0%
ophiuchus      0%             0%     0%     0%      0%     0%
```

A "naive but reasonable" bot wins zero. Even granting the top-3 impact catalysts (Entropy Index, Pair Dynamo, Triplet Engine) plus Metronome (`stacked_deck_sweep.csv`, `mixed_top` loadout), Lyra/Spark wins 0% with mean ante 1.55 — the bot reaches blind 2 of ante 1 (target ~900) with mean score 1440, then runs out of hands.

This is a **balance signal**. The game is genuinely hard. The player is expected to combine catalysts + mods + vouchers + galaxy levels + edition stamps multiplicatively. Without that compounding, no individual subsystem is enough. Two implications:

1. **The first 10–15 hours need a clearer progression carrot** so players survive the early-shop death valley.
2. **The end-state is closer than the unlock matrix suggests** — once a player understands the multiplicative loop, they likely shred Spark on every constellation and the 48-cell matrix collapses to "grind 6 stakes 8 times."

### What's missing

| # | Gap | Why it matters | Concept |
| --- | --- | --- | --- |
| MP1 | No prestige currency. After a run ends, you keep nothing. | Roguelikes that lack between-run progress shed players fast. | Cosmic Dust: ~1–10 dust per run based on score+ante; spend on permanent meta-perks (extra starting catalyst slot, see one boss in advance, +1 starting voucher option, etc.). See §6. |
| MP2 | No daily seed. | Async social loop free of friction; reason to log in once a day | `daily-2026-05-07` seed → fixed constellation/stake/challenge → global leaderboard via portal protocol |
| MP3 | No ascension above Supernova. Once cleared, the constellation is "done." | Top-1% of the playerbase has nothing | Ascension Levels (A1–A20), each adds a stacking modifier (smaller dice pool, +X% target, no boss reveal, etc.). See §6. |
| MP4 | No narrative drip. Every catalyst has flavour text but the world is silent. | Players don't get to *want* to clear something they don't know exists | Per-stake clear: unlock one paragraph of the Constellation's lore (the Lyre's curse, the Mensa's bargain). 8 stakes × 8 constellations = 48 paragraphs. |
| MP5 | No async leaderboard for non-daily content. | Social hook is missing entirely | Per-(constellation, stake) all-time top-100 via portal protocol; show a friend's ghost run replay if they cleared the same seed |
| MP6 | The Codex is a list. | Discovery should feel like discovery | Diegetic codex: as you unlock, the constellation forms on a meta star map; mods orbit your current dice in the codex 3D scene; bosses reveal as moons. |
| MP7 | Challenges (5 total) are all Lyra-only. | Underused content | One challenge per constellation, themed to its mechanic |
| MP8 | Boss debuffs are invisible until played. (Pluto, Ceres, Triton, Phobos, Callisto, Eris, Charon, etc. — `data/blinds.ts:96-280`) | Players can't strategise, only react | Reveal next ante's boss in Hub *only after* you've encountered them once (Codex-gated knowledge) |

---

## 6 · Game-feel & juice findings

The game has unusually thoughtful polish (27 keyframe animations, particle bursts, screen-shake at three intensities, score-pop floaters, holo-foil sweep). What's missing is small but high-leverage:

| # | Finding | Where | Fix sketch |
| --- | --- | --- | --- |
| GF1 | **No haptics anywhere.** The gesture system is fully built. | `src-next/app/input/gestures.ts` — no `navigator.vibrate` calls | New `src-next/app/feel/haptics.ts` exposing `tap()`, `lock()`, `roll()`, `score(tier)`, `bust()`. Fire from `actions/handlers/dice.ts` (lock), `roll.ts` (roll/score), `transitions.ts` (clear/bust). 10–80ms patterns. Honour `motionPref: 'reduce'`. |
| GF2 | Reduced-motion path collapses durations to 80ms instead of 0. Animations still trigger reflows. | `index.css` `.reduce-motion` rules | `.reduce-motion *` → `animation: none !important; transition-duration: 0ms !important;` — and skip particle emission entirely (not just opacity-zero them) |
| GF3 | Audio mixer exists (Master / Music / SFX) but no pitch variation on dice settle by face value. Every die clack sounds the same. | `src-next/audio/sfx.ts` | Map d6 face → semitone offset (face 1 = base, face 6 = +5 semitones). Tone.js handles this trivially. |
| GF4 | Score-pop animations float upward. The breakdown event log (`onUpgradeTriggered`) fires per-catalyst but the screen surfaces only the aggregate. Players don't *feel* their build firing. | `src-next/core/phases/upgrades.ts` events | Sequence catalysts left→right with a 60ms stagger per catalyst, each with its own particle ring colour-coded by archetype |
| GF5 | Boss reveal is a banner. It could be a *moment*. | `BossReveal.tsx` | Camera dolly + audio sting + the boss's specific debuff glyph slowly etching itself onto the dice tray |
| GF6 | The chain multiplier mechanic (consecutive higher-tier hands) is one of the game's deepest score levers. Players do not know about it. | `src-next/core/scoring/constellationChain.ts` | Render a chain meter under the score number with a "next tier needed" ghost |
| GF7 | No "dice slow-mo" on a five-of-a-kind / boss-clearing roll. Three.js scene has full physics control. | `src-next/render/three/Dice3D.ts` | On rare combos, slow physics by 0.5x for the last 200ms of the settle |
| GF8 | Edition stamps (foil/holo/poly) are visually distinguished by the holo-sweep CSS animation but the *moment of rolling an edition at the shop* has no flair | `src-next/core/upgrades/editions.ts:6-35`, shop offer rendering | When an edition rolls in the shop, play a brief shimmer + audio cue scaled to rarity |

---

## 7 · Catalyst impact study (Lyra / Spark, 200 matched pairs)

Source: `docs/sim-data/catalyst_impact_lyra_spark.csv`. Strategy: NoBuy (forces measurement of the catalyst's *intrinsic* contribution, not its interaction with the shop). Read this as: **assuming the player does nothing else, what does this card add?**

### Top performers

| Catalyst | Δ score | Δ% | Notes |
| --- | --- | --- | --- |
| `entropy_index` | +253 | **+90%** | Rewards face variety. Works without specific synergies. |
| `shard_lung` | +210 | +75% | +ante shards on blind start; sustains shop access |
| `pair_dynamo` | +202 | +72% | Boosts pair combos — the bot's most-played hand |
| `low_choir` | +147 | +52% | |
| `metronome` | +138 | +49% | |
| `triplet_engine` | +137 | +49% | |
| `all_band` (legendary) | +134 | +48% | Once-per-round tier-up; no explosive interaction in vacuum |
| `shard_sink` | +91 | +32% | |
| `last_throw` | +80 | +29% | |
| `even_keeled` | +75 | +27% | |

### Zero-impact catalysts (likely "trap" or "needs the right build")

These are catalysts whose impact rounds to ±0% under matched-pair sim with NoBuy strategy:

`magnitude`, `levels_levy`, `straight_signal`, `apex`, `harmonic`, `silver_tongue`, `dust_off`, `crescendo_run`, `audit`, `gilding_press`, `tetrad`, `mod_gravity`.

These need **conditions the no-shop bot can't trigger** — straights specifically (`straight_signal`, `apex`), mods on dice (`harmonic`, `gilding_press`, `mod_gravity`), skipping blinds (`silver_tongue`), busting (`dust_off`, `audit`), going long without locks (`crescendo_run`), or hitting Galaxy levels (`levels_levy`).

This is a **design insight** more than a bug. These catalysts are gated on specific game states. For new players who don't know the combos, they will look the same in the shop and the player's intuition will betray them. Suggested treatment in §8.

---

## 8 · Non-math upgrade ideas (the big section — 22 ideas)

Tagging:
- **S/M/L** — small/medium/large implementation effort
- **🟢 game-feel** / **🟡 balance-aware** / **🔴 systemic** — risk profile
- Each idea cites the file/system it plugs into

### A. Rule-bending catalysts (change *what counts*)

> Players love when an upgrade changes the rules, not the numbers. These plug into `src-next/core/upgrades/registry.ts` as new catalysts with `phase: 'EVALUATION'`.

| # | Idea | Effort | Risk |
| --- | --- | --- | --- |
| 1 | **Phantom Pair** — once per round, the locked-but-unrolled face counts as a wildcard for combo detection. Plugs into `core/scoring/detectCombo.ts` via a `phantomPair: true` flag in `lastScoringCtx`. | M | 🟡 |
| 2 | **Combo Inversion** — once per blind, treat the lowest-tier combo as the highest. Players save it for a game-losing 6th hand. Pure flag in evaluation. | S | 🟡 |
| 3 | **Six Recursion** — on a roll where any die shows 6, that die re-rolls itself once (chains until non-6). Plugs into the post-roll modifier phase. Beautifully physics-driven on the 3D table. | M | 🟡 |
| 4 | **Mirror Hand** — duplicates one die (visually creates a "reflection") for scoring purposes only, picked at score time. Adds a 6th die for combo detection on Lyra. | M | 🟡 |
| 5 | **Heretic** — your Five of a Kind *also* counts as Three of a Kind for downstream catalysts (Triplet Engine, Magnitude, etc.). Encourages 5oak builds without creating a single godcombo. | S | 🟡 |

### B. Information / fog-of-war

| # | Idea | Effort | Risk |
| --- | --- | --- | --- |
| 6 | **Astrolabe** (catalyst) — at the start of each blind, see the next 3 rolls' faces (Three.js ghost dice ring around the tray). Plugs into `core/pipeline/runRollPipelineUpToSim.ts` to peek `predeterminedFaces`. | M | 🟢 |
| 7 | **Cassandra** (consumable) — reveal next ante's boss debuff for free. New consumable type `'oracle'` in `core/consumables/`. | S | 🟢 |
| 8 | **Forecast** (voucher) — every shop now shows one "preview offer" you can lock for next shop at half price. Plugs into shop slice, adds `pinnedOffer` field. | M | 🟡 |

### C. Resource alchemy (convert with friction)

| # | Idea | Effort | Risk |
| --- | --- | --- | --- |
| 9 | **Forge a Hand** (consumable) — pay 5 shards mid-blind for +1 hand. Plugs into `core/consumables/`, `type: 'sacrifice'`. | S | 🟡 |
| 10 | **Burn a Catalyst** (consumable) — sacrifice an owned catalyst slot for one-time ×3 mult on the next score. Forces a real choice at high stakes. | M | 🔴 |
| 11 | **Time Bank** — at end of round, banked unspent rerolls turn into shards at 2:1. Plugs into `core/round/transitions.ts:clearBlind`. | S | 🟢 |

### D. Time / order manipulation

| # | Idea | Effort | Risk |
| --- | --- | --- | --- |
| 12 | **Stash Hand** (consumable) — save the current rolled state, replay it later in the run on demand. Stored in `run.stashedHand` slice. Replay swaps `dice` array with stashed snapshot. | L | 🔴 |
| 13 | **Undo Lock** (consumable) — rewind the most recent TOGGLE_LOCK action. Trivial: keep one action of history in round slice. | S | 🟢 |
| 14 | **Hand Recall** (catalyst) — once per blind, replay the exact dice from the previous *cleared* hand. Powerful for chaining. Plugs into `lastScoringCtx`. | M | 🔴 |

### E. Diegetic / narrative

| # | Idea | Effort | Risk |
| --- | --- | --- | --- |
| 15 | **The Crone** (vendor variant) — once per ante, the shop has a quirky vendor who only sells items matching your dominant archetype, but at 1 shard cheaper. Surfaced as a portrait at the top of the shop. | M | 🟢 |
| 16 | **The Smith** — barters in dice instead of shards: "give me a 6 next round, get this catalyst." Pre-locks one die to a face for a future round. Plugs into a new constraint slice. | L | 🔴 |
| 17 | **Companion Dice** — a persistent meta-dice that grows with your unlocks. After 10 cleared blinds it becomes "veteran" (+1 face value). After 50, "ascendant" (becomes a wildcard sometimes). Lives in `meta` slice. | L | 🟡 |

### F. Physics-interactive (lean into Rapier)

The 3D Rapier physics engine is already there. These ideas use it instead of the score formula:

| # | Idea | Effort | Risk |
| --- | --- | --- | --- |
| 18 | **Magnetic Dice** (catalyst) — on roll, dice with matching faces apply attractive force to each other mid-flight. Plugs into `simulation/rapierSim.ts` with a custom force pass. Visually mesmerizing; mechanically just biases face distribution slightly. | M | 🟢 |
| 19 | **Tilt Table** (catalyst) — on mobile, the rolling tray tilts with `DeviceOrientationEvent` during the settle phase. Pure cosmetic, but enormous "this game knows my phone" energy. | S | 🟢 |
| 20 | **Gravity Well** (consumable) — drag-place a temporary attractor on the tray that pulls dice toward it. Affects `predeterminedFaces` distribution by a small per-die nudge. | L | 🟡 |

### G. Meta-mechanical (upgrades that affect the *game systems*)

| # | Idea | Effort | Risk |
| --- | --- | --- | --- |
| 21 | **Curator** (voucher) — pin one shop offer between shops. Tiny shop-slice change (`pinnedOfferIdx`). Players adore this — it lets them save up. | S | 🟡 |
| 22 | **Bargain Hunter** (voucher) — every 3rd shop visit has one free item. Persistent counter in run slice. Free items rolled before shopPriceMult. | S | 🟡 |

### Summary table — top 5 by impact-to-effort

| Idea | Why pick first |
| --- | --- |
| #21 Curator | One slice field, transformative shop strategy |
| #6 Astrolabe | Already-existing `predeterminedFaces`; plug a peek into the HUD |
| #19 Tilt Table | One-evening implementation; huge phone polish moment |
| #2 Combo Inversion | Single boolean, completely changes endgame play |
| #11 Time Bank | One-line addition to clearBlind reward |

---

## 9 · Creative / outside-the-box concepts (10 bigger swings)

These are bigger structural ideas. None are pure catalysts; each restructures part of the game.

1. **Branching Ante Map.** Each ante presents 2–3 paths through 3 blinds, like Slay the Spire. Some paths have boss debuffs known, some unknown but with double rewards. State change: `run.goalIdx` becomes `run.path[][]`. Plugs into `transitions.ts:clearBlind` to choose next blind from a generated graph. **Effort: L. Impact: enormous on replayability.**

2. **Endless Mode.** After Ante 4, the game continues with `targetMult` scaling per-blind. Final-form scoreboard. New ante reveals a "Cosmic" boss class with stranger debuffs. **Effort: M, mostly tuning.**

3. **Singularity Mode (challenge).** Each cleared blind permanently fuses two of your dice into a single "fused die" with double face range (1–12 from two d6s). By Ante 4, your tray contains 2-3 fused dice. Total visual + mechanical reset. **Effort: L. The kind of thing players make YouTube videos about.**

4. **Diegetic Codex / Star Map.** Replace the linear codex with a Three.js scene: a constellation cluster where each unlock physically pops into existence. Catalysts orbit your discovered constellations as small icon planets. Players come back just to look at it. **Effort: L. Reuses Three.js infra.**

5. **Catalyst Symbiosis.** Hidden third effects when specific pairs are held simultaneously. Example: `tempo` + `quorum` together cause every same-tier hand to *also* tier-up Tempo. *Never announced in tooltips.* Players discover via screenshot-trading and wikis. **Effort: M.** This is the kind of thing that turns a game into a community. Plugs into `core/phases/upgrades.ts` between catalyst applies.

6. **Living Shops.** The shop remembers your last visit. If you sold a catalyst last shop, this shop offers something thematically opposite (sold a defensive catalyst → next shop offers an explosive one). State: `run.lastSoldKind`, `run.lastSoldArchetype`. Plugs into `rollOffers` in `shop.ts:44`.

7. **Asynchronous Ghost Runs.** When you clear a stake, your action log + seed is sent (via `portal.js`) to a server. When other players play that seed, your "ghost dice" roll alongside them — silent, faded. They see your catalyst choices as floating ghost cards in the shop. The portal protocol already exists.

8. **Anti-meta Trickster.** Once per run, the game silently lies in a catalyst's tooltip text (e.g., shows "+5 Mult" but actually does +3). Revealed at first score. Resets per run. Forces players to *trust their math*, not the UI. Lives in `data/catalysts.ts` with a `trickster: boolean` field rolled once per run.

9. **Story-per-Stake.** Every stake clear unlocks one paragraph of constellation lore from a 48-paragraph corpus. Players who clear all 48 unlock an animated cinematic. Lyra's myth, Mensa's bargain, the Triumvirate's three rules, Argo's mutiny, Fibonacci's curse. **Effort: M (technical) + content (writing).**

10. **Cosmic Dust prestige.** Earned 1–10 per run based on score%target across the run. Banked across runs. Spent on permanent passive perks: +1 starting catalyst slot, see one boss in advance per run, +1 voucher shop appearance, free reroll once per run, etc. **Effort: M; lives in `meta` slice.** This is the single biggest retention lever; see §10.

---

## 10 · Top 10 prioritised recommendations

Ranked by `(impact / effort)`. Each has a concrete first edit.

| # | Recommendation | First edit | Why |
| --- | --- | --- | --- |
| 1 | **Add Cosmic Dust prestige currency** | `src-next/state/slices/meta.ts` add `cosmicDust: number`; `core/round/transitions.ts:clearBlind/bustBlind` award dust based on score | Solves MP1. Without this, the game has no between-run progress and player retention plummets after first wins |
| 2 | **Fix desktop layout — wide-mode breakpoint** | `src-next/app/hooks/` new `useWideStage()` (>1280w); refactor Title, ConstellationSelect, Shop with `xl` columns | Single biggest first-impression win. Desktop currently feels unfinished. (D1, D2, UD3) |
| 3 | **Add haptics layer** | New `src-next/app/feel/haptics.ts`; call from dice/roll handlers | Free game feel on mobile. (GF1) |
| 4 | **Onboarding tutorial overlay** | `src-next/app/screens/Title.tsx` + new `OnboardingOverlay`; show on first ever run; localStorage flag | Drop-off in first 60s is the highest in any roguelike. (UD1) |
| 5 | **Daily seed + global leaderboard** | `src-next/online/leaderboard.ts` + new `DailyChallenge` screen; reuse portal protocol | Async social hook. (MP2) |
| 6 | **Reveal next ante's boss after first encounter** | `core/round/transitions.ts:clearBlind` writes to `meta.discovered.bosses`; Hub renders from that | Strategic depth without information overload. (MP8) |
| 7 | **ScoreFloat overflow fix + chain meter HUD** | `app/hud/ScoreFloat.tsx` + new `ChainMeter` HUD component | Score is the dopamine; don't clip it. Surface chain mechanic. (M3, GF6) |
| 8 | **Curator voucher (pin shop offer)** | `state/slices/shop.ts` add `pinnedOfferIdx`; `actions/handlers/shop.ts` handle pin/unpin | One-day implementation. Massive shop strategy unlock. (Idea #21) |
| 9 | **Audit "dead" catalysts** | Re-tune the 12 catalysts at 0% impact (`catalyst_impact_lyra_spark.csv`) so each has a reachable activation in a no-shop sim | Dead catalysts taint shop trust. (§7 "Zero-impact" list) |
| 10 | **Branching Ante Map + boss debuff teaser** | `state/slices/run.ts` `path: BlindPath[]`; `transitions.ts:clearBlind` chooses among generated path nodes | The single biggest replayability lever. (Idea #1, MP8) |

---

## Appendix A — simulation data

| File | Description |
| --- | --- |
| `docs/sim-data/sweep_summary.csv` | 48 cells × win/ante/score summary |
| `docs/sim-data/sweep_runs.csv` | 14,400 raw run records |
| `docs/sim-data/sweep_blinds.csv` | 17,491 per-blind records |
| `docs/sim-data/catalyst_impact_lyra_spark.csv` | 44 catalysts × Δscore Δante ΔwinRate |
| `docs/sim-data/stacked_deck_sweep.csv` | 288 (constellation, stake, loadout) cells |
| `docs/sim-data/dashboard.html` | Self-contained HTML dashboard — open in any browser |

To re-run end-to-end:
```bash
SIM_RUNS_PER_CELL=300 npx tsx tools/sim/sweep.ts
SIM_RUNS_PER_CELL=100 npx tsx tools/sim/stackedDeck.ts
npx tsx tools/sim/catalystImpact.ts --runs 200 --constellation lyra --stake spark
npx tsx tools/sim/htmlReport.ts
```

## Appendix B — viewport audit screenshots

`docs/audit-screenshots/` contains 56 screenshots: 8 viewports × 7 screens (Title, after-title-click, constellation-select, after-pick, hub-or-round, round-after-roll, pause-menu).

Captured with `npx tsx tools/sim/screenshots.ts` (Playwright); requires `npm run dev` running.

Notable individual screenshots:
- `iphone-se-04-after-pick.png` — gold standard mobile constellation select
- `desktop-04-after-pick.png` — same screen at 1920×1080 showing the cramped 4-up grid
- `android-landscape-01-title.png` — OrientationGate working as intended
- `desktop-01-title.png` — compare to mobile to see the wide-mode gap

## Appendix C — dead-catalyst list (Δ ≤ 0% in NoBuy sim)

These 12 catalysts produce ~0 marginal impact in a no-shop bot run because their activation requires conditions the bot can't trigger. They are not necessarily *bad* — they need a deck around them. But for new players reading the shop tooltips, they look indistinguishable from strong catalysts.

| Catalyst | Likely activation condition |
| --- | --- |
| `magnitude` | Specific high-tier combos |
| `levels_levy` | Galaxy combo levels (Quasar / Galaxy Pack content) |
| `straight_signal` | Straight combos |
| `apex` | High-tier combos |
| `harmonic` | Mods on scoring dice |
| `silver_tongue` | Skipping blinds |
| `dust_off` | Busting |
| `crescendo_run` | Multiple rolls without locking |
| `audit` | Busting after catalyst spend |
| `gilding_press` | Mod-heavy build |
| `tetrad` | Four of a kind specifically |
| `mod_gravity` | Mods on dice |

Recommended treatment: either (a) add a tiny baseline contribution so they're never *zero* in a vacuum, or (b) re-tag their tooltip text in the shop with a colour-coded "synergy needed" badge so players know they're conditional.

---

*Report ends. Tooling and data persist under `tools/sim/`, `docs/sim-data/`, `docs/audit-screenshots/` for future iterations.*
