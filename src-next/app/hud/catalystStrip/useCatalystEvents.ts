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

    const off = bus.on('onUpgradeTriggered', (payload: { id: string; deltaChips: number; deltaMult: number }) => {
      const id = payload.id;

      // Resonance: a hand-authored pair fired. Pulse BOTH halves with the
      // legendary fire animation so the player sees the link visually,
      // and float a single resonance label off the FIRST owned catalyst
      // card (we don't double the floater — the player just saw "+5 mult"
      // once, attributed to the named pair).
      const resonanceId = resonanceIdFromEvent(id);
      if (resonanceId) {
        const pair = lookupResonance(resonanceId);
        if (!pair) return;
        const halves = [pair.a, pair.b].filter((cId) => catalysts.includes(cId));
        for (const half of halves) {
          setPulsing((s) => ({ ...s, [half]: 'fire-legendary' }));
          track(() => {
            setPulsing((s) => ({ ...s, [half]: undefined }));
          }, PULSE_DURATION_LEGENDARY_MS);
          // Same tight-mode ring suppression as below — keeps the
          // legendary pulse + named-beat floater, drops the rings.
          if (!tight) {
            const ringKey = ++ringKeyRef.current;
            setRings((rs) => [...rs, { key: ringKey, catalystId: half, color: RESONANCE_RING_COLOR }]);
            track(() => {
              setRings((rs) => rs.filter((r) => r.key !== ringKey));
            }, RING_DURATION_MS);
          }
        }
        // Single floater on the first owned half — shows the named beat
        // ("Symphony +5 mult") rather than two anonymous deltas.
        if (halves[0]) {
          const dChips = payload.deltaChips ?? 0;
          const dMult = payload.deltaMult ?? 0;
          const parts: string[] = [pair.name];
          if (dChips > 0) parts.push(`+${Math.round(dChips)}`);
          if (dMult > 0) parts.push(`+${(Math.round(dMult * 10) / 10).toString().replace(/\.0$/, '')} mult`);
          const floaterKey = ++floaterKeyRef.current;
          const launchAt = tight ? Math.max(performance.now(), floaterStaggerRef.current) : performance.now();
          const delay = launchAt - performance.now();
          if (tight) floaterStaggerRef.current = launchAt + FLOATER_STAGGER_MS;
          const launch = () => {
            setFloaters((fs) => [...fs, {
              key: floaterKey,
              catalystId: halves[0]!,
              text: parts.join(' · '),
              tone: 'mult',
            }]);
            track(() => {
              setFloaters((fs) => fs.filter((f) => f.key !== floaterKey));
            }, FLOATER_DURATION_MS);
          };
          if (delay > 0) track(launch, delay);
          else launch();
        }
        return;
      }

      // catalyst_bench is special: it ripples through every OTHER owned
      // catalyst with a chain pulse, so its fire payload itself stays
      // attributed to the bench card.
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
        return;
      }

      const catalystId = catalystIdFromEvent(id);
      if (!catalystId || !catalysts.includes(catalystId)) return;

      const meta = lookupCatalyst(catalystId);
      const isLegendary = meta?.rarity === 'legendary';
      const isScaling = SCALING_CATALYST_IDS.has(catalystId);
      const isCollision = COLLISION_CATALYST_IDS.has(catalystId);
      // Priority: legendary > scaling > collision > regular fire.
      // Legendary catalysts that are ALSO scaling (heirloom_locket) keep
      // the legendary pulse because their rarity is the stronger signal;
      // the scaling tooltip line + corner badge already mark them as
      // scaling-class. Collision sits between scaling and regular fire —
      // it's a real visual class but rarity overrides it the same way.
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

      // Ring burst emanates from the card; lower-cost than the floater and
      // fires for every catalyst contribution (incl. edition stamps).
      // Tight viewports skip the ring entirely — the card-pulse already
      // communicates "this card fired" and the floater carries the
      // actual delta. The ring is pure redundant celebration on small
      // screens where 4+ concurrent rings stack into visual mud.
      if (!tight) {
        const ringKey = ++ringKeyRef.current;
        // Edition tints win over the rarity / kind defaults so a
        // foil/holo/poly/void catalyst's fire ring matches its
        // surface treatment. Legendary still keeps the warm coral
        // when no edition is set.
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

      // Floater — only when there's a material delta. Skips silent fires
      // (utility catalysts that mutate state without moving chips/mult)
      // so the strip doesn't spam +0 toasts.
      const dChips = payload.deltaChips ?? 0;
      const dMult = payload.deltaMult ?? 0;
      let text = '';
      let tone: 'chips' | 'mult' | 'scaling' = 'chips';
      if (dChips !== 0) {
        text = `+${Math.round(dChips)}`;
        // Scaling-catalyst chip contributions tinted emerald so the
        // accumulated bonus reads visually distinct from regular +chips.
        tone = isScaling ? 'scaling' : 'chips';
      } else if (dMult !== 0) {
        const rounded = Math.round(dMult * 10) / 10;
        text = `+${rounded.toString().replace(/\.0$/, '')} mult`;
        tone = isScaling ? 'scaling' : 'mult';
      }
      if (text) {
        const floaterKey = ++floaterKeyRef.current;
        // Tight: stagger floaters by 120ms so a chain of 4 catalyst
        // fires reads as four sequential reveals instead of four
        // overlapping +chips numbers stacking at the same Y. Wide
        // keeps the simultaneous-burst behavior (more space, clearer
        // spatial attribution per card).
        const now = performance.now();
        const launchAt = tight ? Math.max(now, floaterStaggerRef.current) : now;
        const delay = launchAt - now;
        if (tight) floaterStaggerRef.current = launchAt + FLOATER_STAGGER_MS;
        const launch = () => {
          setFloaters((fs) => [...fs, { key: floaterKey, catalystId, text, tone }]);
          track(() => {
            setFloaters((fs) => fs.filter((f) => f.key !== floaterKey));
          }, FLOATER_DURATION_MS);
        };
        if (delay > 0) track(launch, delay);
        else launch();
      }
    });
    return () => {
      off();
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
