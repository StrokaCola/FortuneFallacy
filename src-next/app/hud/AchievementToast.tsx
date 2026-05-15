// Celebration popup for UNLOCK_ACHIEVEMENT events. Migrated to the
// central toast queue 2026-05-14 — the bespoke internal "drain one
// at a time" queue here became redundant once the central queue
// took over MAX_VISIBLE + throttle.
//
// Multiple unlocks within the same predicate sweep ("First Win" +
// "Spark Cleared" on the same hand) used to queue internally; now
// they queue through the central system, which still serialises them
// (priority='high' + the global throttle keeps them readable).

import { useEffect, useRef } from 'react';
import { bus } from '../../events/bus';
import { lookupAchievement } from '../../data/achievements';
import { sfxPlay } from '../../audio/sfx';
import { pushToast } from './toastQueue';

const SHOW_MS = 4000;

type AchievementData = {
  achievementId: string;
  name: string;
  dust: number;
};

function renderAchievement({ name, dust }: AchievementData) {
  return (
    <div
      className="mat-crystal"
      style={{
        position: 'relative',
        padding: '10px 22px', borderRadius: 12,
        border: '1px solid rgba(245,196,81,0.5)',
        boxShadow: '0 0 24px rgba(245,196,81,0.35), 0 8px 24px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        minWidth: 240,
        overflow: 'hidden',
      }}
    >
      {/* "Constellation lit" backdrop — 5 small stars connected by
          thin gold lines, light up briefly behind the toast text.
          The whole graphic fades in on mount via the toast's own
          enter animation, then settles. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 240 80"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.45,
          pointerEvents: 'none',
        }}
      >
        <polyline
          points="32,46 68,18 108,38 162,22 210,48"
          fill="none"
          stroke="rgba(245,196,81,0.55)"
          strokeWidth={0.8}
          strokeDasharray="2 3"
        />
        {[
          { x: 32, y: 46, r: 1.6 },
          { x: 68, y: 18, r: 1.8 },
          { x: 108, y: 38, r: 2.2 },
          { x: 162, y: 22, r: 1.7 },
          { x: 210, y: 48, r: 1.5 },
        ].map((s, i) => (
          <circle
            key={i}
            cx={s.x} cy={s.y} r={s.r}
            fill="#ffd97a"
            style={{ filter: 'drop-shadow(0 0 4px rgba(245,196,81,0.7))' }}
          />
        ))}
      </svg>
      <div className="f-mono uc" style={{
        fontSize: 9, letterSpacing: '0.4em',
        color: '#f5c451',
        textShadow: '0 0 12px rgba(245,196,81,0.6)',
        position: 'relative', zIndex: 1,
      }}>
        ★ ascension unlocked
      </div>
      <div className="f-display" style={{
        fontSize: 16, color: '#f3f0ff', letterSpacing: '0.04em',
        position: 'relative', zIndex: 1,
      }}>
        {name}
      </div>
      <div className="f-mono" style={{
        fontSize: 10, color: '#cc88ff', letterSpacing: '0.18em',
        position: 'relative', zIndex: 1,
      }}>
        +{dust} cosmic dust
      </div>
    </div>
  );
}

export function AchievementToast() {
  // Per-unlock SFX handles — chime on enqueue + a delayed swell so the
  // sound feels like a layered fanfare even when the visual is
  // throttled by the central queue.
  const sfxTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const off = bus.on('onAchievementUnlocked', (payload) => {
      const def = lookupAchievement(payload.achievementId);
      if (!def) return;
      sfxPlay('comboChime', { gain: 1.1 });
      const t = setTimeout(() => {
        sfxPlay('castSwell', { gain: 0.6 });
        sfxTimersRef.current.delete(t);
      }, 60);
      sfxTimersRef.current.add(t);
      pushToast<AchievementData>({
        id: `achievement-${payload.achievementId}-${Date.now()}`,
        // High priority — achievements are the loudest celebratory
        // beat in the game; they should preempt shard pills + arrival
        // notifications that share the queue.
        priority: 'high',
        durationMs: SHOW_MS,
        data: {
          achievementId: payload.achievementId,
          name: payload.name,
          dust: payload.dust,
        },
        render: renderAchievement,
      });
    });
    return () => {
      off();
      sfxTimersRef.current.forEach(clearTimeout);
      sfxTimersRef.current.clear();
    };
  }, []);

  return null;
}
