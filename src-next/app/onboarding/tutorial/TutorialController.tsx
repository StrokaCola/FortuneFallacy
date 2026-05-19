// Mounts the TutorialOverlay when the tour is active. Reads the current
// step from state; the overlay re-anchors itself when the step id flips.
// Mounted once at the App root alongside CoachmarkController.

import { useRef } from 'react';
import { useStore } from '../../../state/store';
import type { GameState } from '../../../state/store';
import { TutorialOverlay } from './TutorialOverlay';
import { lookupStep, type TutorialStep } from './tutorialScript';
import { useModalExit } from '../../hooks/useModalExit';

const selectActiveStep = (s: GameState): TutorialStep | null => {
  if (!s.tutorial.active || !s.tutorial.step) return null;
  return lookupStep(s.tutorial.step);
};

export function TutorialController() {
  const step = useStore(selectActiveStep);
  // Mirror Coachmark's exit-animation guard so the bubble fades out
  // cleanly when the tour ends.
  const lastStepRef = useRef<TutorialStep | null>(step);
  if (step) lastStepRef.current = step;
  const { rendered, exiting } = useModalExit(!!step, 160);

  const activeStep = step ?? lastStepRef.current;
  if (!rendered || !activeStep) return null;
  return <TutorialOverlay key={activeStep.id} step={activeStep} exiting={exiting} />;
}
