export type ComboDef = {
  id: string;
  name: string;
  tier: number;
  chips: number;
  mult: number;
  test: (countsDesc: number[], longestRun: number) => boolean;
};

export const COMBOS: ComboDef[] = [
  { id: 'five_kind',   name: 'Five of a Kind',  tier: 8, chips: 100, mult: 20, test: (v) => (v[0] ?? 0) >= 5 },
  { id: 'four_kind',   name: 'Four of a Kind',  tier: 7, chips: 60,  mult: 12, test: (v) => (v[0] ?? 0) >= 4 },
  { id: 'lg_straight', name: 'Large Straight',  tier: 6, chips: 40,  mult: 7,  test: (_v, seq) => seq >= 5 },
  { id: 'full_house',  name: 'Full House',      tier: 5, chips: 35,  mult: 8,  test: (v) => v[0] === 3 && v[1] === 2 },
  { id: 'sm_straight', name: 'Small Straight',  tier: 4, chips: 30,  mult: 5,  test: (_v, seq) => seq >= 4 },
  { id: 'three_kind',  name: 'Three of a Kind', tier: 3, chips: 30,  mult: 5,  test: (v) => (v[0] ?? 0) >= 3 },
  { id: 'two_pair',    name: 'Two Pair',        tier: 2, chips: 20,  mult: 3,  test: (v) => (v[0] ?? 0) >= 2 && (v[1] ?? 0) >= 2 },
  { id: 'one_pair',    name: 'One Pair',        tier: 1, chips: 10,  mult: 2,  test: (v) => (v[0] ?? 0) >= 2 },
  { id: 'chance',      name: 'Chance',          tier: 0, chips: 0,   mult: 1,  test: () => true },
];
