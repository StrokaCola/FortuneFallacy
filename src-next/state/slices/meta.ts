export type MetaSlice = {
  playerName: string;
  unlocks: string[];
  highScores: { name: string; score: number; date: number }[];
};

export const initialMetaSlice = (): MetaSlice => ({
  playerName: '',
  unlocks: [],
  highScores: [],
});
