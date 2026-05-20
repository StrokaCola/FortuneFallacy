// Wave T+1 (2026-05-19) bespoke theater — Move 3 — score-ratio
// milestone rituals.
//
// Listens to scoring beats; tracks the running total ÷ target ratio;
// when the ratio crosses a milestone threshold (1.5×, 2.5×, 4.0×,
// 8.0×, 16.0×), fires a unique ritual that earns the moment without
// repeating on every subsequent beat.
//
// Thresholds are RATIO-based (target-relative) not raw mult-based, so
// the rituals scale with the player's current target — a ×4 mult on
// an Ante 1 trial fires the same milestone as a ×4 mult on Ante 8.
// "You scored 250% of target" means the same thing at every stake.

import { useEffect, useRef, useState } from 'react';
import { bus } from '../../../events/bus';
import { store } from '../../../state/store';
import { Z } from '../zLayers';
import { lookupConstellation } from '../../../data/constellations';
import { sfxPlay } from '../../../audio/sfx';
import { triggerShake } from '../../visual/screenShake';

type MilestoneTier = 0 | 1 | 2 | 3 | 4 | 5;

const THRESHOLDS: Array<{ tier: MilestoneTier; minRatio: number; label: string }> = [
  { tier: 1, minRatio: 1.5,  label: '150%' },
  { tier: 2, minRatio: 2.5,  label: '250%' },
  { tier: 3, minRatio: 4.0,  label: '400%' },
  { tier: 4, minRatio: 8.0,  label: '800%' },
  { tier: 5, minRatio: 16.0, label: '1600%' },
];

function reduceMotion(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('reduce-motion');
}

type Ritual = {
  id: number;
  tier: MilestoneTier;
  accent: string;
};

let nextId = 1;

export function ScoreMilestones() {
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const highestTierRef = useRef<MilestoneTier>(0);

  useEffect(() => {
    const off = bus.on('onScoreBeat', ({ beat }) => {
      if (beat.kind === 'cast-swell') {
        highestTierRef.current = 0;
        setRituals([]);
        return;
      }
      if (!('runningTotal' in beat)) return;
      const s = store.getState();
      const target = s.round.target;
      if (target <= 0) return;
      const ratio = (s.round.score + beat.runningTotal) / target;
      // Walk thresholds from lowest to highest; fire all newly-crossed ones.
      for (const t of THRESHOLDS) {
        if (t.tier <= highestTierRef.current) continue;
        if (ratio < t.minRatio) break;
        highestTierRef.current = t.tier;
        if (reduceMotion()) continue;
        const accent = lookupConstellation(s.run.constellationId).color;
        const id = nextId++;
        setRituals((cur) => [...cur, { id, tier: t.tier, accent }]);
        // Per-tier audio cue.
        playRitualAudio(t.tier);
        // Tier 4+ also triggers a screen shake for physical weight.
        if (t.tier >= 4) {
          try { triggerShake(t.tier === 5 ? 'big' : 'mid'); } catch { /* shake offline */ }
        }
        // Auto-cleanup per tier — bigger tiers linger longer.
        const ttl = 600 + t.tier * 200;
        window.setTimeout(() => {
          setRituals((cur) => cur.filter((r) => r.id !== id));
        }, ttl);
      }
    });
    return () => off();
  }, []);

  if (rituals.length === 0) return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        zIndex: Z.bannerBoss - 3,
        overflow: 'hidden',
      }}
    >
      {rituals.map((r) => <RitualOverlay key={r.id} tier={r.tier} accent={r.accent} />)}
    </div>
  );
}

function playRitualAudio(tier: MilestoneTier): void {
  switch (tier) {
    case 1:
      sfxPlay('comboChime', { freq: 880, gain: 0.55 });
      break;
    case 2:
      sfxPlay('comboChime', { freq: 660, gain: 0.6 });
      setTimeout(() => sfxPlay('comboChime', { freq: 880, gain: 0.5 }), 90);
      break;
    case 3:
      sfxPlay('comboChime', { freq: 587, gain: 0.7 });
      setTimeout(() => sfxPlay('comboChime', { freq: 880, gain: 0.55 }), 100);
      setTimeout(() => sfxPlay('comboChime', { freq: 1175, gain: 0.45 }), 200);
      break;
    case 4:
      sfxPlay('multSlam', { freq: 220, gain: 1.0 });
      sfxPlay('comboChime', { freq: 1320, gain: 0.7 });
      break;
    case 5:
      sfxPlay('castBoom', { gain: 0.9 });
      sfxPlay('comboChime', { freq: 1760, gain: 0.85 });
      break;
  }
}

function RitualOverlay({ tier, accent }: { tier: MilestoneTier; accent: string }) {
  // Tier 1: ascending ring around scoreboard
  if (tier === 1) {
    return (
      <div className="score-milestone-tier-1" style={{
        position: 'absolute',
        left: '50%',
        top: 'calc(var(--hud-top-h, 134px) + 150px)',
        transform: 'translate(-50%, -50%)',
        width: 320,
        height: 140,
        borderRadius: '50%',
        border: `2px solid ${accent}`,
        boxShadow: `0 0 24px ${accent}88, 0 0 48px ${accent}44`,
        opacity: 0,
        animation: 'score-milestone-ring 700ms cubic-bezier(0.2, 0.7, 0.3, 1) forwards',
      }} />
    );
  }
  // Tier 2: pip particles rain down
  if (tier === 2) {
    const motes = Array.from({ length: 16 });
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        {motes.map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${5 + i * 6 + (i % 2 === 0 ? 0 : 3)}%`,
            top: -20,
            width: 4, height: 4,
            borderRadius: '50%',
            background: accent,
            boxShadow: `0 0 8px ${accent}, 0 0 16px ${accent}88`,
            opacity: 0,
            animation: `score-milestone-rain 1000ms ease-in ${i * 30}ms forwards`,
          }} />
        ))}
      </div>
    );
  }
  // Tier 3: screen-wide constellation flicker (radial pulse using accent)
  if (tier === 3) {
    return (
      <div className="score-milestone-tier-3" style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at 50% 45%, ${accent}33 0%, ${accent}11 35%, transparent 70%)`,
        opacity: 0,
        mixBlendMode: 'screen',
        animation: 'score-milestone-flicker 900ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
      }} />
    );
  }
  // Tier 4: camera zoom indication + ambient wash
  if (tier === 4) {
    return (
      <div className="score-milestone-tier-4" style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at 50% 40%, ${accent}55 0%, ${accent}22 25%, transparent 60%)`,
        opacity: 0,
        mixBlendMode: 'screen',
        animation: 'score-milestone-wash 1200ms cubic-bezier(0.3, 0, 0.7, 1) forwards',
      }} />
    );
  }
  // Tier 5: total surrender — full freeze flash + crimson-violet wash + single bell
  return (
    <div className="score-milestone-tier-5" style={{
      position: 'absolute',
      inset: 0,
      background: `radial-gradient(circle at 50% 50%, ${accent}aa 0%, rgba(226, 51, 74, 0.5) 30%, rgba(118, 71, 245, 0.3) 60%, transparent 90%)`,
      opacity: 0,
      mixBlendMode: 'screen',
      animation: 'score-milestone-apex 1600ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
    }} />
  );
}
