// Pre-score combo announcement — fires the instant the pipeline detects
// a strong hand and SLAMS a center-screen banner before the scoring
// sequence's beats start running. Skips low-tier hands (chance / one
// pair / two pair) which fire constantly and would just be noise; only
// tier-4+ (small-straight onward) get the cinematic pre-roll.
//
// The banner sits at center for 600ms then fades out. The score
// sequence's cast-swell + first die-ticks happen during this window —
// that's intentional, the banner is the "the universe sees what you
// did" beat that opens the curtain on the scoring crescendo.

import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { COMBOS } from '../../core/scoring/combos';
import { sfxPlay } from '../../audio/sfx';
import { triggerShake } from '../visual/screenShake';
import { Z } from './zLayers';

const HOLD_MS = 700;
const ANNOUNCE_TIER_FLOOR = 4; // small_straight and up

const ANNOUNCE_FLAVOR: Record<string, string> = {
  five_kind: 'five aligned',
  four_kind: 'four aligned',
  lg_straight: 'a clean line',
  full_house: 'three plus two',
  three_kind: 'three aligned',
  sm_straight: 'four in sequence',
};

type Banner = { key: number; comboId: string; comboName: string };
let bannerKey = 1;

export function PatternDetectedBanner() {
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    const off = bus.on('onComboDetected', ({ combo, tier }) => {
      if (tier < ANNOUNCE_TIER_FLOOR) return;
      const def = COMBOS.find((c) => c.id === combo);
      if (!def) return;
      const next: Banner = { key: bannerKey++, comboId: combo, comboName: def.name };
      setBanner(next);
      // Punctuate the appearance — sigilDraw is the "something arrives"
      // motif we already use for boss reveal stings; perfect for this.
      sfxPlay('sigilDraw', { gain: 0.85 });
      // High-tier (apex) hands rattle the cabinet on announce; mid-tier
      // (small straight, three-of-a-kind) are clean text only.
      if (tier >= 6) triggerShake('mid');
      window.setTimeout(() => {
        setBanner((cur) => (cur?.key === next.key ? null : cur));
      }, HOLD_MS);
    });
    return off;
  }, []);

  if (!banner) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: Z.bannerArrival,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div className="pattern-detected-banner" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        <div className="f-mono uc" style={{
          fontSize: 10, letterSpacing: '0.6em',
          color: '#f5c451',
          textShadow: '0 0 16px rgba(245,196,81,0.85)',
        }}>
          ★ pattern detected ★
        </div>
        <div className="f-display" style={{
          fontSize: 'clamp(36px, 7vw, 56px)',
          color: '#f3f0ff',
          letterSpacing: '0.1em',
          textShadow: '0 0 30px rgba(123,227,255,0.85), 0 0 60px rgba(245,196,81,0.4)',
          fontWeight: 900,
        }}>
          {banner.comboName.toUpperCase()}
        </div>
        {ANNOUNCE_FLAVOR[banner.comboId] && (
          <div className="f-mono uc" style={{
            fontSize: 10, letterSpacing: '0.32em',
            color: '#7be3ff',
            opacity: 0.85, fontStyle: 'italic',
          }}>
            {ANNOUNCE_FLAVOR[banner.comboId]}
          </div>
        )}
      </div>
    </div>
  );
}
