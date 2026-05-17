# Unlock-Gated Content Roadmap

10 new catalysts + 5 new mods, each gated behind a specific player accomplishment. Adds long-tail unlock content for the post-Spark phase of the game when players have cleared the basics and need fresh chase targets.

Authored: 2026-05-16. Builds on existing unlock infrastructure:
- `meta.unlocks: string[]` array carries unlock flags
- `LEGENDARY_UNLOCK_PREFIX` (`'legendary_unlocked:'`) prefixes catalyst unlocks
- Existing precedents: Eclipse Pact (clear blind on Eclipse) + Heirloom Locket (100 dust lifetime) gated via `clearBlindLegendaryUnlocks` in [`core/round/transitions.ts`](../src-next/core/round/transitions.ts)

To ship any of these, extend `clearBlindLegendaryUnlocks` (or add a new unlock site for run-end / meta milestones) and add the catalyst meta + apply function. Same pattern as Eclipse Pact / Heirloom Locket.

---

## Catalysts (10)

### 1. Cosmic Compass — rare, scaling
- **Unlock:** Clear Final Trial on 3 different constellations
- **Desc:** Each cleared blind grants +0.05× mult permanent (cap +0.5× per ante).
- **Flavor:** Three skies remembered. The fourth points itself.
- **Design intent:** Rewards constellation breadth. Complements Heirloom Locket (cross-run carryover) by anchoring to in-run breadth.

### 2. Voidwalker — legendary, scaling
- **Unlock:** Reach Cosmic Lap 3 (endless mode)
- **Desc:** While in any Cosmic Lap: all owned catalysts grant +1 mult per lap entered.
- **Flavor:** The 4th orbit. The 5th. The horizon stops mattering.
- **Design intent:** Endless-mode-only payoff. Justifies the grind for late laps with a snowball that compounds across catalysts.

### 3. Crown of Skulls — legendary, risk
- **Unlock:** Bust 10 times on Beacon stake or higher (cumulative across runs)
- **Desc:** ×3 mult every hand. Lose 1 hand at blind start.
- **Flavor:** Worn by the patient. Earned by the willing.
- **Design intent:** Reward perseverance through hard-stake losses. A true glass-cannon catalyst — the player who's been hurt enough by Beacon+ has earned the right to play this.

### 4. The Patient — rare, timing
- **Unlock:** Hit Patience Counter's ×3 bonus 5 times in a single run
- **Desc:** Every 3rd hand of the run: +50 chips and +3 mult.
- **Flavor:** The waiting catalyst that learned from the master.
- **Design intent:** Honors players who actually time the Patience Counter rhythm. The earned-version triggers every 3 instead of every 5, with smaller per-fire payoff but tighter cadence.

### 5. Salt of the Earth — uncommon, economy
- **Unlock:** End any run with 50+ shards in hand
- **Desc:** Each hand: +1 shard if shards < 5, otherwise +0.
- **Flavor:** The pantry catalyst. Fills until full.
- **Design intent:** Anti-Stipend. Stipend has flat +1/hand cap 6. Salt only fires below 5, so it's a *recovery* tool — bounce back from shop spends, never accumulate beyond bottom.

### 6. Stargazer — rare, face
- **Unlock:** Reach 100% Codex catalyst discovery
- **Desc:** +1 mult per distinct face value seen this run (uncapped).
- **Flavor:** Every face logged. Every face counts.
- **Design intent:** Codex-completion reward. Polyhedra (5 dice with d4/d6/d8/d10/d12) becomes the dream constellation — 12+ distinct faces possible across a run.

