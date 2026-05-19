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
    // Per-catalyst fire counter — increments once per onUpgradeTriggered
    // event whose id resolves to a catalyst (via catalystIdFromEvent).
    // Drives the Awakening visual layer: a catalyst at or above its
    // awaken threshold (data/catalysts.ts AWAKENING_THRESHOLDS) gets
    // a "★ AWAKENED" badge on the strip + tooltip uplift. Mechanical
    // amplification is intentionally a v2 follow-up — needs balance
    // playtesting before adding multiplicative power.
    catalystFires: Record<string, number>;
  };
  // Audit (mid-run risk event) — true once the player has resolved the
  // ante-3 audit modal (either gambled or skipped). Stays false through
  // antes 1 and 2 so the modal pops on ante 3 entry.
  auditResolved: boolean;
  // Generic per-catalyst stack counter. Used by the new scaling catalysts
  // (Lodestone, Comet Trail, Memento Star, Ouroboros, Tide, Event Horizon,
  // Highwater, Heirloom Locket, Star Chart). Keyed by catalyst id; value
  // semantics are per-catalyst. Survives across blinds, resets on bust
  // (handled in transitions.bustBlind).
  catalystStacks: Record<string, number>;
  // Lunar Phases catalyst — 0..7 moon cycle counter. Each hand advances
  // the phase; full moon (8) bakes +0.1× mult into `lunarBakedMult` then
  // resets to 0. Run-scoped.
  lunarPhase: number;
  lunarBakedMult: number;
  // Parallel array to diceMods: per-mod-instance stack counters for the
  // scaling die-mods (Tally Mark, Cadence, Veteran, Glutton, Dormant,
  // Ballast, Pyre Mark). Length-synced with diceMods at all times.
  diceModStacks: number[][];
  // Run-scoped easter-egg flags. Surfaced via Codex + tooltips. Persisted
  // so a discovery in run N still hints to the player in run N+1.
  // Inverted: when `theAnswerArmed` is true, a hand totaling 42 grants a
  // permanent +1 reroll for the rest of the run; resets each run.
  theAnswerArmed: boolean;
  // Mirrored Hand easter egg — set on START_BLIND when two catalysts with
  // palindromic names are owned. Causes the first hand's scoring dice to
  // retrigger once.
  mirroredHandActive: boolean;
  // Cosmic Lap (Pillar D) — endless-mode loop counter. 0 during the
  // normal 4-ante run. Increments by 1 each time the player clears Ante
  // 4 Final Trial and picks "Continue into the Cosmic Lap". Drives
  // target scaling (see targetForBlind in data/blinds.ts) and selects
  // the active cosmic afflictions below.
  endlessLap?: number;
  // 2026-05-19 stacking afflictions — IDs of EVERY active cosmic
  // affliction for the current lap (from data/cosmicAfflictions.ts).
  // Empty in normal-run; populated by startCosmicLap with all entries
  // whose lapTrigger <= endlessLap. Effects compound in startBlind:
  // target-tax multiplies, compounding-tax sums, hands-delta sums.
  cosmicAfflictionIds?: string[];
  // Boss debuff id locked in for the CURRENT ante's boss blind. Picked
  // ahead of time (NEW_RUN seeds ante 1's; clearBlind picks the next on
  // boss-clear) so:
  //   - the Hub can reveal the curse before the player clicks Begin,
  //   - START_BLIND uses a stable id instead of re-rolling on every
  //     refresh + boss entry.
  // Null on legacy saves; startBlind falls back to a fresh roll and
  // saves it so the next refresh stays consistent.
  upcomingBossId?: string | null;
  // How this run's seed got chosen — drives whether the seed is visible
  // during play. 'random' = auto-generated (hidden until postmortem),
  // 'player' = explicit Enter-Seed entry (visible throughout),
  // 'daily' = daily-challenge seed (visible throughout, the player
  // already knows they're on a daily). Postmortem reveals the seed
  // for ALL three so a great run can be shared back. Legacy saves
  // default to 'random'.
  seedSource?: 'random' | 'player' | 'daily';
  // 2026-05-16 unlock-content roadmap — in-run accumulators that
  // drive new unlock conditions (see docs/unlock-gated-content-roadmap.md).
  // All optional for back-compat with older saves.
  //
  // The Patient: count of Patience Counter ×3 fires this run.
  patienceCounterFires?: number;
  // Veiled mod: tracks consecutive hands where the player didn't reroll
  // (locked all dice between scoring and the next hand). Reset on any
  // REROLL_REQUESTED.
  consecutiveLockedHands?: number;
  // Calibrated mod: count of Pin consumables used this run. Pin Six,
  // Pin One, Pin Three — bumped on consumable apply.
  pinConsumablesUsed?: number;
  // Monotonic counter of shop rolls (OPEN_SHOP + REROLL_SHOP). Used as
  // the scope discriminator for the seeded shop RNG so a refresh
  // mid-shop produces the same offers and a deterministic reroll
  // sequence falls out of the seed alone. Increments by 1 on each
  // shop roll; resets to 0 on NEW_RUN.
  shopSeq?: number;
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
    catalystFires: {},
  },
  auditResolved: false,
  catalystStacks: {},
  lunarPhase: 0,
  lunarBakedMult: 0,
  diceModStacks: Array.from({ length: 5 }, () => [] as number[]),
  theAnswerArmed: false,
  mirroredHandActive: false,
  endlessLap: 0,
  cosmicAfflictionIds: [],
  upcomingBossId: null,
  seedSource: 'random',
  shopSeq: 0,
  patienceCounterFires: 0,
  consecutiveLockedHands: 0,
  pinConsumablesUsed: 0,
});
