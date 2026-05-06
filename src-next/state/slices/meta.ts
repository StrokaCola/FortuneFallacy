export type MetaSlice = {
  playerName: string;
  unlocks: string[];
  highScores: { name: string; score: number; date: number }[];
  // Highest cleared stake id per constellation. Indexes into data/stakes.ts STAKES.
  // A constellation present here with stake 'ember' means the player has cleared
  // Ember on that constellation and can now attempt Pyre.
  // Default empty → only Spark is unlocked (the first stake).
  stakeProgress: Record<string, string>;
  // Set of completed challenge ids. Persisted so the codex can render badges.
  challengeWins: string[];
  // Set of catalyst/mod/voucher/boss ids the player has encountered.
  // Used by the Codex to silhouette undiscovered entries.
  discovered: {
    catalysts: string[];
    mods: string[];
    vouchers: string[];
    bosses: string[];
    consumables: string[];
  };
};

// All constellations are seeded as unlocked while the gameplay-side
// unlock-grant logic is still TBD. Codex tabs already render a `???`
// locked state for any id not present here, so flipping this to a smaller
// list (or `[]`) re-enables locking without further code changes.
export const SEEDED_UNLOCKS: string[] = [
  'lyra',
  'mensa',
  'triumvirate',
  'argo',
  'fibonacci',
  'eclipse',
  'polyhedra',
  'ophiuchus',
];

export const initialMetaSlice = (): MetaSlice => ({
  playerName: '',
  unlocks: [...SEEDED_UNLOCKS],
  highScores: [],
  stakeProgress: {},
  challengeWins: [],
  discovered: {
    catalysts: [],
    mods: [],
    vouchers: [],
    bosses: [],
    consumables: [],
  },
});
