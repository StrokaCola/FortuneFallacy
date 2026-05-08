import { describe, it, expect } from 'vitest';
import {
  parseEventId,
  buildExplanation,
  formatDelta,
  formatNumber,
  type LastScoringCtx,
} from './scoreExplainData';

describe('parseEventId', () => {
  it('parses a mod-on-die id', () => {
    expect(parseEventId('mod:pip_charge@3')).toEqual({
      kind: 'mod', modId: 'pip_charge', dieIdx: 3,
    });
  });

  it('parses a crownMul id as its own kind', () => {
    expect(parseEventId('mod:crownMul@4')).toEqual({
      kind: 'crownMul', dieIdx: 4,
    });
  });

  it('treats a plain id as a catalyst', () => {
    expect(parseEventId('entropy_index')).toEqual({
      kind: 'catalyst', catalystId: 'entropy_index',
    });
  });

  it('falls back to catalyst when mod tag has no @', () => {
    expect(parseEventId('mod:something_weird')).toEqual({
      kind: 'catalyst', catalystId: 'mod:something_weird',
    });
  });
});

describe('formatNumber / formatDelta', () => {
  it('renders integers without decimals', () => {
    expect(formatNumber(7)).toBe('7');
    expect(formatNumber(1)).toBe('1');
  });

  it('rounds floats to 2 decimals', () => {
    expect(formatNumber(1.234)).toBe('1.23');
    expect(formatNumber(1.5)).toBe('1.5');
  });

  it('adds thousand-separator commas to integers ≥1000', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(12345)).toBe('12,345');
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(-50000)).toBe('-50,000');
  });

  it('keeps multiplier-style decimals raw (no comma decimal point)', () => {
    expect(formatNumber(1.25)).toBe('1.25');
    expect(formatNumber(2.5)).toBe('2.5');
  });

  it('signs positive deltas and strips zeros', () => {
    expect(formatDelta(5)).toBe('+5');
    expect(formatDelta(-3)).toBe('-3');
    expect(formatDelta(0)).toBe('0');
    expect(formatDelta(1.25)).toBe('+1.25');
  });
});

function ctx(partial: Partial<LastScoringCtx>): LastScoringCtx {
  return {
    combo: { id: 'three_kind', tier: 3 },
    chips: 0,
    mult: 1,
    chain: { mult: 1 },
    total: 0,
    events: [],
    state: { round: { dice: [], scoringOrder: undefined } },
    ...partial,
  };
}

describe('buildExplanation', () => {
  it('returns null combo when ctx.combo is null', () => {
    const e = buildExplanation(ctx({ combo: null }));
    expect(e.combo).toBeNull();
  });

  it('looks up combo display info from COMBOS', () => {
    const e = buildExplanation(ctx({ combo: { id: 'three_kind', tier: 3 } }));
    expect(e.combo?.name).toBe('Three of a Kind');
    expect(e.combo?.baseChips).toBe(30);
    expect(e.combo?.baseMult).toBe(5);
  });

  it('builds a row for a mod fire with die label', () => {
    const e = buildExplanation(ctx({
      events: [{
        type: 'onUpgradeTriggered',
        payload: { id: 'mod:pip_charge@2', phase: 5, deltaChips: 8, deltaMult: 0 },
      }],
      state: { round: { dice: [{ face: 1 }, { face: 2 }, { face: 4 }] } },
    }));
    expect(e.rows).toHaveLength(1);
    const row = e.rows[0]!;
    expect(row.source).toBe('mod');
    expect(row.label).toBe('Pip Charge');
    expect(row.detail).toBe('die 3 · face 4');
    expect(row.chipsDelta).toBe(8);
    expect(row.multDelta).toBe(0);
  });

  it('builds a row for a crownMul event', () => {
    const e = buildExplanation(ctx({
      events: [{
        type: 'onUpgradeTriggered',
        payload: { id: 'mod:crownMul@0', phase: 5, deltaChips: 0, deltaMult: 4 },
      }],
      state: { round: { dice: [{ face: 6 }] } },
    }));
    const row = e.rows[0]!;
    expect(row.label).toBe('Crown');
    expect(row.icon).toBe('♛');
    expect(row.multDelta).toBe(4);
  });

  it('builds a row for a catalyst event with metadata', () => {
    const e = buildExplanation(ctx({
      events: [{
        type: 'onUpgradeTriggered',
        payload: { id: 'entropy_index', phase: 5, deltaChips: 0, deltaMult: 1.25 },
      }],
    }));
    const row = e.rows[0]!;
    expect(row.source).toBe('catalyst');
    expect(row.label).toBe('Entropy Index');
    expect(row.detail).toBe('catalyst');
    expect(row.multDelta).toBe(1.25);
  });

  it('falls back to a prettified id for unknown catalysts (e.g. encore is real, but still)', () => {
    const e = buildExplanation(ctx({
      events: [{
        type: 'onUpgradeTriggered',
        payload: { id: 'unknown_thing', phase: 5, deltaChips: 1, deltaMult: 2 },
      }],
    }));
    expect(e.rows[0]!.label).toBe('Unknown Thing');
  });

  it('skips non-onUpgradeTriggered events', () => {
    const e = buildExplanation(ctx({
      events: [
        { type: 'onModFired', payload: { id: 'irrelevant', phase: 5, deltaChips: 0, deltaMult: 0 } },
        { type: 'onUpgradeTriggered', payload: { id: 'mod:amplify@0', phase: 5, deltaChips: 2, deltaMult: 0 } },
      ],
      state: { round: { dice: [{ face: 3 }] } },
    }));
    expect(e.rows).toHaveLength(1);
    expect(e.rows[0]!.label).toBe('Amplify');
  });

  it('preserves event order in rows', () => {
    const e = buildExplanation(ctx({
      events: [
        { type: 'onUpgradeTriggered', payload: { id: 'stratifier', phase: 5, deltaChips: 0, deltaMult: 1 } },
        { type: 'onUpgradeTriggered', payload: { id: 'mod:amplify@0', phase: 5, deltaChips: 2, deltaMult: 0 } },
        { type: 'onUpgradeTriggered', payload: { id: 'chaos_theory', phase: 5, deltaChips: 0, deltaMult: 5 } },
      ],
      state: { round: { dice: [{ face: 1 }] } },
    }));
    expect(e.rows.map((r) => r.label)).toEqual(['Stratifier', 'Amplify', 'Chaos Theory']);
  });

  it('passes through totals from ctx', () => {
    const e = buildExplanation(ctx({
      chips: 84, mult: 9, chain: { mult: 1.5 }, total: 1134,
    }));
    expect(e.totalChips).toBe(84);
    expect(e.totalMult).toBe(9);
    expect(e.chainMult).toBe(1.5);
    expect(e.total).toBe(1134);
  });
});
