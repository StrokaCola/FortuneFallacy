import { describe, it, expect } from 'vitest';
import { applyDieModStep } from './applyDieModStep';

function step(
  modIds: string[],
  overrides: {
    pos?: number;
    totalScoring?: number;
    scoringFaces?: number[];
    modsOnThisDie?: number;
    comboLevelOnPlayed?: number;
  } = {},
) {
  return applyDieModStep(
    {
      face: 6,
      dieIdx: 0,
      pos: overrides.pos ?? 0,
      totalScoring: overrides.totalScoring ?? 1,
      scoringFaces: overrides.scoringFaces ?? [6],
      titheBudget: 0,
      modsOnThisDie: overrides.modsOnThisDie,
      comboLevelOnPlayed: overrides.comboLevelOnPlayed,
    },
    modIds,
  );
}

describe('Polarize mod (×1.4 mult at 3+ mods on die)', () => {
  it('fires when modsOnThisDie >= 3', () => {
    const r = step(['polarize'], { modsOnThisDie: 3 });
    expect(r.dMultMul).toBe(1.4);
  });
  it('does not fire at 2 mods', () => {
    const r = step(['polarize'], { modsOnThisDie: 2 });
    expect(r.dMultMul).toBe(1);
  });
});

describe('Telescope mod (first scoring die of leveled combo: ×1.3)', () => {
  it('fires when pos=0 AND combo has galaxy levels', () => {
    const r = step(['telescope'], { pos: 0, comboLevelOnPlayed: 2 });
    expect(r.dMultMul).toBe(1.3);
  });
  it('does not fire when combo has no galaxy levels', () => {
    const r = step(['telescope'], { pos: 0, comboLevelOnPlayed: 0 });
    expect(r.dMultMul).toBe(1);
  });
  it('does not fire at pos > 0', () => {
    const r = step(['telescope'], { pos: 2, comboLevelOnPlayed: 5, totalScoring: 5 });
    expect(r.dMultMul).toBe(1);
  });
});

describe('Engraved mod (utility — no scoring contribution)', () => {
  it('contributes no chips/mult', () => {
    const r = step(['engraved']);
    expect(r.dChips).toBe(0);
    expect(r.dMult).toBe(0);
    expect(r.dMultMul).toBe(1);
  });
});
