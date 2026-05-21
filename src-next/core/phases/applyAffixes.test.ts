import { describe, it, expect } from 'vitest';
import { applyAffixes } from './applyAffixes';
import { mulberry32 } from '../rng';
import { generateAffixedItem } from '../../voidmode/affixGenerator';
import { BLIND_AFFIX_DEFS } from '../../voidmode/blindAffixes';
import type { CatalystMeta } from '../../data/catalysts';
import type { BlindDef } from '../../data/blinds';
import type { AffixContext } from '../../voidmode/types';

const BASE: CatalystMeta = {
  id: 'burst_card', name: 'Burst Card', rarity: 'uncommon',
  archetypeTags: ['combo', 'scaling'],
} as unknown as CatalystMeta;

function makeCtx(overrides: Partial<AffixContext> = {}): AffixContext {
  return {
    chipsBonus: 0,
    multBonus: 0,
    goldBonus: 0,
    hand: { comboId: 'pair', diceValues: [3, 3, 1, 2, 4], isWild: [false, false, false, false, false] },
    run: { discardsRemaining: 3, handsRemaining: 4, catalystsOwned: 2, goldHeld: 12, seedDigit: 7 },
    trial: { rollsThisTrial: 1, isBossBlind: false },
    scratch: {},
    ...overrides,
  };
}

describe('applyAffixes', () => {
  it('is a no-op when no affixed items are present', () => {
    const ctx = makeCtx();
    applyAffixes(ctx, []);
    expect(ctx.chipsBonus).toBe(0);
    expect(ctx.multBonus).toBe(0);
    expect(ctx.goldBonus).toBe(0);
  });

  it('runs each affix effect on the context', () => {
    const item = generateAffixedItem(mulberry32(42), BASE);
    const ctx = makeCtx({ hand: { comboId: 'pair', diceValues: [3,3,1,2,4], isWild: [false,false,false,false,false] }});
    applyAffixes(ctx, [item]);
    // The generated item should have at least one affix attached given
    // archetypeTags: ['combo','scaling']. We don't pin a specific delta —
    // some affixes only fire on specific comboIds — but applying multiple
    // seeded items shouldn't leave the context entirely untouched across
    // multiple seeds. See the "across seeds" test below.
    expect(item.affixes.length).toBeGreaterThan(0);
  });

  it('produces non-zero context deltas for at least some seeds', () => {
    let anyChanged = false;
    for (let s = 0; s < 30; s++) {
      const item = generateAffixedItem(mulberry32(s), BASE);
      const ctx = makeCtx();
      applyAffixes(ctx, [item]);
      if (ctx.chipsBonus !== 0 || ctx.multBonus !== 0 || ctx.goldBonus !== 0) {
        anyChanged = true;
        break;
      }
    }
    expect(anyChanged).toBe(true);
  });

  it('does not throw for any affix family on a pair combo', () => {
    for (let s = 0; s < 30; s++) {
      const item = generateAffixedItem(mulberry32(s), BASE);
      const ctx = makeCtx();
      expect(() => applyAffixes(ctx, [item])).not.toThrow();
    }
  });

  it('applies a blind affix alongside catalyst affixes', () => {
    // Blind affix is the same shape (AffixedItem), so applyAffixes
    // iterates it identically. We confirm a blind-pool roll produces
    // non-zero deltas across some seeds — parallel to the catalyst case.
    const FAKE_BLIND: BlindDef & { id: string } = {
      id: 'lesser_trial',
      index: 0,
      name: 'Lesser Trial',
      targetMult: 1.0,
      isBoss: false,
      skipReward: 3,
      archetypeTags: ['timing', 'combo'],
    };
    let anyChanged = false;
    for (let s = 0; s < 30; s++) {
      const item = generateAffixedItem(mulberry32(s), FAKE_BLIND, { pool: BLIND_AFFIX_DEFS });
      const ctx = makeCtx({
        hand: { comboId: 'three_kind', diceValues: [3, 3, 3, 2, 4], isWild: [false, false, false, false, false] },
      });
      applyAffixes(ctx, [item]);
      if (ctx.chipsBonus !== 0 || ctx.multBonus !== 0 || ctx.goldBonus !== 0) {
        anyChanged = true;
        break;
      }
    }
    expect(anyChanged).toBe(true);
  });
});
