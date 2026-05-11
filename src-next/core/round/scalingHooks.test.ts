// Unit tests for the 2026-05-11 scaling pack + easter egg detection.
// Pure-function tests against scalingHooks.ts — no rendering, no rng.

import { describe, it, expect } from 'vitest';
import { accrueScalingStacks, accrueBlindCleared, checkEasterEggs, isPalindrome } from './scalingHooks';
import { initialRunSlice } from '../../state/slices/run';
import { initialRoundSlice } from '../../state/slices/round';

describe('accrueScalingStacks', () => {
  it('Star Chart bumps on small straight', () => {
    const run = { ...initialRunSlice(), catalysts: ['star_chart'] };
    const { run: diff } = accrueScalingStacks({ run, comboId: 'sm_straight', events: [], peakHandWasNew: false });
    expect(diff.catalystStacks?.['star_chart']).toBe(1);
  });
  it('Star Chart bumps on large straight', () => {
    const run = { ...initialRunSlice(), catalysts: ['star_chart'] };
    const { run: diff } = accrueScalingStacks({ run, comboId: 'lg_straight', events: [], peakHandWasNew: false });
    expect(diff.catalystStacks?.['star_chart']).toBe(1);
  });
  it('Star Chart does NOT bump on pair', () => {
    const run = { ...initialRunSlice(), catalysts: ['star_chart'] };
    const { run: diff } = accrueScalingStacks({ run, comboId: 'one_pair', events: [], peakHandWasNew: false });
    expect(diff.catalystStacks).toBeUndefined();
  });
  it('Lodestone bumps on pair', () => {
    const run = { ...initialRunSlice(), catalysts: ['lodestone'] };
    const { run: diff } = accrueScalingStacks({ run, comboId: 'one_pair', events: [], peakHandWasNew: false });
    expect(diff.catalystStacks?.['lodestone']).toBe(1);
  });
  it('Lunar Phases advances and bakes on cycle', () => {
    let run = { ...initialRunSlice(), catalysts: ['lunar_phases'] };
    for (let i = 0; i < 7; i++) {
      const { run: diff } = accrueScalingStacks({ run, comboId: null, events: [], peakHandWasNew: false });
      run = { ...run, ...diff };
    }
    expect(run.lunarPhase).toBe(7);
    expect(run.lunarBakedMult).toBe(0);
    const { run: diff8 } = accrueScalingStacks({ run, comboId: null, events: [], peakHandWasNew: false });
    expect(diff8.lunarPhase).toBe(0);
    expect(diff8.lunarBakedMult).toBeCloseTo(0.1);
  });
  it('Event Horizon bumps when a big die contributes', () => {
    const run = { ...initialRunSlice(), catalysts: ['event_horizon'] };
    const events = [{ type: 'onUpgradeTriggered' as const, payload: { id: 'mod:loaded@2', phase: 5, deltaChips: 150, deltaMult: 0 } }];
    const { run: diff } = accrueScalingStacks({ run, comboId: 'one_pair', events, peakHandWasNew: false });
    expect(diff.catalystStacks?.['event_horizon']).toBe(1);
  });
  it('Highwater bumps on new peak BUT not on first-ever hand', () => {
    const run0 = { ...initialRunSlice(), catalysts: ['highwater'] };
    // handsPlayed = 0 → "first hand" guard, no stack
    const { run: d0 } = accrueScalingStacks({ run: run0, comboId: null, events: [], peakHandWasNew: true });
    expect(d0.catalystStacks).toBeUndefined();
    // handsPlayed = 1 → real PB
    const run1 = { ...run0, handsPlayed: 1 };
    const { run: d1 } = accrueScalingStacks({ run: run1, comboId: null, events: [], peakHandWasNew: true });
    expect(d1.catalystStacks?.['highwater']).toBe(1);
  });
});

