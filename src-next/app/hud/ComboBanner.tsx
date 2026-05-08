// "Pattern detected" banner that pops above the gameplay area when a
// combo is scored. Apex variants — tier 6+ (Large Straight onward) —
// unfurl with bigger typography, a particle wreath, and a stronger
// glow so rare combos feel mythic instead of just "another label".
//
// Tier tiers:
//   0: Chance                   — minimal banner, plain text
//   1-3: One Pair → Three Kind  — base banner
//   4-5: Small Straight, Full House — base banner
//   6: Large Straight            — apex (slightly bigger + wreath)
//   7: Four of a Kind            — apex
//   8: Five of a Kind            — APEX MAX (full drama)

import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { COMBOS } from '../../core/scoring/combos';

type Banner = { combo: string; chips: number; mult: number; ts: number };

const APEX_TIER = 6;
const APEX_MAX_TIER = 8;

const COMBO_FLAVOR: Record<string, string> = {
  five_kind: 'Cygnus · all five align',
  four_kind: 'Orion · the hunter strikes',
  lg_straight: 'Lyra · a clean line through the dark',
  full_house: 'Pegasus · three plus two',
  three_kind: 'Auriga · triplet engine',
  sm_straight: 'Cassiopeia · the queen\'s arc',
  two_pair: 'Gemini · twin samples',
  one_pair: 'Vela · matched sails',
  chance: 'Wandering Star',
};

export function ComboBanner({ accent = '#7be3ff' }: { accent?: string }) {
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    const off = bus.on('onScoreCalculated', ({ combo, chips, mult }) => {
      const b: Banner = { combo, chips, mult, ts: Date.now() };
      setBanner(b);
      setTimeout(() => setBanner((cur) => (cur === b ? null : cur)), 2400);
    });
    return off;
  }, []);

  if (!banner) return null;
  const c = COMBOS.find((x) => x.id === banner.combo);
  if (!c) return null;

  const tier = c.tier;
  const isApex = tier >= APEX_TIER;
  const isApexMax = tier >= APEX_MAX_TIER;
  const flavor = COMBO_FLAVOR[c.id];

  // Progressive scaling: each apex tier above the threshold ramps up
  // the typography and glow. Tier 6 is the smallest apex; tier 8 is
  // the maximum.
  const apexLift = isApex ? Math.min(1, (tier - APEX_TIER + 1) / 3) : 0;
  const titleSize = 22 + apexLift * 18; // 22 → 40 px
  const titleGlow = isApex
    ? `0 0 ${12 + apexLift * 24}px ${accent}, 0 0 ${24 + apexLift * 36}px rgba(245,196,81,${0.25 + apexLift * 0.4})`
    : undefined;
  const apexBorder = isApex
    ? `${1 + apexLift}px solid ${isApexMax ? '#ff7847cc' : `${accent}cc`}`
    : `1px solid ${accent}88`;
  const apexShadow = isApex
    ? `0 0 ${28 + apexLift * 20}px ${accent}88, 0 0 ${56 + apexLift * 40}px rgba(255,120,71,${apexLift * 0.5}), inset 0 0 ${18 + apexLift * 12}px ${accent}30`
    : `0 0 28px ${accent}55, inset 0 0 18px ${accent}20`;

  return (
    <div style={{
      position: 'absolute', left: '50%',
      top: 'calc(var(--hud-top-h, 134px) + 12px)',
      transform: 'translateX(-50%)',
      pointerEvents: 'none', textAlign: 'center', zIndex: 4,
      animation: isApex ? 'apex-banner-in 480ms cubic-bezier(0.2, 1.4, 0.4, 1)' : 'fadein 0.25s ease-out',
    }}>
      <div className="f-mono uc" style={{
        fontSize: 9, letterSpacing: '0.4em',
        color: isApexMax ? '#f5c451' : '#bba8ff',
        marginBottom: 4,
        textShadow: isApexMax ? '0 0 8px rgba(245,196,81,0.7)' : undefined,
      }}>
        {isApexMax ? '★ APEX REACHED ★' : isApex ? '◇◇ pattern detected ◇◇' : '◇ pattern detected ◇'}
      </div>
      <div className={`panel-strong${isApex ? ' apex-banner-shimmer' : ''}`} style={{
        padding: isApex ? '14px 36px' : '10px 28px',
        display: 'inline-flex', alignItems: 'center', gap: 18,
        border: apexBorder,
        boxShadow: apexShadow,
        position: 'relative',
      }}>
        {/* Apex wreath — orbital ring of dots that draws around the
            banner on tier-6+ combos. Pure decoration, pointer-events
            disabled so it can never block input. */}
        {isApex && <ApexWreath color={isApexMax ? '#ff7847' : '#f5c451'} count={isApexMax ? 8 : 6} />}
        <span className="f-display" style={{
          fontSize: titleSize,
          color: '#f3f0ff',
          letterSpacing: isApex ? '0.06em' : undefined,
          textShadow: titleGlow,
          fontWeight: isApexMax ? 900 : undefined,
        }}>
          {c.name}
        </span>
        <span className="f-mono num" style={{ fontSize: 14, color: '#7be3ff' }}>+{banner.chips}</span>
        <span style={{ width: 1, height: 18, background: 'rgba(149,119,255,0.4)' }} />
        <span className="f-mono num" style={{ fontSize: 14, color: '#ff7847' }}>×{banner.mult}</span>
      </div>
      {isApex && flavor && (
        <div className="f-mono uc" style={{
          fontSize: 9, letterSpacing: '0.32em',
          color: isApexMax ? '#ff7847' : '#cc88ff',
          marginTop: 6, opacity: 0.85,
          fontStyle: 'italic',
        }}>
          {flavor}
        </div>
      )}
    </div>
  );
}

// Six or eight orbital glyphs traced on a dashed circle around the
// banner. Pure SVG — no animation library — so it scales cleanly with
// the banner and respects reduce-motion via CSS.
function ApexWreath({ color, count }: { color: string; count: number }) {
  return (
    <svg
      aria-hidden
      style={{
        position: 'absolute',
        inset: -16,
        pointerEvents: 'none',
        animation: 'apex-wreath-spin 8s linear infinite',
      }}
      viewBox="-100 -50 200 100"
      preserveAspectRatio="none"
    >
      {Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * Math.PI * 2;
        const cx = Math.cos(a) * 96;
        const cy = Math.sin(a) * 46;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r="2.4"
            fill={color}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
        );
      })}
    </svg>
  );
}
