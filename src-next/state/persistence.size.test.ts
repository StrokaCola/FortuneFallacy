// Persistence blob size measurement — re-run after any save-shape change.
//
// Builds a hand-crafted "max state" save snapshot (full discovery, full
// catalyst stack, full mod editions across all dice, full high-score table,
// every voucher, every consumable) and reports the JSON-serialized blob size
// in kb. Threshold from the 2026-05-07 audit follow-up: >50 kb means we
// should move the persist trigger from "every store delta + 400 ms debounce"
// to "phase transitions only" (round end / shop close / hub).
//
// Re-run with: `npx vitest run src-next/state/persistence.size.test.ts --reporter=verbose`

import { describe, it, expect } from 'vitest';
import { initialRunSlice } from './slices/run';
import { initialRoundSlice } from './slices/round';
import { initialUiSlice } from './slices/ui';
import { initialMetaSlice, SEEDED_UNLOCKS } from './slices/meta';
import { CATALYST_META } from '../data/catalysts';
import { MODS } from '../core/mods';
import { VOUCHERS } from '../core/vouchers';
import { CONSUMABLES } from '../core/consumables';
import { BOSS_BLINDS } from '../data/blinds';
import { CONSTELLATIONS } from '../data/constellations';

function buildMaxState() {
  const allCatalystIds = CATALYST_META.map((c) => c.id);
  const allModIds = MODS.map((m) => m.id);
  const allVoucherIds = VOUCHERS.map((v) => v.id);
  const allConsumableIds = CONSUMABLES.map((c) => c.id);
  const allBossIds = BOSS_BLINDS.map((b) => b.id);
  const allConstIds = CONSTELLATIONS.map((c) => c.id);

  // 7 dice (Mensa) × 4 mods per die with editions — pessimistic but reachable
  // with the Forged Links voucher line.
  const diceCount = 7;
  const modsPerDie = 4;
  const diceMods: string[][] = Array.from({ length: diceCount }, () => allModIds.slice(0, modsPerDie));
  const diceModEditions: (null | 'foil' | 'holo' | 'poly')[][] = Array.from(
    { length: diceCount },
    () => Array.from({ length: modsPerDie }, () => 'poly' as const),
  );
  const ownedMods = allModIds.slice(0, 12);
  const ownedModEditions: (null | 'foil' | 'holo' | 'poly')[] = ownedMods.map(() => 'poly');

  const run = {
    ...initialRunSlice(),
    shards: 12345,
    ante: 4,
    goalIdx: 11,
    constellationId: 'mensa',
    catalysts: allCatalystIds.slice(0, 12),
    vouchers: allVoucherIds,
    consumables: allConsumableIds.slice(0, 8),
    ownedMods,
    diceMods,
    diceModEditions,
    ownedModEditions,
    catalystEditions: Object.fromEntries(allCatalystIds.slice(0, 12).map((id) => [id, 'poly' as const])),
    handsPlayed: 80,
    compoundingStacks: 11,
    rollCounter: 240,
    tempoStreak: 4,
    tempoLastTier: 6,
    lastComboId: 'four_kind',
    comboStreak: 3,
    comboLevels: {
      chance: 5, one_pair: 5, two_pair: 5, three_kind: 5,
      sm_straight: 5, full_house: 5, lg_straight: 5, four_kind: 5, five_kind: 5,
    },
    catalystShardSpend: 88,
    stakeId: 'supernova',
  };

  // Long-lived players accumulate a full high-score history (cap=10) and
  // wide discovery sets across many runs.
  const highScores = Array.from({ length: 10 }, (_, i) => ({
    name: `Player${i.toString().padStart(2, '0')}`,
    score: 1_000_000 + i * 17_000,
    date: 1_700_000_000_000 + i * 86_400_000,
  }));
  const stakeProgress: Record<string, string> = {};
  for (const cid of allConstIds) stakeProgress[cid] = 'supernova';

  const meta = {
    ...initialMetaSlice(),
    playerName: 'A Long Player Name For Pessimistic Sizing',
    unlocks: [...SEEDED_UNLOCKS, 'legendary_all_band', ...allConstIds],
    highScores,
    stakeProgress,
    challengeWins: ['ascetic', 'wildcat', 'hex'],
    discovered: {
      catalysts: allCatalystIds,
      mods: allModIds,
      vouchers: allVoucherIds,
      bosses: allBossIds,
      consumables: allConsumableIds,
    },
  };

  const round = {
    ...initialRoundSlice(),
    active: true,
    blindId: 'final_trial',
    blindIndex: 2,
    isBoss: true,
    target: 30000,
    handsMax: 3,
    handsLeft: 1,
    rerollsLeft: 1,
    score: 18000,
    chainLen: 3,
    chainTier: 6,
    dice: Array.from({ length: 7 }, (_, i) => ({ id: i, face: (i % 6) + 1, locked: false })),
    scoringOrder: [0, 1, 2, 3, 4, 5, 6],
  };

  const ui = { ...initialUiSlice() };

  return { run, meta, round, ui };
}

describe('persistence blob size', () => {
  it('measures the worst-case save snapshot and reports it', () => {
    const snapshot = buildMaxState();
    const json = JSON.stringify(snapshot);
    const kb = json.length / 1024;

    const lines = [
      '',
      '=== Worst-case save blob size ===',
      `  bytes : ${json.length}`,
      `  kb    : ${kb.toFixed(2)}`,
      `  run   : ${(JSON.stringify(snapshot.run).length / 1024).toFixed(2)} kb`,
      `  meta  : ${(JSON.stringify(snapshot.meta).length / 1024).toFixed(2)} kb`,
      `  round : ${(JSON.stringify(snapshot.round).length / 1024).toFixed(2)} kb`,
      `  ui    : ${(JSON.stringify(snapshot.ui).length / 1024).toFixed(2)} kb`,
      '',
      `  Threshold for "switch to phase-transition persist": 50 kb`,
      `  Verdict: ${kb > 50 ? 'SWITCH (blob too large for delta-debounced saves)' : 'OK (current debounce is fine)'}`,
      '',
    ];
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));

    // The snapshot should always be a valid serializable object.
    expect(json.length).toBeGreaterThan(0);
    // No non-serializable cycles.
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