describe('accrueBlindCleared', () => {
  it('Comet Trail bumps on clean blind, resets on consumable-used blind', () => {
    const run = { ...initialRunSlice(), catalysts: ['comet_trail'], catalystStacks: { comet_trail: 3 } };
    // No consumable used → +1
    const round = { ...initialRoundSlice(), consumableUsedThisBlind: false };
    const clean = accrueBlindCleared({ run, round, blindTarget: 100, blindScore: 150 });
    expect(clean.run.catalystStacks?.['comet_trail']).toBe(4);
    // Used → reset
    const dirty = accrueBlindCleared({ run, round: { ...round, consumableUsedThisBlind: true }, blindTarget: 100, blindScore: 150 });
    expect(dirty.run.catalystStacks?.['comet_trail']).toBe(0);
  });
  it('Memento Star bumps only on 200%+ overflow', () => {
    const run = { ...initialRunSlice(), catalysts: ['memento_star'] };
    const round = { ...initialRoundSlice(), consumableUsedThisBlind: false };
    const small = accrueBlindCleared({ run, round, blindTarget: 100, blindScore: 199 });
    expect(small.run.catalystStacks).toBeUndefined();
    const big = accrueBlindCleared({ run, round, blindTarget: 100, blindScore: 200 });
    expect(big.run.catalystStacks?.['memento_star']).toBe(1);
  });
  it('Heirloom Locket bumps unconditionally per blind', () => {
    const run = { ...initialRunSlice(), catalysts: ['heirloom_locket'] };
    const round = { ...initialRoundSlice(), consumableUsedThisBlind: false };
    const r = accrueBlindCleared({ run, round, blindTarget: 100, blindScore: 150 });
    expect(r.run.catalystStacks?.['heirloom_locket']).toBe(1);
  });
});

describe('checkEasterEggs', () => {
  it('The Answer fires at exactly 42 and grants +1 reroll', () => {
    const run = initialRunSlice();
    const round = initialRoundSlice();
    const r = checkEasterEggs({ run, round, handTotal: 42, scoringFaces: [6, 6, 6, 6, 6], blindId: 'lesser_trial', isBoss: false });
    expect(r.run.theAnswerArmed).toBe(true);
    expect(r.bonusRerollsThisHand).toBe(1);
    expect(r.events).toHaveLength(1);
  });
  it('The Answer does not double-fire once armed', () => {
    const run = { ...initialRunSlice(), theAnswerArmed: true };
    const round = initialRoundSlice();
    const r = checkEasterEggs({ run, round, handTotal: 42, scoringFaces: [], blindId: null, isBoss: false });
    expect(r.bonusRerollsThisHand).toBe(0);
    expect(r.run.theAnswerArmed).toBeUndefined();
  });
  it('Lucky Seven fires at 3+ scoring 7s', () => {
    const run = initialRunSlice();
    const round = initialRoundSlice();
    const r = checkEasterEggs({ run, round, handTotal: 100, scoringFaces: [7, 7, 7], blindId: null, isBoss: false });
    expect(r.shardsBonus).toBe(50);
  });
  it('Lucky Seven does NOT fire at 2 sevens', () => {
    const run = initialRunSlice();
    const round = initialRoundSlice();
    const r = checkEasterEggs({ run, round, handTotal: 100, scoringFaces: [7, 7, 6], blindId: null, isBoss: false });
    expect(r.shardsBonus).toBe(0);
  });
  it('Eris Apple flips only in Eris boss with all-prime hand', () => {
    const run = initialRunSlice();
    const round = initialRoundSlice();
    const yes = checkEasterEggs({ run, round, handTotal: 30, scoringFaces: [2, 3, 5, 7], blindId: 'eris', isBoss: true });
    expect(yes.round.errisAppleFlipped).toBe(true);
    const wrongBoss = checkEasterEggs({ run, round, handTotal: 30, scoringFaces: [2, 3, 5, 7], blindId: 'pluto', isBoss: true });
    expect(wrongBoss.round.errisAppleFlipped).toBeUndefined();
    const nonPrime = checkEasterEggs({ run, round, handTotal: 30, scoringFaces: [2, 3, 5, 4], blindId: 'eris', isBoss: true });
    expect(nonPrime.round.errisAppleFlipped).toBeUndefined();
  });
});

describe('isPalindrome', () => {
  it('detects palindromes ignoring case/punctuation', () => {
    expect(isPalindrome('Anna')).toBe(true);
    expect(isPalindrome('Race car')).toBe(true);
    expect(isPalindrome('No lemon, no melon')).toBe(true);
    expect(isPalindrome('hello')).toBe(false);
    expect(isPalindrome('Star Chart')).toBe(false);
  });
});
