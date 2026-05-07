// Stacked-deck sweep: instead of letting the bot shop, grant a strong
// pre-built catalyst loadout at run start and play the run. Answers the
// question "is the game winnable with a competent deck on stake X?"
//
// Loadouts are picked from the top of the per-catalyst impact study and
// tagged by archetype so we cover multiple play styles.

import { bootstrapHeadless, dispatch } from './bootstrap';
import { driveRun } from './driver';
import { writeCsv } from './csv';
import { createEvKeepStrategy } from './strategies';

const LOADOUTS: Record<string, string[]> = {
  // High-impact mixed: best individual contributors from the impact study
  mixed_top: ['entropy_index', 'pair_dynamo', 'triplet_engine', 'metronome'],
  // Pure scaling: Compounding Bias + Tempo + Patience Counter benefit from
  // long runs and many hands
  scaling: ['compounding_bias', 'tempo', 'patience_counter', 'usurer'],
  // Combo synergy: each catalyst boosts a specific combo tier
  combo_synergy: ['pair_dynamo', 'triplet_engine', 'magnitude', 'all_band'],
  // Economy/sustain
  economy: ['shard_lung', 'shard_sink', 'stipend', 'usurer'],
  // Single legendary
  legendary_only: ['all_band'],
  // Empty control
  empty: [],
};

const CONSTELLATIONS = ['lyra', 'mensa', 'triumvirate', 'argo', 'fibonacci', 'eclipse', 'polyhedra', 'ophiuchus'];
const STAKES = ['spark', 'ember', 'pyre', 'beacon', 'nova', 'supernova'];
const RUNS = Number(process.env.SIM_RUNS_PER_CELL ?? '150');
const SEED = Number(process.env.SIM_SEED ?? '5001');

interface CellRow {
  constellation: string;
  stake: string;
  loadout: string;
  runs: number;
  winRate: number;
  meanAnte: number;
  meanScore: number;
  medianScore: number;
}

const rows: CellRow[] = [];
const t0 = Date.now();

for (const [loadoutName, ids] of Object.entries(LOADOUTS)) {
  console.log(`\n--- Loadout: ${loadoutName} [${ids.join(', ') || 'none'}] ---`);
  for (const constellation of CONSTELLATIONS) {
    for (const stake of STAKES) {
      const scores: number[] = [];
      const antes: number[] = [];
      let wins = 0;

      for (let i = 0; i < RUNS; i++) {
        const seed = (SEED + i) >>> 0;
        bootstrapHeadless(seed);
        // Set up the run, then grant catalysts before any blind starts.
        dispatch({ type: 'NEW_RUN', constellationId: constellation, stakeId: stake });
        for (const id of ids) {
          dispatch({ type: 'GRANT_CATALYST', id });
        }
        const r = driveRun(seed, {
          constellationId: constellation,
          stakeId: stake,
          strategy: createEvKeepStrategy(),
          skipNewRun: true,
        });
        scores.push(r.finalScore);
        antes.push(r.finalAnte);
        if (r.won) wins++;
      }

      const meanScore = scores.reduce((s, v) => s + v, 0) / RUNS;
      const sorted = [...scores].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      const meanAnte = antes.reduce((s, v) => s + v, 0) / RUNS;
      const winRate = wins / RUNS;
      rows.push({
        constellation,
        stake,
        loadout: loadoutName,
        runs: RUNS,
        winRate: Number(winRate.toFixed(3)),
        meanAnte: Number(meanAnte.toFixed(2)),
        meanScore: Math.round(meanScore),
        medianScore: median,
      });
    }
    const cellSummary = rows
      .filter((r) => r.constellation === constellation && r.loadout === loadoutName)
      .map((r) => `${r.stake}=${(r.winRate * 100).toFixed(0)}%`)
      .join(' ');
    console.log(`  ${constellation.padEnd(11)} ${cellSummary}`);
  }
}

writeCsv('docs/sim-data/stacked_deck_sweep.csv', rows as unknown as Record<string, unknown>[]);
const dt = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nTotal: ${rows.length} cells × ${RUNS} runs in ${dt}s`);
console.log(`Wrote docs/sim-data/stacked_deck_sweep.csv`);
