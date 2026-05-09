// Sound captions — accessibility layer for deaf / HoH players + streamers
// in noisy environments. Toggle in Settings; off by default. When on, every
// gameplay-significant SFX-bearing event renders a short floating caption
// in the bottom-left of the stage so the player has a visual readout of
// what their audio engine just said.
//
// Throttled — repeated identical captions within the same 220ms window
// collapse to a count badge ("[ chip tick ×4 ]") so a 5-die roll doesn't
// fire 5 separate caption rows.

import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { Z } from './zLayers';
import { getCaptionsEnabled, subscribeCaptions } from '../../audio/audioSettings';

const CAPTION_HOLD_MS = 1800;
const COLLAPSE_WINDOW_MS = 220;
const MAX_VISIBLE = 5;

type Caption = { id: number; text: string; ts: number; count: number };

let captionId = 1;

export function SoundCaptions() {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [enabled, setEnabled] = useState(getCaptionsEnabled());

  useEffect(() => {
    return subscribeCaptions(() => setEnabled(getCaptionsEnabled()));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const push = (text: string) => {
      const now = performance.now();
      setCaptions((prev) => {
        // Collapse identical captions within the recent window.
        const recent = prev[prev.length - 1];
        if (recent && recent.text === text && now - recent.ts <= COLLAPSE_WINDOW_MS) {
          return [
            ...prev.slice(0, -1),
            { ...recent, count: recent.count + 1, ts: now },
          ];
        }
        const next = [...prev, { id: captionId++, text, ts: now, count: 1 }];
        return next.slice(-MAX_VISIBLE);
      });
    };

    const subs = [
      bus.on('onComboDetected', ({ combo }) => push(`[ combo: ${combo.replace(/_/g, ' ')} ]`)),
      bus.on('onUpgradeTriggered', ({ id }) => {
        if (id.startsWith('mod:')) return;
        if (id.startsWith('resonance:')) {
          push(`[ resonance: ${id.slice('resonance:'.length).replace(/_/g, ' ')} ]`);
        } else {
          const cleanId = id.split('@')[0]!.replace(/^edition:.+@/, '').replace(/_/g, ' ');
          push(`[ catalyst: ${cleanId} ]`);
        }
      }),
      bus.on('onModFired', ({ modId }) => push(`[ mod: ${modId.replace(/_/g, ' ')} ]`)),
      bus.on('onScoreCalculated', ({ total }) => push(`[ score: +${total.toLocaleString()} ]`)),
      bus.on('onBlindCleared', () => push('[ blind cleared ]')),
      bus.on('onBossRevealed', () => push('[ boss revealed ]')),
      bus.on('onRunEnded', ({ won }) => push(won ? '[ run won ]' : '[ run busted ]')),
      bus.on('onAchievementUnlocked', ({ name }) => push(`[ ascension: ${name} ]`)),
      bus.on('onHotStreak', () => push('[ hot streak ]')),
    ];

    // Auto-prune old captions on a slow tick. Keeping it 200ms apart so
    // the component doesn't re-render every frame.
    const prune = window.setInterval(() => {
      setCaptions((prev) => prev.filter((c) => performance.now() - c.ts < CAPTION_HOLD_MS));
    }, 200);

    return () => {
      subs.forEach((u) => u());
      window.clearInterval(prune);
    };
  }, [enabled]);

  if (!enabled || captions.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: 'absolute',
        left: 16, bottom: 'calc(var(--hud-bottom-h, 0px) + 18px)',
        display: 'flex', flexDirection: 'column', gap: 4,
        zIndex: Z.toast, pointerEvents: 'none',
        maxWidth: '60vw',
      }}
    >
      {captions.map((c) => (
        <div
          key={c.id}
          className="f-mono"
          style={{
            fontSize: 11,
            color: '#7be3ff',
            background: 'rgba(7,5,26,0.7)',
            padding: '3px 8px',
            borderRadius: 3,
            borderLeft: '2px solid #7be3ff',
            opacity: Math.max(0.4, 1 - (performance.now() - c.ts) / CAPTION_HOLD_MS),
            transition: 'opacity 200ms linear',
          }}
        >
          {c.text}{c.count > 1 ? ` ×${c.count}` : ''}
        </div>
      ))}
    </div>
  );
}
