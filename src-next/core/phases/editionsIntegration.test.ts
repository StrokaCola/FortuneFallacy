import { describe, it, expect } from 'vitest';
import { upgrades } from './upgrades';
// Pull in the catalysts we use here so they're registered.
import '../upgrades/catalysts/coldHand';
import '../upgrades/catalysts/pairDynamo';
import type { PipelineCtx } from '../pipeline/types';
import type { GameState } from '../../state/store';
import { mulberry32 } from '../rng';
import type { CatalystEdition } from '../../state/slices/run';

function makeCtx(opts: {
  catalysts: string[];
  catalystEditions?: Record<string, CatalystEdition>;
  combo: { id: string; tier: number; baseChips: number; baseMult: number; scoringFaces: number[] };
  chips?: number;
  mult?: number;
}): PipelineCtx {
  const state = {
    run: {
      catalysts: opts.catalysts,
      catalystEditions: opts.catalystEditions ?? {},
      compoundingStacks: 0,
      diceMods: [],
    },
    round: {
      isBoss: false,
      blindId: null,
      handsLeft: 3,
      handsMax: 3,
      firstHandPlayed: true,
      scoringOrder: [],
      tithePrimedThisHand: 0,
    },
  } as unknown as GameState;
  return {
    state,
    chips: opts.chips ?? 50,
    mult: opts.mult ?? 4,
    total: 0,
    events: [],
    rng: mulberry32(0),
    combo: opts.combo,
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

const onePair = { id: 'one_pair', tier: 1, baseChips: 10, baseMult: 2, scoringFaces: [3, 3] };
const fullHouse = { id: 'full_house', tier: 5, baseChips: 35, baseMult: 8, scoringFaces: [] };

describe('upgrades phase — catalyst editions', () => {
  it('foil pair_dynamo: +5 mult from catalyst, +50 chips from foil', () => {
    // pair_dynamo grants +5 mult on one_pair. With foil, the +50-chip
    // edition bonus rides on top.
    const ctx = makeCtx({
      catalysts: ['pair_dynamo'],
      catalystEditions: { pair_dynamo: 'foil' },
      combo: onePair,
    });
    const out = upgrades(ctx);
    expect(out.chips).toBe(100); // 50 base + 50 foil
    expect(out.mult).toBe(9);    // 4 base + 5 from pair_dynamo
  });

  it('holo cold_hand on Chance: +4 mult from catalyst, +10 mult from holo', () => {
    const ctx = makeCtx({
      catalysts: ['cold_hand'],
      catalystEditions: { cold_hand: 'holo' },
      combo: { id: 'chance', tier: 0, baseChips: 0, baseMult: 1, scoringFaces: [] },
    });
    const out = upgrades(ctx);
    // cold_hand adds +4 mult; holo adds +10 mult.
    expect(out.mult).toBe(18); // 4 base + 4 + 10
  });

  it('poly pair_dynamo: +5 mult from catalyst, +50% of contribution = +2.5 mult from poly', () => {
    const ctx = makeCtx({
      catalysts: ['pair_dynamo'],
      catalystEditions: { pair_dynamo: 'poly' },
      combo: onePair,
    });
    const out = upgrades(ctx);
    expect(out.mult).toBe(11.5); // 4 base + 5 + 2.5
  });

  it('edition does not fire when the catalyst gates and returns ctx unchanged', () => {
    // pair_dynamo gates on one_pair. Playing Full House → the catalyst
    // returns ctx unchanged → the foil edition should also no-op.
    const ctx = makeCtx({
      catalysts: ['pair_dynamo'],
      catalystEditions: { pair_dynamo: 'foil' },
      combo: fullHouse,
    });
    const out = upgrades(ctx);
    expect(out.chips).toBe(50); // unchanged — no foil bonus
    expect(out.mult).toBe(4);
  });

  it('plain (no edition) catalyst behaves identically to before', () => {
    const ctx = makeCtx({
      catalysts: ['pair_dynamo'],
      combo: onePair,
    });
    const out = upgrades(ctx);
    expect(out.chips).toBe(50);
    expect(out.mult).toBe(9); // 4 + 5
  });

  it('emits a synthetic edition event tagged with edition:<kind>@<catalyst>', () => {
    const ctx = makeCtx({
      catalysts: ['pair_dynamo'],
      catalystEditions: { pair_dynamo: 'holo' },
      combo: onePair,
    });
    const out = upgrades(ctx);
    const editionEvts = out.events.flatMap((e) =>
      e.type === 'onUpgradeTriggered' && e.payload.id.startsWith('edition:') ? [e.payload.id] : [],
    );
    expect(editionEvts).toEqual(['edition:holo@pair_dynamo']);
  });
});
