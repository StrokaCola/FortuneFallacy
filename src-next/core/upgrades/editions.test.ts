import { describe, it, expect } from 'vitest';
import { rollCatalystEdition, editionBonus, editionLabel, editionColor, editionTakesSlot } from './editions';

describe('rollCatalystEdition', () => {
  it('returns undefined when rng lands above all weights (90%+)', () => {
    expect(rollCatalystEdition(() => 0.99)).toBeUndefined();
  });

  it('returns foil at the lowest band', () => {
    expect(rollCatalystEdition(() => 0.0)).toBe('foil');
    expect(rollCatalystEdition(() => 0.04)).toBe('foil');
  });

  it('returns holo in the middle band', () => {
    expect(rollCatalystEdition(() => 0.06)).toBe('holo');
    expect(rollCatalystEdition(() => 0.07)).toBe('holo');
  });

  it('returns poly in the top band', () => {
    expect(rollCatalystEdition(() => 0.085)).toBe('poly');
    expect(rollCatalystEdition(() => 0.099)).toBe('poly');
  });
});

describe('editionBonus', () => {
  it('foil grants +50 chips, no mult', () => {
    expect(editionBonus('foil', 0, 0)).toEqual({ bonusChips: 50, bonusMult: 0 });
    expect(editionBonus('foil', 100, 5)).toEqual({ bonusChips: 50, bonusMult: 0 });
  });

  it('holo grants +10 mult, no chips', () => {
    expect(editionBonus('holo', 0, 0)).toEqual({ bonusChips: 0, bonusMult: 10 });
  });

  it('poly grants +50% of the catalyst contribution', () => {
    expect(editionBonus('poly', 100, 4)).toEqual({ bonusChips: 50, bonusMult: 2 });
    expect(editionBonus('poly', 0, 0)).toEqual({ bonusChips: 0, bonusMult: 0 });
  });

  it('void grants no per-fire bonus — its value is freeing the slot', () => {
    expect(editionBonus('void', 0, 0)).toEqual({ bonusChips: 0, bonusMult: 0 });
    expect(editionBonus('void', 999, 99)).toEqual({ bonusChips: 0, bonusMult: 0 });
  });
});

describe('rollCatalystEdition (void)', () => {
  it('returns void in the ultra-rare band just above poly', () => {
    // poly band ends at 0.10; void band ends at 0.103
    expect(rollCatalystEdition(() => 0.101)).toBe('void');
    expect(rollCatalystEdition(() => 0.1029)).toBe('void');
  });

  it('returns undefined just past the void band', () => {
    expect(rollCatalystEdition(() => 0.104)).toBeUndefined();
  });
});

describe('editionLabel + editionColor', () => {
  it('handles void', () => {
    expect(editionLabel('void')).toBe('Void');
    expect(editionColor('void')).toBe('#aa66ff');
  });
});

describe('editionTakesSlot', () => {
  it('void edition occupies zero slots', () => {
    expect(editionTakesSlot('void')).toBe(false);
  });

  it('all other editions take a slot', () => {
    expect(editionTakesSlot('foil')).toBe(true);
    expect(editionTakesSlot('holo')).toBe(true);
    expect(editionTakesSlot('poly')).toBe(true);
  });

  it('plain catalyst (no edition) takes a slot', () => {
    expect(editionTakesSlot(undefined)).toBe(true);
  });
});

describe('editionLabel + editionColor', () => {
  it('returns a label for each edition', () => {
    expect(editionLabel('foil')).toBe('Foil');
    expect(editionLabel('holo')).toBe('Holographic');
    expect(editionLabel('poly')).toBe('Polychrome');
  });

  it('returns a hex color for each edition', () => {
    expect(editionColor('foil')).toMatch(/^#/);
    expect(editionColor('holo')).toMatch(/^#/);
    expect(editionColor('poly')).toMatch(/^#/);
  });
});
