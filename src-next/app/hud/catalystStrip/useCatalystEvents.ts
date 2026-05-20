// Subscribes to the `onUpgradeTriggered` bus event and turns each fire
// into a coordinated set of on-card animations: a pulse class on the
// card, an outward ring burst, and a "+N chips" / "+N mult" floater.
//
// Lifted out of CatalystStrip.tsx — the original useEffect body was
// 175 lines including the resonance-pair branch, the catalyst_bench
// ripple, the legendary/scaling/collision/regular pulse priority
// resolver, the ring suppression on tight viewports, and the
// stagger-on-tight-viewport floater scheduler. Behavior preserved
// verbatim; only the location moved.

import { useEffect, useRef, useState } from 'react';
import { bus } from '../../../events/bus';
import { lookupCatalyst, SCALING_CATALYST_IDS, COLLISION_CATALYST_IDS } from '../../../data/catalysts';
import { catalystIdFromEvent, resonanceIdFromEvent } from '../../../core/upgrades/eventId';
import { lookupResonance } from '../../../data/resonances';
import type { CatalystEdition } from '../../../state/slices/run';
import type { FloaterRecord, RingRecord, PulseKind } from './types';

// Per-edition fire-ring color override. Foil rings glint gold,
// holo rings push violet (the holo accent), poly rings push
// orange (the poly accent), void rings stay deep-violet for the
// "cosmic" feel. Null = no override, fall back to legendary /
// collision / catalyst color.
function editionRingColor(edition: CatalystEdition | undefined): string | null {
  switch (edition) {
    case 'foil': return '#ffd97a';
    case 'holo': return '#cc88ff';
    case 'poly': return '#ff7847';
    case 'void': return '#aa66ff';
    default: return null;
  }
}

// Animation timings — tuned so the per-fire burst feels distinct
// without spilling into the next event. Mirror values used by the
// CSS keyframes in app/hud/CatalystStrip.css (and ScoringVFX.css).
const PULSE_DURATION_MS = 380;
const PULSE_DURATION_LEGENDARY_MS = 540;
const PULSE_DURATION_SCALING_MS = 460;
const PULSE_DURATION_COLLISION_MS = 320;
const CHAIN_PULSE_STEP_MS = 80;
const FLOATER_DURATION_MS = 900;
const RING_DURATION_MS = 720;
const FLOATER_STAGGER_MS = 120;

const COLLISION_RING_COLOR = '#ffd84a';
const RESONANCE_RING_COLOR = '#ffd84a';

export type CatalystEventState = {
  pulsing: Record<string, PulseKind | undefined>;
  floaters: FloaterRecord[];
  rings: RingRecord[];
};

/**
 * Wires the catalyst strip's bus listener and returns the live
 * animation state. Owns its own setTimeout pool; cleanup runs on
 * unmount or when the `catalysts` set changes.
 *
 * - `tight` controls compact-viewport ergonomics: rings are
 *   suppressed (the card-pulse already conveys "fired", and rings
 *   stack into visual mud on small screens), and floaters are
 *   staggered by 120ms so a chain of fires reads sequentially
 *   rather than overlapping.
 */
