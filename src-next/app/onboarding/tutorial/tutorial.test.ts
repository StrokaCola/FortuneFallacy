import { describe, it, expect } from 'vitest';
import { tutorialHandler } from '../../../actions/handlers/tutorial';
import { shopHandler } from '../../../actions/handlers/shop';
import { pickActiveCoachmark } from '../coachmarks';
import { TUTORIAL_STEPS, FIRST_STEP_ID, LAST_STEP_ID, lookupStep, nextStepId } from './tutorialScript';
import { TUTORIAL_SHOP_OFFERS, applyScriptedFaces, facesForStep, isTutorialActive, tutorialStepIs } from './deterministicScript';
import { initialMetaSlice } from '../../../state/slices/meta';
import { initialUiSlice } from '../../../state/slices/ui';
import { initialRoundSlice } from '../../../state/slices/round';
import { initialRunSlice } from '../../../state/slices/run';
import { initialShopSlice } from '../../../state/slices/shop';
import { initialTutorialSlice } from '../../../state/slices/tutorial';
import type { GameState } from '../../../state/store';

const baseState = (over: Partial<GameState> = {}): GameState => ({
  run: initialRunSlice(),
  round: initialRoundSlice(),
  shop: initialShopSlice(),
  meta: initialMetaSlice(),
  ui: initialUiSlice(),
  tutorial: initialTutorialSlice(),
  pingCount: 0,
  ...over,
} as GameState);

describe('tutorialHandler — OPEN_OPT_IN', () => {
  it('flips optInPending to true', () => {
    const r = tutorialHandler({ type: 'OPEN_OPT_IN' }, baseState());
    expect(r.state.tutorial.optInPending).toBe(true);
  });

  it('is idempotent when already pending', () => {
    const s = { ...baseState(), tutorial: { ...initialTutorialSlice(), optInPending: true } };
    const r = tutorialHandler({ type: 'OPEN_OPT_IN' }, s);
    expect(r.state).toBe(s);
  });
});

describe('tutorialHandler — DISMISS_OPT_IN', () => {
  it('clears optInPending and firstLaunch', () => {
    const s = {
      ...baseState(),
      tutorial: { ...initialTutorialSlice(), optInPending: true },
    };
    const r = tutorialHandler({ type: 'DISMISS_OPT_IN' }, s);
    expect(r.state.tutorial.optInPending).toBe(false);
    expect(r.state.tutorial.endedAt).toBe('skipped');
    expect(r.state.meta.onboarding.firstLaunch).toBe(false);
  });
});

describe('tutorialHandler — START_TUTORIAL', () => {
  it('activates the tour at the first step', () => {
    const r = tutorialHandler({ type: 'START_TUTORIAL' }, baseState());
    expect(r.state.tutorial.active).toBe(true);
    expect(r.state.tutorial.step).toBe(FIRST_STEP_ID);
    expect(r.state.tutorial.endedAt).toBeNull();
  });

  it('pre-equips the starter catalyst', () => {
    const r = tutorialHandler({ type: 'START_TUTORIAL' }, baseState());
    expect(r.state.run.catalysts).toContain('stratifier');
  });

  it('does not double-add stratifier if already owned', () => {
    const s = baseState();
    s.run.catalysts = ['stratifier'];
    const r = tutorialHandler({ type: 'START_TUTORIAL' }, s);
    expect(r.state.run.catalysts.filter((id) => id === 'stratifier')).toHaveLength(1);
  });

  it('clears any pre-rolled shop offers', () => {
    const s = baseState();
    s.shop.offers = [{ kind: 'catalyst', id: 'six_bias', price: 5 }];
    const r = tutorialHandler({ type: 'START_TUTORIAL' }, s);
    expect(r.state.shop.offers).toHaveLength(0);
  });

  it('clears firstLaunch', () => {
    const r = tutorialHandler({ type: 'START_TUTORIAL' }, baseState());
    expect(r.state.meta.onboarding.firstLaunch).toBe(false);
  });
});

describe('tutorialHandler — ADVANCE_TUTORIAL', () => {
  it('advances to the next step id', () => {
    const s = baseState();
    s.tutorial = { ...initialTutorialSlice(), active: true, step: FIRST_STEP_ID };
    const r = tutorialHandler({ type: 'ADVANCE_TUTORIAL' }, s);
    expect(r.state.tutorial.step).toBe(nextStepId(FIRST_STEP_ID));
  });

  it('ends the tour as completed when past the last step', () => {
    const s = baseState();
    s.tutorial = { ...initialTutorialSlice(), active: true, step: LAST_STEP_ID };
    const r = tutorialHandler({ type: 'ADVANCE_TUTORIAL' }, s);
    expect(r.state.tutorial.active).toBe(false);
    expect(r.state.tutorial.step).toBeNull();
    expect(r.state.tutorial.endedAt).toBe('completed');
  });

  it('is a no-op when the tour is inactive', () => {
    const r = tutorialHandler({ type: 'ADVANCE_TUTORIAL' }, baseState());
    expect(r.state.tutorial.active).toBe(false);
    expect(r.state.tutorial.step).toBeNull();
  });
});

