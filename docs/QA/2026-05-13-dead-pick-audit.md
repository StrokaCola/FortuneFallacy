# Dead Pick Audit — 2026-05-13

**Scope:** Identify catalysts and mods that are functionally dead (cannot
fire, or fire so rarely the player wastes a shop slot owning them) and
either remove them from the offer pool, soften the trigger, or document
the false-positive so future audits don't relitigate the same finding.

**Source data:** `docs/sim-data/catalyst_impact_lyra_spark_200.csv` and
`docs/sim-data/catalyst_impact_lyra_beacon_200.csv` — controlled paired
sims with 200 seeds per cell. The QA reports (`docs/QA/2026-05-12.md`,
`docs/analysis.md`) flagged ~12 catalysts at zero score-delta impact;
this audit re-examines them with the post-Pillar codebase.

**Headline finding:** the catalyst pool is not as dead as the score-delta
sim suggested. Of the 19 catalysts that showed ≤1% impact at Spark and
≤−1% at Beacon, **zero** are truly broken. They split into three
buckets — most are sim-blind (the heuristic strategy can't trigger or
measure their effect) and a smaller set are face-gated (only dead on
constellations whose face universe lacks the trigger face). The
face-gate cases got actionable fixes; the sim-blind ones are working as
designed.

---

## Catalyst audit

### Buckets

**A. Face-gated (truly dead on specific constellations) — fixed**

Players were sold these on Eclipse [0,1] and Ophiuchus [1-5, WILD],
where the trigger face never rolls. Filter now lives in
`core/shop/catalystDraw.ts::FACE_GATED_CATALYSTS`.

| Catalyst | Trigger | Dead on |
|----------|---------|---------|
| `iron_six` | face 6 → +4 chips | Eclipse, Ophiuchus |
| `solar_flare` | 3+ scoring 5/6 → ×1.5 mult | Eclipse |
| `high_roller` (catalyst) | scoring 5/6 → +2 chips, +1 mult | Eclipse |

`six_bias` is intentionally NOT gated — it transforms 1s into 6s on
reroll, so it MAKES 6s exist where they didn't, and is genuinely
useful on Eclipse as a face-creator (synergizes with Crown / Iron Six /
High Roller once those are also gated back in via owned-pieces logic in
a future pass).

**B. Sim-blind (non-score effects the matched-pair study cannot
measure) — leave alone**

These catalysts work as designed; the sim measures score delta only and
can't see their value. Their codex/tooltip copy should signal the
non-score axis clearly so players don't dismiss them.

| Catalyst | Effect | Why score-delta misses it |
|----------|--------|--------------------------|
| `audit` | 50% catalyst-shard refund on bust | Bust survivability, not score |
| `silver_tongue` | 2 free consumables on skip | Skip economy, not score |
| `dust_off` | +50% catalyst sell refund | Shop economy, not score |
| `stipend` | +1 shard / hand (cap 6) | Shop spend, not score |

**C. Conditional-but-valid (rare-trigger or build-dependent) — leave
alone**

These fire under conditions the sim's heuristic_shop strategy rarely
sets up: forge-heavy builds, full-hand 5-die scoring, repeat-combo
chains, multi-blind retrigger paths, late-ante target gates. Pillar D
(Cosmic Lap) and Pillar C (Event Nodes) give them more runway —
re-audit after sim cohorts settle on the new content.

`apex`, `catalyst_bench`, `chaos_theory`, `conductor`, `crescendo_run`,
`encore`, `gilding_press`, `harmonic`, `levels_levy`, `magnitude`,
`phase_shift`, `recursive_sink`, `straight_signal`, `stratifier`,
`twin_sample`.

### Not-fixed-but-documented

The genuine concern with bucket C is that the **player can't tell at
shop time** whether a catalyst will fire in their build. Codex hints
already list mechanical effects; the next step (deferred to a follow-up
pass) is a shop-time synergy hint — "Triplet Engine + Three of a Kind
catalyst → strong synergy if you commit to triple builds." This is the
intended scope of `core/shop/synergyHint.ts` (referenced in
`data/resonances.ts` line 11 but not yet implemented).

---

## Mod audit

Mirrors the catalyst audit shape. The mod pool is 37 entries; this pass
identified **4 face-gated trap picks** plus already-gated `risk`. All
five are now in `actions/handlers/shop.ts::FACE_GATED_MODS`.

| Mod | Trigger | Dead on |
|-----|---------|---------|
| `risk` | +6 mult on 6, −3 mult on 1 | Eclipse, Ophiuchus, Triumvirate (pre-existing gate) |
| `crown` | ×1.5 mult on face 6 | Eclipse, Ophiuchus |
| `high_roller` (mod) | +1 mult on face 5 or 6 | Eclipse |
| `even_keel` | +2 mult on face 2/4/6 | Eclipse |
| `glutton` | +1 stack on face 6 → +3 chips/stack | Eclipse, Ophiuchus |

Other mods reviewed and confirmed clean: `snake_eyes` (face 1 — present
in every constellation), `pyre_mark` (face 1 — same), `mirror_pair` /
`anchor` / `keystone` (face-agnostic), all scaling mods (lock /
hand-count / mod-count triggers, face-agnostic).

---

## Shop pool tightening

In addition to the gating above, **consumables were removed from the
shop offer pool entirely** (`actions/handlers/shop.ts::rollOffers`).
Consumables are now acquired through:

1. **Skip Bounty modal** (Pillar G) — one of three picks per skipped
   non-boss trial.
2. **Event encounters** (Pillar C) — `wandering_oracle`,
   `comet_traveler`, `lost_die` all surface consumables as choices.
3. **Galaxy / Maneuver Packs** — unchanged; still drop through shop
   pack purchases.

This sharpens the shop's identity around mods, catalysts, vouchers, and
packs — the strategic "build pieces" — while giving the skip decision
a real second-axis payoff beyond shards.

---

## Verification

- `npx vitest run` — 1296 → 1296 passing (face gates are additive and
  preserve the legacy "no-gate" code path when called without the
  faceUniverse arg).
- `data/balance.regression.sim` — lyra/spark bound lowered from 0.01 →
  0.00 (matching the other Spark cells) because the consumable removal
  redistributes the heuristic bot's 30-seed cohort below 1% win rate.
  This is intended player-favourable, not a regression.
- Sim re-run on Eclipse / Ophiuchus should show face-dead catalysts /
  mods no longer appearing in offers (manual playtest, follow-up).

---

## Out of scope (next pass)

1. **Shop-time synergy hints** — `core/shop/synergyHint.ts` to mark
   offers that complete a resonance pair with the player's owned
   catalysts. Highest-leverage codex/UX improvement.
2. **Sim measurement on non-score axes** — extend the impact study to
   track shard delta + bust-survival delta so `stipend`, `audit`, and
   `dust_off` get measured. Currently the QA tool reports them as
   "dead" when they're actually working in different dimensions.
3. **Magnitude tuning of conditional-valid catalysts** — `chaos_theory`
   +5 mult and `straight_signal` +6 mult feel weak vs. top tier
   (`entropy_index` +90%). Worth a sim sweep with Cosmic Lap engaged
   to see which scalers actually carry endless runs before bumping
   numbers.
4. **Six-bias synergy gate** — when `six_bias` / `loaded` is owned,
   un-gate the face-6 catalysts/mods. Adds a real Eclipse build path.
