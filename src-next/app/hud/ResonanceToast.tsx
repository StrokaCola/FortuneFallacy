// ResonanceToast (Pillar E) — fires when an owned catalyst resonance
// pair triggers during scoring. Two flavors:
//
//   • Every fire: subtle "✦ {Pair Name}" toast under the TopBar. A
//     small whisper that the synergy hit. Self-dismisses in ~1.6s.
//   • First-ever discovery (pair not in meta.discovered.resonances at
//     the time of the event): big celebration with "RESONANCE DISCOVERED"
//     prefix + flavor line + slow ✦ flash. 3.4s dwell.
//
// The discovery flag is computed at event time against the CURRENT
// store snapshot, so the discoveryBridge's setStateRaw race-condition
// doesn't matter — both listeners read from store.getState() and the
// first one to read wins the discovery beat. Subsequent fires within
// the same hand for the same pair are deduped via a per-session
// shownThisHandRef.

import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import { lookupResonance } from '../../data/resonances';
import { store } from '../../state/store';
import { Z } from './zLayers';
import { sfxPlay } from '../../audio/sfx';
import { playHaptic } from '../haptics/haptics';

const FIRE_MS = 1600;
const DISCOVERY_MS = 3400;

type Toast = {
  key: number;
  pairId: string;
  name: string;
  flavor: string;
  isDiscovery: boolean;
};

export function ResonanceToast() {
  const [active, setActive] = useState<Toast | null>(null);
  const keyRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      // this pair at the time the event fired. discoveryBridge writes the
      // id after we run; we read state RIGHT NOW so we get the pre-write
      // view. If the bridge ran first, this returns false → degrades
      // gracefully to the live-fire toast.
      const discovered = store.getState().meta.discovered.resonances ?? [];
      const isDiscovery = !discovered.includes(pairId);
      const entry: Toast = {
        key: ++keyRef.current,
        pairId,
        name: pair.name,
        flavor: pair.flavor,
        isDiscovery,
      };
      setActive(entry);
      // SFX layer: discoveries get the full chime; everyday fires get a
      // softer tick so the audio doesn't crowd the scoring beats.
      if (isDiscovery) {
        sfxPlay('whisperChime', { idx: 3 });
        playHaptic('clear');
      } else {
        sfxPlay('comboChime', { gain: 0.65 });
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(
        () => setActive(null),
        isDiscovery ? DISCOVERY_MS : FIRE_MS,
      );
    });
    // Clear per-hand dedupe on every SCORE_HAND so the next hand's
    // fires don't get suppressed.
    const offScore = bus.on('onScoreCalculated', () => {
      shownThisHandRef.current.clear();
    });
    return () => {
      offFire();
      offScore();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!active) return null;
  const accent = active.isDiscovery ? '#f5c451' : '#7be3ff';

  return (
    <div
      onClick={() => setActive(null)}
      className="mat-crystal"
      style={{
        position: 'absolute',
        // Slot ABOVE WhisperToast and BELOW AchievementToast so the three
        // can stack without overlap when a flurry of events lands.
        top: 'calc(var(--hud-top-h, 134px) + 48px)',
        right: '50%',
        transform: 'translate(50%, 0)',
        padding: active.isDiscovery ? '10px 20px' : '6px 14px',
        borderRadius: 10,
        zIndex: Z.bannerArrival,
        cursor: 'pointer',
        pointerEvents: 'auto',
        border: `1px solid ${accent}88`,
        boxShadow: `0 0 18px ${accent}55, 0 6px 16px rgba(0,0,0,0.35)`,
        animation: 'whisper-toast-in 380ms cubic-bezier(0.2, 1.0, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        minWidth: active.isDiscovery ? 220 : 160,
        overflow: 'hidden',
      }}
    >
      {active.isDiscovery && (
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
        {active.isDiscovery ? '✦ resonance discovered ✦' : 'resonance'}
      </div>
      <div className="f-display" style={{
        position: 'relative', zIndex: 1,
        fontSize: active.isDiscovery ? 16 : 13,
        color: '#f3f0ff',
        letterSpacing: '0.05em',
      }}>
        {active.name}
      </div>
      {active.isDiscovery && (
        <div style={{
          position: 'relative', zIndex: 1,
          fontFamily: '"Exo 2", sans-serif',
          fontSize: 11, color: '#bba8ff',
          fontStyle: 'italic',
          textAlign: 'center',
          maxWidth: 240,
        }}>
          "{active.flavor}"
        </div>
      )}
    </div>
  );
}
