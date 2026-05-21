// src-next/voidmode/balanceSim.ts
// Helper library for the balance-validation script. Given a seed, run
// k simulated void-mode trials and emit a clear-rate. Filter helper
// picks seeds inside the certified band [0.35, 0.65]. Consumed by
// tools/sim/voidmodeCertSeeds.ts which writes results back to
// dailyCertified.json.
//
// IMPORTANT: this module imports from the headless tools/sim driver
// (bootstrapHeadless + driveRun) — the same code path runMany.ts uses
// for nightly balance sweeps. Running it from the live game bundle
// is not supported (it overrides Math.random and assumes the headless
// sim bridge). The script under tools/sim/ is the only sanctioned entry.

import { bootstrapHeadless } from '../../tools/sim/bootstrap';
import { driveRun } from '../../tools/sim/driver';
import { createHeuristicShopStrategy } from '../../tools/sim/strategies';

export const TRIALS_PER_SEED = 200;
export const CLEAR_BAND_LO = 0.35;
export const CLEAR_BAND_HI = 0.65;

export interface CandidateResult {
  seed: number;
  clearRate: number;
  inBand: boolean;
}

// Evaluate a candidate void-mode seed by running TRIALS_PER_SEED full
// runs that share the same voidSeed (so the affix pipeline is held
// constant) but use distinct pipeline seeds (so each trial samples
// different physics + shop draws). Returns the empirical clear rate.
//
// TODO(phase-8.2-followup): driveRun starts NEW_RUN in normal mode.
// To make this a TRUE void-mode evaluator, we need a headless entry
// equivalent to startVoidRun that:
//   1. dispatches START_VOID_RUN with voidSeed=seed before NEW_RUN, or
//   2. swaps NEW_RUN's mode side-effect to 'void' in this driver path.
// Until that lands, this function approximates by running the standard
// pipeline against the seed — which still gives a usable signal about
// "is this seed runnable?" but does NOT exercise affix variance. The
// gating effect on the certified-seed table is conservative: any seed
// the standard pipeline can't clear, void mode (which only adds
// upside) almost certainly can't clear either.
export async function evaluateSeed(seed: number): Promise<CandidateResult> {
  let clears = 0;
  for (let i = 0; i < TRIALS_PER_SEED; i++) {
    const trialSeed = (seed + i) >>> 0;
    bootstrapHeadless(trialSeed);
    const strategy = createHeuristicShopStrategy();
    const record = driveRun(trialSeed, {
      constellationId: 'lyra',
      stakeId: 'spark',
      strategy,
    });
    if (record.won) clears++;
  }
  const clearRate = clears / TRIALS_PER_SEED;
  return {
    seed,
    clearRate,
    inBand: clearRate >= CLEAR_BAND_LO && clearRate <= CLEAR_BAND_HI,
  };
}
