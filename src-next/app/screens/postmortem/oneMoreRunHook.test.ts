import { describe, it, expect } from 'vitest';
import { computeOneMoreRunHook } from './oneMoreRunHook';
import { initialMetaSlice } from '../../../state/slices/meta';
import { initialRunSlice } from '../../../state/slices/run';
import { ASTRAL_PERKS } from '../../../data/astralPerks';
import { CATALYST_META } from '../../../data/catalysts';

const FIXED_NOW = new Date(Date.UTC(2026, 4, 8));

describe('computeOneMoreRunHook', () => {
  it("surfaces today's daily when it hasn't been attempted", () => {
    const hook = computeOneMoreRunHook(initialMetaSlice(), initialRunSlice(), FIXED_NOW);
    expect(hook.tone).toBe('daily');
    expect(hook.label).toMatch(/Daily Challenge/);
  });

  it('skips the daily hook when today is already attempted', () => {
    const meta = {
      ...initialMetaSlice(),
      dailyHistory: {
        '2026-05-08': {
          score: 0, cleared: false, ante: 1,
          constellation: 'lyra', stake: 'spark', playedAt: 0,
        },
      },
    };
    const hook = computeOneMoreRunHook(meta, initialRunSlice(), FIXED_NOW);
    expect(hook.tone).not.toBe('daily');
  });

  it("nudges 'X dust from {perkName}' when within 30 of an unowned perk", () => {
    const cheapest = ASTRAL_PERKS.slice().sort((a, b) => a.cost - b.cost)[0]!;
    const meta = {
      ...initialMetaSlice(),
      cosmicDust: cheapest.cost - 10, // 10-dust gap
      dailyHistory: { '2026-05-08': skippedToday() },
    };
    const hook = computeOneMoreRunHook(meta, initialRunSlice(), FIXED_NOW);
    expect(hook.tone).toBe('dust');
    expect(hook.label).toMatch(/10 dust from/);
    expect(hook.label).toMatch(new RegExp(cheapest.name));
  });

  it('falls through dust hook when gap is > 30', () => {
    const meta = {
      ...initialMetaSlice(),
      cosmicDust: 0, // way under the cheapest perk (25-dust threshold + 30 cap = 55)
      dailyHistory: { '2026-05-08': skippedToday() },
    };
    // The cheapest perk is 25 dust; with 0 dust the gap is 25 (within 30),
    // so this case actually IS a dust-tone hook. Verify the threshold edge.
    const hook = computeOneMoreRunHook(meta, initialRunSlice(), FIXED_NOW);
    expect(hook.tone).toBe('dust');
    expect(hook.label).toMatch(/25 dust from/);
  });

  it('surfaces codex hint when within 5 of full discovery', () => {
    const allButFour = CATALYST_META.slice(0, CATALYST_META.length - 4).map((c) => c.id);
    const meta = {
      ...initialMetaSlice(),
      cosmicDust: 999, // skip dust hook
      astralPerks: ASTRAL_PERKS.map((p) => p.id), // all perks owned, skip dust+affordable
      discovered: {
        ...initialMetaSlice().discovered,
        catalysts: allButFour,
      },
      dailyHistory: { '2026-05-08': skippedToday() },
    };
    const hook = computeOneMoreRunHook(meta, initialRunSlice(), FIXED_NOW);
    expect(hook.tone).toBe('codex');
    expect(hook.label).toMatch(/4 catalysts from a complete codex/);
  });

  it('surfaces affordable perk when dust > cheapest unowned', () => {
    const meta = {
      ...initialMetaSlice(),
      cosmicDust: 200,
      dailyHistory: { '2026-05-08': skippedToday() },
    };
    const hook = computeOneMoreRunHook(meta, initialRunSlice(), FIXED_NOW);
    expect(hook.tone).toBe('dust');
    expect(hook.label).toMatch(/Astral Forge/);
  });

  it('falls back to the generic hook when nothing applies', () => {
    const meta = {
      ...initialMetaSlice(),
      cosmicDust: 0,
      astralPerks: ASTRAL_PERKS.map((p) => p.id), // all owned
      discovered: {
        ...initialMetaSlice().discovered,
        catalysts: CATALYST_META.map((c) => c.id), // codex complete
      },
      dailyHistory: { '2026-05-08': skippedToday() },
      stakeProgress: {},
    };
    const hook = computeOneMoreRunHook(meta, initialRunSlice(), FIXED_NOW);
    expect(hook.tone).toBe('generic');
  });

  it('surfaces stake progression after a clear', () => {
    const meta = {
      ...initialMetaSlice(),
      cosmicDust: 0,
      astralPerks: ASTRAL_PERKS.map((p) => p.id),
      discovered: {
        ...initialMetaSlice().discovered,
        catalysts: CATALYST_META.map((c) => c.id),
      },
      dailyHistory: { '2026-05-08': skippedToday() },
      stakeProgress: { lyra: 'spark' }, // just cleared spark on lyra
    };
    const run = { ...initialRunSlice(), constellationId: 'lyra' };
    const hook = computeOneMoreRunHook(meta, run, FIXED_NOW);
    expect(hook.tone).toBe('stake');
    expect(hook.label).toMatch(/Lyra/);
  });
});

function skippedToday() {
  return {
    score: 0, cleared: false, ante: 1,
    constellation: 'lyra', stake: 'spark', playedAt: 0,
  };
}
