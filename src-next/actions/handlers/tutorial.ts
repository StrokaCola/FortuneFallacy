// Tutorial action handler. Owns the guided-tour slice; dispatch-level
// observation (see ../dispatch.ts) feeds ADVANCE_TUTORIAL when a step's
// scripted action fires. The handler itself stays free of side effects
// on the rest of state — Stratifier pre-equip lives in round.ts, scripted
// dice in roll.ts, scripted offers in shop.ts.

import type { ActionHandler } from './types';
import { FIRST_STEP_ID, LAST_STEP_ID, nextStepId } from '../../app/onboarding/tutorial/tutorialScript';

export const tutorialHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'OPEN_OPT_IN':
      // Idempotent — re-opening is a no-op so a stuck modal can't
      // double-fire on rapid re-render.
      if (s.tutorial.optInPending) return { state: s, events: [] };
      return {
        state: { ...s, tutorial: { ...s.tutorial, optInPending: true } },
        events: [],
      };

    case 'DISMISS_OPT_IN':
      return {
        state: {
          ...s,
          tutorial: { ...s.tutorial, optInPending: false, endedAt: 'skipped' },
          meta: {
            ...s.meta,
            onboarding: { ...s.meta.onboarding, firstLaunch: false },
          },
        },
        events: [],
      };

    case 'START_TUTORIAL': {
      // Pre-equip Stratifier so the scripted Full House on hand 1 fires a
      // visible catalyst payout. Guarded against double-add if the run
      // already has it for any reason.
      const alreadyHas = s.run.catalysts.includes('stratifier');
      const catalysts = alreadyHas ? s.run.catalysts : [...s.run.catalysts, 'stratifier'];
      return {
        state: {
          ...s,
          tutorial: {
            active: true,
            step: FIRST_STEP_ID,
            optInPending: false,
            endedAt: null,
          },
          meta: {
            ...s.meta,
            onboarding: { ...s.meta.onboarding, firstLaunch: false },
          },
          run: { ...s.run, catalysts },
          // Wipe pre-rolled shop offers so the next OPEN_SHOP regenerates
          // into the scripted set. Persistence may have hydrated a stale
          // shop snapshot from a prior run; safer to clear here than to
          // rely on every entry path doing it.
          shop: { ...s.shop, offers: [] },
        },
        events: [],
      };
    }

    case 'ADVANCE_TUTORIAL': {
      if (!s.tutorial.active || s.tutorial.step == null) return { state: s, events: [] };
      const next = nextStepId(s.tutorial.step);
      if (next == null) {
        // Walked past the last step — end the tour as completed.
        return {
          state: {
            ...s,
            tutorial: { ...s.tutorial, active: false, step: null, endedAt: 'completed' },
          },
          events: [],
        };
      }
      return {
        state: { ...s, tutorial: { ...s.tutorial, step: next } },
        events: [],
      };
    }

    case 'END_TUTORIAL':
      return {
        state: {
          ...s,
          tutorial: { ...s.tutorial, active: false, step: null, endedAt: a.reason },
        },
        events: [],
      };

    default:
      return { state: s, events: [] };
  }
};

// Re-export the last step id so dispatch.ts can detect the implicit end.
export { LAST_STEP_ID };
