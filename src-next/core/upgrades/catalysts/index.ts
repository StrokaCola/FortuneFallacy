import './stratifier';
import './chaosTheory';
import './sixBias';
import './twinSample';
import './coldHand';
import './entropyIndex';
import './compoundingBias';
import './lastThrow';
import './patienceCounter';
import './catalystBench';
import './shardSink';
import './stipend';
import './recursiveSink';
import './encore';
import './phaseShift';
import './ironSix';
import './solarFlare';
import './tempo';
import './conductor';
import './quorum';

export const CATALYST_IDS = [
  'stratifier', 'chaos_theory', 'six_bias',
  'twin_sample', 'cold_hand', 'entropy_index',
  'compounding_bias', 'last_throw', 'patience_counter',
  'catalyst_bench', 'shard_sink',
  'stipend', 'recursive_sink', 'encore', 'phase_shift',
  'iron_six', 'solar_flare', 'tempo', 'conductor', 'quorum',
] as const;
export type CatalystId = typeof CATALYST_IDS[number];
