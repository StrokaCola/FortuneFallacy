// Headless stress run — 10k+ runs across the full (constellation × stake)
// grid + a single strategy, surfacing the bottom-5% win-rate cells and
// the top-N most-frequent winning catalyst combos. Designed to be the
// "find broken cells before players do" gate that runs nightly or
// pre-release.
//
// Usage:
//   npx tsx tools/sim/stress.ts --runs 1000
//   npx tsx tools/sim/stress.ts --runs 5000 --strategy heuristic_shop
//   npx tsx tools/sim/stress.ts --runs 1000 --out docs/sim-data/stress.csv

import { runMany } from './runMany';
import { CONSTELLATIONS } from '../../src-next/data/constellations';
import { STAKES } from '../../src-next/data/stakes';
import { CATALYST_META } from '../../src-next/data/catalysts';
import { writeCsv } from './csv';
import { parseArgs } from './args';

interface StressOptions {
  runsPerCell: number;
  baseSeed: number;
  strategy: 'heuristic_shop' | 'evkeep' | 'greedy' | 'random';
  outPath?: string;
  // Cells with winRate below this surface in the bottom-N report.
  bottomQuantile: number;
}

interface CellResult {
  constellationId: string;
  stakeId: string;
  winRate: number;
  meanScore: number;
  meanFinalAnte: number;
  meanCatalystsBought: number;
  catalystAppearances: Map<string, number>;
}

export function stress(opts: StressOptions): CellResult[] {
  const cells: CellResult[] = [];
  const totalCells = CONSTELLATIONS.length * STAKES.length;
  let cellIdx = 0;

  for (const c of CONSTELLATIONS) {
    for (const s of STAKES) {
      cellIdx++;
      const tStart = Date.now();
      const summary = runMany({
        constellationId: c.id,
        stakeId: s.id,
        strategy: opts.strategy,
        runs: opts.runsPerCell,
        baseSeed: opts.baseSeed,
      });
      const cell: CellResult = {
        constellationId: c.id,
        stakeId: s.id,
        winRate: summary.winRate,
        meanScore: summary.meanScore,
        meanFinalAnte: summary.meanFinalAnte,
        meanCatalystsBought: summary.catalystsBoughtMean,
        catalystAppearances: new Map(),
      };
      // Aggregate per-catalyst appearance frequencies in winning runs
      // for the top-builds report.
      for (const r of summary.records) {
        if (!r.won) continue;
        for (const id of r.finalCatalysts) {
          cell.catalystAppearances.set(id, (cell.catalystAppearances.get(id) ?? 0) + 1);
        }
      }
      cells.push(cell);
      const dt = ((Date.now() - tStart) / 1000).toFixed(1);
      console.log(`  [${cellIdx}/${totalCells}] ${c.id}/${s.id}  winRate=${(cell.winRate * 100).toFixed(1)}%  meanAnte=${cell.meanFinalAnte.toFixed(2)}  in ${dt}s`);
    }
  }

  // Bottom-quantile cells — sorted ascending, slice to size.
  const sorted = [...cells].sort((a, b) => a.winRate - b.winRate);
  const bottomCount = Math.max(1, Math.floor(cells.length * opts.bottomQuantile));
  const bottom = sorted.slice(0, bottomCount);
  console.log(`\n=== Bottom ${(opts.bottomQuantile * 100).toFixed(0)}% cells (${bottomCount} of ${cells.length}) ===`);
  for (const c of bottom) {
    console.log(`  ${c.constellationId.padEnd(14)} ${c.stakeId.padEnd(10)}  winRate=${(c.winRate * 100).toFixed(1)}%`);
  }

  // Top catalysts in winning builds globally.
  const globalApp = new Map<string, number>();
  for (const c of cells) {
    for (const [id, v] of c.catalystAppearances) {
      globalApp.set(id, (globalApp.get(id) ?? 0) + v);
    }
  }
  const topCatalysts = [...globalApp.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const totalWins = cells.reduce((s, c) => s + c.winRate * opts.runsPerCell, 0);
  console.log(`\n=== Top 10 catalysts in winning builds (${Math.round(totalWins)} wins total) ===`);
  for (const [id, v] of topCatalysts) {
    const meta = CATALYST_META.find((m) => m.id === id);
    const share = totalWins > 0 ? (v / totalWins) * 100 : 0;
    console.log(`  ${(meta?.name ?? id).padEnd(24)} ${v} appearances (${share.toFixed(1)}% of wins)`);
  }

  // Catalysts NEVER seen in winning builds — true dead weight.
  const seenIds = new Set(globalApp.keys());
  const deadWeight = CATALYST_META.filter((m) => !seenIds.has(m.id));
  if (deadWeight.length > 0) {
    console.log(`\n=== Dead weight (${deadWeight.length} catalysts) ===`);
    for (const m of deadWeight) {
      console.log(`  ${m.name}`);
    }
  } else {
    console.log('\nAll catalysts appeared in at least one winning build.');
  }

  if (opts.outPath) {
    const rows = cells.map((c) => ({
      constellation: c.constellationId,
      stake: c.stakeId,
      winRate: c.winRate,
      meanScore: c.meanScore,
      meanFinalAnte: c.meanFinalAnte,
      meanCatalystsBought: c.meanCatalystsBought,
    }));
    writeCsv(opts.outPath, rows);
    console.log(`\nWrote ${rows.length} cells → ${opts.outPath}`);
  }

  return cells;
}

const isMain = (() => {
  try {
    const argv1 = process.argv[1] ?? '';
    return argv1.endsWith('stress.ts') || argv1.endsWith('stress.js');
  } catch { return false; }
})();

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const opts: StressOptions = {
    runsPerCell: Number(args.runs ?? 1000),
    baseSeed: Number(args.seed ?? 1),
    strategy: (args.strategy ?? 'heuristic_shop') as StressOptions['strategy'],
    bottomQuantile: Number(args.bottom ?? 0.05),
    outPath: args.out ? String(args.out) : undefined,
  };
  const totalRuns = opts.runsPerCell * CONSTELLATIONS.length * STAKES.length;
  console.log(`Stress sweep: ${CONSTELLATIONS.length}×${STAKES.length} cells × ${opts.runsPerCell} runs = ${totalRuns} total`);
  const t0 = Date.now();
  stress(opts);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nDone in ${dt}s.`);
}
