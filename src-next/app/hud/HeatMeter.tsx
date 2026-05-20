// Persistent combo-streak heat meter. Shows the current run.comboStreak
// as a row of small chevron segments so the player can SEE the chain
// building before the HotStreakBanner fires at 3+. Hidden when streak
// is 0 so the HUD stays clean during exploratory hands.
//
// Pairs with HotStreakBanner (transient 3-in-a-row celebration) — this
// is the ambient counter that backstops the banner. Once the banner
// fires the meter stays lit so the player sees they're still in the
// streak window, then dims back as the streak breaks.

import { useEffect, useState } from 'react';
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
  // Anchor the meter horizontally to the TopBar's middle panel
  // (ante / blind name) instead of viewport center. The TopBar's
  // flex layout has asymmetric side panels (Score panel wider than
  // Treasury chip), so viewport center sits ~16px right of the
  // middle panel's optical center. Without this, the meter looks
  // off-axis from the FINAL TRIAL / ante label above it — which
  // playtest flagged. Measured on mount + window resize.
  const [centerX, setCenterX] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const measure = () => {
      // The TopBar's middle panel carries the ante / blind label
      // ("ante 01 · final trial"). We identify it via a stable text
      // match because the panel itself has no semantic id and its
      // className varies across screens (Tailwind utility classes
      // are inconsistent between Round, Hub, etc).
      const divs = document.querySelectorAll('div.f-mono.uc');
      let anchor: Element | null = null;
      for (const d of divs) {
        const txt = (d.textContent || '').toLowerCase().trim();
        // Match the "ante NN · {blind name}" pattern — short string,
        // contains "ante " at the start, and either "trial" or "blind".
        if (txt.length < 60 && txt.startsWith('ante ') && (txt.includes('trial') || txt.includes('blind'))) {
          anchor = d;
          break;
        }
      }
      if (!anchor) {
        // Fallback to viewport center when the TopBar hasn't rendered
        // yet (first paint of the round). Re-measures on next interval.
        setCenterX(window.innerWidth / 2);
        return;
      }
      const r = anchor.getBoundingClientRect();
      setCenterX(r.left + r.width / 2);
    };
    measure();
    window.addEventListener('resize', measure);
    // TopBar's panel width also changes when --hud-top-h re-reports
    // (TopBar wraps onto two rows at narrow widths). Poll on a slow
    // interval so the meter follows that transition without wiring a
    // ResizeObserver in this component.
    const interval = window.setInterval(measure, 800);
    return () => {
      window.removeEventListener('resize', measure);
      window.clearInterval(interval);
    };
  }, [active]);

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
      // 2026-05-16 — `has-tip` enables the explanatory tooltip below.
      // Dropped the aria-hidden so screen readers + keyboard focus
      // can surface the tip text.
      className="has-tip"
      style={{
        position: 'absolute',
        // 2026-05-16 fix — the meter previously sat at left:18 directly
        // over the CatalystStrip's first card column (overlap reported
        // in playtest). Moved to top-CENTER between TopBar and the
        // dice canvas so it doesn't compete with either side rail.
        // 2026-05-16 follow-up — anchor horizontally to the TopBar's
        // middle panel's optical center (measured in useEffect above),
        // not viewport center. The TopBar's outer panels are asymmetric
        // so viewport-center reads as off-axis with the blind label
        // above. Falls back to 50% on first paint before measure runs.
        top: 'calc(var(--hud-top-h, 134px) + 6px)',
        left: centerX != null ? `${centerX}px` : '50%',
        transform: 'translateX(-50%)',
        zIndex: Z.hud,
        // `pointerEvents: auto` lets hover fire so the tooltip surfaces.
        // The inner segments still don't intercept clicks (no buttons),
        // so this doesn't compete with the dice canvas for input.
        pointerEvents: 'auto',
        cursor: 'help',
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
      {/* Tooltip body — surfaces what the meter actually measures so a
          new player isn't left guessing. Uses the shared `.tip` styling
          (cosmos panel + Cinzel title + Exo 2 body) already wired in
          styles/index.css. Anchored below the meter since the meter
          itself sits directly under TopBar; tip-above would clip into
          the score panel. */}
      <span className="tip">
        <span className="tip-title">Hot Streak</span>
        Land the same combo back-to-back (Pair after Pair, Three of a Kind after Three of a Kind, etc) to build the streak.
        <span style={{ display: 'block', marginTop: 6, color: '#ff4d6d' }}>
          Each step lights another segment. Three lit = full heat. The bar pulses while you're hot — break the chain and it dims.
        </span>
        <span style={{ display: 'block', marginTop: 6, color: '#bba8ff', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>
          ◇ Quorum catalyst doubles down on this — same combo twice in a row → pips ×1.5, three in a row → mult ×1.5 too.
        </span>
      </span>
    </div>
  );
}
