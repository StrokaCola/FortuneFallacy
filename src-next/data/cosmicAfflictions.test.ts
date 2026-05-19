import { describe, it, expect } from 'vitest';
import {
  COSMIC_AFFLICTIONS,
  pickAfflictionForLap,
  pickAfflictionsForLap,
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
    // 2026-05-19 long-tail laps: pool extended past lap 10 (final_dark)
    // to lap 15 (singularity). Any lap >= 15 picks singularity as the
    // headline (highest lapTrigger).
    const a = pickAfflictionForLap(99);
    expect(a?.id).toBe('singularity');
  });

  it('lap 5 still picks heat_death (boundary above lap-5 entries)', () => {
    expect(pickAfflictionForLap(5)?.id).toBe('heat_death');
  });

  it('lap 6 picks gravity_well_redux (first lap-6+ entry)', () => {
    expect(pickAfflictionForLap(6)?.id).toBe('gravity_well_redux');
  });

  it('lap 8 picks event_horizon', () => {
    expect(pickAfflictionForLap(8)?.id).toBe('event_horizon');
  });

  it('lap 10 picks final_dark', () => {
    expect(pickAfflictionForLap(10)?.id).toBe('final_dark');
  });

  it('lap 12 picks oblivion_pull (new 2026-05-19 entry)', () => {
    expect(pickAfflictionForLap(12)?.id).toBe('oblivion_pull');
  });

  it('lap 15 picks singularity (new 2026-05-19 entry)', () => {
    expect(pickAfflictionForLap(15)?.id).toBe('singularity');
  });
});

describe('pickAfflictionsForLap (stacking)', () => {
  it('returns empty for lap 0 (normal run)', () => {
    expect(pickAfflictionsForLap(0)).toEqual([]);
  });

  it('returns just the lap-1 entry on lap 1', () => {
    const a = pickAfflictionsForLap(1);
    expect(a.map((x) => x.id)).toEqual(['gravity']);
  });

  it('returns all lap-trigger<=lap entries, sorted ascending', () => {
    const a = pickAfflictionsForLap(5);
    expect(a.map((x) => x.id)).toEqual([
      'gravity',
      'echoing_void',
      'cold_constellation',
      'shattered_sky',
      'heat_death',
    ]);
  });

  it('at lap 15 returns the full ladder', () => {
    const a = pickAfflictionsForLap(15);
    expect(a.map((x) => x.id)).toEqual([
      'gravity',
      'echoing_void',
      'cold_constellation',
      'shattered_sky',
      'heat_death',
      'gravity_well_redux',
      'frozen_choir',
      'event_horizon',
      'void_tithe',
      'final_dark',
      'oblivion_pull',
      'singularity',
    ]);
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
  // 2026-05-19 Cosmic Lap rebalance — new compounding curve:
  //   lapMul(lap) = 2.5^lap * (1 + 0.08 * lap^2)  for lap > 0
  //   lapMul(0)   = 1                              (legacy preserved)
  const lapMul = (lap: number) => Math.pow(2.5, lap) * (1 + 0.08 * lap * lap);

  it('lap 0 reproduces the legacy formula (no scaling)', () => {
    const t0 = targetForBlind(1, 0, 0);
    const tLegacy = targetForBlind(1, 0); // default arg
    expect(t0).toBe(tLegacy);
  });

  it('lap 1 multiplies the base by ~2.70', () => {
    const base = targetForBlind(1, 0, 0);
    const lap1 = targetForBlind(1, 0, 1);
    expect(lap1).toBe(Math.ceil(base * lapMul(1)));
  });

  it('lap 3 follows the compounding curve (~26.88×)', () => {
    const base = targetForBlind(2, 1, 0);
    const lap3 = targetForBlind(2, 1, 3);
    expect(lap3).toBe(Math.ceil(base * lapMul(3)));
  });

  it('lap 5 is dramatically harder than the old 2.25^lap curve', () => {
    const base = targetForBlind(1, 0, 0);
    const lap5 = targetForBlind(1, 0, 5);
    // New curve: ~292.97x. Old curve was: 2.25^5 = 57.6x. Confirm the
    // new value exceeds the old by a wide margin (~5x harder at lap 5).
    expect(lap5).toBeGreaterThan(Math.ceil(base * 200));
  });
});
