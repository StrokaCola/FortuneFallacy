import { describe, it, expect } from 'vitest';
import { effectiveDiscardCost } from './discardCost';
import type { BlindRule } from '../../voidmode/types';

describe('effectiveDiscardCost', () => {
  it('returns 1 with no rules (normal-mode / void-mode-no-rule baseline)', () => {
    expect(effectiveDiscardCost([])).toBe(1);
  });

  it('returns 1 when only non-cost rules are present (banCombo)', () => {
    const rules: BlindRule[] = [{ kind: 'banCombo', comboId: 'one_pair' }];
    expect(effectiveDiscardCost(rules)).toBe(1);
  });

  it('multiplies for a single discardCostMultiplier rule', () => {
    expect(effectiveDiscardCost([{ kind: 'discardCostMultiplier', multiplier: 2 }])).toBe(2);
    expect(effectiveDiscardCost([{ kind: 'discardCostMultiplier', multiplier: 3 }])).toBe(3);
  });

  it('composes multiplicatively when multiple cost rules stack', () => {
    const rules: BlindRule[] = [
      { kind: 'discardCostMultiplier', multiplier: 2 },
      { kind: 'discardCostMultiplier', multiplier: 3 },
    ];
    expect(effectiveDiscardCost(rules)).toBe(6);
  });

  it('floors at 1 (defensive — sub-integer multipliers ceil to 1)', () => {
    expect(effectiveDiscardCost([{ kind: 'discardCostMultiplier', multiplier: 0 }])).toBe(1);
    expect(effectiveDiscardCost([{ kind: 'discardCostMultiplier', multiplier: 0.4 }])).toBe(1);
  });

  it('ignores unrecognized rule kinds without crashing', () => {
    const rules = [
      { kind: 'discardCostMultiplier' as const, multiplier: 2 },
      { kind: 'banCombo' as const, comboId: 'chance' },
    ];
    expect(effectiveDiscardCost(rules)).toBe(2);
  });
});
