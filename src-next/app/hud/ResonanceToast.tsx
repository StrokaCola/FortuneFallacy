// ResonanceToast (Pillar E) — fires when an owned catalyst resonance
// pair triggers during scoring. Migrated to the central toast queue
// 2026-05-14.
//
// Two flavors:
//   • Every fire: subtle "✦ {Pair Name}" toast. priority='normal',
//     1.6 s dwell. Same-key (pair-id) → re-fires within the same
//     visible window just refresh the visible duration.
//   • First-ever discovery (pair not in meta.discovered.resonances at
//     the time of the event): big celebration with "RESONANCE
//     DISCOVERED" prefix + flavor line + slow ✦ flash. 3.4 s dwell.
//     priority='high'.

import { useEffect, useRef } from 'react';
import { bus } from '../../events/bus';
import { lookupResonance } from '../../data/resonances';
import { store } from '../../state/store';
import { sfxPlay } from '../../audio/sfx';
import { playHaptic } from '../haptics/haptics';
import { pushToast } from './toastQueue';

const FIRE_MS = 1600;
const DISCOVERY_MS = 3400;

type ResonanceData = {
  pairId: string;
  name: string;
  flavor: string;
  isDiscovery: boolean;
};

function renderResonance({ name, flavor, isDiscovery }: ResonanceData) {
  const accent = isDiscovery ? '#f5c451' : '#7be3ff';
  return (
    <div
      className="mat-crystal"
      style={{
        position: 'relative',
        padding: isDiscovery ? '10px 20px' : '6px 14px',
        borderRadius: 10,
        border: `1px solid ${accent}88`,
        boxShadow: `0 0 18px ${accent}55, 0 6px 16px rgba(0,0,0,0.35)`,
        animation: 'whisper-toast-in 380ms cubic-bezier(0.2, 1.0, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        minWidth: isDiscovery ? 220 : 160,
        overflow: 'hidden',
      }}
    >
      {isDiscovery && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%', top: '50%',
            fontSize: 56,
            color: accent,
            opacity: 0,
            pointerEvents: 'none',
            textShadow: `0 0 22px ${accent}cc, 0 0 44px ${accent}80`,
            animation: 'whisper-sigil-flash 1100ms ease-out forwards',
            zIndex: 0,
          }}
        >
          ✦
        </div>
      )}
      <div className="f-mono uc" style={{
        position: 'relative', zIndex: 1,
        fontSize: 8, letterSpacing: '0.5em',
        color: accent,
        textShadow: `0 0 8px ${accent}88`,
      }}>
        {isDiscovery ? '✦ resonance discovered ✦' : 'resonance'}
      </div>
      <div className="f-display" style={{
        position: 'relative', zIndex: 1,
        fontSize: isDiscovery ? 16 : 13,
        color: '#f3f0ff',
        letterSpacing: '0.05em',
      }}>
        {name}
      </div>
      {isDiscovery && (
        <div style={{
          position: 'relative', zIndex: 1,
          fontFamily: '"Exo 2", sans-serif',
          fontSize: 11, color: '#bba8ff',
          fontStyle: 'italic',
          textAlign: 'center',
          maxWidth: 240,
        }}>
          "{flavor}"
        </div>
      )}
    </div>
  );
}

export function ResonanceToast() {
  // Per-hand dedupe: applyResonances emits once per pair per hand, so
  // this is mostly defensive against retrigger loops or HMR replays.
  const shownThisHandRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const offFire = bus.on('onUpgradeTriggered', (payload: { id: string }) => {
      const PREFIX = 'resonance:';
      if (!payload.id.startsWith(PREFIX)) return;
      const pairId = payload.id.slice(PREFIX.length);
      if (shownThisHandRef.current.has(pairId)) return;
      shownThisHandRef.current.add(pairId);
      const pair = lookupResonance(pairId);
      if (!pair) return;
      // First-ever discovery: meta.discovered.resonances did not include
      // this pair at the time the event fired. discoveryBridge writes
      // the id after we run; we read state RIGHT NOW so we get the
      // pre-write view. If the bridge ran first, this returns false →
      // degrades gracefully to the live-fire toast.
      const discovered = store.getState().meta.discovered.resonances ?? [];
      const isDiscovery = !discovered.includes(pairId);
      // SFX: discoveries get the full chime; everyday fires get a
      // softer tick so the audio doesn't crowd the scoring beats.
      if (isDiscovery) {
        sfxPlay('whisperChime', { idx: 3 });
        playHaptic('clear');
      } else {
        sfxPlay('comboChime', { gain: 0.65 });
      }
      pushToast<ResonanceData>({
        id: `resonance-${pairId}-${Date.now()}`,
        // Same-key (pair) merge: a re-fire of the same pair while the
        // visible toast is still up just refreshes the duration. The
        // merge keeps the *earlier* descriptor's data — discovery
        // wins permanently if either fire was a discovery.
        key: `resonance:${pairId}`,
        priority: isDiscovery ? 'high' : 'normal',
        durationMs: isDiscovery ? DISCOVERY_MS : FIRE_MS,
        data: { pairId, name: pair.name, flavor: pair.flavor, isDiscovery },
        render: renderResonance,
        merge: (incoming, current) => ({
          ...current,
          isDiscovery: current.isDiscovery || incoming.isDiscovery,
        }),
      });
    });
    // Clear per-hand dedupe on every SCORE_HAND so the next hand's
    // fires don't get suppressed.
    const offScore = bus.on('onScoreCalculated', () => {
      shownThisHandRef.current.clear();
    });
    return () => {
      offFire();
      offScore();
    };
  }, []);

  return null;
}
