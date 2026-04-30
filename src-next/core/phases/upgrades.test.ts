import { describe, it, expect, beforeAll } from 'vitest';
import { upgrades } from './upgrades';
import '../upgrades/catalysts/compoundingBias';
import type { PipelineCtx } from '../pipeline/types';
import type { GameState } from '../../state/store';

function makeCtx(overrides: {
  blindId?: string;
  isBoss?: boolean;
  firstHandPlayed?: boolean;
  handsLeft?: number;
  handsMax?: number;
  catalysts?: string[];
  compoundingStacks?: number;
}): PipelineCtx {
  const state = {
    run: {
      catalysts: overrides.catalysts ?? [],
      compoundingStacks: overrides.compoundingStacks ?? 0,
    },
    round: {
      isBoss: overrides.isBoss ?? false,
      blindId: overrides.blindId ?? null,
      handsLeft: overrides.handsLeft ?? 3,
      handsMax: overrides.handsMax ?? 3,
      firstHandPlayed: overrides.firstHandPlayed ?? false,
      diceMods: [],
    },
  } as unknown as GameState;
  return {
    state,
    chips: 50,
    mult: 4,
    total: 0,
    events: [],
    rng: () => 0,
    sim: {
      finalFaces: [],
      restPositions: [],
      settleMs: [],
      peakVelocity: 0,
      collisionCount: 0,
      bounceHeights: [],
    } as unknown as PipelineCtx['sim'],
  };
}

describe('upgrades phase — Eris first-hand gate (firstHandPlayed)', () => {
  beforeAll(() => {
    // catalysts auto-register on import
  });

  it('blocks catalysts on first hand when Eris active and firstHandPlayed=false', () => {
    const ctx = makeCtx({
      isBoss: true,
      blindId: 'eris',
      firstHandPlayed: false,
      catalysts: ['compounding_bias'],
      compoundingStacks: 2,
    });
    const out = upgrades(ctx);
    // compounding_bias would multiply mult by 1.10; blocked → mult unchanged
    expect(out.mult).toBe(4);
  });

  it('allows catalysts after first hand played when Eris active', () => {
    const ctx = makeCtx({
      isBoss: true,
      blindId: 'eris',
      firstHandPlayed: true,
      catalysts: ['compounding_bias'],
      compoundingStacks: 2,
    });
    const out = upgrades(ctx);
    // compounding_bias bonus = 4 * (1 + 2*0.05) = 4.4
    expect(out.mult).toBeCloseTo(4.4, 5);
  });

  it('roll_token-safe: handsLeft === handsMax does not retrigger Eris block once firstHandPlayed=true', () => {
    // Scenario: player on hand 2, plays roll_token consumable, handsLeft bumps to 3 == handsMax.
    // Old check (handsLeft === handsMax) would falsely re-block. New flag must not.
    const ctx = makeCtx({
      isBoss: true,
      blindId: 'eris',
      firstHandPlayed: true,
      handsLeft: 3,
      handsMax: 3,
      catalysts: ['compounding_bias'],
      compoundingStacks: 1,
    });
    const out = upgrades(ctx);
    // 4 * (1 + 0.05) = 4.2; if blocked would stay 4
    expect(out.mult).toBeCloseTo(4.2, 5);
  });

  it('non-Eris boss with firstHandPlayed=false does not block catalysts', () => {
    const ctx = makeCtx({
      isBoss: false,
      blindId: null as unknown as string,
      firstHandPlayed: false,
      catalysts: ['compounding_bias'],
      compoundingStacks: 2,
    });
    const out = upgrades(ctx);
    expect(out.mult).toBeCloseTo(4.4, 5);
  });
});
