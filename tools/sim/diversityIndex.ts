// Build Diversity Index — measures how many distinct catalyst pairings
// appear across SUCCESSFUL runs. The metric surfaces meta-staleness:
// when only a handful of pair combinations ever clear, the build space
// is too narrow and balance work needs to widen the viable lanes.
//
// Algorithm:
//   1. Run a sweep across (constellation × stake) cells using the
//      existing sim harness (heuristic_shop strategy).
//   2. Filter to wins (`record.won === true`).
//   3. For each winning run, enumerate every UNORDERED catalyst pair
//      from `record.finalCatalysts` (C(n,2) pairs per run).
//   4. Aggregate pair frequencies and report:
//        - Total distinct pairs ever cleared / Total possible pairs
//        - Top 10 most-frequent pairs (likely "the meta")
//        - Bottom 5 catalysts (least-likely to be in any winning pair)
//
// Usage:
//   npx tsx tools/sim/diversityIndex.ts --runs 200
//   npx tsx tools/sim/diversityIndex.ts --runs 500 --stakes spark,ember,pyre
//
// Pairs with the existing sweep + catalystImpact tools — intentionally
// scope-narrow so it complements the impact study (per-catalyst chip
// contribution) with a structural view (which catalysts cluster).

import { runMany } from './runMany';
import { CATALYST_META } from '../../src-next/data/catalysts';
import { writeCsv } from './csv';
import { parseArgs } from './args';
import { CONSTELLATIONS } from '../../src-next/data/constellations';

const ALL_CONSTELLATIONS = CONSTELLATIONS.map((c) => c.id);
const DEFAULT_STAKES = ['spark', 'ember', 'pyre'];

interface DiversityOptions {
  runsPerCell: number;
  baseSeed: number;
  constellations: string[];
  stakes: string[];
  outPath?: string;
}

interface PairKey {
  a: string;
  b: string;
}

function pairId(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function unpackPairId(id: string): PairKey {
  const [a, b] = id.split('|');
  return { a: a!, b: b! };
}

export function diversityIndex(opts: DiversityOptions): void {
  const pairCounts = new Map<string, number>();
  const catalystAppearances = new Map<string, number>();
  let winCount = 0;
  let totalRuns = 0;

  for (const constellation of opts.constellations) {
    for (const stake of opts.stakes) {
      const summary = runMany({
        constellationId: constellation,
        stakeId: stake,
        strategy: 'heuristic_shop',
        runs: opts.runsPerCell,
        baseSeed: opts.baseSeed,
      });
      totalRuns += summary.records.length;
      for (const r of summary.records) {
        if (!r.won) continue;
        winCount++;
        const cats = r.finalCatalysts;
        // Track per-catalyst inclusion in wins
        for (const c of cats) {
          catalystAppearances.set(c, (catalystAppearances.get(c) ?? 0) + 1);
        }
        // Enumerate unordered pairs
        for (let i = 0; i < cats.length; i++) {
          for (let j = i + 1; j < cats.length; j++) {
            const id = pairId(cats[i]!, cats[j]!);
            pairCounts.set(id, (pairCounts.get(id) ?? 0) + 1);
          }
        }
      }
    }
  }

  // Total possible UNORDERED pairs across the catalyst pool. Sets the
  // ceiling for the "what fraction of the build space ever clears"
  // ratio.
  const N = CATALYST_META.length;
  const possiblePairs = (N * (N - 1)) / 2;
  const distinctPairs = pairCounts.size;
  const coverage = possiblePairs > 0 ? distinctPairs / possiblePairs : 0;

  // Top 10 most-frequent pairs — surfaces "the meta".
  const topPairs = [...pairCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Bottom 5 catalysts by win-appearance count — surfaces dead weight.
  const allCatalystIds = CATALYST_META.map((c) => c.id);
  const bottomCatalysts = [...allCatalystIds]
    .sort((a, b) => (catalystAppearances.get(a) ?? 0) - (catalystAppearances.get(b) ?? 0))
    .slice(0, 5);

  console.log('\n=== Build Diversity Index ===');
  console.log(`(${totalRuns} runs total · ${winCount} wins · heuristic_shop strategy)`);
  console.log(`distinct pairs in winning builds: ${distinctPairs} / ${possiblePairs} (${(coverage * 100).toFixed(1)}%)`);

  console.log('\n--- Top 10 pairs by appearance in winning builds ---');
  for (const [id, n] of topPairs) {
    const { a, b } = unpackPairId(id);
    const aMeta = CATALYST_META.find((c) => c.id === a);
    const bMeta = CATALYST_META.find((c) => c.id === b);
    const fraction = winCount > 0 ? (n / winCount) * 100 : 0;
    console.log(`  ${(aMeta?.name ?? a).padEnd(20)} + ${(bMeta?.name ?? b).padEnd(20)}  ${n} wins (${fraction.toFixed(1)}%)`);
  }

  console.log('\n--- Bottom 5 catalysts (rarest in winning builds) ---');
  for (const id of bottomCatalysts) {
    const meta = CATALYST_META.find((c) => c.id === id);
    const n = catalystAppearances.get(id) ?? 0;
    const fraction = winCount > 0 ? (n / winCount) * 100 : 0;
    console.log(`  ${(meta?.name ?? id).padEnd(24)}  ${n} wins (${fraction.toFixed(1)}%)`);
  }

  // CSV export — used for follow-up dashboard rendering.
  if (opts.outPath) {
    const rows = [...pairCounts.entries()].map(([id, count]) => {
      const { a, b } = unpackPairId(id);
      return { pairId: id, a, b, wins: count, winShare: winCount > 0 ? count / winCount : 0 };
    });
    writeCsv(opts.outPath, rows);
    console.log(`\nWrote ${rows.length} pairs → ${opts.outPath}`);
  }
}

// CLI ------------------------------------------------------------------------
const isMain = (() => {
  try {
    const argv1 = process.argv[1] ?? '';
    return argv1.endsWith('diversityIndex.ts') || argv1.endsWith('diversityIndex.js');
  } catch { return false; }
})();

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const constellationsArg = args.constellations as string | undefined;
  const stakesArg = args.stakes as string | undefined;
  const opts: DiversityOptions = {
    runsPerCell: Number(args.runs ?? 200),
    baseSeed: Number(args.seed ?? 1),
    constellations: constellationsArg
      ? constellationsArg.split(',')
      : ALL_CONSTELLATIONS,
    stakes: stakesArg
      ? stakesArg.split(',')
      : DEFAULT_STAKES,
    outPath: args.out ? String(args.out) : undefined,
  };
  console.log(`Running diversity index sweep: ${opts.constellations.length} × ${opts.stakes.length} cells × ${opts.runsPerCell} runs each`);
  const t0 = Date.now();
  diversityIndex(opts);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nDone in ${dt}s.`);
}
