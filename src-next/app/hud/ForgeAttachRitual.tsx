// ForgeAttachRitual — Phase 1.2 of the 2026-05-11 Forge overhaul.
//
// When `onModAttached` fires while the Forge screen is active, this
// overlay plays a three-beat ritual on top of the Forge:
//
//   Beat 1 (0–250 ms)   CHARGE  — soft rising tone, mod accent glow
//                                rises from below the central die
//   Beat 2 (250–450 ms) STRIKE  — sharp chime + bright flash + jolt
//                                kick on the die; mod material crossfade
//   Beat 3 (450–900 ms) SETTLE  — expanding halo ring + soft chime tail
//
// Tap-to-skip: after the first ritual of a session, the player can tap
// anywhere on the overlay to fast-forward to SETTLE immediately. The
// session-scoped flag lives in component state — leaving the Forge or
// reloading resets it. New players still get the full show on their
// first attach.

import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import { lookupMod } from '../../core/mods';
import { sfxPlay } from '../../audio/sfx';
import { playHaptic } from '../haptics/haptics';
import { useStore, type GameState } from '../../state/store';
import { Z } from './zLayers';

const BEAT_CHARGE_MS  = 250;
const BEAT_STRIKE_MS  = 200;
const BEAT_SETTLE_MS  = 450;
const TOTAL_MS = BEAT_CHARGE_MS + BEAT_STRIKE_MS + BEAT_SETTLE_MS;

type RitualState =
  | { phase: 'idle' }
  | { phase: 'charge'; modId: string; accent: string; startedAt: number; skippable: boolean }
  | { phase: 'strike'; modId: string; accent: string; skippable: boolean }
  | { phase: 'settle'; modId: string; accent: string; skippable: boolean };

const selectScreen = (s: GameState) => s.ui.screen;

export function ForgeAttachRitual() {
  const screen = useStore(selectScreen);
  const [state, setState] = useState<RitualState>({ phase: 'idle' });
  // Session-scoped flag: once the player has seen one full ritual on
  // this Forge visit, subsequent rituals are skippable from the start.
  // Resets when the Forge screen unmounts (see useEffect cleanup below).
  const hasSeenFullRef = useRef(false);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Reset session flag when the player leaves the Forge.
  useEffect(() => {
    if (screen !== 'forge') {
      hasSeenFullRef.current = false;
      setState({ phase: 'idle' });
    }
  }, [screen]);

  useEffect(() => {
    const track = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timersRef.current.delete(t);
        fn();
      }, ms);
      timersRef.current.add(t);
      return t;
    };

    const off = bus.on('onModAttached', (payload: { dieIdx: number; modId: string }) => {
      // Only ritualize on the Forge screen. onModAttached can fire from
      // consumable effects on Round, etc — those land silently.
      if (screen !== 'forge') return;
      const def = lookupMod(payload.modId);
      if (!def) return;
      const accent = def.visual?.accentColor ?? '#7be3ff';
      const skippable = hasSeenFullRef.current;

      // Charge beat
      setState({ phase: 'charge', modId: payload.modId, accent, startedAt: performance.now(), skippable });
      playHaptic('tap');
      sfxPlay('castSwell', { gain: 0.45 });

      // Strike beat — fires its own chime + a sharper percussive layer.
      track(() => {
        setState({ phase: 'strike', modId: payload.modId, accent, skippable });
        sfxPlay('modPulse', { gain: 1.1 });
        sfxPlay('castBoom', { gain: 0.6 });
        playHaptic('tick');
      }, BEAT_CHARGE_MS);

      // Settle beat
      track(() => {
        setState({ phase: 'settle', modId: payload.modId, accent, skippable });
        sfxPlay('comboChime', { gain: 0.55 });
      }, BEAT_CHARGE_MS + BEAT_STRIKE_MS);

      // Resolve back to idle
      track(() => {
        setState({ phase: 'idle' });
        hasSeenFullRef.current = true;
      }, TOTAL_MS);
    });
    return () => {
      off();
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();
    };
  }, [screen]);

  // Tap-to-skip: fast-forward to settle. Only available after the first
  // full ritual of the session.
  const handleSkip = () => {
    if (state.phase === 'idle' || !state.skippable) return;
    // Clear pending timers and jump straight to settle.
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
    const accent = state.accent;
    const modId = state.modId;
    setState({ phase: 'settle', modId, accent, skippable: true });
    sfxPlay('comboChime', { gain: 0.55 });
    const t = setTimeout(() => setState({ phase: 'idle' }), 220);
    timersRef.current.add(t);
  };

  if (state.phase === 'idle') return null;

  const { phase, accent, skippable } = state;
  // The overlay's three layered visuals — charge ring, strike flash,
  // settle halo — are all positioned relative to the center of the
  // viewport (which is also where the centerpiece DieView sits).
  return (
    <div
      onClick={handleSkip}
      data-forge-ritual={phase}
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        zIndex: Z.bannerArrival,
        pointerEvents: skippable ? 'auto' : 'none',
        cursor: skippable && phase !== 'settle' ? 'pointer' : 'default',
      }}>
      {/* Charge ring — small, rises from below the die center on beat 1. */}
      {phase === 'charge' && (
        <div style={{
          position: 'absolute',
          left: '50%', top: '50%',
          width: 160, height: 160,
          marginLeft: -80, marginTop: -80,
          borderRadius: '50%',
          border: `2px solid ${accent}`,
          boxShadow: `0 0 24px ${accent}, inset 0 0 32px ${accent}66`,
          animation: `forge-ritual-charge ${BEAT_CHARGE_MS}ms ease-out forwards`,
          pointerEvents: 'none',
        }} />
      )}
      {/* Strike flash — bright accent flare that paints the whole viewport
          for a single frame, then fades. */}
      {phase === 'strike' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle at center, ${accent}55 0%, ${accent}18 30%, transparent 60%)`,
          animation: `forge-ritual-strike ${BEAT_STRIKE_MS}ms ease-out forwards`,
          pointerEvents: 'none',
        }} />
      )}
      {/* Settle halo — expanding outer ring + a soft accent bloom. */}
      {phase === 'settle' && (
        <div style={{
          position: 'absolute',
          left: '50%', top: '50%',
          width: 220, height: 220,
          marginLeft: -110, marginTop: -110,
          borderRadius: '50%',
          border: `2px solid ${accent}`,
          boxShadow: `0 0 36px ${accent}, 0 0 80px ${accent}88`,
          animation: `forge-ritual-settle ${BEAT_SETTLE_MS}ms cubic-bezier(0.2, 0.9, 0.3, 1) forwards`,
          pointerEvents: 'none',
        }} />
      )}
      {/* Tap-to-skip hint — only shown for the first ~600ms of subsequent
          rituals so it doesn't add clutter every attach. */}
      {skippable && phase === 'charge' && (
        <div className="f-mono uc" style={{
          position: 'absolute',
          left: '50%', bottom: 'calc(var(--hud-bottom-h, 60px) + 80px)',
          transform: 'translateX(-50%)',
          fontSize: 8, letterSpacing: '0.4em',
          color: accent, opacity: 0.65,
          pointerEvents: 'none',
        }}>
          tap to skip
        </div>
      )}
    </div>
  );
}
