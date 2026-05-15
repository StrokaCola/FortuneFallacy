// CoachmarkController — picks the active coachmark for the current state and
// renders it via <Coachmark>. Mounted once at the App root. Returns null
// when nothing is eligible (most of the time, after the first few runs).
//
// The selector returns the active CoachmarkDef directly. Because every
// CoachmarkDef is a reference into the module-constant COACHMARKS array,
// the SAME def for the SAME active coachmark returns the SAME reference
// across selector calls — Zustand's default Object.is equality bails out
// and CoachmarkController only re-renders when the active def actually
// flips. The prior `selectAll` selector returned the whole state, which
// re-rendered the controller on every store mutation and contributed to
// React error #185 cascades when paired with Coachmark's measurement
// effect.

import { useEffect, useRef } from 'react';
import { useStore } from '../../state/store';
import type { GameState } from '../../state/store';
import { Coachmark } from './Coachmark';
import { pickActiveCoachmark, type CoachmarkDef } from './coachmarks';
import { useModalExit } from '../hooks/useModalExit';

const selectActiveCoachmark = (s: GameState) => pickActiveCoachmark(s);

export function CoachmarkController() {
  const def = useStore(selectActiveCoachmark);
  // Hold onto the previous def so the bubble can fade out cleanly
  // after the active def flips back to null (Got it / Skip tutorial).
  // Without this, Controller returns null immediately and Coachmark
  // pops away with no exit animation.
  const lastDefRef = useRef<CoachmarkDef | null>(def);
  if (def) lastDefRef.current = def;
  const { rendered, exiting } = useModalExit(!!def, 160);

  // Mirror "is a coachmark showing?" onto <body> so the tooltip
  // suppression CSS can hide hover/stuck tips while a coachmark is
  // active. Coachmarks are higher-priority guidance than help
  // tooltips and shouldn't share screen real estate with them.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (def) {
      document.body.dataset.coachActive = 'true';
      return () => { delete document.body.dataset.coachActive; };
    }
    return undefined;
  }, [def?.id]);

  const activeDef = def ?? lastDefRef.current;
  if (!rendered || !activeDef) return null;
  // Key on id so the bubble re-mounts cleanly between coachmarks (resets
  // the rAF re-measure loop in Coachmark.tsx). Pass `exiting` through so
  // the bubble fades out instead of popping when the player dismisses.
  return <Coachmark key={activeDef.id} def={activeDef} exiting={exiting} />;
}
