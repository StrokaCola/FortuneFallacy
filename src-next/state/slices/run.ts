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
};

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
});
