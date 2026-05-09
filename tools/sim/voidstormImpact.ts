// Voidstorm balance sim — runs matched-pair simulations WITH and
// WITHOUT voidstorms enabled and reports the net delta on win-rate
// and mean-score. The expectation is "boons and curses cancel out
// to roughly neutral net" — anything biased >5pp in either direction
// is a tuning flag.
//
// Disabling voidstorms in the "off" arm is done by intercepting the
// store after START_BLIND dispatches and force-clearing voidstormId
// to null. The pickVoidstorm gate has already run by then, but the
// scoring pipeline reads voidstormId at SCORE_HAND time — so clearing
// it before any hand is played gives a clean "no voidstorm this run"
// arm without modifying production code.
//
// Usage:
//   npx tsx tools/sim/voidstormImpact.ts --runs 500
//   npx tsx tools/sim/voidstormImpact.ts --runs 1000 --constellations lyra,fibonacci

import { bootstrapHeadless } from './bootstrap';
import { driveRun, type RunRecord } from './driver';
import { createHeuristicShopStrategy } from './strategies';
import { store } from '../../src-next/state/store';
import { CONSTELLATIONS } from '../../src-next/data/constellations';
import { VOIDSTORMS } from '../../src-next/core/round/voidstorms';
import { parseArgs } from './args';

interface ImpactOptions {
  runsPerCell: number;
  baseSeed: number;
  constellations: string[];
  stake: string;
}

interface ArmResult {
  wins: number;
  totalScore: number;
  totalRuns: number;
  voidstormFires: Map<string, number>;
}

function newArm(): ArmResult {
  return { wins: 0, totalScore: 0, totalRuns: 0, voidstormFires: new Map() };
}

// One run with voidstorms forced off. The sim subscribes to the store
// and clears voidstormId whenever it appears, so any START_BLIND that
// rolled a storm gets neutralized before the player's first hand.
function driveWithoutVoidstorm(seed: number, constellationId: string, stake: string): RunRecord {
  bootstrapHeadless(seed);
  const off = store.subscribe((s) => {
    if (s.round.voidstormId) {
      store.setState((cur) => ({ ...cur, round: { ...cur.round, voidstormId: null } }), true);
    }
  });
  try {
    return driveRun(seed, {
      constellationId,
      stakeId: stake,
      strategy: createHeuristicShopStrategy(),
    });
  } finally {
    off();
  }
}

// One run with voidstorms enabled (default behavior). We additionally
// tally which voidstorms actually fired by snapshotting voidstormId
// across blinds — store-subscription samples so we don't miss any.
function driveWithVoidstorm(
  seed: number, constellationId: string, stake: string,
  fires: Map<string, number>,
): RunRecord {
  bootstrapHeadless(seed);
  const seenInThisBlind = new Set<string>();
  let lastBlindKey = '';
  const off = store.subscribe((s) => {
    const key = `${s.run.ante}:${s.run.goalIdx}`;
    if (key !== lastBlindKey) {
      lastBlindKey = key;
      seenInThisBlind.clear();
    }
    const id = s.round.voidstormId;
    if (id && !seenInThisBlind.has(id)) {
      seenInThisBlind.add(id);
      fires.set(id, (fires.get(id) ?? 0) + 1);
    }
  });
  try {
    return driveRun(seed, {
      constellationId,
      stakeId: stake,
      strategy: createHeuristicShopStrategy(),
    });
  } finally {
    off();
  }
}

