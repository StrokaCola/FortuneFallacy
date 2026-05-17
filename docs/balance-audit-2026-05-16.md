# FortuneFallacy2 — Balance + Catalyst Audit

Authored: 2026-05-16. Senior-game-dev review across all 92 catalysts, 6 stakes, 8 bosses, 6 astral perks, and the shop draw weights. Goal: surface dead picks, outliers, and missing design space; propose specific tunings.

---

## Headline Findings

**Strengths (don't touch):**
- ✓ Honest risk-tier tradeoffs (Bone Tax / Witch's Bargain are balanced; only Hollow Bishop's penalty is too harsh — see below)
- ✓ Rarity curve well-tuned (3 legendaries, gated by ante + special conditions)
- ✓ Shop archetype-bias (70%) creates real build coherence without forcing picks
- ✓ Pluto phase-2 `only_even_faces` is a *rule change*, not just a debuff — strong design

**Issues:**
- ⚠ **Combo archetype oversaturated** (18 catalysts, overlapping triggers — Pair Dynamo + Lucky Streak + Cold Hand + Chance Doctrine all compete for the same "any combo" slot)
- ⚠ **Scaling archetype oversaturated** (19 catalysts — too many multiplicative lanes)
- ⚠ **Tempo caps too early** (+0.5× per tier capped ×3 → hits cap by hand 6, dead by Ante 2)
- ⚠ **Hollow Bishop penalty inconsistent** (zero-chip erase vs Bone Tax's −15% / Witch's Bargain's −8/die — binary too harsh)
- ⚠ **Recursion Lens is a parasitic legendary** (zero solo value, requires another retrigger to fire)
- ⚠ **Prime Resonance dead-weight rare** (Mult^1.05 per die → only +11% impact, overshadowed by every other rare scaling option)
- ⚠ **Constellation-locked catalysts feel weak** (modest-power, not "build anchors")
- ⚠ **Pyre → Beacon stake cliff** (51% → 15% clear-rate drop from a single +10% target + 25% shop tax)

**Top 10 catalysts by impact (Lyra/Spark sim, NoBuy strategy):**
| Rank | Catalyst | Delta% | Notes |
|---|---|---|---|
| 1 | Eclipse Pact (leg, combo) | +244% | Unconditional +50 chips/+5 mult every hand |
| 2 | Shard Lung (uncommon, economy) | +173% | Sustains shop access mid-game |
| 3 | Prism Lens (rare, combo) | +88.7% | +25 chips & ×1.5 mult any combo |
| 4 | Entropy Index (rare, face) | +64.2% | ×1.25 mult per unique face (Lyra 5 unique = ×3.05) |
| 5 | Metronome (rare, timing) | +48% | Odd/even alt, always fires |
| 6 | Lucky Streak (common, combo) | +47.4% | First hand: +30 chips & +3 mult |
| 7 | Triplet Engine (uncommon, combo) | +43.9% | 3oak → ×1.75 mult |
| 8 | Pair Dynamo (common, combo) | +41.8% | 1-pair → +5 mult |
| 9 | Nova Burst (rare, scaling) | +36.2% | Mult ×(1+ante×0.4) |
| 10 | Shard Sink (common, economy) | +35.9% | Spend 1 shard → ×1.5 mult |

---

## Critical Tunings (Ship First)

### 1. Tempo (Solos) — cap raise + ramp extension
- **Current:** +0.5× per tier-up hand, capped ×3.0 → maxes at hand 6
- **Proposed:** +0.4× per tier-up hand, capped ×3.5 → maxes at ~hand 9
- **File:** [src-next/core/upgrades/catalysts/tempo.ts](src-next/core/upgrades/catalysts/tempo.ts)
- **Why:** Currently dead weight by Ante 2. Extending the ramp gives Tempo a presence across the full run instead of front-loading.

### 2. Hollow Bishop — soften One/Two Pair penalty
- **Current:** One Pair / Two Pair → **0 chips** (binary erase)
- **Proposed:** One Pair / Two Pair → **chips ×0.5** (50% tax)
- **File:** [src-next/core/upgrades/catalysts/hollowBishop.ts](src-next/core/upgrades/catalysts/hollowBishop.ts)
- **Why:** Bone Tax taxes 15%, Witch's Bargain taxes 8/die. Hollow Bishop's zero-chip is mechanically harsher than its rare-tier siblings. 50% tax preserves the "discourage pairs" identity without killing thin-build runs.

### 3. Recursion Lens — standalone viability
- **Current:** "Retriggers the first retrigger" — requires another retrigger catalyst (Polaris/Refrain/etc) to activate, zero solo value
- **Proposed:** "All retriggers fire twice this hand"
- **File:** [src-next/core/upgrades/catalysts/](src-next/core/upgrades/catalysts/)
- **Why:** A legendary should be powerful alone. Reframing to "retrigger amplifier" gives it solo value AND retains multiplicative scaling with other retrigger catalysts.

### 4. Prime Resonance — remove or retune
- **Current:** Mult^1.05 per die → ×1.28 at 5 dice. +11% impact, weakest rare in the pool.
- **Option A:** Remove from CATALYST_META + index — frees a rare slot.
- **Option B:** Mult^1.10 per die → ×1.61 at 5 dice, more competitive with Nova Burst (+36%).
- **Why:** Trap rare. Either delete it or make it pull its weight.

### 5. Entropy Index — slight nerf
- **Current:** ×1.25 mult per unique face → ×3.05 at 5 unique (Lyra). 80%+ auto-pick rate.
- **Proposed:** ×1.20 per unique face → ×2.49 at 5 unique. Or: ×1.25 with "requires ≥4 unique faces" gate.
- **Why:** Currently a strict upgrade over most face catalysts. A gentler nerf keeps it strong but not auto-pick.

### 6. Shard Lung — slight nerf
- **Current:** +ante shards at blind start (Ante 4 = +4)
- **Proposed:** +ceil(ante/2) shards (Ante 4 = +2)
- **Why:** +173% impact is the second-highest in the game. Currently this single catalyst sustains the entire mid-late economy. A slight ramp-down keeps it useful without making it the single must-buy uncommon.

---

## New Catalysts (5 Proposals, Fill Design Gaps)

### 1. Piggy Bank — economy, uncommon
**Desc:** Each hand, bank 10% of chips gained as shards (capped at 5/hand).
**Flavor:** "Every coin saved is a coin earned tomorrow."
**Fills:** Chip → shard conversion lane. Sustains shop access on chip-heavy builds. Stacks with Usurer (uncapped mult per shard above 10) for late-game scaling.

### 2. Runaway — scaling, uncommon
**Desc:** Each scoring hand that's a straight: +1 stack. Each stack: +0.10× mult permanent (resets on bust).
**Flavor:** "A line that builds on itself."
**Fills:** Straight-archetype scaling. Triumvirate / Lyra straight builders currently lack a snowball lane.

### 3. Double or Nothing — risk, rare
**Desc:** 25% chance each hand: Mult ×2. Otherwise: Mult ×0.5. Expected ×1.25 with 50% variance.
**Flavor:** "The house's favorite game."
**Fills:** True variance as a strategic lever. Synergizes with Patience Counter / Streak Seeker (time the gamble).

### 4. Resonance Cascade — collision, rare
**Desc:** Each collision this round adds +0.05× mult permanent (cap +1.0×). Resets on bust.
**Flavor:** "Small taps echo louder together."
**Fills:** Collision currently has 3 catalysts; this one bridges physics → long-term scoring, encouraging aggressive rolling.

### 5. Leveling — combo, uncommon (Triumvirate-locked)
**Desc:** Three of a Kind and below count as one tier higher for downstream catalysts (1-pair triggers Triplet Engine, etc).
**Flavor:** "Three stones build as high as four."
**Fills:** Triumvirate identity catalyst. Currently the constellation struggles because d12 dice rarely combo; this rule-change lets lower tiers do the work, mirroring Captain's Wage for Argo.

---

## Cuts (Tighten the Pool)

- **Prime Resonance** (rare, scaling) — see #4 above. Trap rare.
- **Dust-Off** (common, utility) — +50% sell value. Only triggers if you're selling catalysts mid-run, which almost never happens. Slot better spent on a reroll-discount common.
- **Audit** (uncommon, utility) — refund 50% shards on bust, self-destructs. Only triggers on *failure*. Either remove or repurpose as "Spare Reroll on bust" for guaranteed value.

---

## Stake Balance — Pyre Cliff

From sim data: clear-rate cliff at Pyre → Beacon (51% → 15%, 3.4× drop).
- **Pyre:** 1.2× target, −1 reroll, 1.0× shop. 51% clear.
- **Beacon:** 1.3× target, −1 reroll, 1.25× shop. 15% clear.

Beacon adds 10% target AND 25% shop cost on top of Pyre's reroll loss. That's three stacked penalties between adjacent stakes vs. one or two between every other pair.

**Proposal:** Either soften Beacon (drop shop cost to 1.15× or target to 1.25×) or add a "Pyre+" intermediate stake at 1.25× target, −1 reroll, 1.1× shop to bridge the gap.

**File:** [src-next/data/stakes.ts](src-next/data/stakes.ts)

---

## Boss Concerns

**Pluto Phase 2 (`only_even_faces`):** Beautiful structural twist, but biases against constellations with low even-face distribution:
- Fibonacci faces [1,1,2,3,5,8] → 33% even
- Ophiuchus [1-5 + WILD] → 0% native even (WILD-only via substitution)
- Lyra [1-6] → 50% even (fine)

**Recommendation:** Monitor Pluto Phase 2 clear-rates by constellation post-ship. If Fibonacci/Ophiuchus drop >20% vs Lyra, soften phase 2 to "1s cannot be locked" instead of "only even faces."

---

## Astral Perk Buy Order (Recommendation)

Players should buy perks in this order for max ROI:

1. **Astrolabe** (120 dust) — *information leverage*. Knowing the boss debuff lets you pivot strategy.
2. **Wider Orbit** (250 dust) — *synergy density*. +1 catalyst slot opens triple-stacks.
3. **Reliquary** (175 dust) — *random consumable*. Wild card with high ceiling.
4. **First Breath** (90 dust) — *Ante 1 survival*. Skip if comfortable on Spark.
5. **Patient Eye** (60 dust) — *reroll discount*. Incremental QoL.
6. **Morning Star** (25 dust) — *+2 starting shards*. Marginal. Skip until everything else owned.

Total: 720 dust → ~36 runs at average 20 dust/run.

**Missing perk:** "Astral Reset" (one-time perk that disables all owned perks for a run, useful for clean-slate challenges). Pure-cosmetic ladder support — no dust refund.

---

## Closing

The catalyst system is **fundamentally healthy** — clear power tiers, emergent synergies, honest tradeoffs in the risk tier. The bottlenecks are: (a) a handful of dead-weight catalysts (Prime Resonance, Dust-Off, Audit, Recursion Lens) crowding the pool; (b) one outlier ramp (Tempo) capping too early; (c) one outlier penalty (Hollow Bishop) too harsh vs its risk-tier siblings; and (d) one stake cliff (Pyre → Beacon).

Ship the 6 critical tunings + 5 new catalysts and the catalyst set tightens from 92 → ~90 (cuts + adds) with a healthier power distribution. Skipping the new catalysts is fine; the critical tunings alone fix the biggest playtest pain points.

---

*Audit cross-references [docs/analysis.md](./analysis.md), [docs/sim-data/catalyst_impact_lyra_spark.csv](./sim-data) (if present), and `tools/sim/` outputs.*
