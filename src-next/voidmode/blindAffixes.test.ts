import { describe, it, expect } from 'vitest';
import { BLIND_AFFIX_DEFS, BLIND_AFFIX_BY_ID } from './blindAffixes';
import { mulberry32 } from '../core/rng';
import { generateAffixedItem } from './affixGenerator';
import { AFFIX_DEFS } from './affixes';
import type { AffixContext } from './types';
import type { BlindDef } from '../data/blinds';

describe('BLIND_AFFIX_DEFS', () => {
  it('exposes 6 entries, one per family', () => {
    expect(BLIND_AFFIX_DEFS.length).toBe(6);
    const families = new Set(BLIND_AFFIX_DEFS.map((a) => a.family));
    expect(families.has('scalar')).toBe(true);
    expect(families.has('conditional')).toBe(true);
    expect(families.has('persistent')).toBe(true);
    expect(families.has('drawback')).toBe(true);
    expect(families.has('synergy')).toBe(true);
    expect(families.has('reality-warp')).toBe(true);
    expect(families.size).toBe(6);
  });

  it('every entry has a unique id, slot, and weight', () => {
    const ids = new Set<string>();
    for (const a of BLIND_AFFIX_DEFS) {
      expect(a.id.length).toBeGreaterThan(0);
      expect(ids.has(a.id)).toBe(false);
      ids.add(a.id);
      expect(['prefix', 'suffix', 'mid']).toContain(a.slot);
      expect(a.weight).toBeGreaterThan(0);
    }
  });

  it('lookup map round-trips every entry', () => {
    for (const a of BLIND_AFFIX_DEFS) {
      expect(BLIND_AFFIX_BY_ID.get(a.id)).toBe(a);
    }
  });

  it('every effect runs safely across canonical combo ids', () => {
    const COMBO_IDS = [
      'five_kind', 'four_kind', 'lg_straight', 'full_house', 'sm_straight',
      'three_kind', 'two_pair', 'one_pair', 'chance',
    ];
    for (const a of BLIND_AFFIX_DEFS) {
      for (const combo of COMBO_IDS) {
        const ctx: AffixContext = {
          chipsBonus: 0, multBonus: 0, goldBonus: 0,
          hand: { comboId: combo, diceValues: [1, 2, 3, 4, 5], isWild: [false, false, false, false, false] },
          run: { discardsRemaining: 2, handsRemaining: 3, catalystsOwned: 2, goldHeld: 13, seedDigit: 7 },
          trial: { rollsThisTrial: 3, isBossBlind: true },
          scratch: {},
        };
        expect(() => a.effect(ctx)).not.toThrow();
      }
    }
  });
});

describe('generateAffixedItem with custom pool', () => {
  const FAKE_BLIND: BlindDef & { id: string } = {
    id: 'lesser_trial',
    index: 0,
    name: 'Lesser Trial',
    targetMult: 1.0,
    isBoss: false,
    skipReward: 3,
    archetypeTags: ['timing', 'combo'],
  };

  it('returns affixes drawn only from the blind pool', () => {
    const blindIds = new Set(BLIND_AFFIX_DEFS.map((a) => a.id));
    const catalystIds = new Set(AFFIX_DEFS.map((a) => a.id));
    // Verify the pools are actually disjoint enough to be a real test.
    // Some ids overlap by string ('of-echoes' exists in both pools), so
    // we look up the actual AffixDef references via the BLIND_AFFIX_BY_ID
    // map: a roll from the blind pool must yield references that are
    // === entries of BLIND_AFFIX_DEFS, not the catalyst-side defs.
    const blindDefRefs = new Set<unknown>(BLIND_AFFIX_DEFS);
    let foundAny = false;
    for (let seed = 0; seed < 50; seed++) {
      const item = generateAffixedItem(mulberry32(seed), FAKE_BLIND, { pool: BLIND_AFFIX_DEFS });
      for (const a of item.affixes) {
        expect(blindIds.has(a.id)).toBe(true);
        expect(blindDefRefs.has(a)).toBe(true);
        foundAny = true;
      }
      // Defensive: even if id strings overlap between pools, the def
      // references must originate from the blind pool, never the catalyst.
      const catalystRefs = new Set<unknown>(AFFIX_DEFS);
      for (const a of item.affixes) {
        // 'of-echoes' on the blind side is a separate object literal
        // from the catalyst-side 'of-echoes' (also present in AFFIX_DEFS),
        // so `catalystRefs.has(a)` must be false for a blind-pool roll.
        expect(catalystRefs.has(a) && !blindDefRefs.has(a)).toBe(false);
      }
    }
    expect(foundAny).toBe(true);
    expect(catalystIds.size).toBeGreaterThan(0); // sanity
  });

  it('falls back to AFFIX_DEFS when no pool is provided (catalyst-path back-compat)', () => {
    const catalystRefs = new Set<unknown>(AFFIX_DEFS);
    for (let seed = 0; seed < 30; seed++) {
      const item = generateAffixedItem(mulberry32(seed), {
        id: 'fake', name: 'Fake', rarity: 'uncommon', archetypeTags: ['combo'],
      } as unknown as BlindDef & { id: string });
      for (const a of item.affixes) {
        expect(catalystRefs.has(a)).toBe(true);
      }
    }
  });

  it('is deterministic for a given seed when the blind pool is used', () => {
    const a = generateAffixedItem(mulberry32(123), FAKE_BLIND, { pool: BLIND_AFFIX_DEFS });
    const b = generateAffixedItem(mulberry32(123), FAKE_BLIND, { pool: BLIND_AFFIX_DEFS });
    expect(a.displayName).toBe(b.displayName);
    expect(a.affixes.map((x) => x.id)).toEqual(b.affixes.map((x) => x.id));
  });
});