export function voidstormImpact(opts: ImpactOptions): void {
  const onArm = newArm();
  const offArm = newArm();
  const totalCells = opts.constellations.length;
  let cellIdx = 0;

  for (const c of opts.constellations) {
    cellIdx++;
    const tStart = Date.now();
    for (let i = 0; i < opts.runsPerCell; i++) {
      const seed = (opts.baseSeed + i * 2) >>> 0;
      // Matched pair: same seed, same strategy, same constellation /
      // stake — only the voidstorm-enable flag differs. Lets us read
      // the delta cleanly even at modest run counts.
      const onRun  = driveWithVoidstorm(seed, c, opts.stake, onArm.voidstormFires);
      const offRun = driveWithoutVoidstorm(seed, c, opts.stake);
      onArm.totalRuns++;
      offArm.totalRuns++;
      onArm.totalScore += onRun.finalScore;
      offArm.totalScore += offRun.finalScore;
      if (onRun.won) onArm.wins++;
      if (offRun.won) offArm.wins++;
    }
    const dt = ((Date.now() - tStart) / 1000).toFixed(1);
    console.log(`  [${cellIdx}/${totalCells}] ${c}/${opts.stake} (${opts.runsPerCell}×2 runs) in ${dt}s`);
  }

  const onWinRate  = onArm.wins / Math.max(1, onArm.totalRuns);
  const offWinRate = offArm.wins / Math.max(1, offArm.totalRuns);
  const onMeanScore  = onArm.totalScore / Math.max(1, onArm.totalRuns);
  const offMeanScore = offArm.totalScore / Math.max(1, offArm.totalRuns);

  console.log('\n=== Voidstorm Impact (matched-pair, heuristic_shop) ===');
  console.log(`  arm        runs    winRate     meanScore`);
  console.log(`  ON         ${onArm.totalRuns.toString().padStart(4)}    ${(onWinRate * 100).toFixed(1).padStart(6)}%    ${Math.round(onMeanScore).toString().padStart(8)}`);
  console.log(`  OFF        ${offArm.totalRuns.toString().padStart(4)}    ${(offWinRate * 100).toFixed(1).padStart(6)}%    ${Math.round(offMeanScore).toString().padStart(8)}`);
  const winRateDelta = (onWinRate - offWinRate) * 100;
  const scoreDelta = onMeanScore - offMeanScore;
  console.log(`  Δ          —       ${winRateDelta >= 0 ? '+' : ''}${winRateDelta.toFixed(1).padStart(5)}pp   ${scoreDelta >= 0 ? '+' : ''}${Math.round(scoreDelta).toString().padStart(7)}`);

  // Storm fire frequency in the ON arm — surfaces which storms fire
  // most often. Even split is the design intent (uniform pickVoidstorm
  // selection above the 25% gate).
  console.log('\n=== Voidstorm fire counts (ON arm) ===');
  const totalFires = [...onArm.voidstormFires.values()].reduce((s, v) => s + v, 0);
  for (const def of VOIDSTORMS) {
    const n = onArm.voidstormFires.get(def.id) ?? 0;
    const share = totalFires > 0 ? (n / totalFires) * 100 : 0;
    console.log(`  ${def.id.padEnd(16)} ${def.tone.padEnd(6)} ${n.toString().padStart(5)}  (${share.toFixed(1).padStart(5)}%)`);
  }
  console.log(`  total                 ${totalFires}`);

  // Verdict — flag tuning if the win-rate delta is outside ±5pp.
  console.log('');
  if (Math.abs(winRateDelta) <= 5) {
    console.log(`✓ Voidstorms net within ±5pp on win-rate. Balance is healthy at the current tuning.`);
  } else {
    console.log(`⚠ Voidstorms shift win-rate by ${winRateDelta.toFixed(1)}pp — tune ${winRateDelta > 0 ? 'curses' : 'boons'}.`);
  }
}

const isMain = (() => {
  try {
    const argv1 = process.argv[1] ?? '';
    return argv1.endsWith('voidstormImpact.ts') || argv1.endsWith('voidstormImpact.js');
  } catch { return false; }
})();

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const constellationsArg = args.constellations as string | undefined;
  const opts: ImpactOptions = {
    runsPerCell: Number(args.runs ?? 200),
    baseSeed: Number(args.seed ?? 1),
    constellations: constellationsArg
      ? constellationsArg.split(',')
      : CONSTELLATIONS.map((c) => c.id).slice(0, 4),
    stake: String(args.stake ?? 'spark'),
  };
  console.log(`Voidstorm impact sweep: ${opts.constellations.length} cells × ${opts.runsPerCell} matched pairs`);
  const t0 = Date.now();
  voidstormImpact(opts);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nDone in ${dt}s.`);
}