describe('tutorialHandler — END_TUTORIAL', () => {
  it('sets endedAt to the provided reason', () => {
    const s = baseState();
    s.tutorial = { ...initialTutorialSlice(), active: true, step: 't_intro_roll' };
    const r = tutorialHandler({ type: 'END_TUTORIAL', reason: 'skipped' }, s);
    expect(r.state.tutorial.active).toBe(false);
    expect(r.state.tutorial.endedAt).toBe('skipped');
  });
});

describe('tutorialScript registry', () => {
  it('has at least 11 steps covering round + shop', () => {
    expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(11);
  });

  it('lookupStep returns the same reference for a known id', () => {
    expect(lookupStep(FIRST_STEP_ID)?.id).toBe(FIRST_STEP_ID);
  });

  it('lookupStep returns null for unknown ids', () => {
    expect(lookupStep(null)).toBeNull();
  });

  it('nextStepId walks the array in order and returns null past the end', () => {
    expect(nextStepId(LAST_STEP_ID)).toBeNull();
    expect(nextStepId(null)).toBe(FIRST_STEP_ID);
  });

  it('every step has an anchor and copy', () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.anchor).toBeTruthy();
      expect(step.text.length).toBeGreaterThan(0);
    }
  });
});

describe('deterministicScript', () => {
  it('isTutorialActive reflects state.tutorial.active', () => {
    const s = baseState();
    expect(isTutorialActive(s)).toBe(false);
    s.tutorial = { ...initialTutorialSlice(), active: true, step: 't_intro_roll' };
    expect(isTutorialActive(s)).toBe(true);
  });

  it('tutorialStepIs returns true only for matching ids while active', () => {
    const s = baseState();
    s.tutorial = { ...initialTutorialSlice(), active: true, step: 't_intro_roll' };
    expect(tutorialStepIs(s, 't_intro_roll')).toBe(true);
    expect(tutorialStepIs(s, 't_lock_pair')).toBe(false);
  });

  it('facesForStep returns the scripted dice for the intro step', () => {
    const faces = facesForStep('t_intro_roll');
    expect(faces).toEqual([5, 5, 3, 3, 4]);
  });

  it('facesForStep returns null when the step has no override', () => {
    // t_catalyst_intro has no diceFaces — it's a click-advance bubble.
    expect(facesForStep('t_catalyst_intro')).toBeNull();
  });

  it('applyScriptedFaces preserves locked dice and substitutes unlocked', () => {
    const original = [1, 2, 3, 4, 5];
    const locked = [true, true, false, false, false];
    const scripted = [9, 9, 7, 7, 7];
    const result = applyScriptedFaces(original, locked, scripted);
    expect(result).toEqual([1, 2, 7, 7, 7]);
  });

  it('TUTORIAL_SHOP_OFFERS includes the scripted catalyst at index 0', () => {
    expect(TUTORIAL_SHOP_OFFERS[0]).toEqual({ kind: 'catalyst', id: 'compounding_bias', price: 5 });
  });
});

describe('shopHandler — OPEN_SHOP during tutorial', () => {
  it('returns the scripted offer set regardless of seed', () => {
    const s = baseState();
    s.tutorial = { ...initialTutorialSlice(), active: true, step: 't_score_two_pair' };
    s.run.seed = 12345;
    const r = shopHandler({ type: 'OPEN_SHOP' }, s);
    expect(r.state.shop.offers).toEqual(TUTORIAL_SHOP_OFFERS);
  });

  it('tops up shards to the tutorial minimum if below', () => {
    const s = baseState();
    s.tutorial = { ...initialTutorialSlice(), active: true, step: 't_score_two_pair' };
    s.run.shards = 2;
    const r = shopHandler({ type: 'OPEN_SHOP' }, s);
    expect(r.state.run.shards).toBeGreaterThanOrEqual(8);
  });

  it('does not reduce shards if the player has more than the minimum', () => {
    const s = baseState();
    s.tutorial = { ...initialTutorialSlice(), active: true, step: 't_score_two_pair' };
    s.run.shards = 25;
    const r = shopHandler({ type: 'OPEN_SHOP' }, s);
    expect(r.state.run.shards).toBe(25);
  });
});

describe('pickActiveCoachmark — tutorial suppression', () => {
  it('returns null when the tutorial is active', () => {
    const s = baseState();
    s.tutorial = { ...initialTutorialSlice(), active: true, step: FIRST_STEP_ID };
    s.ui.screen = 'round';
    expect(pickActiveCoachmark(s)).toBeNull();
  });

  it('resumes the normal coachmark flow when the tutorial ends', () => {
    const s = baseState();
    s.tutorial = { ...initialTutorialSlice(), active: false, endedAt: 'completed' };
    s.ui.screen = 'round';
    // round_roll is the first round-screen coachmark and has no requires.
    expect(pickActiveCoachmark(s)?.id).toBe('round_roll');
  });
});
