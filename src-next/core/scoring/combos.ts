// Combo definitions and predicates. The `test` predicate takes a small
// context describing the dice landscape (count thresholds, straight length
// bonus) so different constellations can raise or lower thresholds without
// duplicating the predicate list.

export type ComboCtx = {
  comboCountBonus: number;   // raise n-of-a-kind requirement (Mensa = +1)
  straightLenBonus: number;  // raise/lower straight length requirement (Mensa = +1, Triumvirate = -2)
  diceCount?: number;
  faceUniverse?: number[];
};

const DEFAULT_CTX: ComboCtx = { comboCountBonus: 0, straightLenBonus: 0 };

export type ComboDef = {
  id: string;
  name: string;
  tier: number;
  chips: number;
  mult: number;
  test: (countsDesc: number[], longestRun: number, ctx?: ComboCtx) => boolean;
};

const has = (counts: number[], n: number, ctx?: ComboCtx) =>
  (counts[0] ?? 0) >= n + (ctx?.comboCountBonus ?? 0);

const hasTwoOf = (counts: number[], n1: number, n2: number, ctx?: ComboCtx) => {
  const bonus = ctx?.comboCountBonus ?? 0;
  return (counts[0] ?? 0) >= n1 + bonus && (counts[1] ?? 0) >= n2 + bonus;
};

const straight = (longestRun: number, n: number, ctx?: ComboCtx) =>
  longestRun >= Math.max(2, n + (ctx?.straightLenBonus ?? 0));

export const COMBOS: ComboDef[] = [
  { id: 'five_kind',   name: 'Five of a Kind',  tier: 8, chips: 100, mult: 20, test: (v, _s, c = DEFAULT_CTX) => has(v, 5, c) },
  { id: 'four_kind',   name: 'Four of a Kind',  tier: 7, chips: 60,  mult: 12, test: (v, _s, c = DEFAULT_CTX) => has(v, 4, c) },
  { id: 'lg_straight', name: 'Large Straight',  tier: 6, chips: 40,  mult: 7,  test: (_v, s, c = DEFAULT_CTX) => straight(s, 5, c) },
  { id: 'full_house',  name: 'Full House',      tier: 5, chips: 35,  mult: 8,  test: (v, _s, c = DEFAULT_CTX) => hasTwoOf(v, 3, 2, c) },
  { id: 'sm_straight', name: 'Small Straight',  tier: 4, chips: 30,  mult: 5,  test: (_v, s, c = DEFAULT_CTX) => straight(s, 4, c) },
  { id: 'three_kind',  name: 'Three of a Kind', tier: 3, chips: 30,  mult: 5,  test: (v, _s, c = DEFAULT_CTX) => has(v, 3, c) },
  { id: 'two_pair',    name: 'Two Pair',        tier: 2, chips: 20,  mult: 3,  test: (v, _s, c = DEFAULT_CTX) => hasTwoOf(v, 2, 2, c) },
  { id: 'one_pair',    name: 'One Pair',        tier: 1, chips: 10,  mult: 2,  test: (v, _s, c = DEFAULT_CTX) => has(v, 2, c) },
  // 2026-05-13 floor lift: was chips:0 (a true zero). A bare-roll Chance now
  // pays a small consolation 5 chips so the score readout never reads as
  // mockery on a no-pattern hand. Catalysts targeting Chance (Cold Hand,
  // Pair Dynamo's miss-floor) still proc on top.
  { id: 'chance',      name: 'Chance',          tier: 0, chips: 5,   mult: 1,  test: () => true },
];
