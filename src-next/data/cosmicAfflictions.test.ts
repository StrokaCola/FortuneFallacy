import { describe, it, expect } from 'vitest';
import {
  COSMIC_AFFLICTIONS,
  pickAfflictionForLap,
  lookupCosmicAffliction,
} from './cosmicAfflictions';
import { targetForBlind } from './blinds';

describe('cosmicAfflictions registry (Pillar D)', () => {
  it('has at least 5 entries', () => {
    expect(COSMIC_AFFLICTIONS.length).toBeGreaterThanOrEqual(5);
  });

  it('ids are unique', () => {
    const ids = COSMIC_AFFLICTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has a flavor and a lapTrigger ≥ 1', () => {
    for (const a of COSMIC_AFFLICTIONS) {
      expect(a.flavor.length).toBeGreaterThan(0);
      expect(a.lapTrigger).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('pickAfflictionForLap', () => {
  it('returns undefined for lap 0 (normal run)', () => {
    expect(pickAfflictionForLap(0)).toBeUndefined();
  });

  it('returns the lap-1 entry on lap 1', () => {
    const a = pickAfflictionForLap(1);
    expect(a?.id).toBe('gravity');
  });

  it('escalates to the highest-trigger eligible entry as lap grows', () => {
    const a3 = pickAfflictionForLap(3);
    expect(a3?.lapTrigger).toBeLessThanOrEqual(3);
    const a5 = pickAfflictionForLap(5);
    expect(a5?.lapTrigger).toBeLessThanOrEqual(5);
    expect(a5?.id).toBe('heat_death');
  });

  it('caps at the highest-tier affliction on very high laps', () => {
    const a = pickAfflictionForLap(99);
    expect(a?.id).toBe('heat_death');
  });
});

describe('lookupCosmicAffliction', () => {
  it('finds a known affliction by id', () => {
    expect(lookupCosmicAffliction('gravity')?.name).toBe('Gravity');
  });

  it('returns undefined for unknown / nullish ids', () => {
    expect(lookupCosmicAffliction(null)).toBeUndefined();
    expect(lookupCosmicAffliction('not_real')).toBeUndefined();
  });
});

describe('targetForBlind (lap scaling)', () => {
  it('lap 0 reproduces the legacy formula', () => {
    const t0 = targetForBlind(1, 0, 0);
    const tLegacy = targetForBlind(1, 0); // default arg
    expect(t0).toBe(tLegacy);
  });

  it('lap 1 multiplies the base by 2.25', () => {
    const base = targetForBlind(1, 0, 0);
    const lap1 = targetForBlind(1, 0, 1);
    expect(lap1).toBe(Math.ceil(base * 2.25));
  });

  it('lap 3 stacks the multiplier exponentially', () => {
    const base = targetForBlind(2, 1, 0);
    const lap3 = targetForBlind(2, 1, 3);
    expect(lap3).toBe(Math.ceil(base * Math.pow(2.25, 3)));
  });
});
