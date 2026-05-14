import { describe, it, expect } from 'vitest';
import { buildQuestLog } from './RunQuestLog';
import type { GameState } from '../../../state/store';

function mockState(overrides: Partial<GameState> = {}): GameState {
  // Minimal-shape mock — only the fields buildQuestLog reads. Cast
  // through unknown so we don't have to fill every unrelated slice.
  return ({
    run: {
      constellationId: 'lyra',
      runStats: { peakHand: 0 },
    },
    meta: {
      achievements: { unlocked: [] },
      discovered: { catalysts: [] },
      unlocks: ['lyra'],
      stakeProgress: {},
    },
    ...overrides,
  } as unknown) as GameState;
}

describe('buildQuestLog', () => {
  it('always returns at least one nudge', () => {
    const out = buildQuestLog(mockState());
    expect(out.length).toBeGreaterThanOrEqual(1);
  });

  it('caps at three nudges', () => {
    const out = buildQuestLog(mockState());
    expect(out.length).toBeLessThanOrEqual(3);
  });

  it('surfaces a Codex nudge when below the 25-mark', () => {
    const s = mockState({
      meta: {
        achievements: { unlocked: [] },
        discovered: { catalysts: ['a', 'b', 'c'] },
        unlocks: ['lyra'],
        stakeProgress: {},
      } as unknown as GameState['meta'],
    });
    const out = buildQuestLog(s);
    expect(out.some((n) => n.label === 'Codex progress')).toBe(true);
  });

  it('skips the Codex nudge once the 25-mark is unlocked', () => {
    const s = mockState({
      meta: {
        achievements: { unlocked: ['codex_25'] },
        discovered: { catalysts: Array.from({ length: 25 }, (_, i) => `c-${i}`) },
        unlocks: ['lyra'],
        stakeProgress: {},
      } as unknown as GameState['meta'],
    });
    const out = buildQuestLog(s);
    const codex = out.find((n) => n.label === 'Codex progress');
    // If still present it should point at the next milestone (40), not 25.
    if (codex) expect(codex.detail).toMatch(/40/);
  });

  it('surfaces a constellation nudge for an unlocked, unwon constellation', () => {
    const s = mockState({
      meta: {
        achievements: { unlocked: [] },
        discovered: { catalysts: [] },
        unlocks: ['lyra', 'mensa'],
        stakeProgress: { lyra: 'spark' },
      } as unknown as GameState['meta'],
    });
    const out = buildQuestLog(s);
    expect(out.some((n) => n.label === 'Untried sky' && n.detail.includes('Mensa'))).toBe(true);
  });

  it('falls back to "The loop holds" when every milestone is met', () => {
    const s = mockState({
      run: {
        constellationId: 'lyra',
        runStats: { peakHand: 2_000_000 },
      } as unknown as GameState['run'],
      meta: {
        achievements: { unlocked: ['codex_25', 'codex_40', 'codex_56'] },
        discovered: { catalysts: Array.from({ length: 60 }, (_, i) => `c-${i}`) },
        unlocks: ['lyra'],
        stakeProgress: { lyra: 'supernova' },
      } as unknown as GameState['meta'],
    });
    const out = buildQuestLog(s);
    expect(out[0]!.label).toBe('The loop holds');
  });
});
