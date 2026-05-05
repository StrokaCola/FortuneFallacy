import { describe, it, expect } from 'vitest';
import { migrateRetheme } from './v1_retheme';

describe('migrateRetheme', () => {
  it('returns input unchanged for null/undefined', () => {
    expect(migrateRetheme(null)).toBe(null);
    expect(migrateRetheme(undefined)).toBe(undefined);
  });

  it('renames run.oracles -> run.catalysts and remaps ids', () => {
    const old = {
      run: {
        oracles: ['the_oracle', 'prophet', 'chaos_theory'],
        vouchers: ['astral_plane'],
        consumables: ['the_moon', 'shard_strike'],
      },
    };
    const m = migrateRetheme(old) as any;
    expect(m.run.catalysts).toEqual(['stratifier', 'six_bias', 'chaos_theory']);
    expect(m.run.oracles).toBeUndefined();
    expect(m.run.vouchers).toEqual(['bench']);
    expect(m.run.consumables).toEqual(['pin_six', 'shard_drop']);
  });

  it('lifts round.diceRunes -> run.diceMods and remaps mod ids', () => {
    const old = {
      run: { catalysts: [] },
      round: {
        diceRunes: [['snake_cult', 'amplify'], ['blessed'], []],
      },
    };
    const m = migrateRetheme(old) as any;
    expect(m.run.diceMods).toEqual([['snake_eyes', 'amplify'], ['backstop'], []]);
    expect(m.round.diceRunes).toBeUndefined();
    expect(m.round.diceMods).toBeUndefined();
  });

  it('lifts legacy round.diceMods -> run.diceMods (and remaps ids)', () => {
    const old = {
      run: { catalysts: [] },
      round: {
        diceMods: [['snake_cult'], [], ['amplify']],
      },
    };
    const m = migrateRetheme(old) as any;
    expect(m.run.diceMods).toEqual([['snake_eyes'], [], ['amplify']]);
    expect(m.round.diceMods).toBeUndefined();
  });

  it('defaults run.diceMods to [[],[],[],[],[]] when absent', () => {
    const old = { run: { catalysts: [] }, round: {} };
    const m = migrateRetheme(old) as any;
    expect(m.run.diceMods).toEqual([[], [], [], [], []]);
  });

  it('remaps boss blindId', () => {
    const m = migrateRetheme({ round: { blindId: 'the_devil' } }) as any;
    expect(m.round.blindId).toBe('phobos');
  });

  it('leaves new-shape data alone (idempotent)', () => {
    const fresh = {
      run: {
        catalysts: ['stratifier'],
        vouchers: ['bench'],
        consumables: ['pin_six'],
        diceMods: [['amplify']],
        handsPlayed: 0,
        compoundingStacks: 0,
        rollCounter: 0,
        tempoStreak: 0,
        tempoLastTier: -1,
        lastComboId: null,
        comboStreak: 0,
      },
      round: {
        shardSinkPrimedThisHand: false,
        firstRollDone: false,
        tithePrimedThisHand: 0,
        recursiveSinkPrimedThisHand: false,
      },
    };
    expect(migrateRetheme(fresh)).toEqual(fresh);
  });

  it('preserves unknown ids verbatim', () => {
    const old = { run: { oracles: ['unknown_oracle'], vouchers: [], consumables: [] } };
    const m = migrateRetheme(old) as any;
    expect(m.run.catalysts).toEqual(['unknown_oracle']);
  });

  it('defaults handsPlayed, compoundingStacks, shardSinkPrimedThisHand when missing', () => {
    const old = {
      run: { catalysts: [], vouchers: [], consumables: [] },
      round: {},
    };
    const m = migrateRetheme(old) as { run: { handsPlayed: number; compoundingStacks: number }; round: { shardSinkPrimedThisHand: boolean } };
    expect(m.run.handsPlayed).toBe(0);
    expect(m.run.compoundingStacks).toBe(0);
    expect(m.round.shardSinkPrimedThisHand).toBe(false);
  });

  it('preserves existing handsPlayed and compoundingStacks values', () => {
    const fresh = {
      run: { catalysts: [], vouchers: [], consumables: [], diceMods: [['amplify']], handsPlayed: 12, compoundingStacks: 3 },
      round: { shardSinkPrimedThisHand: true },
    };
    const m = migrateRetheme(fresh) as { run: { handsPlayed: number; compoundingStacks: number }; round: { shardSinkPrimedThisHand: boolean } };
    expect(m.run.handsPlayed).toBe(12);
    expect(m.run.compoundingStacks).toBe(3);
    expect(m.round.shardSinkPrimedThisHand).toBe(true);
  });
});
