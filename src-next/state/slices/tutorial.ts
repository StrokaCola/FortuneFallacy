// Guided-tour onboarding state. The scripted first-run tutorial advances
// through a fixed sequence of steps (see app/onboarding/tutorial/tutorialScript.ts).
// Separate from `meta.onboarding` (which tracks the 18 organic coachmarks
// the player has seen) — the tour is a single linear walkthrough that
// pre-empts coachmarks while active. Coachmarks resume after END_TUTORIAL.

export type TutorialStepId =
  | 't_intro_roll'
  | 't_lock_pair'
  | 't_reroll'
  | 't_score_first'
  | 't_catalyst_intro'
  | 't_hand_two'
  | 't_score_two_pair'
  | 't_shop_intro'
  | 't_shop_recommend'
  | 't_shop_voucher'
  | 't_shop_continue';

export type TutorialSlice = {
  // Tour is currently running — pause coachmarks, inject scripted dice
  // and shop offers, pre-equip the scripted starter catalyst.
  active: boolean;
  // Active step id, or null when inactive. Persistence keeps this value
  // across refresh so a mid-tour reload resumes at the same step.
  step: TutorialStepId | null;
  // Opt-in modal queued (set by ConstellationSelect on first-launch).
  // App renders the modal when this is true; Yes flips to active, No
  // flips to dismissed.
  optInPending: boolean;
  // How the tour ended — used by tests + future analytics. Null while
  // the tour has never started or is still running.
  endedAt: 'completed' | 'skipped' | null;
};

export const initialTutorialSlice = (): TutorialSlice => ({
  active: false,
  step: null,
  optInPending: false,
  endedAt: null,
});
