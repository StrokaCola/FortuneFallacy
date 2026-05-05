export type MetaSlice = {
  playerName: string;
  unlocks: string[];
  highScores: { name: string; score: number; date: number }[];
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
});
