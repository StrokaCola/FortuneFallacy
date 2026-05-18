// Wires haptic patterns to gameplay events. Mirrors audio/audioBridge.ts
// in shape — subscribes on install, returns a disposer. Mounted once
// from App.tsx.
//
// Events:
//   onLockToggled  → 'tap'    (lock confirmation)
//   onBlindCleared → 'clear'  (win moment)
//   onScoreBeat (die-tick) → 'tick'  (chain step)
//   onNearBust → 'heartbeat' (repeating, gated to last-shot)  [2026-05-18]
//
// Bust intentionally does NOT buzz — punishing physical feedback on a
// loss is a hostile UX. Win-only haptics keep the device feeling
// rewarding.
//
// The near-bust heartbeat is the only ANTICIPATORY haptic, and it's
// gated to the player's genuine point-of-no-return: last hand AND no
// rerolls remaining. Earlier near-bust states (mid-round tension)
// felt like "constantly beating" through the phone. Gating by the
// final-shot state keeps the heartbeat as a rare, meaningful cue
// instead of ambient noise. Because `onNearBust` is a one-shot
// threshold-cross event, we also subscribe to the store so the
// heartbeat can start/stop when handsLeft/rerollsLeft change mid-
// near-bust (e.g. rerolls drop to 0 while already in danger).

import { bus } from '../../events/bus';
import { playHaptic } from './haptics';
import { getAmbientReactions } from '../settings/aliveness';
import { store } from '../../state/store';

const HEARTBEAT_INTERVAL_MS = 720;

export function startHapticsBridge(): () => void {
  let heartbeatTimer: number | null = null;
  let nearBustActive = false;

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

  // The gate: heartbeat may only fire on the last-shot moment —
  // hands === 1 (final hand) AND rerolls === 0 (no more bail-outs).
  // Any earlier near-bust state buzzes audio + visuals only.
  const isLastShot = (): boolean => {
    const s = store.getState();
    return s.round.handsLeft === 1 && s.round.rerollsLeft === 0;
  };

  const evaluate = () => {
    if (nearBustActive && isLastShot()) startHeartbeat();
    else stopHeartbeat();
  };

  // Watch state transitions — if the player burns down to (1 hand,
  // 0 rerolls) while already past the near-bust threshold, the bus
  // won't re-fire onNearBust, so we re-evaluate the gate on every
  // store change. playHaptic doesn't dispatch, so no loop risk.
  const unsubStore = store.subscribe(() => evaluate());

  const subs = [
    bus.on('onLockToggled', () => playHaptic('tap')),
    bus.on('onBlindCleared', () => {
      nearBustActive = false;
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
    bus.on('onNearBust', () => {
      nearBustActive = true;
      evaluate();
    }),
    bus.on('onSafe', () => {
      nearBustActive = false;
      stopHeartbeat();
    }),
    // Defensive — clear the heartbeat on any run end so it never
    // outlives the round it was scheduled for. The state listener
    // also fires onSafe in this case but belt-and-suspenders here.
    bus.on('onRunEnded', () => {
      nearBustActive = false;
      stopHeartbeat();
    }),
  ];
  return () => {
    nearBustActive = false;
    stopHeartbeat();
    unsubStore();
    subs.forEach((u) => u());
  };
}
