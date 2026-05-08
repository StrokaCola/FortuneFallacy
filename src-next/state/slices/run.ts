export type RunSlice = {
  seed: number;
  shards: number;
  ante: number;
  goalIdx: number;
  // Run-style choice made on the constellation select screen. Default 'lyra'
  // is the legacy 5×d6 game. See data/constellations.ts.
  constellationId: string;
  catalysts: string[];
  vouchers: string[];
  consumables: string[];
  ownedMods: string[];
  // Per-die mod attachments. Lives on the run (not the round) so Forge
  // changes persist across blinds. Length matches the constellation's dice
  // count (5 for Lyra, 7 for Mensa, 1 for Argo, etc).
  diceMods: string[][];
  handsPlayed: number;
  compoundingStacks: number;
  // Monotonic counter advanced once per ROLL_REQUESTED / REROLL_REQUESTED.
  // Mixed into the pipeline seed so each physical roll within a round
  // produces a different (but reproducible) outcome.
  rollCounter: number;
  // Tempo catalyst: number of consecutive hands of strictly higher combo
  // tier than the previous hand. Resets to 0 on tie/decrease. Run-scoped
  // (does NOT reset on bust — survives across blinds within the run).
  tempoStreak: number;
  // Combo tier of the most recent hand played in this run (or -1 if none).
  // Used by Tempo to detect strict increases.
  tempoLastTier: number;
  // Quorum catalyst: id of the most recent combo (e.g. 'four_kind') and
  // a streak counter for repeats of the same combo across consecutive hands.
  lastComboId: string | null;
  comboStreak: number;
  // Galaxy consumables raise per-combo levels. Each level adds flat chips
  // and flat mult to the combo's base values in the EVALUATION phase
  // (see core/phases/evaluation.ts and core/consumables/galaxies.ts).
  // Run-scoped: resets on a new run, persists across blinds within the run.
  comboLevels: Record<string, number>;
  // Per-catalyst edition stamp. Keyed by catalyst id (catalysts can't be
  // duplicated within a run — see catalyst.ts GRANT_CATALYST guard). Edition
  // bonuses are applied in core/phases/upgrades.ts immediately after the
  // catalyst's own apply, so they ride any later catalyst multipliers.
  // Cleared on SELL_UPGRADE so a re-bought catalyst doesn't inherit the
  // old stamp.
  catalystEditions: Record<string, CatalystEdition>;
  // Mod editions live in PARALLEL arrays to ownedMods/diceMods. We don't
  // migrate diceMods to ModInstance[][] because the 3D renderer reads
  // string[][] in many places — keeping the id arrays untouched avoids a
  // 50-site cascade. The parallel structure must be kept length-synced
  // with the id arrays (see actions/handlers/dice.ts and shop.ts).
  ownedModEditions: (ModEdition | null)[];
  diceModEditions: (ModEdition | null)[][];
  // Audit catalyst — running tally of shards spent on catalysts this run.
  // BUY_OFFER for kind=catalyst increments by the offer's price. Audit
  // refunds 50% of this on bust. Persists across blinds within the run.
  catalystShardSpend: number;
  // Stake id chosen on ConstellationSelect. Drives target multiplier, hand
  // count, reroll budget, shop pricing. Default 'spark' is the canonical run.
  stakeId: string;
  // Optional Challenge id when this run was started from ChallengeSelect.
  // Empty string = standard run. Challenge modifiers stack on top of stake.
  challengeId: string;
  // Daily-challenge marker. When non-null, this run was started from the
  // daily seed and its score should submit to the daily-leaderboard
  // partition. Format: 'YYYY-MM-DD' (UTC). See online/dailyChallenge.ts.
  // Daily runs disable astral perks for fair leaderboard comparison.
  dailyDate: string | null;
  // Per-run telemetry. Aggregated in actions/handlers/roll.ts (SCORE_HAND)
  // by walking the pipeline's onUpgradeTriggered events. Read by the
  // post-run Postmortem to celebrate the player's peak moment + show
  // which catalysts carried their build. Resets on NEW_RUN.
  runStats: {
    // Best total single-hand score across the run.
    peakHand: number;
    // Combo id at the peak hand (e.g. 'four_kind', 'lg_straight').
    peakCombo: string | null;
    // Total chips contributed per catalyst id, summed across all hands.
    // Edition fires (`edition:foil@stratifier`) and catalyst-driven mod
    // re-fires (`gilding_press@N`, `encore`) attribute back to the
    // owning catalyst via catalystIdFromEvent. Pure mod fires (`mod:*`)
    // are excluded — those credit no catalyst.
    catalystChips: Record<string, number>;
    // Cosmic Dust gained THIS run (positive sum across blinds + win
    // bonus). Pre-bust/win baseline. Accumulated in core/round/transitions.ts
    // alongside the meta-currency mutation. Reset on NEW_RUN.
    dustEarned: number;
  };
  // Audit (mid-run risk event) — true once the player has resolved the
  // ante-3 audit modal (either gambled or skipped). Stays false through
  // antes 1 and 2 so the modal pops on ante 3 entry.
  auditResolved: boolean;
};

// Visual + mechanical variant for catalysts. Mirrors Balatro's foil/holo/poly
// system at smaller magnitudes, scaled to FortuneFallacy's economy.
//
//   foil → +50 chips when this catalyst fires
//   holo → +10 mult when this catalyst fires
//   poly → ×1.5 to the catalyst's own contribution this trigger
//   void → costs ZERO catalyst slot (Balatro's Negative analog). Ultra-rare;
//          adds no chip/mult bonus on its own — the slot saving IS the value.
export type CatalystEdition = 'foil' | 'holo' | 'poly' | 'void';

// Mod-tier editions. Same axes, smaller magnitudes than catalyst editions.
//   foil → +20 chips when this mod fires
//   holo → +4 mult when this mod fires
//   poly → ×1.25 to the mod's own contribution this fire
export type ModEdition = 'foil' | 'holo' | 'poly';

export const initialRunSlice = (): RunSlice => ({
  seed: Math.floor(Math.random() * 0xFFFFFFFF),
  shards: 0,
  ante: 1,
  goalIdx: 0,
  constellationId: 'lyra',
  catalysts: [],
  vouchers: [],
  consumables: [],
  ownedMods: [],
  diceMods: Array.from({ length: 5 }, () => [] as string[]),
  handsPlayed: 0,
  compoundingStacks: 0,
  rollCounter: 0,
  tempoStreak: 0,
  tempoLastTier: -1,
  lastComboId: null,
  comboStreak: 0,
  comboLevels: {
    chance: 0,
    one_pair: 0,
    two_pair: 0,
    three_kind: 0,
    sm_straight: 0,
    full_house: 0,
    lg_straight: 0,
    four_kind: 0,
    five_kind: 0,
  },
  catalystEditions: {},
  ownedModEditions: [],
  diceModEditions: Array.from({ length: 5 }, () => [] as (ModEdition | null)[]),
  catalystShardSpend: 0,
  stakeId: 'spark',
  challengeId: '',
  dailyDate: null,
  runStats: {
    peakHand: 0,
    peakCombo: null,
    catalystChips: {},
    dustEarned: 0,
  },
  auditResolved: false,
});