export function useCatalystEvents(
  catalysts: string[],
  tight: boolean,
  editions: Record<string, CatalystEdition | undefined> = {},
): CatalystEventState {
  const [pulsing, setPulsing] = useState<Record<string, PulseKind | undefined>>({});
  const [floaters, setFloaters] = useState<FloaterRecord[]>([]);
  const [rings, setRings] = useState<RingRecord[]>([]);

  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const floaterKeyRef = useRef(0);
  const ringKeyRef = useRef(0);
  const floaterStaggerRef = useRef(0);

  useEffect(() => {
    const timers = timersRef.current;
    const track = (cb: () => void, delayMs: number): ReturnType<typeof setTimeout> => {
      const t = setTimeout(() => {
        timers.delete(t);
        cb();
      }, delayMs);
      timers.add(t);
      return t;
    };

    // Wave T+1 (2026-05-19) sync fix — catalyst pulse + ring + floater
    // used to fire on onUpgradeTriggered (eval-time, all at once before
    // scoring sequence playback). The corresponding upgrade-chip /
    // upgrade-mult beats fire LATER during sequence playback. That
    // desync meant the catalyst bounced + the cardFloater rose at t=0,
    // while the FlyToCounter +N floater rose 1-2s later when its beat
    // played. The fix here: drive catalyst visuals from onScoreBeat
    // instead, so the catalyst pulses at the same moment the beat
    // plays back and FlyToCounter renders the +N. catalyst_bench's
    // chain ripple stays on onUpgradeTriggered because it has no
    // per-target beats — it's pure visual decoration triggered when
    // the bench card itself fires.
    const triggerCatalystVisual = (catalystId: string) => {
      const meta = lookupCatalyst(catalystId);
      const isLegendary = meta?.rarity === 'legendary';
      const isScaling = SCALING_CATALYST_IDS.has(catalystId);
      const isCollision = COLLISION_CATALYST_IDS.has(catalystId);
      const pulseKind: PulseKind =
        isLegendary ? 'fire-legendary'
        : isScaling ? 'scaling'
        : isCollision ? 'collision'
        : 'fire';
      const pulseDuration =
        isLegendary ? PULSE_DURATION_LEGENDARY_MS :
        isScaling ? PULSE_DURATION_SCALING_MS :
        isCollision ? PULSE_DURATION_COLLISION_MS :
        PULSE_DURATION_MS;
      setPulsing((s) => ({ ...s, [catalystId]: pulseKind }));
      track(() => {
        setPulsing((s) => ({ ...s, [catalystId]: undefined }));
      }, pulseDuration);
      if (!tight) {
        const ringKey = ++ringKeyRef.current;
        const editionTint = editionRingColor(editions[catalystId]);
        const ringColor =
          editionTint ??
          (isLegendary ? '#ff9466'
            : isCollision ? COLLISION_RING_COLOR
            : meta?.color ?? '#7be3ff');
        setRings((rs) => [...rs, { key: ringKey, catalystId, color: ringColor }]);
        track(() => {
          setRings((rs) => rs.filter((r) => r.key !== ringKey));
        }, RING_DURATION_MS);
      }
    };

    const offBeat = bus.on('onScoreBeat', ({ beat }) => {
      if (beat.kind === 'cast-swell') {
        // New hand — clear any in-flight visual state to avoid stale
        // floaters / pulses bleeding in from a previous sequence.
        setPulsing({});
        setRings([]);
        floaterStaggerRef.current = 0;
        return;
      }
      if (beat.kind !== 'upgrade-chip' && beat.kind !== 'upgrade-mult') return;
      const sourceType = beat.sourceType;
      const sourceId = beat.sourceId;
      if (!sourceId) return;
      if (sourceType === 'catalyst') {
        if (!catalysts.includes(sourceId)) return;
        triggerCatalystVisual(sourceId);
      } else if (sourceType === 'resonance') {
        const pair = lookupResonance(sourceId);
        if (!pair) return;
        const halves = [pair.a, pair.b].filter((cId) => catalysts.includes(cId));
        for (const half of halves) {
          setPulsing((s) => ({ ...s, [half]: 'fire-legendary' }));
          track(() => {
            setPulsing((s) => ({ ...s, [half]: undefined }));
          }, PULSE_DURATION_LEGENDARY_MS);
          if (!tight) {
            const ringKey = ++ringKeyRef.current;
            setRings((rs) => [...rs, { key: ringKey, catalystId: half, color: RESONANCE_RING_COLOR }]);
            track(() => {
              setRings((rs) => rs.filter((r) => r.key !== ringKey));
            }, RING_DURATION_MS);
          }
        }
      }
    });

    const off = bus.on('onUpgradeTriggered', (payload: { id: string; deltaChips: number; deltaMult: number }) => {
      const id = payload.id;
      // Resonance and per-catalyst pulses moved to the onScoreBeat
      // listener above (beat-time sync with FlyToCounter floaters).
      // Per-catalyst cardFloater dropped — FlyToCounter is the single
      // floater system now, with size scaling and float-up-at-origin.
      // catalyst_bench's chain ripple stays here because it has no
      // matching per-target upgrade-chip/upgrade-mult beat to hook on.
      if (id === 'catalyst_bench') {
        const others = catalysts.filter((c) => c !== 'catalyst_bench');
        others.forEach((otherId, i) => {
          track(() => {
            setPulsing((s) => ({ ...s, [otherId]: 'chain' }));
            track(() => {
              setPulsing((s) => ({ ...s, [otherId]: undefined }));
            }, PULSE_DURATION_MS);
          }, i * CHAIN_PULSE_STEP_MS);
        });
      }
    });
    return () => {
      off();
      offBeat();
      timers.forEach(clearTimeout);
      timers.clear();
    };
    // Match the original CatalystStrip dependency array exactly: only
    // `catalysts`. `tight` is captured by closure; if the viewport
    // crosses the tight breakpoint mid-blind, the listener stays bound
    // to the old value until the catalysts set next changes (e.g.
    // shop purchase). Behavior-preserving with the pre-refactor file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalysts]);

  return { pulsing, floaters, rings };
}

// Re-exported timing constants so consumers (CatalystCard) can read
// the same values for their CSS animation strings without
// re-declaring them.
export const CATALYST_ANIM = {
  PULSE_DURATION_MS,
  PULSE_DURATION_LEGENDARY_MS,
  PULSE_DURATION_SCALING_MS,
  PULSE_DURATION_COLLISION_MS,
  FLOATER_DURATION_MS,
  RING_DURATION_MS,
} as const;
