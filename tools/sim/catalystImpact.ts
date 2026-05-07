// Catalyst impact study. For each catalyst id, runs N matched-pair seeds:
// once with the catalyst granted at run start, once without. Tabulates the
// marginal Δ in score and ante reach.
//
// Strategy: EVKeep. Shop is suppressed (NoBuyStrategy variant) so the
// catalyst-under-test doesn't randomly appear in the control's shop and
// confound the comparison. We measure pure "what does this catalyst do for
// a player who never shops?"
//
// Usage:
//   npx tsx tools/sim/catalystImpact.ts --runs 100 --constellation lyra --stake spark

import { bootstrapHeadless, dispatch, snapshotRng, restoreRng } from './bootstrap';
import { driveRun, type RunRecord } from './driver';
import { writeCsv } from './csv';
import { parseArgs } from './args';
import type { Strategy } from './strategies';
import { CATALYST_META } from '../../src-next/data/catalysts';

// NoBuy strategy: never buys, never rerolls. Plays dice via EVKeep heuristics.
function createNoBuyStrategy(): Strategy {
  const lockByMode = (faces: number[]): number[] => {
    if (faces.length <= 1) return [0];
    const counts = new Map<number, number>();
    for (const f of faces) counts.set(f, (counts.get(f) ?? 0) + 1);
    const target = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    const out: number[] = [];
    for (let i = 0; i < faces.length; i++) {
      if (faces[i] === target) out.push(i);
    }
    return out;
  };
  return {
    id: 'nobuy_evkeep',
    pickDiceToLock(s) {
      return lockByMode(s.round.dice.map((d) => d.face));
    },
    shouldScore(s) {
      if (s.round.handsLeft <= 1) return true;
      if (s.round.rerollsLeft <= 0) return true;
      const faces = s.round.dice.map((d) => d.face);
      const counts = new Map<number, number>();
      for (const f of faces) counts.set(f, (counts.get(f) ?? 0) + 1);
      const max = Math.max(0, ...counts.values());
      const sorted = [...counts.values()].sort((a, b) => b - a);
      const isFullHouse = sorted[0] === 3 && sorted[1] === 2;
      const isTwoPair = sorted[0] === 2 && sorted[1] === 2;
      return max >= 3 || isFullHouse || isTwoPair;
    },
    chooseShopAction() { return { type: 'CLOSE_SHOP' }; },
    pickFromPack() { return { type: 'SKIP_PACK' }; },
  };
}

interface ImpactRow {
  catalystId: string;
  rarity: string;
  archetype: string;
  meanScoreControl: number;
  meanScoreTreatment: number;
  deltaScore: number;
  deltaScorePct: number;
  meanAnteControl: number;
  meanAnteTreatment: number;
  deltaAnte: number;
  winRateControl: number;
  winRateTreatment: number;
  deltaWinRate: number;
}

function runOne(seed: number, constellation: string, stake: string, grantId: string | null): RunRecord {
  bootstrapHeadless(seed);
  const strat = createNoBuyStrategy();
  // Set up the run, then grant catalyst BEFORE round starts
  dispatch({ type: 'NEW_RUN', constellationId: constellation, stakeId: stake });
  if (grantId) dispatch({ type: 'GRANT_CATALYST', id: grantId });
  // Use driveRun without re-dispatching NEW_RUN — but the driver does call
  // NEW_RUN itself. We need to grant AFTER. So we rebuild: bootstrap, then
  // call driveRun which dispatches NEW_RUN → grant catalyst inside the
  // first iteration. Solution: dispatch grant after driveRun's NEW_RUN.
  // Cleanest: add a `preRunGrants` option to driveRun. For now, monkey-patch
  // by calling driveRun with a tiny wrapper.
  // ... but driveRun does its own bootstrap-less NEW_RUN dispatch.
  // We've already done NEW_RUN above + grant; now drive without re-dispatching.
  return driveOneFromCurrent(seed, constellation, stake, strat);
}

// Drive a run assuming NEW_RUN has already been dispatched (and any
// pre-run catalyst grants applied).
function driveOneFromCurrent(seed: number, constellation: string, stake: string, strategy: Strategy): RunRecord {
  // We can't easily reuse driveRun without it re-dispatching NEW_RUN.
  // Inline a minimal version that skips NEW_RUN.
  return driveRun(seed, {
    constellationId: constellation,
    stakeId: stake,
    strategy,
    skipNewRun: true,
  } as Parameters<typeof driveRun>[1] & { skipNewRun: true });
}

