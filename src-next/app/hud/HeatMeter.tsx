// Persistent combo-streak heat meter. Shows the current run.comboStreak
// as a row of small chevron segments so the player can SEE the chain
// building before the HotStreakBanner fires at 3+. Hidden when streak
// is 0 so the HUD stays clean during exploratory hands.
//
// Pairs with HotStreakBanner (transient 3-in-a-row celebration) — this
// is the ambient counter that backstops the banner. Once the banner
// fires the meter stays lit so the player sees they're still in the
// streak window, then dims back as the streak breaks.

import { useStore, type GameState } from '../../state/store';
import { Z } from './zLayers';
import { useIsTightStage } from '../hooks/useIsCompactStage';

const SEGMENTS = 3;

const selectComboStreak = (s: GameState) => s.run.comboStreak ?? 0;
const selectActive = (s: GameState) => s.round.active;

export function HeatMeter() {
  const streak = useStore(selectComboStreak);
  const active = useStore(selectActive);
  // `tight` is no longer used now that the meter centers horizontally
  // — kept the import so a future per-viewport tweak (e.g. compact
  // segments on phone) has the hook already wired.
  useIsTightStage();

  // Hide entirely when no streak running — the meter would otherwise
  // sit as visual debris on the very first hand of a blind.
  if (!active || streak <= 0) return null;

  const hot = streak >= SEGMENTS;
  // Lit segment count caps at SEGMENTS so the visual top end is "all
  // filled + pulsing"; longer streaks (4, 5, ...) keep the pulse but
  // the bar can't grow further. The label below carries the raw count.
  const litCount = Math.min(SEGMENTS, streak);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        // 2026-05-16 fix — the meter previously sat at left:18 directly
        // over the CatalystStrip's first card column (overlap reported
        // in playtest). Moved to top-CENTER between TopBar and the
        // dice canvas so it doesn't compete with either side rail.
        top: 'calc(var(--hud-top-h, 134px) + 6px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: Z.hud,
        pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        opacity: 0.92,
      }}
    >
      <div className="f-mono uc" style={{
        fontSize: 8, letterSpacing: '0.32em',
        color: hot ? '#ff4d6d' : '#bba8ff',
        textShadow: hot ? '0 0 8px rgba(255,77,109,0.7)' : undefined,
      }}>
        {hot ? '◇ hot streak ◇' : '◇ streak'}
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const lit = i < litCount;
          const color = hot ? '#ff4d6d' : i === 0 ? '#7be3ff' : i === 1 ? '#f5c451' : '#ff7847';
          return (
            <div
              key={i}
              className={lit && hot ? 'heat-seg heat-seg-hot' : 'heat-seg'}
              style={{
                width: 18, height: 6,
                borderRadius: 2,
                background: lit ? color : 'rgba(149,119,255,0.15)',
                border: `1px solid ${lit ? color : 'rgba(149,119,255,0.35)'}`,
                boxShadow: lit
                  ? `0 0 6px ${color}aa, 0 0 14px ${color}55`
                  : 'none',
                transition: 'background 200ms, border-color 200ms, box-shadow 200ms',
              }}
            />
          );
        })}
      </div>
      {/* Raw count label only shown when the streak has grown past the
          visible bar — communicates "you're way over the floor" without
          asking the bar to grow. */}
      {streak > SEGMENTS && (
        <div className="f-mono" style={{
          fontSize: 10, fontWeight: 800,
          color: '#ff4d6d',
          textShadow: '0 0 8px rgba(255,77,109,0.7)',
          letterSpacing: '0.06em',
        }}>
          ×{streak}
        </div>
      )}
    </div>
  );
}
