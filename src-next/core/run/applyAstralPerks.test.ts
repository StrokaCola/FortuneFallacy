import { describe, it, expect } from 'vitest';
import {
  applyAstralPerksToNewRun,
  rerollDiscount,
  startingCatalystSlotBonus,
  firstBlindExtraHands,
  shouldRevealNextBoss,
  hasAstralPerk,
} from './applyAstralPerks';
import { initialRunSlice } from '../../state/slices/run';
import { initialMetaSlice } from '../../state/slices/meta';
import type { GameState } from '../../state/store';

const stateWithPerks = (perks: string[]): GameState => ({
  run: initialRunSlice(),
  round: {} as GameState['round'],
  shop: {} as GameState['shop'],
  meta: { ...initialMetaSlice(), astralPerks: perks },
  ui: {} as GameState['ui'],
  pingCount: 0,
});

describe('applyAstralPerksToNewRun', () => {
  it('grants +2 starting shards from morning_star', () => {
    const r = applyAstralPerksToNewRun(initialRunSlice(), ['morning_star']);
    expect(r.shards).toBe(2);
  });

  it('stacks multiple perks (independently)', () => {
    // morning_star is the only mutating perk in the default catalog; the
    // rest read at compute time. So stacking morning_star + reroll perk
    // still gives +2 shards.
    const r = applyAstralPerksToNewRun(initialRunSlice(), ['morning_star', 'patient_eye']);
    expect(r.shards).toBe(2);
  });

  it('returns base run unchanged when no perks owned', () => {
    const base = initialRunSlice();
    const r = applyAstralPerksToNewRun(base, []);
    expect(r).toEqual(base);
  });

  it('reliquary grants a starting consumable when slots are free', () => {
    // Use a deterministic RNG so the picked consumable is reproducible.
    const r = applyAstralPerksToNewRun(initialRunSlice(), ['reliquary'], () => 0);
    expect(r.consumables.length).toBe(1);
  });
});

describe('read-side perk helpers', () => {
  it('rerollDiscount returns 1 for patient_eye', () => {
    expect(rerollDiscount(stateWithPerks(['patient_eye']))).toBe(1);
    expect(rerollDiscount(stateWithPerks([]))).toBe(0);
  });

  it('startingCatalystSlotBonus returns 1 for wider_orbit', () => {
    expect(startingCatalystSlotBonus(stateWithPerks(['wider_orbit']))).toBe(1);
    expect(startingCatalystSlotBonus(stateWithPerks([]))).toBe(0);
  });

  it('firstBlindExtraHands returns 1 for first_breath', () => {
    expect(firstBlindExtraHands(stateWithPerks(['first_breath']))).toBe(1);
  });

  it('shouldRevealNextBoss is true when astrolabe is owned', () => {
    expect(shouldRevealNextBoss(stateWithPerks(['astrolabe']))).toBe(true);
    expect(shouldRevealNextBoss(stateWithPerks([]))).toBe(false);
  });

  it('hasAstralPerk handles missing astralPerks defensively', () => {
    const s = stateWithPerks([]);
    // Simulate older save without the field at all.
    const legacy = { ...s, meta: { ...s.meta, astralPerks: undefined as unknown as string[] } };
    expect(hasAstralPerk(legacy, 'morning_star')).toBe(false);
  });
});
