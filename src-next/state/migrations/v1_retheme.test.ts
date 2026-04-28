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
    const m = migrateRetheme(old);
    expect(m.run.catalysts).toEqual(['stratifier', 'six_bias', 'chaos_theory']);
    expect(m.run.oracles).toBeUndefined();
    expect(m.run.vouchers).toEqual(['bench']);
    expect(m.run.consumables).toEqual(['pin_six', 'shard_drop']);
  });

  it('renames round.diceRunes -> round.diceMods and remaps mod ids', () => {
    const old = {
      round: {
        diceRunes: [['snake_cult', 'amplify'], ['blessed'], []],
      },
    };
    const m = migrateRetheme(old);
    expect(m.round.diceMods).toEqual([['snake_eyes', 'amplify'], ['backstop'], []]);
    expect(m.round.diceRunes).toBeUndefined();
  });

  it('remaps boss blindId', () => {
    const m = migrateRetheme({ round: { blindId: 'the_devil' } });
    expect(m.round.blindId).toBe('phobos');
  });

  it('leaves new-shape data alone (idempotent)', () => {
    const fresh = {
      run: { catalysts: ['stratifier'], vouchers: ['bench'], consumables: ['pin_six'] },
      round: { diceMods: [['amplify']] },
    };
    expect(migrateRetheme(fresh)).toEqual(fresh);
  });

  it('preserves unknown ids verbatim', () => {
    const old = { run: { oracles: ['unknown_oracle'], vouchers: [], consumables: [] } };
    const m = migrateRetheme(old);
    expect(m.run.catalysts).toEqual(['unknown_oracle']);
  });
});
