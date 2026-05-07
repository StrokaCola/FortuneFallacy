// Batch runner. Plays N games for a given (constellation, stake, strategy)
// and writes per-run CSVs + per-blind CSVs.
//
// Usage:
//   npx tsx tools/sim/runMany.ts --constellation lyra --stake spark --strategy heuristic_shop --runs 500 --seed 42 --out docs/sim-data/lyra_spark_heur.csv

import { bootstrapHeadless } from './bootstrap';
import { driveRun, type RunRecord } from './driver';
import {
  createRandomStrategy,
  createGreedyStrategy,
  createEvKeepStrategy,
  createHeuristicShopStrategy,
  type Strategy,
} from './strategies';
import { writeCsv } from './csv';
import { parseArgs } from './args';

const COMBO_KEYS = [
  'chance', 'one_pair', 'two_pair', 'three_kind', 'sm_straight',
  'full_house', 'lg_straight', 'four_kind', 'five_kind', 'no_combo',
];

export interface RunManyOptions {
  constellationId: string;
  stakeId: string;
  challengeId?: string;
  strategy: 'random' | 'greedy' | 'evkeep' | 'heuristic_shop';
  runs: number;
  baseSeed: number;
  outPath?: string;
  perBlindOutPath?: string;
}

export interface RunManySummary {
  runs: number;
  winRate: number;
  meanFinalAnte: number;
  meanScore: number;
  medianScore: number;
  bustReasons: Record<string, number>;
  comboDistribution: Record<string, number>;
  catalystsBoughtMean: number;
  vouchersBoughtMean: number;
  shopsRerolledMean: number;
  records: RunRecord[];
}

export function buildStrategy(name: string, seed: number): Strategy {
  switch (name) {
    case 'random': return createRandomStrategy(seed);
    case 'greedy': return createGreedyStrategy();
    case 'evkeep': return createEvKeepStrategy();
    case 'heuristic_shop': return createHeuristicShopStrategy();
    default: throw new Error(`Unknown strategy: ${name}`);
  }
}

export function runMany(opts: RunManyOptions): RunManySummary {
  const records: RunRecord[] = [];
  for (let i = 0; i < opts.runs; i++) {
    const seed = (opts.baseSeed + i) >>> 0;
    bootstrapHeadless(seed);
    const strategy = buildStrategy(opts.strategy, seed);
    const r = driveRun(seed, {
      constellationId: opts.constellationId,
      stakeId: opts.stakeId,
      challengeId: opts.challengeId,
      strategy,
    });
    records.push(r);
  }

  const summary = summarize(records);
  if (opts.outPath) {
    const flatRows = records.map(flattenRecord);
    writeCsv(opts.outPath, flatRows);
    console.log(`Wrote ${flatRows.length} runs → ${opts.outPath}`);
  }
  if (opts.perBlindOutPath) {
    const blindRows = records.flatMap((r) => r.perBlind.map((b) => ({
      seed: r.seed,
      strategy: r.strategyId,
      constellation: r.constellationId,
      stake: r.stakeId,
      ante: b.ante,
      blindIdx: b.blindIdx,
      blindId: b.blindId,
      isBoss: b.isBoss,
      target: b.target,
      score: b.score,
      handsUsed: b.handsUsed,
      outcome: b.outcome,
    })));
    writeCsv(opts.perBlindOutPath, blindRows);
    console.log(`Wrote ${blindRows.length} blind rows → ${opts.perBlindOutPath}`);
  }
  return { ...summary, records };
}

function flattenRecord(r: RunRecord): Record<string, unknown> {
  const row: Record<string, unknown> = {
    seed: r.seed,
    strategy: r.strategyId,
    constellation: r.constellationId,
    stake: r.stakeId,
    challenge: r.challengeId,
    won: r.won ? 1 : 0,
    finalAnte: r.finalAnte,
    goalsCleared: r.goalsCleared,
    finalScore: r.finalScore,
    totalHandsPlayed: r.totalHandsPlayed,
    totalShardsEarned: r.totalShardsEarned,
    catalystsBought: r.catalystsBought,
    vouchersBought: r.vouchersBought,
    consumablesBought: r.consumablesBought,
    modsBought: r.modsBought,
    packsBought: r.packsBought,
    shopRerolls: r.shopRerolls,
    bustReason: r.bustReason,
  };
  for (const k of COMBO_KEYS) row[`combo_${k}`] = r.combosPlayed[k] ?? 0;
  return row;
}

function summarize(records: RunRecord[]): Omit<RunManySummary, 'records'> {
  const wins = records.filter((r) => r.won).length;
  const meanScore = records.reduce((s, r) => s + r.finalScore, 0) / Math.max(1, records.length);
  const sortedScores = records.map((r) => r.finalScore).sort((a, b) => a - b);
  const medianScore = sortedScores[Math.floor(sortedScores.length / 2)] ?? 0;
  const meanFinalAnte = records.reduce((s, r) => s + r.finalAnte, 0) / Math.max(1, records.length);
  const bustReasons: Record<string, number> = {};
  const comboDistribution: Record<string, number> = {};
  let cat = 0, vou = 0, rerolls = 0;
  for (const r of records) {
    bustReasons[r.bustReason] = (bustReasons[r.bustReason] ?? 0) + 1;
    for (const [k, v] of Object.entries(r.combosPlayed)) comboDistribution[k] = (comboDistribution[k] ?? 0) + v;
    cat += r.catalystsBought;
    vou += r.vouchersBought;
    rerolls += r.shopRerolls;
  }
  const N = Math.max(1, records.length);
  return {
    runs: records.length,
    winRate: wins / N,
    meanFinalAnte,
    meanScore,
    medianScore,
    bustReasons,
    comboDistribution,
    catalystsBoughtMean: cat / N,
    vouchersBoughtMean: vou / N,
    shopsRerolledMean: rerolls / N,
  };
}

export function printSummary(s: Omit<RunManySummary, 'records'>): void {
  console.log(`runs=${s.runs}  winRate=${(s.winRate * 100).toFixed(1)}%  meanAnte=${s.meanFinalAnte.toFixed(2)}  meanScore=${s.meanScore.toFixed(0)}  medianScore=${s.medianScore}`);
  console.log(`  bust: ${JSON.stringify(s.bustReasons)}`);
  console.log(`  combos: ${JSON.stringify(s.comboDistribution)}`);
  console.log(`  cats=${s.catalystsBoughtMean.toFixed(1)}/run  vou=${s.vouchersBoughtMean.toFixed(2)}/run  rerolls=${s.shopsRerolledMean.toFixed(1)}/run`);
}

// CLI entrypoint --------------------------------------------------------------
const isMain = (() => {
  try {
    const argv1 = process.argv[1] ?? '';
    return argv1.endsWith('runMany.ts') || argv1.endsWith('runMany.js');
  } catch { return false; }
})();

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const opts: RunManyOptions = {
    constellationId: String(args.constellation ?? 'lyra'),
    stakeId: String(args.stake ?? 'spark'),
    strategy: (args.strategy ?? 'heuristic_shop') as RunManyOptions['strategy'],
    runs: Number(args.runs ?? 200),
    baseSeed: Number(args.seed ?? 1),
    outPath: args.out ? String(args.out) : undefined,
    perBlindOutPath: args.blindsOut ? String(args.blindsOut) : undefined,
  };
  const t0 = Date.now();
  const result = runMany(opts);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n[${opts.constellationId}/${opts.stakeId}/${opts.strategy}] in ${dt}s`);
  printSummary(result);
}
