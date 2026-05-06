import { describe, it, expect } from 'vitest';
import { updateComboStreaks } from './comboStreak';
import type { RunSlice } from '../../state/slices/run';

function run(over: Partial<RunSlice> = {}): RunSlice {
  return {
    seed: 0, shards: 0, ante: 1, goalIdx: 0, constellationId: 'lyra',
    catalysts: [], vouchers: [], consumables: [], ownedMods: [],
    diceMods: [[], [], [], [], []],
    handsPlayed: 0, compoundingStacks: 0, rollCounter: 0,
    tempoStreak: 0, tempoLastTier: -1, lastComboId: null, comboStreak: 0,
    comboLevels: {},
    catalystEditions: {},
    ownedModEditions: [],
    diceModEditions: [[], [], [], [], []],
    catalystShardSpend: 0,
    ...over,
  };
}

describe('updateComboStreaks', () => {
  it('returns prior values when combo is null', () => {
    const out = updateComboStreaks(run({ tempoStreak: 3, comboStreak: 2, lastComboId: 'pair' }), null);
    expect(out.tempoStreak).toBe(3);
    expect(out.comboStreak).toBe(2);
    expect(out.lastComboId).toBe('pair');
  });

  it('first hand of run starts both streaks at 1', () => {
    const out = updateComboStreaks(run(), { id: 'one_pair', tier: 1 });
    expect(out.tempoStreak).toBe(1);
    expect(out.tempoLastTier).toBe(1);
    expect(out.lastComboId).toBe('one_pair');
    expect(out.comboStreak).toBe(1);
  });

  it('strict tier increase grows tempoStreak', () => {
    const out = updateComboStreaks(
      run({ tempoStreak: 2, tempoLastTier: 1, lastComboId: 'one_pair', comboStreak: 1 }),
      { id: 'two_pair', tier: 2 },
    );
    expect(out.tempoStreak).toBe(3);
    expect(out.tempoLastTier).toBe(2);
  });

  it('tier tie or decrease resets tempoStreak', () => {
    const out = updateComboStreaks(
      run({ tempoStreak: 4, tempoLastTier: 5 }),
      { id: 'two_pair', tier: 2 },
    );
    expect(out.tempoStreak).toBe(0);
    expect(out.tempoLastTier).toBe(2);
  });

  it('combo match grows comboStreak; mismatch resets to 1', () => {
    const sameOut = updateComboStreaks(
      run({ lastComboId: 'full_house', comboStreak: 2, tempoLastTier: 5 }),
      { id: 'full_house', tier: 5 },
    );
    expect(sameOut.comboStreak).toBe(3);
    const mismatchOut = updateComboStreaks(
      run({ lastComboId: 'full_house', comboStreak: 5, tempoLastTier: 5 }),
      { id: 'two_pair', tier: 2 },
    );
    expect(mismatchOut.comboStreak).toBe(1);
  });
});
