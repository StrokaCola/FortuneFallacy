// Sweep: run N games for every (constellation, stake) cell with the
// strongest available strategy and write a single combined CSV.
//
// Used to produce balance/pacing data for the analysis report.

import { runMany } from './runMany';
import { writeCsv } from './csv';
import type { RunRecord } from './driver';

const CONSTELLATIONS = ['lyra', 'mensa', 'triumvirate', 'argo', 'fibonacci', 'eclipse', 'polyhedra', 'ophiuchus'];
const STAKES = ['spark', 'ember', 'pyre', 'beacon', 'nova', 'supernova'];

interface CellSummary {
  constellation: string;
  stake: string;
  runs: number;
  winRate: number;
  meanAnte: number;
  meanScore: number;
  medianScore: number;
  meanCatalysts: number;
  meanVouchers: number;
  bustAt1: number;
  bustAt2: number;
  bustAt3: number;
  bustAt4: number;
  iterCap: number;
}

const RUNS_PER_CELL = Number(process.env.SIM_RUNS_PER_CELL ?? '200');
const STRATEGY = (process.env.SIM_STRATEGY ?? 'heuristic_shop') as 'heuristic_shop' | 'evkeep' | 'greedy' | 'random';
const BASE_SEED = Number(process.env.SIM_SEED ?? '101');

const summaries: CellSummary[] = [];
const allRecords: RunRecord[] = [];
const allBlindRows: Record<string, unknown>[] = [];

const t0 = Date.now();
for (const constellation of CONSTELLATIONS) {
  for (const stake of STAKES) {
    const t1 = Date.now();
    const result = runMany({
      constellationId: constellation,
      stakeId: stake,
      strategy: STRATEGY,
      runs: RUNS_PER_CELL,
      baseSeed: BASE_SEED,
    });
    const dt = ((Date.now() - t1) / 1000).toFixed(1);

    const bustAt: Record<number, number> = {};
    let iterCap = 0;
    for (const r of result.records) {
      if (r.bustReason === 'iter_cap') iterCap++;
      else if (!r.won) bustAt[r.finalAnte] = (bustAt[r.finalAnte] ?? 0) + 1;
    }
    summaries.push({
      constellation,
      stake,
      runs: result.runs,
      winRate: result.winRate,
      meanAnte: result.meanFinalAnte,
      meanScore: Math.round(result.meanScore),
      medianScore: result.medianScore,
      meanCatalysts: Number(result.catalystsBoughtMean.toFixed(2)),
      meanVouchers: Number(result.vouchersBoughtMean.toFixed(3)),
      bustAt1: bustAt[1] ?? 0,
      bustAt2: bustAt[2] ?? 0,
      bustAt3: bustAt[3] ?? 0,
      bustAt4: bustAt[4] ?? 0,
      iterCap,
    });
    for (const r of result.records) {
      allRecords.push(r);
      for (const b of r.perBlind) {
        allBlindRows.push({
          seed: r.seed,
          strategy: r.strategyId,
          constellation: r.constellationId,
          stake: r.stakeId,
          ante: b.ante,
          blindIdx: b.blindIdx,
          blindId: b.blindId,
          isBoss: b.isBoss ? 1 : 0,
          target: b.target,
          score: b.score,
          handsUsed: b.handsUsed,
          outcome: b.outcome,
        });
      }
    }
    console.log(
      `[${constellation}/${stake}] win=${(result.winRate * 100).toFixed(1)}%  ante=${result.meanFinalAnte.toFixed(2)}  score=${Math.round(result.meanScore)}  in ${dt}s`
    );
  }
}

const totalDt = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nTotal: ${summaries.reduce((s, c) => s + c.runs, 0)} runs in ${totalDt}s with strategy=${STRATEGY}`);

writeCsv('docs/sim-data/sweep_summary.csv', summaries as unknown as Record<string, unknown>[]);

const flatRuns = allRecords.map((r) => ({
  seed: r.seed,
  strategy: r.strategyId,
  constellation: r.constellationId,
  stake: r.stakeId,
  won: r.won ? 1 : 0,
  finalAnte: r.finalAnte,
  goalsCleared: r.goalsCleared,
  finalScore: r.finalScore,
  totalHands: r.totalHandsPlayed,
  shardsEarned: r.totalShardsEarned,
  catalysts: r.catalystsBought,
  vouchers: r.vouchersBought,
  consumables: r.consumablesBought,
  mods: r.modsBought,
  packs: r.packsBought,
  rerolls: r.shopRerolls,
  bustReason: r.bustReason,
  combo_chance: r.combosPlayed['chance'] ?? 0,
  combo_one_pair: r.combosPlayed['one_pair'] ?? 0,
  combo_two_pair: r.combosPlayed['two_pair'] ?? 0,
  combo_three_kind: r.combosPlayed['three_kind'] ?? 0,
  combo_sm_straight: r.combosPlayed['sm_straight'] ?? 0,
  combo_full_house: r.combosPlayed['full_house'] ?? 0,
  combo_lg_straight: r.combosPlayed['lg_straight'] ?? 0,
  combo_four_kind: r.combosPlayed['four_kind'] ?? 0,
  combo_five_kind: r.combosPlayed['five_kind'] ?? 0,
}));
writeCsv('docs/sim-data/sweep_runs.csv', flatRuns);
writeCsv('docs/sim-data/sweep_blinds.csv', allBlindRows);

console.log(`\nWrote:`);
console.log(`  docs/sim-data/sweep_summary.csv (${summaries.length} cells)`);
console.log(`  docs/sim-data/sweep_runs.csv (${flatRuns.length} runs)`);
console.log(`  docs/sim-data/sweep_blinds.csv (${allBlindRows.length} blinds)`);
