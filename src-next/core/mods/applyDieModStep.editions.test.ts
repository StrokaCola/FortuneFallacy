import { describe, it, expect } from 'vitest';
import { applyDieModStep } from './applyDieModStep';
import type { ModEdition } from '../../state/slices/run';

function step(modIds: string[], editions: (ModEdition | null)[]) {
  return applyDieModStep(
    {
      face: 6,
      dieIdx: 0,
      pos: 0,
      totalScoring: 1,
      scoringFaces: [6],
      titheBudget: 0,
    },
    modIds,
    editions,
  );
}

describe('Mod editions — applyDieModStep integration', () => {
  it('foil amplify: +2 base chips + 20 foil = +22', () => {
    // amplify has scoreBonus: 2.
    const r = step(['amplify'], ['foil']);
    expect(r.dChips).toBe(22);
    expect(r.dMult).toBe(0);
  });

  it('holo sharpened: +1 base mult + 4 holo = +5', () => {
    // sharpened has multBonus: 1.
    const r = step(['sharpened'], ['holo']);
    expect(r.dMult).toBe(5);
    expect(r.dChips).toBe(0);
  });

  it('poly amplify: +2 base chips × 1.25 = +2.5', () => {
    // Poly adds 25% of mod's own contribution.
    const r = step(['amplify'], ['poly']);
    expect(r.dChips).toBe(2.5);
  });

  it('plain (null edition) leaves base contribution untouched', () => {
    const r = step(['amplify'], [null]);
    expect(r.dChips).toBe(2);
  });

  it('edition does not fire when mod contributed nothing this step', () => {
    // snake_eyes only fires on face 1; we're on face 6 → mod contributes 0.
    // The edition (foil) should NOT add +20 chips because the mod didn't fire.
    const r = step(['snake_eyes'], ['foil']);
    expect(r.dChips).toBe(0);
    expect(r.dMult).toBe(0);
  });

  it('two mods on same die — each carries its own edition', () => {
    // amplify+sharpened, both foil → +2 +20 (foil) +0 +20 (foil) = 42 chips
    // (sharpened has scoreBonus 0; both mods get foil's flat +20).
    const r = step(['amplify', 'sharpened'], ['foil', 'foil']);
    // amplify: 2 (base) + 20 (foil flat) = 22 chips
    // sharpened: 1 mult base + 0 chip → fires due to multBonus → +20 foil chips
    expect(r.dChips).toBe(42);
    expect(r.dMult).toBe(1); // sharpened's +1 mult
  });
});