### 7. Bloodied Coin — rare, risk
- **Unlock:** Clear any blind with 3+ risk-archetype catalysts owned
- **Desc:** All owned risk catalysts grant +50% more upside (penalty unchanged).
- **Flavor:** Pay the tax twice, keep the savings thrice.
- **Design intent:** Risk-tribal payoff. Encourages stacking risk catalysts (Bone Tax + Witch's Bargain + Hollow Bishop) for compounded reward without flat-buffing the penalties.

### 8. The Confessor — uncommon, mods
- **Unlock:** Equip 4 mods on a single die (requires Forged Links voucher)
- **Desc:** Mods on dice with 3+ slots filled fire one extra time.
- **Flavor:** A heavy die speaks twice.
- **Design intent:** Rewards mod-loaded builds. Currently Forged Links → 3 mod slots is reachable but feels like overkill on most dice. Confessor turns that overkill into a strategic objective.

### 9. Hourglass — rare, timing
- **Unlock:** Clear Ante 4 in under 30 hands total (counts hands played across all blinds)
- **Desc:** +1 hand per blind. Blind target +10%.
- **Flavor:** More breath, more weight.
- **Design intent:** Speedrun reward. Pushes "play efficiently" runs while still being a useful catalyst for slow grinders (more hands = more time to scale).

### 10. The Reckoning — legendary, combo
- **Unlock:** Trigger all 5 easter eggs (Mirrored Hand, The Answer, Pi Approximation, Eris Apple, Lucky Seven) across runs
- **Desc:** First hand of every blind: ×2 mult AND +50 chips.
- **Flavor:** The cosmos remembers what you found.
- **Design intent:** Easter-egg-completion reward. Stacks with Lucky Streak (common, also fires on first hand) for a "first hand is everything" build identity.

---

## Mods (5)

### 1. Calibrated — rare mod
- **Unlock:** Clear any run without using a Pin consumable (Pin Six / Pin One / Pin Three)
- **Desc:** First scoring die: +15 chips.
- **Flavor:** No shortcut taken.
- **Design intent:** Anti-Pin reward. Honors players who scored their dice raw. Sits as the only "first scoring die specifically" effect in the mod set.

### 2. Reckless — uncommon mod
- **Unlock:** Bust 5 times on a single constellation (tracked per-constellation)
- **Desc:** Die: +3 mult per scoring fire. Mod destroyed on bust (`loseOnBust: true`).
- **Flavor:** Burn it. Get burned. Bring it again.
- **Design intent:** High-fire reward with a real cost. Brittle mod with disposable-by-design framing.

### 3. Sun-Forged — legendary mod
- **Unlock:** Clear Supernova stake on any constellation
- **Desc:** Die: in captain-crew scoring (Argo), this die is always the captain. In standard scoring, +5 mult.
- **Flavor:** Steel that crossed the corona.
- **Design intent:** Endgame stake reward. Argo-specific upside + flat mult in other modes ensures it's not constellation-trapped.

### 4. Heirbound — rare mod
- **Unlock:** Carry the same mod on the same die slot from blind 1 to blind 12 of a run (without forge swap)
- **Desc:** Survives bust (overrides `loseOnBust`).
- **Flavor:** Carved in. Doesn't leave.
- **Design intent:** Inverts the Brittle / Reckless pattern. Rewards players who keep a build coherent across the entire run.

### 5. Veiled — uncommon mod
- **Unlock:** Lock all dice and skip rerolling for 3 consecutive hands in a single blind
- **Desc:** Die scores ×1.25 chips when it carried over its lock from the previous hand.
- **Flavor:** The die that didn't move learned the wager.
- **Design intent:** Rewards calm-play. The lock-hoarder playstyle finally has a mod that pays it.

---

## Unlock Infrastructure Notes

Currently `clearBlindLegendaryUnlocks` only handles:
- Constellation-tied unlocks (Eclipse Pact on Eclipse clear)
- Dust-threshold unlocks (Heirloom Locket at 100 lifetime dust)

To support this roadmap's unlock conditions, extend the unlock system with:

1. **Run-end unlock hooks** — fire on `bustBlind` + `clearBlind` (run-end branch only)
   - Tracks: bust count by stake (Crown of Skulls), bust count by constellation (Reckless), Patience Counter trigger count per run (The Patient)

2. **Cross-run accumulator state** in `meta` — for unlocks that need cumulative tracking
   - `meta.bustCountByStake: Record<string, number>` (Crown of Skulls)
   - `meta.bustCountByConstellation: Record<string, number>` (Reckless)
   - `meta.constellationClears: Set<string>` (Cosmic Compass)
   - `meta.codexComplete: boolean` (Stargazer)

3. **In-run accumulators** for run-scoped unlock checks
   - `run.patienceCounterFires: number` (The Patient)
   - `run.handsPlayedTotal: number` already exists — Hourglass uses with goalIdx ≥ 11
   - `run.locksHeldStreak: number` (Veiled)
   - `run.pinConsumablesUsed: number` (Calibrated)

4. **New unlock event** — `onCatalystUnlocked` bus event so a toast can celebrate the moment. Currently unlocks happen silently inside `clearBlindLegendaryUnlocks`. Adding a toast for first-time unlocks gives the player closure on the chase.

5. **Codex Mysteries-style "unlocked / locked / hint" rendering** in the catalyst tab so players can see what they're chasing. Same UI pattern as the existing Whispers (easter eggs) tab — `???` silhouette + one-line hint, flips to full text on unlock.

---

## Shipping Order (Recommendation)

If shipping incrementally, do this order:

1. **Salt of the Earth** + **Heirbound** first — simplest unlock conditions (end with 50 shards / carry a mod 12 blinds). Tests the run-end + in-run accumulator pattern.
2. **Hourglass** + **The Patient** next — both use run-scoped accumulators. Light infra extension.
3. **Calibrated** + **Veiled** — adds two more in-run accumulators. Mods feel different from catalysts; a small mod batch is good before the bigger catalyst tier.
4. **Cosmic Compass** + **Stargazer** — cross-run accumulators. Bigger meta-state extension.
5. **Reckless** + **Bloodied Coin** — bust tracking. Different infra surface.
6. **The Confessor** — requires Forged Links voucher purchase + 4 mods on one die. Pure in-run state.
7. **Crown of Skulls** — cross-run bust-by-stake tracking. Heaviest infra.
8. **Voidwalker** — endless mode integration. Reuses existing `endlessLap` state.
9. **Sun-Forged** — Supernova clear. Reuses existing `stakeProgress` state.
10. **The Reckoning** — easter-egg completion. Reuses existing `meta.easterEggs` set.

Total: 5–8 hours of design+code per item once the unlock infrastructure (#1 above) is in place. Infrastructure itself: ~1 day of work.

---

## What This Does Not Cover

- **Per-catalyst portrait art** — these are line-art glyphs only, like the existing 67 in `public/brand/catalysts/`. Painted portraits are out of scope (see catalyst-card-system-brief.md stretch deliverable).
- **Balance numbers** — the listed values are starting points. Each catalyst needs simulation (`tools/sim/`) before ship.
- **Mod-tier editions for new mods** — Calibrated / Reckless / etc inherit foil/holo/poly edition mechanics from the existing mod system. No special edition handling required.
- **Cosmetic shop unlocks** — the cosmetic dust shop (Aurora Lyra, Ember Argo, etc.) is a separate progression track. These catalyst/mod unlocks are the *mechanical* chase; cosmetics are the *vanity* chase.
