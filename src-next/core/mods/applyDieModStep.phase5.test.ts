import { describe, it, expect } from 'vitest';
import { applyDieModStep } from './applyDieModStep';

// Minimal step-ctx factory for the new mod fields. Existing mod tests
// cover the core path; this file targets only the Phase 5b additions.
function step(
  modIds: string[],
  overrides: {
    face?: number;
    pos?: number;
    totalScoring?: number;
    scoringFaces?: number[];
    titheBudget?: number;
    comboId?: string;
    ante?: number;
    handsLeft?: number;
    comboLevelOnPlayed?: number;
  } = {},
) {
  return applyDieModStep(
    {
      face: overrides.face ?? 6,
      dieIdx: 0,
      pos: overrides.pos ?? 0,
      totalScoring: overrides.totalScoring ?? 5,
      scoringFaces: overrides.scoringFaces ?? [6, 6, 6, 6, 6],
      titheBudget: overrides.titheBudget ?? 0,
      comboId: overrides.comboId,
      ante: overrides.ante,
      handsLeft: overrides.handsLeft,
      comboLevelOnPlayed: overrides.comboLevelOnPlayed,
    },
    modIds,
  );
}

describe('Anchor mod (paired-face chips)', () => {
  it('fires +15 chips when face appears 2+ times in scoringFaces', () => {
    const r = step(['anchor'], { face: 4, scoringFaces: [4, 4, 1, 2, 3] });
    expect(r.dChips).toBe(15);
  });
  it('no-op when face is unique in scoringFaces', () => {
    const r = step(['anchor'], { face: 4, scoringFaces: [4, 1, 2, 3, 5] });
    expect(r.dChips).toBe(0);
  });
});

describe('Keystone mod (highest-face mult)', () => {
  it('×1.4 mult when face is the strict max', () => {
    const r = step(['keystone'], { face: 6, scoringFaces: [6, 5, 4, 3, 2] });
    expect(r.dMultMul).toBe(1.4);
  });
  it('does not fire when there is a tie for max', () => {
    const r = step(['keystone'], { face: 6, scoringFaces: [6, 6, 4, 3, 2] });
    expect(r.dMultMul).toBe(1);
  });
  it('does not fire when this die is not the max', () => {
    const r = step(['keystone'], { face: 4, scoringFaces: [6, 5, 4, 3, 2] });
    expect(r.dMultMul).toBe(1);
  });
});

describe('Astrolabe mod (chips per combo level)', () => {
  it('+3 chips per level on the played combo', () => {
    const r = step(['astrolabe'], { comboLevelOnPlayed: 4 });
    expect(r.dChips).toBe(12);
  });
  it('no-op at level 0', () => {
    const r = step(['astrolabe'], { comboLevelOnPlayed: 0 });
    expect(r.dChips).toBe(0);
  });
});

describe('Pressure mod (chips per remaining hand)', () => {
  it('+5 chips per hand left', () => {
    const r = step(['pressure'], { handsLeft: 3 });
    expect(r.dChips).toBe(15);
  });
  it('no-op at 0 hands left', () => {
    const r = step(['pressure'], { handsLeft: 0 });
    expect(r.dChips).toBe(0);
  });
});

describe('Risk mod (face-conditional bonus + penalty)', () => {
  it('+6 mult on face 6', () => {
    const r = step(['risk'], { face: 6 });
    expect(r.dMult).toBe(6);
  });
  it('-3 mult on face 1', () => {
    const r = step(['risk'], { face: 1 });
    expect(r.dMult).toBe(-3);
  });
  it('no-op on faces 2-5', () => {
    expect(step(['risk'], { face: 3 }).dMult).toBe(0);
  });
});

describe('Singularity mod (ante-gated mult)', () => {
  it('×2 mult at Ante 4', () => {
    const r = step(['singularity'], { ante: 4 });
    expect(r.dMultMul).toBe(2);
  });
  it('no-op at Ante 3', () => {
    const r = step(['singularity'], { ante: 3 });
    expect(r.dMultMul).toBe(1);
  });
});

describe('Refinery mod (combo-conditional shards)', () => {
  // Refinery's shard accrual is handled in roll.ts (not applyDieModStep);
  // this test documents that fact — applyDieModStep returns no chips/mult.
  it('contributes no chips/mult on its own', () => {
    const r = step(['refinery'], { comboId: 'two_pair' });
    expect(r.dChips).toBe(0);
    expect(r.dMult).toBe(0);
  });
});
