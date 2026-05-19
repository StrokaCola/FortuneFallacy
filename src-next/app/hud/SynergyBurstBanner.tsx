// Wave T (Batch E) — Synergy Burst banner. Counts distinct resonance
// pair fires per hand via onUpgradeTriggered (resonance: prefix). On
// onScoreCalculated (hand-end trigger), if 3+ distinct pairs fired,
// emits onSynergyBurst and renders a brief celebration banner +
// triumphant chord. The 3-pair threshold is the Balatro-style "your
// engine just sang" moment — a hand where the player's catalysts
// genuinely combined.

import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import { sfxPlay } from '../../audio/sfx';
import { Z } from './zLayers';

const HOLD_MS = 1800;
const MIN_PAIRS_FOR_BURST = 3;

type Banner = { id: number; pairCount: number };

export function SynergyBurstBanner() {
  const firedThisHandRef = useRef<Set<string>>(new Set());
  const [banner, setBanner] = useState<Banner | null>(null);
  const bannerIdRef = useRef(0);

  useEffect(() => {
    const off1 = bus.on('onUpgradeTriggered', ({ id }: { id: string }) => {
      const PREFIX = 'resonance:';
      if (!id.startsWith(PREFIX)) return;
      firedThisHandRef.current.add(id.slice(PREFIX.length));
    });
    const off2 = bus.on('onScoreCalculated', () => {
      const ids = [...firedThisHandRef.current];
      firedThisHandRef.current.clear();
      if (ids.length < MIN_PAIRS_FOR_BURST) return;
      const pairCount = ids.length;
      bus.emit('onSynergyBurst', { pairCount, resonanceIds: ids });
      const id = ++bannerIdRef.current;
      setBanner({ id, pairCount });
      // Triumphant chord — ascending pentatonic via three staggered
      // comboChimes at increasing pitch. audioBridge could subscribe
      // separately, but the chord pairs so tightly with this banner's
      // appearance that emitting it from the same effect keeps timing
      // perfect.
      sfxPlay('comboChime', { gain: 0.7 });
      window.setTimeout(() => sfxPlay('comboChime', { gain: 0.75, idx: 1 }), 120);
      window.setTimeout(() => sfxPlay('comboChime', { gain: 0.85, idx: 2 }), 240);
      window.setTimeout(() => {
        setBanner((cur) => (cur && cur.id === id ? null : cur));
      }, HOLD_MS);
    });
    return () => { off1(); off2(); };
  }, []);

  if (!banner) return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: '50%', top: '30%',
        transform: 'translate(-50%, -50%)',
        zIndex: Z.bannerBoss,
        pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        animation: `hot-streak-in 320ms cubic-bezier(0.2, 1.2, 0.4, 1) both, hot-streak-out 520ms ease-in ${HOLD_MS - 520}ms both`,
      }}
    >
      <div className="f-mono uc" style={{
        fontSize: 10, letterSpacing: '0.5em',
        color: '#cc88ff',
        textShadow: '0 0 14px rgba(204, 136, 255, 0.85)',
      }}>
        ◇ synergy burst ◇
      </div>
      <div className="f-display" style={{
        fontSize: 'clamp(22px, 5vw, 36px)',
        color: '#f3f0ff',
        letterSpacing: '0.16em',
        textShadow: '0 0 28px rgba(204, 136, 255, 0.55), 0 0 10px rgba(204, 136, 255, 0.9)',
        fontWeight: 900,
      }}>
        {banner.pairCount} RESONANCES FIRED
      </div>
    </div>
  );
}
