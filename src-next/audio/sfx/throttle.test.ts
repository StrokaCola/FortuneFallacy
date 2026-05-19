import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Stub the voices so sfxPlay's switch reaches them but does no Tone work.
// Using vi.mock per-module so each cue is a no-op spy we can count.
vi.mock('./voices', () => ({
  diceClack: vi.fn(), lockTap: vi.fn(), reroll: vi.fn(), buy: vi.fn(),
  combo: vi.fn(), upgrade: vi.fn(), bossSting: vi.fn(), bigScore: vi.fn(),
  winFanfare: vi.fn(), bust: vi.fn(), chipTick: vi.fn(),
  castSwell: vi.fn(), castBoom: vi.fn(), sigilDraw: vi.fn(),
  cardFlip: vi.fn(), nodePulse: vi.fn(), transitionWipe: vi.fn(),
  multSlam: vi.fn(), comboChime: vi.fn(), targetCross: vi.fn(),
  notEnough: vi.fn(), modPulse: vi.fn(), modLoaded: vi.fn(),
  modPipCharge: vi.fn(), modBackstop: vi.fn(),
  modAttach: vi.fn(), modDetach: vi.fn(),
  uiClick: vi.fn(), uiHover: vi.fn(),
}));

vi.mock('./voices.legacy', () => ({
  diceClack: vi.fn(), lockTap: vi.fn(), reroll: vi.fn(), buy: vi.fn(),
  combo: vi.fn(), upgrade: vi.fn(), bossSting: vi.fn(), bigScore: vi.fn(),
  winFanfare: vi.fn(), bust: vi.fn(), chipTick: vi.fn(),
  castSwell: vi.fn(), castBoom: vi.fn(), sigilDraw: vi.fn(),
  cardFlip: vi.fn(), nodePulse: vi.fn(), transitionWipe: vi.fn(),
}));

import * as voicesMock from './voices';
import { sfxPlay, __sfxTestHooks, __setBankForTest } from './index';

// Provide a minimal bank stub so the `if (!bank) return` guard passes.
// The actual stub object is irrelevant — voices are mocked above.
beforeEach(() => {
  __setBankForTest({} as unknown as Parameters<typeof __setBankForTest>[0]);
  __sfxTestHooks.resetThrottle();
  vi.clearAllMocks();
});

afterEach(() => {
  __setBankForTest(null);
});

describe('sfxPlay throttle', () => {
  it('drops a second uiHover within the throttle window', () => {
    const fn = vi.mocked(voicesMock.uiHover);
    sfxPlay('uiHover');
    sfxPlay('uiHover');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('drops a sweep of cardFlips fired in rapid succession', () => {
    const fn = vi.mocked(voicesMock.cardFlip);
    // Simulates a mouse sweep across 5 shop offers, each onMouseEnter
    // firing within milliseconds of the next.
    for (let i = 0; i < 5; i++) sfxPlay('cardFlip');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not throttle un-listed cues (e.g. comboChime fires every time)', () => {
    // multSlam + chipTick gained throttles in Wave T Scoring Theater
    // (Batch I, 2026-05-19) — voice-steal prevents 5-catalyst wash.
    // comboChime stays unlisted; if every cue ever gets throttled
    // this guard catches the accidental over-throttle.
    const fn = vi.mocked(voicesMock.comboChime);
    sfxPlay('comboChime');
    sfxPlay('comboChime');
    sfxPlay('comboChime');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('allows the throttled cue to fire again once the gap has elapsed', () => {
    const fn = vi.mocked(voicesMock.uiHover);
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    sfxPlay('uiHover');
    expect(fn).toHaveBeenCalledTimes(1);

    now += 50; // < 80ms gap → still throttled
    sfxPlay('uiHover');
    expect(fn).toHaveBeenCalledTimes(1);

    now += 50; // total 100ms since first play → past 80ms, allowed
    sfxPlay('uiHover');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throttle is per-cue, not global', () => {
    const hover = vi.mocked(voicesMock.uiHover);
    const flip = vi.mocked(voicesMock.cardFlip);
    sfxPlay('uiHover');
    sfxPlay('cardFlip');
    sfxPlay('uiHover'); // throttled
    sfxPlay('cardFlip'); // throttled
    expect(hover).toHaveBeenCalledTimes(1);
    expect(flip).toHaveBeenCalledTimes(1);
  });
});
