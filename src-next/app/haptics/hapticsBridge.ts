// Wires haptic patterns to gameplay events. Mirrors audio/audioBridge.ts
// in shape — subscribes on install, returns a disposer. Mounted once
// from App.tsx.
//
// Events:
//   onLockToggled  → 'tap'    (lock confirmation)
//   onBlindCleared → 'clear'  (win moment)
//   onScoreBeat (die-tick) → 'tick'  (chain step)
//
// Bust intentionally does NOT buzz — punishing physical feedback on a
// loss is a hostile UX. Win-only haptics keep the device feeling
// rewarding.

import { bus } from '../../events/bus';
import { playHaptic } from './haptics';

export function startHapticsBridge(): () => void {
  const subs = [
    bus.on('onLockToggled', () => playHaptic('tap')),
    bus.on('onBlindCleared', () => playHaptic('clear')),
    bus.on('onScoreBeat', ({ beat }) => {
      // Only the per-die ticks should buzz. Combo bonus and mult-slam
      // beats are louder events with their own visual + audio punch;
      // an extra haptic on top makes long combos feel like a phone
      // call instead of a satisfying read-out.
      if (beat.kind === 'die-tick') playHaptic('tick');
    }),
  ];
  return () => subs.forEach((u) => u());
}
