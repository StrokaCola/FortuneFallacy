import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../core/rng';
import { generateItemName, generateRunAlias, generateFlavor } from './nameGenerator';
import type { AffixDef } from './types';

const FAKE_PREFIX: AffixDef = {
  id: 'p1', slot: 'prefix', family: 'scalar', budgetCost: 1,
  validOn: ['combo'], weight: 1, nameTemplate: 'Cracked',
  flavorTags: ['decay'], effect: () => {},
};
const FAKE_SUFFIX: AffixDef = {
  id: 's1', slot: 'suffix', family: 'scalar', budgetCost: 1,
  validOn: ['combo'], weight: 1, nameTemplate: 'of Sundering',
  flavorTags: ['void'], effect: () => {},
};

describe('generateItemName', () => {
  it('formats prefix + base + suffix', () => {
    expect(generateItemName('Burst Card', [FAKE_PREFIX, FAKE_SUFFIX]))
      .toBe('Cracked Burst Card of Sundering');
  });

  it('handles prefix only', () => {
    expect(generateItemName('Burst Card', [FAKE_PREFIX])).toBe('Cracked Burst Card');
  });

  it('handles suffix only', () => {
    expect(generateItemName('Burst Card', [FAKE_SUFFIX])).toBe('Burst Card of Sundering');
  });

  it('inserts mid-name slot when a mid affix is present', () => {
    const mid: AffixDef = {
      id: 'm1', slot: 'mid', family: 'reality-warp', budgetCost: 5,
      validOn: ['combo'], weight: 1, nameTemplate: 'That-Forgot-Its-Name',
      flavorTags: ['memory'], effect: () => {},
    };
    expect(generateItemName('Burst Card', [FAKE_PREFIX, mid, FAKE_SUFFIX]))
      .toBe('Cracked Burst-Card-That-Forgot-Its-Name of Sundering');
  });
});

describe('generateFlavor', () => {
  it('picks a line whose tags overlap the affix tags', () => {
    const rng = mulberry32(42);
    const flavor = generateFlavor(rng, [FAKE_PREFIX]); // tags: ['decay']
    // The exact line picked under mulberry32(42) is deterministic — the
    // first test run will tell us what it is. Lock it in.
    expect(typeof flavor).toBe('string');
    expect(flavor.length).toBeGreaterThan(0);
  });

  it('is deterministic given the same seed', () => {
    expect(generateFlavor(mulberry32(7), [FAKE_PREFIX]))
      .toBe(generateFlavor(mulberry32(7), [FAKE_PREFIX]));
  });

  it('never returns the empty string when at least one flavor matches', () => {
    const rng = mulberry32(99);
    expect(generateFlavor(rng, [FAKE_PREFIX, FAKE_SUFFIX])).not.toBe('');
  });

  it('picks a tag-matching line (decay tag must hit a decay-tagged line)', () => {
    // FLAVOR_POOL has two lines tagged 'decay':
    //   - 'The edges remember being more.' (['decay'])
    //   - 'Cold to the touch even through gloves.' (['decay', 'cold'])
    // With FAKE_PREFIX tagged ['decay'], the filter narrows to exactly these
    // two; pick() must return one of them. Tag-filter correctness.
    const flavor = generateFlavor(mulberry32(123), [FAKE_PREFIX]);
    expect([
      'The edges remember being more.',
      'Cold to the touch even through gloves.',
    ]).toContain(flavor);
  });
});

describe('generateRunAlias', () => {
  it('produces a non-empty string', () => {
    expect(generateRunAlias(mulberry32(1)).length).toBeGreaterThan(0);
  });

  it('is deterministic given the same seed', () => {
    expect(generateRunAlias(mulberry32(123))).toBe(generateRunAlias(mulberry32(123)));
  });
});
