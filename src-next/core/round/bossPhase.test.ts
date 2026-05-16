import { describe, it, expect } from 'vitest';
import { evaluateBossPhase } from './bossPhase';

const base = {
  isBoss: true,
  blindId: 'pluto',
  bossPhase: 1 as const,
  // pyre = the first stake where phase 2 engages. Spark/Ember tests
  // explicitly use those ids to verify the stake gate.
  stakeId: 'pyre',
  newScore: 0,
  newHandsLeft: 2,
  handsMax: 3,
  target: 1000,
  pendingRoundEnd: null,
};

describe('evaluateBossPhase', () => {
  it('does not promote on non-boss blinds', () => {
    const r = evaluateBossPhase({ ...base, isBoss: false, blindId: 'lesser_trial' });
    expect(r.promote).toBe(false);
  });

  it('does not promote when already at phase 2', () => {
    const r = evaluateBossPhase({ ...base, bossPhase: 2 });
    expect(r.promote).toBe(false);
  });

  it('does not promote if the blind is ending (clear)', () => {
    // Pluto trigger is hand-2, which IS true here, but clear takes priority.
    const r = evaluateBossPhase({ ...base, newHandsLeft: 2, pendingRoundEnd: 'clear' });
    expect(r.promote).toBe(false);
  });

  it('does not promote if the blind is ending (bust)', () => {
    const r = evaluateBossPhase({ ...base, pendingRoundEnd: 'bust' });
    expect(r.promote).toBe(false);
  });

  it('promotes Pluto on hand-2 trigger when score has crossed 1/3 of target', () => {
    // handsMax 3, newHandsLeft 2 means hand 1 was just played; score is
    // past the 1/3 gate. Phase 2 should fire.
    const r = evaluateBossPhase({ ...base, blindId: 'pluto', newHandsLeft: 2, newScore: 400, target: 1000 });
    expect(r.promote).toBe(true);
    if (r.promote) {
      expect(r.secondWind.trigger).toBe('hand-2');
      // 2026-05-16 — Pluto phase-2 now ships with only_even_faces
      // (structural twist replacing the earlier hand_size_cap_4
      // softer escalation).
      expect(r.secondWind.debuffs).toContain('only_even_faces');
    }
  });

  it('does NOT promote Pluto on hand-2 trigger when score is below 1/3', () => {
    // Player flunked the first hand — boss does NOT pile on. This is the
    // critical Spark-stake fix: phase-2 should be a climax, not a kicker
    // when the player is already losing.
    const r = evaluateBossPhase({ ...base, blindId: 'pluto', newHandsLeft: 2, newScore: 100, target: 1000 });
    expect(r.promote).toBe(false);
  });

  it('promotes Pluto on later hands too if 1/3-target gate is finally met', () => {
    // newHandsLeft 1, still NOT the literal last hand exclusion (the trigger
    // accepts any hand-spent state where score now qualifies).
    const r = evaluateBossPhase({ ...base, blindId: 'pluto', newHandsLeft: 1, newScore: 400, target: 1000 });
    expect(r.promote).toBe(true);
  });

  it('does not promote Pluto when no hands have been spent (sanity gate)', () => {
    const r = evaluateBossPhase({ ...base, blindId: 'pluto', newHandsLeft: 3, handsMax: 3, newScore: 400, target: 1000 });
    expect(r.promote).toBe(false);
  });

  it('promotes Ceres on half-target crossing', () => {
    const r = evaluateBossPhase({ ...base, blindId: 'ceres', newScore: 500, target: 1000 });
    expect(r.promote).toBe(true);
    if (r.promote) {
      expect(r.secondWind.debuffs).toContain('consumables_locked');
    }
  });

  it('does not promote Ceres when score < half-target', () => {
    const r = evaluateBossPhase({ ...base, blindId: 'ceres', newScore: 499, target: 1000 });
    expect(r.promote).toBe(false);
  });

  it('does not promote on half-target when the blind cleared (pendingRoundEnd guard)', () => {
    const r = evaluateBossPhase({
      ...base, blindId: 'ceres', newScore: 1000, target: 1000, pendingRoundEnd: 'clear',
    });
    expect(r.promote).toBe(false);
  });

  it('promotes Sedna on last-hand (newHandsLeft === 1)', () => {
    const r = evaluateBossPhase({ ...base, blindId: 'sedna', newHandsLeft: 1 });
    expect(r.promote).toBe(true);
    if (r.promote) {
      expect(r.secondWind.trigger).toBe('last-hand');
    }
  });

  it('Callisto promotes to RELAX — removeDebuffs lifts the silence', () => {
    // Callisto's secondWind has debuffs:[] and removeDebuffs:['disable_catalysts'].
    const r = evaluateBossPhase({ ...base, blindId: 'callisto', newScore: 500, target: 1000 });
    expect(r.promote).toBe(true);
    if (r.promote) {
      expect(r.secondWind.debuffs).toEqual([]);
      expect(r.secondWind.removeDebuffs).toContain('disable_catalysts');
    }
  });

  it('returns no promotion for an unknown blindId', () => {
    const r = evaluateBossPhase({ ...base, blindId: 'unknown_boss' });
    expect(r.promote).toBe(false);
  });

  it('STAKE GATE: Spark stake never promotes (beginner ladder stays single-phase)', () => {
    // Otherwise-valid Pluto hand-2 trigger, but on Spark the phase gate
    // suppresses it. This is the difficulty curve fix that keeps
    // Fibonacci/Spark and similar fragile cells inside their balance
    // bounds.
    const r = evaluateBossPhase({ ...base, blindId: 'pluto', stakeId: 'spark', newHandsLeft: 2, newScore: 400, target: 1000 });
    expect(r.promote).toBe(false);
  });

  it('STAKE GATE: Ember stake also stays single-phase', () => {
    const r = evaluateBossPhase({ ...base, blindId: 'pluto', stakeId: 'ember', newHandsLeft: 2, newScore: 400, target: 1000 });
    expect(r.promote).toBe(false);
  });

  it('STAKE GATE: Pyre stake DOES promote (escalation engaged)', () => {
    const r = evaluateBossPhase({ ...base, blindId: 'pluto', stakeId: 'pyre', newHandsLeft: 2, newScore: 400, target: 1000 });
    expect(r.promote).toBe(true);
  });
});
