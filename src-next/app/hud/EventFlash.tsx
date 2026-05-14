// Universal one-shot screen flash component. Subscribes to the event
// bus for moments that need a visual punch in sync with their audio —
// achievements unlocking and blind clears. Renders a fixed-position
// fullscreen overlay that fades from transparent → tinted → transparent
// over ~340ms, then unmounts.
//
// Reasons to centralise rather than rolling per-event flashes:
//   1. One z-index source of truth so the flash always sits at the
//      right HUD layer (above HUD chrome, below modals).
//   2. Reduce-motion suppression in one place.
//   3. Predictable timing curves across all event types.
//
// Each event tunes its own color + duration via the EVENT_FLASH table
// so the audio cue and visual cue feel like they're the same beat.
//
// Peak-hand milestones (5k / 25k / 100k / 500k / 1M) ARE achievements
// in this codebase, so the achievement flash automatically covers
// those celebratory moments without a separate hook.

import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { Z } from './zLayers';

type FlashSpec = {
  color: string;
  durationMs: number;
  peakOpacity: number;
  ring?: boolean;
};

const ACHIEVEMENT_FLASH: FlashSpec = { color: '#f5c451', durationMs: 420, peakOpacity: 0.45, ring: true };
const BLIND_CLEAR_FLASH: FlashSpec = { color: '#7be3ff', durationMs: 320, peakOpacity: 0.3 };

type Active = { spec: FlashSpec; key: number };

export function EventFlash() {
  const [active, setActive] = useState<Active | null>(null);

  useEffect(() => {
    let keyCounter = 0;
    const fire = (spec: FlashSpec) => {
      keyCounter++;
      const myKey = keyCounter;
      setActive({ spec, key: myKey });
      window.setTimeout(() => {
        setActive((cur) => (cur && cur.key === myKey ? null : cur));
      }, spec.durationMs + 40);
    };

    const offs = [
      bus.on('onAchievementUnlocked', () => fire(ACHIEVEMENT_FLASH)),
      bus.on('onBlindCleared', () => fire(BLIND_CLEAR_FLASH)),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  if (!active) return null;
  const { spec, key } = active;
  return (
    <>
      <div
        key={`flash-${key}`}
        aria-hidden="true"
        className="event-flash-pulse"
        style={{
          position: 'fixed', inset: 0,
          pointerEvents: 'none',
          background: `radial-gradient(ellipse at center, ${spec.color}cc 0%, ${spec.color}55 25%, transparent 60%)`,
          mixBlendMode: 'screen',
          opacity: 0,
          zIndex: Z.bannerArrival,
          animationDuration: `${spec.durationMs}ms`,
          ['--event-flash-peak' as string]: String(spec.peakOpacity),
        }}
      />
      {spec.ring && (
        <div
          key={`ring-${key}`}
          aria-hidden="true"
          className="event-flash-ring"
          style={{
            position: 'fixed',
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 60, height: 60,
            borderRadius: '50%',
            border: `2px solid ${spec.color}`,
            boxShadow: `0 0 32px ${spec.color}aa, 0 0 64px ${spec.color}55`,
            pointerEvents: 'none',
            opacity: 0,
            zIndex: Z.bannerArrival,
            animationDuration: `${spec.durationMs}ms`,
          }}
        />
      )}
    </>
  );
}
