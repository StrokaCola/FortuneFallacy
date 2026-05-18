// Wires haptic patterns to gameplay events. Mirrors audio/audioBridge.ts
// in shape — subscribes on install, returns a disposer. Mounted once
// from App.tsx.
//
// Events:
//   onLockToggled  → 'tap'    (lock confirmation)
//   onBlindCleared → 'clear'  (win moment)
//   onScoreBeat (die-tick) → 'tick'  (chain step)
//   onNearBust → 'heartbeat' (repeating until onSafe)  [2026-05-18]
//
// Bust intentionally does NOT buzz — punishing physical feedback on a
// loss is a hostile UX. Win-only haptics keep the device feeling
// rewarding. The near-bust heartbeat is the only ANTICIPATORY haptic
// — it fires while danger is imminent, then stops the moment the
// player clears or busts.

import { bus } from '../../events/bus';
import { playHaptic } from './haptics';
import { getAmbientReactions } from '../settings/aliveness';

const HEARTBEAT_INTERVAL_MS = 720;

export function startHapticsBridge(): () => void {
  let heartbeatTimer: number | null = null;

  const stopHeartbeat = () => {
    if (heartbeatTimer != null) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const startHeartbeat = () => {
    if (heartbeatTimer != null) return;
    // 'off' / 'subtle' both disable the haptic — heartbeats through
    // a vibrating phone are the loudest piece of the ambience layer
    // and the most divisive. Players opting out of full intensity
    // shouldn't feel their phone start pulsing on tight blinds.
    if (getAmbientReactions() !== 'on') return;
    playHaptic('heartbeat');
    heartbeatTimer = window.setInterval(() => playHaptic('heartbeat'), HEARTBEAT_INTERVAL_MS);
  };

  const subs = [
    bus.on('onLockToggled', () => playHaptic('tap')),
    bus.on('onBlindCleared', () => {
      stopHeartbeat();
      playHaptic('clear');
    }),
    bus.on('onScoreBeat', ({ beat }) => {
      // Only the per-die ticks should buzz. Combo bonus and mult-slam
      // beats are louder events with their own visual + audio punch;
      // an extra haptic on top makes long combos feel like a phone
      // call instead of a satisfying read-out.
      if (beat.kind === 'die-tick') playHaptic('tick');
    }),
    bus.on('onNearBust', () => startHeartbeat()),
    bus.on('onSafe', () => stopHeartbeat()),
    // Defensive — clear the heartbeat on any run end so it never
    // outlives the round it was scheduled for. The state listener
    // also fires onSafe in this case but belt-and-suspenders here.
    bus.on('onRunEnded', () => stopHeartbeat()),
  ];
  return () => {
    stopHeartbeat();
    subs.forEach((u) => u());
  };
}
