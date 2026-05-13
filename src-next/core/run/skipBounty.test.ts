import { describe, it, expect } from 'vitest';
import { rollSkipBountyOptions } from './skipBounty';

describe('rollSkipBountyOptions (Pillar G)', () => {
  it('returns exactly 3 options', () => {
    const opts = rollSkipBountyOptions({
      rng: () => 0,
      baseShards: 3,
      ownedConsumables: [],
      ownedCatalysts: [],
    });
    expect(opts).toHaveLength(3);
  });

  it('first option is always a shards bounty', () => {
    const opts = rollSkipBountyOptions({
      rng: () => 0,
      baseShards: 3,
      ownedConsumables: [],
      ownedCatalysts: [],
    });
    expect(opts[0]?.kind).toBe('shards');
  });

  it('second option is a consumable when the pool has unowned entries', () => {
    const opts = rollSkipBountyOptions({
      rng: () => 0,
      baseShards: 3,
      ownedConsumables: [],
      ownedCatalysts: [],
    });
    expect(opts[1]?.kind).toBe('consumable');
  });

  it('third option is a catalyst when the pool has unowned commons', () => {
    const opts = rollSkipBountyOptions({
      rng: () => 0,
      baseShards: 3,
      ownedConsumables: [],
      ownedCatalysts: [],
    });
    expect(opts[2]?.kind).toBe('catalyst');
  });

  it('every option carries a label string', () => {
    const opts = rollSkipBountyOptions({
      rng: () => 0.42,
      baseShards: 3,
      ownedConsumables: [],
      ownedCatalysts: [],
    });
    for (const opt of opts) {
      expect(opt.label).toBeTruthy();
    }
  });

  it('determinism: same rng output produces same options', () => {
    const a = rollSkipBountyOptions({ rng: () => 0.3, baseShards: 3, ownedConsumables: [], ownedCatalysts: [] });
    const b = rollSkipBountyOptions({ rng: () => 0.3, baseShards: 3, ownedConsumables: [], ownedCatalysts: [] });
    expect(a).toEqual(b);
  });
});
