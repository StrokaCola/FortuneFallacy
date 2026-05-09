// "🔥 HOT STREAK" celebration banner — fires once per blind when the
// player chains three consecutive hands above the per-hand-share
// threshold. Self-dismissing after 3.5s. Stays visually distinct from
// the legendary fanfare (gold) and the achievement toast (orange-gold)
// by using ember-red and an outward shockwave.

import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { Z } from './zLayers';
import { sfxPlay } from '../../audio/sfx';
import { playHaptic } from '../haptics/haptics';

const SHOW_MS = 3500;

export function HotStreakBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const off = bus.on('onHotStreak', () => {
      setShow(true);
      // Sting layer that doesn't clash with the score sequence's own
      // boom — multSlam is sharp enough to mark the moment without
      // pulling focus from the running scoring beats.
      sfxPlay('multSlam', { freq: 660, gain: 1.1 });
      window.setTimeout(() => sfxPlay('comboChime', { gain: 0.9 }), 120);
      playHaptic('clear');
      window.setTimeout(() => setShow(false), SHOW_MS);
    });
    return () => off();
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden
      className="hot-streak-banner"
      style={{
        position: 'absolute',
        top: '38%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: Z.bannerBoss,
        pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        animation: `hot-streak-in 380ms cubic-bezier(0.2, 1.2, 0.4, 1) both, hot-streak-out 600ms ease-in ${SHOW_MS - 600}ms both`,
      }}
    >
      <div className="f-mono uc" style={{
        fontSize: 11, letterSpacing: '0.5em',
        color: '#ff7847',
        textShadow: '0 0 14px rgba(255,120,71,0.85)',
      }}>
        ◇ three in a row ◇
      </div>
      <div className="f-display" style={{
        fontSize: 'clamp(36px, 8vw, 64px)',
        color: '#ff4d6d',
        letterSpacing: '0.18em',
        textShadow: '0 0 30px rgba(255,77,109,0.95), 0 0 60px rgba(245,196,81,0.45)',
        fontWeight: 900,
      }}>
        HOT STREAK
      </div>
      <div className="f-mono uc" style={{
        fontSize: 10, letterSpacing: '0.34em', color: '#f5c451',
      }}>
        the table is yours
      </div>
    </div>
  );
}
