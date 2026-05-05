import { describe, it, expect } from 'vitest';
import { CONSTELLATIONS, lookupConstellation, DEFAULT_CONSTELLATION_ID } from './constellations';
import { applyConstellation } from '../core/run/applyConstellation';
import { initialRunSlice } from '../state/slices/run';
import { initialRoundSlice } from '../state/slices/round';
import { initialShopSlice } from '../state/slices/shop';
import { initialMetaSlice } from '../state/slices/meta';
import { initialUiSlice } from '../state/slices/ui';
import { maxCatalystSlots } from '../core/vouchers';
import type { GameState } from '../state/store';

function stateWith(constellationId: string): GameState {
  return {
    run: applyConstellation(initialRunSlice(), lookupConstellation(constellationId)),
    round: initialRoundSlice(),
    shop: initialShopSlice(),
    meta: initialMetaSlice(),
    ui: initialUiSlice(),
    pingCount: 0,
  } as unknown as GameState;
}

describe('constellation registry', () => {
  it('exposes a non-empty list', () => {
    expect(CONSTELLATIONS.length).toBeGreaterThan(0);
  });

  it('every entry has unique id', () => {
    const ids = CONSTELLATIONS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('default id resolves', () => {
    const c = lookupConstellation(DEFAULT_CONSTELLATION_ID);
    expect(c.id).toBe(DEFAULT_CONSTELLATION_ID);
  });

  it('unknown id falls back to first entry', () => {
    expect(lookupConstellation('not_real').id).toBe(CONSTELLATIONS[0]!.id);
    expect(lookupConstellation(undefined).id).toBe(CONSTELLATIONS[0]!.id);
  });

  it('every entry has a non-empty dice spec', () => {
    for (const c of CONSTELLATIONS) {
      expect(c.dice.length).toBeGreaterThan(0);
      for (const d of c.dice) {
        expect(d.faces.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('applyConstellation', () => {
  it('seeds diceMods to match dice count for each constellation', () => {
    for (const c of CONSTELLATIONS) {
      const run = applyConstellation(initialRunSlice(), c);
      expect(run.constellationId).toBe(c.id);
      expect(run.diceMods.length).toBe(c.dice.length);
      for (const slots of run.diceMods) expect(slots).toEqual([]);
    }
  });

  it('Argo collapses to a single die', () => {
    const argo = lookupConstellation('argo');
    const run = applyConstellation(initialRunSlice(), argo);
    expect(run.diceMods.length).toBe(1);
  });

  it('Mensa expands to 7 dice', () => {
    const mensa = lookupConstellation('mensa');
    const run = applyConstellation(initialRunSlice(), mensa);
    expect(run.diceMods.length).toBe(7);
  });

  it('Triumvirate exposes 12-face dice', () => {
    const tri = lookupConstellation('triumvirate');
    expect(tri.dice.every((d) => d.faces.length === 12)).toBe(true);
  });

  it('Polyhedra is genuinely heterogeneous', () => {
    const poly = lookupConstellation('polyhedra');
    const sizes = poly.dice.map((d) => d.faces.length);
    expect(sizes.sort((a, b) => a - b)).toEqual([4, 6, 8, 10, 12]);
  });

  it('Argo declares face_x_catalysts scoring', () => {
    expect(lookupConstellation('argo').modifiers?.scoringMode).toBe('face_x_catalysts');
  });

  it('Ophiuchus declares wildcard faces', () => {
    const o = lookupConstellation('ophiuchus');
    expect(o.dice.every((d) => d.faces.includes('WILD'))).toBe(true);
  });

  it('Eclipse only uses 0 and 1 face values', () => {
    const e = lookupConstellation('eclipse');
    for (const d of e.dice) {
      for (const f of d.faces) expect(f === 0 || f === 1).toBe(true);
    }
  });

  it('Fibonacci uses [1,1,2,3,5,8] faces', () => {
    const f = lookupConstellation('fibonacci');
    for (const d of f.dice) expect(d.faces).toEqual([1, 1, 2, 3, 5, 8]);
  });
});

describe('constellation modifier wiring', () => {
  it("Argo's catalystSlotBonus reaches maxCatalystSlots()", () => {
    const lyra = stateWith('lyra');
    const argo = stateWith('argo');
    expect(maxCatalystSlots(argo) - maxCatalystSlots(lyra)).toBe(2);
  });

  it('non-Argo constellations leave the slot cap at the legacy default', () => {
    for (const c of CONSTELLATIONS) {
      if (c.id === 'argo') continue;
      const s = stateWith(c.id);
      expect(maxCatalystSlots(s)).toBe(6);
    }
  });
});
