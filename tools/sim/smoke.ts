// Smoke test: boot, drive one Random run, dump key fields.
// Run via: npx tsx tools/sim/smoke.ts

import { bootstrapHeadless } from './bootstrap';
import { driveRun } from './driver';
import { attachTelemetry } from './telemetry';
import { createRandomStrategy, createGreedyStrategy, createEvKeepStrategy, createHeuristicShopStrategy, createPlaysCatalystsStrategy } from './strategies';

function runOne(label: string, seed: number, strat: ReturnType<typeof createRandomStrategy>) {
  bootstrapHeadless(seed);
  const record = {
    seed, constellationId: 'lyra', stakeId: 'spark', challengeId: '', strategyId: strat.id,
    finalAnte: 0, goalsCleared: 0, won: false, finalScore: 0,
    totalHandsPlayed: 0, totalShardsEarned: 0,
    catalystsBought: 0, vouchersBought: 0, consumablesBought: 0, modsBought: 0, packsBought: 0, shopRerolls: 0,
    bustReason: 'unknown',
    combosPlayed: {} as Record<string, number>,
    perBlind: [] as Array<{ante:number;blindIdx:number;blindId:string;isBoss:boolean;target:number;score:number;handsUsed:number;outcome:'clear'|'bust';}>,
    actionLog: [] as Array<unknown>,
  };
  const detach = attachTelemetry(record as Parameters<typeof attachTelemetry>[0]);
  try {
    const r = driveRun(seed, { constellationId: 'lyra', stakeId: 'spark', strategy: strat });
    // Copy back the telemetry counters that were populated on the local record
    // by the attached listeners.
    r.totalShardsEarned = record.totalShardsEarned;
    r.perBlind = record.perBlind;
    console.log(`[${label}] seed=${seed} strat=${strat.id}`);
    console.log(`  goals=${r.goalsCleared}/12 ante=${r.finalAnte} won=${r.won} score=${r.finalScore} hands=${r.totalHandsPlayed} bust=${r.bustReason}`);
    console.log(`  blinds: ${r.perBlind.map((b) => `${b.blindId}@${b.score}/${b.target}(${b.outcome[0]})`).join(' → ')}`);
    console.log(`  combos: ${JSON.stringify(r.combosPlayed)}`);
    console.log(`  shop: cat=${r.catalystsBought} vou=${r.vouchersBought} con=${r.consumablesBought} mod=${r.modsBought} pack=${r.packsBought} rerolls=${r.shopRerolls} shards-earned=${r.totalShardsEarned}`);
    return r;
  } finally {
    detach();
  }
}

const seeds = [1, 42, 1337, 99999, 2026];

console.log('=== Random ===');
for (const s of seeds) runOne('rand', s, createRandomStrategy(s));

console.log('\n=== Greedy ===');
for (const s of seeds) runOne('greedy', s, createGreedyStrategy());

console.log('\n=== EVKeep ===');
for (const s of seeds) runOne('evkeep', s, createEvKeepStrategy());

console.log('\n=== HeuristicShop ===');
for (const s of seeds) runOne('heur', s, createHeuristicShopStrategy());

// 2026-05-21 — canonical "real player" baseline. Random/Greedy/EVKeep/Heuristic
// all rank vouchers above catalysts (vouchers are permanent and that's correct
// long-run), so the smoke output reads as 0/5 ante-1 wins. PlaysCatalysts
// flips the ranking — affordable catalyst beats voucher — so the demo
// actually accumulates a deck. Closer match to what a real player does at
// the bottom of the Spark stake.
console.log('\n=== PlaysCatalysts (canonical demo) ===');
for (const s of seeds) runOne('plays', s, createPlaysCatalystsStrategy());
