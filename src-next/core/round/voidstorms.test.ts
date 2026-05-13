import { describe, it, expect } from 'vitest';
import {
  VOIDSTORMS,
  pickVoidstorm,
  lookupVoidstorm,
  getVoidstormForBlind,
} from './voidstorms';

describe('voidstorm pool (Pillar A)', () => {
  it('contains at least 18 entries', () => {
    expect(VOIDSTORMS.length).toBeGreaterThanOrEqual(18);
  });

  it('every entry carries a preview line', () => {
    for (const v of VOIDSTORMS) {
      expect(v.preview, `${v.id} missing preview`).toBeTruthy();
    }
  });

  it('all IDs are unique', () => {
    const ids = VOIDSTORMS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('legacy IDs are still present (back-compat)', () => {
    for (const legacy of ['stellar_wind', 'comet_tail', 'twin_suns', 'solar_flare', 'eclipse', 'cold_spell']) {
      expect(VOIDSTORMS.find((v) => v.id === legacy), `${legacy} dropped`).toBeTruthy();
    }
  });
});

describe('pickVoidstorm', () => {
  it('always returns null on boss blinds', () => {
    const r = pickVoidstorm(() => 0.01, true);
    expect(r).toBeNull();
  });

  it('returns null on the ~75% no-storm gate', () => {
    // First rng() call is the gate; >= 0.25 means no storm.
    const r = pickVoidstorm(() => 0.5, false);
    expect(r).toBeNull();
  });

  it('returns a valid id when the gate passes', () => {
    let n = 0;
    const rng = () => {
      n++;
      return n === 1 ? 0.0 : 0.0;
    };
    const r = pickVoidstorm(rng, false);
    expect(r).toBeTruthy();
    expect(VOIDSTORMS.find((v) => v.id === r)).toBeTruthy();
  });
});

describe('getVoidstormForBlind (deterministic)', () => {
  it('returns the same id for the same (seed, goalIdx)', () => {
    const a = getVoidstormForBlind(12345, 4, false);
    const b = getVoidstormForBlind(12345, 4, false);
    expect(a).toBe(b);
  });

  it('returns null for boss blinds regardless of seed', () => {
    expect(getVoidstormForBlind(12345, 4, true)).toBeNull();
    expect(getVoidstormForBlind(99999, 7, true)).toBeNull();
  });

  it('different goalIdx values produce a varied distribution (not all the same)', () => {
    const ids = new Set<string | null>();
    for (let i = 0; i < 40; i++) {
      ids.add(getVoidstormForBlind(7777, i, false));
    }
    // At least 2 unique outcomes (including possible nulls). With 25%
    // hit-rate over 40 trials we expect ~10 storms across ~12+ distinct
    // ids; a tight floor of 2 catches a deterministic regression
    // (where all calls suddenly return the same value).
    expect(ids.size).toBeGreaterThan(2);
  });
});

describe('onBlindStart hooks (Pillar A)', () => {
  it('Nebula Drift grants +1 reroll', () => {
    const def = lookupVoidstorm('nebula_drift');
    expect(def?.onBlindStart?.({} as any).rerollsDelta).toBe(1);
  });

  it('Dust Storm trades a hand for two rerolls', () => {
    const def = lookupVoidstorm('dust_storm');
    const r = def?.onBlindStart?.({} as any);
    expect(r?.handsDelta).toBe(-1);
    expect(r?.rerollsDelta).toBe(2);
  });

  it('Singularity takes 2 shards at start', () => {
    const def = lookupVoidstorm('singularity');
    expect(def?.onBlindStart?.({} as any).shardsDelta).toBe(-2);
  });

  it('Mirror Sky grants +1 hand', () => {
    const def = lookupVoidstorm('mirror_sky');
    expect(def?.onBlindStart?.({} as any).handsDelta).toBe(1);
  });
});
