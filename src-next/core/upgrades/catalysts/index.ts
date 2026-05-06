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
// Phase 3 additions
import './pairDynamo';
import './tripletEngine';
import './magnitude';
import './primePact';
import './evenKeeled';
import './oddVoice';
import './usurer';
import './levelsLevy';
import './allBand';
// Phase 5 additions
import './straightSignal';
import './tetrad';
import './apex';
import './chanceDoctrine';
import './lowChoir';
import './harmonic';
import './metronome';
import './primeResonance';
// Phase 5e (lifecycle catalysts that need state hooks)
import './crescendoRun';
import './shardLung';
// Phase 5f (no-op apply, real effect in upgrades.ts / transitions.ts)
import './gildingPress';
import './modGravity';

export const CATALYST_IDS = [
  'stratifier', 'chaos_theory', 'six_bias',
  'twin_sample', 'cold_hand', 'entropy_index',
  'compounding_bias', 'last_throw', 'patience_counter',
  'catalyst_bench', 'shard_sink',
  'stipend', 'recursive_sink', 'encore', 'phase_shift',
  'iron_six', 'solar_flare', 'tempo', 'conductor', 'quorum',
  // Phase 3
  'pair_dynamo', 'triplet_engine', 'magnitude',
  'prime_pact', 'even_keeled', 'odd_voice',
  'usurer', 'levels_levy', 'all_band',
  // Phase 5
  'straight_signal', 'tetrad', 'apex',
  'chance_doctrine', 'low_choir', 'harmonic',
  'metronome', 'prime_resonance',
  // Phase 5d — non-pipeline catalysts (no register call; effects in
  // lifecycle hooks: silver_tongue → skipBlind, dust_off → SELL_UPGRADE).
  'silver_tongue', 'dust_off',
  // Phase 5e — lifecycle catalysts: crescendo_run reads round.rollsWithoutLock,
  // shard_lung needs both startBlind (round-start grant) and pipeline apply.
  'crescendo_run', 'shard_lung',
  // Phase 5f — bust-hook + mod-density.
  'audit', 'gilding_press',
  // Phase 5g — wide-scoring bonus.
  'mod_gravity',
] as const;
export type CatalystId = typeof CATALYST_IDS[number];