// CLI ------------------------------------------------------------------------
const args = parseArgs(process.argv.slice(2));
const RUNS = Number(args.runs ?? 100);
const CONSTELLATION = String(args.constellation ?? 'lyra');
const STAKE = String(args.stake ?? 'spark');
const SEED = Number(args.seed ?? 1001);
const OUT_PATH = String(args.out ?? `docs/sim-data/catalyst_impact_${CONSTELLATION}_${STAKE}.csv`);

console.log(`Catalyst impact study: ${CATALYST_META.length} catalysts × ${RUNS} matched pairs on ${CONSTELLATION}/${STAKE}`);
const t0 = Date.now();

const rows: ImpactRow[] = [];
for (let cidx = 0; cidx < CATALYST_META.length; cidx++) {
  const meta = CATALYST_META[cidx]!;
  const controlScores: number[] = [];
  const treatScores: number[] = [];
  const controlAntes: number[] = [];
  const treatAntes: number[] = [];
  let controlWins = 0;
  let treatWins = 0;

  for (let i = 0; i < RUNS; i++) {
    const seed = (SEED + i) >>> 0;
    // Control
    const c = runOne(seed, CONSTELLATION, STAKE, null);
    // Treatment — use same seed so dice/shop sequence aligns
    const t = runOne(seed, CONSTELLATION, STAKE, meta.id);
    controlScores.push(c.finalScore);
    treatScores.push(t.finalScore);
    controlAntes.push(c.finalAnte);
    treatAntes.push(t.finalAnte);
    if (c.won) controlWins++;
    if (t.won) treatWins++;
  }

  const meanCtl = controlScores.reduce((s, v) => s + v, 0) / RUNS;
  const meanTrt = treatScores.reduce((s, v) => s + v, 0) / RUNS;
  rows.push({
    catalystId: meta.id,
    rarity: meta.rarity,
    archetype: meta.archetype ?? '',
    meanScoreControl: Math.round(meanCtl),
    meanScoreTreatment: Math.round(meanTrt),
    deltaScore: Math.round(meanTrt - meanCtl),
    deltaScorePct: Number((((meanTrt - meanCtl) / Math.max(1, meanCtl)) * 100).toFixed(1)),
    meanAnteControl: Number((controlAntes.reduce((s, v) => s + v, 0) / RUNS).toFixed(2)),
    meanAnteTreatment: Number((treatAntes.reduce((s, v) => s + v, 0) / RUNS).toFixed(2)),
    deltaAnte: Number(((treatAntes.reduce((s, v) => s + v, 0) - controlAntes.reduce((s, v) => s + v, 0)) / RUNS).toFixed(2)),
    winRateControl: Number((controlWins / RUNS).toFixed(3)),
    winRateTreatment: Number((treatWins / RUNS).toFixed(3)),
    deltaWinRate: Number(((treatWins - controlWins) / RUNS).toFixed(3)),
  });
}

// Sort by impact descending
rows.sort((a, b) => b.deltaScorePct - a.deltaScorePct);

writeCsv(OUT_PATH, rows as unknown as Record<string, unknown>[]);
const dt = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nDone in ${dt}s. Wrote ${rows.length} catalysts → ${OUT_PATH}`);
console.log('\nTop 10:');
for (const r of rows.slice(0, 10)) {
  console.log(`  ${r.catalystId.padEnd(22)} Δ=${String(r.deltaScore).padStart(5)} (${r.deltaScorePct.toFixed(1)}%)  Δante=${r.deltaAnte}  ctl=${r.meanScoreControl}→trt=${r.meanScoreTreatment}`);
}
console.log('\nBottom 10:');
for (const r of rows.slice(-10)) {
  console.log(`  ${r.catalystId.padEnd(22)} Δ=${String(r.deltaScore).padStart(5)} (${r.deltaScorePct.toFixed(1)}%)  Δante=${r.deltaAnte}`);
}
// Track unused vars
void snapshotRng; void restoreRng;
