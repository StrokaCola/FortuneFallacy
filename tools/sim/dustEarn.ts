// Measure Cosmic Dust earned per run across (constellation, stake) combos.
// Used to validate the conservative starting prices in data/astralPerks.ts.
//
// The bot busts most runs; the dust grant is `1 + goalIdx` on bust, so this
// gives a realistic picture of "how much dust does a struggling new player
// accumulate after N runs?"
//
// Usage:
//   npx tsx tools/sim/dustEarn.ts

import { bootstrapHeadless, dispatch, store } from './bootstrap';
import { driveRun } from './driver';
import { createHeuristicShopStrategy } from './strategies';
import { writeCsv } from './csv';
import { bus } from '../../src-next/events/bus';

const CONSTELLATIONS = ['lyra', 'mensa', 'triumvirate', 'argo', 'fibonacci', 'eclipse', 'polyhedra', 'ophiuchus'];
const STAKES = ['spark', 'ember', 'pyre', 'beacon', 'nova', 'supernova'];
const RUNS = Number(process.env.SIM_RUNS_PER_CELL ?? '300');
const SEED = Number(process.env.SIM_SEED ?? '7777');

interface Row {
  constellation: string;
  stake: string;
  runs: number;
  meanDustPerRun: number;
  medianDustPerRun: number;
  totalDust300runs: number;
}

const rows: Row[] = [];
const t0 = Date.now();

for (const constellation of CONSTELLATIONS) {
  for (const stake of STAKES) {
    const dustPerRun: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const seed = (SEED + i) >>> 0;
      bootstrapHeadless(seed);
      let dustGained = 0;
      const off = bus.on('onDustEarned', ({ delta }) => { dustGained += delta; });
      try {
        driveRun(seed, {
          constellationId: constellation,
          stakeId: stake,
          strategy: createHeuristicShopStrategy(),
        });
      } finally { off(); }
      dustPerRun.push(dustGained);
    }
    const sum = dustPerRun.reduce((s, v) => s + v, 0);
    const sorted = [...dustPerRun].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    rows.push({
      constellation,
      stake,
      runs: RUNS,
      meanDustPerRun: Number((sum / RUNS).toFixed(2)),
      medianDustPerRun: median,
      totalDust300runs: sum,
    });
  }
  const cellSummary = rows
    .filter((r) => r.constellation === constellation)
    .map((r) => `${r.stake}=${r.meanDustPerRun}`)
    .join(' ');
  console.log(`  ${constellation.padEnd(11)} ${cellSummary}`);
}

const dt = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nTotal: ${rows.length} cells × ${RUNS} runs in ${dt}s`);
writeCsv('docs/sim-data/dust_earn.csv', rows as unknown as Record<string, unknown>[]);
console.log(`Wrote docs/sim-data/dust_earn.csv`);

// Pricing implications
console.log('\n--- Pricing implications (using Lyra/Spark mean) ---');
const lyraSpark = rows.find((r) => r.constellation === 'lyra' && r.stake === 'spark')!;
console.log(`Mean dust per Lyra/Spark run: ${lyraSpark.meanDustPerRun}`);
const PERK_TIERS = [25, 60, 90, 120, 175, 250];
for (const cost of PERK_TIERS) {
  const runsNeeded = Math.ceil(cost / lyraSpark.meanDustPerRun);
  console.log(`  ◇ ${cost} perk: ~${runsNeeded} runs to afford`);
}

// Reference unused symbol so tsc is quiet
void store; void dispatch;
