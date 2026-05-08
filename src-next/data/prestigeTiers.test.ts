import { describe, it, expect } from 'vitest';
import { currentPrestigeTier, nextPrestigeTier, PRESTIGE_TIERS } from './prestigeTiers';

describe('PRESTIGE_TIERS table', () => {
  it('starts at Wanderer with threshold 0', () => {
    expect(PRESTIGE_TIERS[0]?.id).toBe('wanderer');
    expect(PRESTIGE_TIERS[0]?.threshold).toBe(0);
  });

  it('thresholds are strictly increasing', () => {
    for (let i = 1; i < PRESTIGE_TIERS.length; i++) {
      expect(PRESTIGE_TIERS[i]!.threshold).toBeGreaterThan(PRESTIGE_TIERS[i - 1]!.threshold);
    }
  });

  it('all ids are unique', () => {
    const ids = new Set(PRESTIGE_TIERS.map((t) => t.id));
    expect(ids.size).toBe(PRESTIGE_TIERS.length);
  });
});

describe('currentPrestigeTier', () => {
  it('returns Wanderer at 0 dust', () => {
    expect(currentPrestigeTier(0).id).toBe('wanderer');
  });

  it('returns Spark just above the threshold', () => {
    expect(currentPrestigeTier(500).id).toBe('spark');
    expect(currentPrestigeTier(1999).id).toBe('spark');
  });

  it('returns Singularity at extreme totals', () => {
    expect(currentPrestigeTier(10_000_000).id).toBe('singularity');
  });

  it('never returns null — always at least Wanderer', () => {
    expect(currentPrestigeTier(-1).id).toBe('wanderer');
  });
});

describe('nextPrestigeTier', () => {
  it('returns the next tier and the dust gap', () => {
    const next = nextPrestigeTier(0);
    expect(next?.tier.id).toBe('spark');
    expect(next?.gap).toBe(500);
  });

  it('returns null at the top tier', () => {
    expect(nextPrestigeTier(10_000_000)).toBe(null);
  });

  it('reports the correct gap mid-tier', () => {
    const next = nextPrestigeTier(1500);
    expect(next?.tier.id).toBe('kindling');
    expect(next?.gap).toBe(500);
  });
});
