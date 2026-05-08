// Celebration popup that fires every time the achievement listener
// dispatches UNLOCK_ACHIEVEMENT. Multiple unlocks queue up and display
// one after another so a single hand that triggers two achievements
// (e.g. "First Win" + "Spark Cleared") doesn't drop one of them.
//
// Lives at the same layer as ArrivalToast (the only other top-anchored
// celebration toast). Auto-dismisses after 4s; clickable to skip.

import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import { lookupAchievement } from '../../data/achievements';
import { Z } from './zLayers';
import { sfxPlay } from '../../audio/sfx';

const SHOW_MS = 4000;
const STAGGER_MS = 250;

type ToastEntry = {
  key: number;
  achievementId: string;
  name: string;
  dust: number;
};

export function AchievementToast() {
  const [queue, setQueue] = useState<ToastEntry[]>([]);
  const [active, setActive] = useState<ToastEntry | null>(null);
  const keyRef = useRef(0);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Subscribe to unlock events; enqueue a toast for each. The queue
  // drains itself via the active-state effect below — we intentionally
  // never display two toasts simultaneously, even when several
  // achievements unlock from the same predicate sweep.
  useEffect(() => {
    const off = bus.on('onAchievementUnlocked', (payload) => {
      const def = lookupAchievement(payload.achievementId);
      if (!def) return;
      const entry: ToastEntry = {
        key: ++keyRef.current,
        achievementId: payload.achievementId,
        name: payload.name,
        dust: payload.dust,
      };
      setQueue((q) => [...q, entry]);
    });
    return () => {
      off();
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();
    };
  }, []);

  // Drain the queue when the active slot is empty.
  useEffect(() => {
    if (active || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setActive(next!);
    sfxPlay('comboChime', { gain: 1.1 });
    const t1 = setTimeout(() => sfxPlay('castSwell', { gain: 0.6 }), 60);
    timersRef.current.add(t1);
    const t2 = setTimeout(() => {
      setActive(null);
      timersRef.current.delete(t2);
    }, SHOW_MS);
    timersRef.current.add(t2);
    return () => {
      clearTimeout(t1);
      timersRef.current.delete(t1);
    };
  }, [active, queue]);

  if (!active) return null;

  return (
    <div
      onClick={() => setActive(null)}
      className="mat-crystal"
      style={{
        position: 'absolute',
        top: 'calc(var(--hud-top-h, 134px) + 18px)',
        right: '50%',
        transform: 'translate(50%, 0)',
        padding: '10px 22px', borderRadius: 12,
        zIndex: Z.bannerArrival,
        cursor: 'pointer', pointerEvents: 'auto',
        border: '1px solid rgba(245,196,81,0.5)',
        boxShadow: '0 0 24px rgba(245,196,81,0.35), 0 8px 24px rgba(0,0,0,0.4)',
        // Slide-down + scale-in from the top edge. Reduce-motion users
        // get the snap state via the .reduce-motion override below.
        animation: `achievement-toast-in 480ms cubic-bezier(0.2, 1.2, 0.4, 1) ${STAGGER_MS}ms both`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        minWidth: 240,
      }}
    >
      <div className="f-mono uc" style={{
        fontSize: 9, letterSpacing: '0.4em',
        color: '#f5c451',
        textShadow: '0 0 12px rgba(245,196,81,0.6)',
      }}>
        ★ ascension unlocked
      </div>
      <div className="f-display" style={{
        fontSize: 16, color: '#f3f0ff', letterSpacing: '0.04em',
      }}>
        {active.name}
      </div>
      <div className="f-mono" style={{
        fontSize: 10, color: '#cc88ff', letterSpacing: '0.18em',
      }}>
        +{active.dust} cosmic dust
      </div>
    </div>
  );
}
