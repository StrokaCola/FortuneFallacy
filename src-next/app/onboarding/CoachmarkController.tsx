// CoachmarkController — picks the active coachmark for the current state and
// renders it via <Coachmark>. Mounted once at the App root. Returns null
// when nothing is eligible (most of the time, after the first few runs).
//
// Re-renders on every store update — `pickActiveCoachmark` is a 5-line for
// loop, cheaper than maintaining a memoized derivation across screen + onb
// + round flag changes.

import { useStore } from '../../state/store';
import type { GameState } from '../../state/store';
import { Coachmark } from './Coachmark';
import { pickActiveCoachmark } from './coachmarks';

const selectAll = (s: GameState) => s;

export function CoachmarkController() {
  const state = useStore(selectAll);
  const def = pickActiveCoachmark(state);
  if (!def) return null;
  // Key on id so the bubble re-mounts cleanly between coachmarks (resets
  // the rAF re-measure loop in Coachmark.tsx).
  return <Coachmark key={def.id} def={def} />;
}
