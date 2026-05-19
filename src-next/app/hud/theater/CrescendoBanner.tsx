// Wave T Scoring Theater (Batch K, 2026-05-19) — sustained-phase
// crescendo banner. Pulses "ESCALATING ×N" at the top of the play
// area when the theater enters `sustained` phase AND peak mult is
// already at ×4 or higher. Live-updates `N` as mult-slams / upgrade-
// mult beats continue stacking. Dismissed on `release` (boom/bail).
//
// Banner is intentionally non-blocking — it sits above the dice
// at the very top edge so the player reads "tension is building"
// without losing sight of the dice or score counter.

import { useEffect, useState } from 'react';
import { bus } from '../../../events/bus';
import { Z } from '../zLayers';

const MIN_MULT_TO_SHOW = 4;

const TIER_COLOR = ['#7be3ff', '#ff9d4a', '#cc88ff', '#f5c451', '#e2334a'];
function tierColor(mult: number): string {
  if (mult >= 16) return TIER_COLOR[4]!;
  if (mult >= 8) return TIER_COLOR[3]!;
  if (mult >= 4) return TIER_COLOR[2]!;
  if (mult >= 2) return TIER_COLOR[1]!;
  return TIER_COLOR[0]!;
}

export function CrescendoBanner() {
  const [active, setActive] = useState(false);
  const [peakMult, setPeakMult] = useState(1);

  useEffect(() => {
    const offPhase = bus.on('onTheaterPhase', ({ phase, peakMult: pm }) => {
      const m = pm ?? 1;
      if (phase === 'sustained') {
        if (m >= MIN_MULT_TO_SHOW) {
          setActive(true);
          setPeakMult(m);
        }
      } else if (phase === 'release') {
        setActive(false);
      } else if (phase === 'ramping') {
        setActive(false);
        setPeakMult(1);
      } else if (phase === 'held-breath') {
        // Keep banner visible through held-breath so the tension
        // reads as building toward boom; release will clear.
      }
    });
    // Track live mult escalation independent of phase events so the
    // displayed N updates beat-by-beat once the banner is up.
    const offBeat = bus.on('onScoreBeat', ({ beat }) => {
      if (beat.kind === 'upgrade-mult' && beat.currentMult > 1) {
        setPeakMult((cur) => Math.max(cur, beat.currentMult));
      } else if (beat.kind === 'mult-slam') {
        setPeakMult((cur) => Math.max(cur, beat.multiplier));
      }
    });
    return () => { offPhase(); offBeat(); };
  }, []);

  if (!active) return null;
  const color = tierColor(peakMult);
  const displayMult = peakMult >= 100 ? peakMult.toFixed(0) : peakMult.toFixed(peakMult >= 10 ? 0 : 1);
  return (
    <div
      aria-hidden
      className="theater-crescendo-banner"
      style={{
        position: 'absolute',
        left: '50%',
        top: 'calc(var(--hud-top-h, 96px) + 12px)',
        transform: 'translateX(-50%)',
        zIndex: Z.bannerBoss - 2,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <div className="f-mono uc" style={{
        fontSize: 9, letterSpacing: '0.5em',
        color,
        textShadow: `0 0 12px ${color}cc`,
      }}>
        ◇ escalating ◇
      </div>
      <div className="f-display" style={{
        fontSize: 'clamp(20px, 4vw, 32px)',
        color: '#f3f0ff',
        letterSpacing: '0.18em',
        textShadow: `0 0 24px ${color}aa, 0 0 6px ${color}`,
        fontWeight: 900,
      }}>
        ×{displayMult}
      </div>
    </div>
  );
}
