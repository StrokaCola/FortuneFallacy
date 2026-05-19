import './stratifier';
import './constellationLocked';
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

// 2026-05-08 balance pack — 12 catalysts added to lift Spark clear-rate
// to ~70% per the simulation harness in balance.fullrun.sim.test.ts.
// Deliberately overtuned per design direction.
import './luckyStreak';
import './faceValue';
import './firstStrike';
import './momentum';
import './diceMaster';
import './prismLens';
import './streakSeeker';
import './novaBurst';
import './highRoller';
import './royalFlush';
import './economyEngine';
import './eclipsePact';
// 2026-05-11 scaling pack
import './starChart';
import './lodestone';
import './cometTrail';
import './mementoStar';
import './ouroboros';
import './lunarPhases';
import './tide';
import './eventHorizon';
import './highwater';
import './heirloomLocket';
// Retrigger pack registers no per-id handlers; its single export is
// applyRetriggers, invoked from phases/upgrades.ts. Importing here
// keeps the file in the bundle and matches the existing pattern.
import './retriggers';
// 2026-05-13 unheld + collision pack — registers in the new
// UNHELD_SCAN and ON_COLLISION phases (see core/pipeline/types.ts).
import './shadowCache';
import './reservoir';
import './silentWitness';
import './unseenChorus';
import './kineticCharge';
import './chainReaction';
import './kindredClatter';
// 2026-05-16 risk pack — tradeoff catalysts with explicit downsides.
// Each one trades a build constraint for an outsized payoff so the
// shop offers a real choice instead of a strictly-positive ladder.
import './boneTax';
import './hollowBishop';
import './witchsBargain';
// 2026-05-16 unlock-content roadmap (10 catalysts). Each gated behind
// a player-earned condition; see docs/unlock-gated-content-roadmap.md.
import './cosmicCompass';
import './voidwalker';
import './crownOfSkulls';
import './thePatient';
import './saltOfEarth';
import './stargazer';
import './bloodiedCoin';
import './theConfessor';
import './hourglass';
import './theReckoning';
// 2026-05-18 audit additions — fill design gaps surfaced by the
// 2026-05-16 balance audit. See docs/balance-audit-2026-05-16.md
// "New Catalysts (5 Proposals)".
import './piggyBank';
import './runaway';
import './doubleOrNothing';
import './resonanceCascade';
import './leveling';
// 2026-05-19 shard-scaling pack — three lower-rarity shard-hoarder cards
// that scale with live shard balance. Mythic Hoarder's Crown is the
// build-defining ceiling for the same axis.
import './counterPurse';
import './magpie';
import './vaultHeart';
// 2026-05-19 mythic tier — 5 build-defining cards above legendary.
// Cosmic Anchor + Eclipse Heart register no-op handlers; their real
// effects live in transitions.startBlind and vouchers/maxCatalystSlots.
import './singularityEngine';
import './cosmicAnchor';
import './voidforge';
import './hoardersCrown';
import './eclipseHeart';
// 2026-05-19 locked-dice archetype pair. Asymmetric tradeoff —
// Patience's Reward rewards no-reroll commit, Sunk Cost punishes
// spam-rerolling. See docs/superpowers/plans/2026-05-19-tier2-batch-e.md.
import './patiencesReward';
import './sunkCost';

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
  // 2026-05-08 balance pack
  'lucky_streak', 'face_value', 'first_strike',
  'momentum', 'dice_master', 'prism_lens',
  'streak_seeker', 'nova_burst', 'high_roller',
  'royal_flush', 'economy_engine', 'eclipse_pact',
  // 2026-05-11 scaling pack
  'star_chart', 'lodestone', 'comet_trail', 'memento_star', 'ouroboros',
  'lunar_phases', 'tide', 'event_horizon', 'highwater', 'heirloom_locket',
  // 2026-05-11 retrigger pack — handlers live in retriggers.ts (invoked
  // explicitly from phases/upgrades.ts, not via the standard registry).
  'polaris', 'refrain', 'mirror_edge', 'curtain_call', 'stutter',
  'recursion_lens', 'cardinal_compass', 'echo_chamber',
  // 2026-05-13 unheld + collision pack
  'shadow_cache', 'reservoir', 'silent_witness', 'unseen_chorus',
  'kinetic_charge', 'chain_reaction', 'kindred_clatter',
  // 2026-05-16 risk pack
  'bone_tax', 'hollow_bishop', 'witchs_bargain',
  // 2026-05-16 unlock-content roadmap
  'cosmic_compass', 'voidwalker', 'crown_of_skulls', 'the_patient',
  'salt_of_earth', 'stargazer', 'bloodied_coin', 'the_confessor',
  'hourglass', 'the_reckoning',
  // 2026-05-18 audit additions
  'piggy_bank', 'runaway', 'double_or_nothing', 'resonance_cascade', 'leveling',
  // 2026-05-19 shard-scaling pack
  'counter_purse', 'magpie', 'vault_heart',
  // 2026-05-19 mythic tier
  'singularity_engine', 'cosmic_anchor', 'voidforge', 'hoarders_crown', 'eclipse_heart',
  // 2026-05-19 locked-dice archetype pair
  'patiences_reward', 'sunk_cost',
] as const;
export type CatalystId = typeof CATALYST_IDS[number];
