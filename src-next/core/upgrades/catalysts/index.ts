import './stratifier';
import './chaosTheory';
import './sixBias';
import './twinSample';
import './coldHand';
import './entropyIndex';

export const CATALYST_IDS = [
  'stratifier', 'chaos_theory', 'six_bias',
  'twin_sample', 'cold_hand', 'entropy_index',
] as const;
export type CatalystId = typeof CATALYST_IDS[number];
