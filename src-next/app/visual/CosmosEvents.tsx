// Wave T+1 (2026-05-20) living cosmos — bespoke reactive layers that
// sit inside CosmosBackground and respond to in-round gameplay
// events. Each layer is a self-contained subscriber to a single bus
// event and renders a transient overlay; aggregate state lives in
// closure / local React state per layer.
//
// All layers are gated by motionReduced() + an optional `enabled`
// flag (CosmosBackground passes false in perf-degraded mode for the
// heavier overlays).
//
// Mounted as a single <CosmosEvents enabled={!degraded} /> inside
// CosmosBackground's tree, BELOW the meteor shower so meteors paint
// on top during boom celebrations.

import { useEffect, useMemo, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import { store } from '../../state/store';
import { lookupVoidstorm } from '../../core/round/voidstorms';
import { BOSS_BLINDS } from '../../data/blinds';

function motionReduced(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('reduce-motion');
}

// ─── 1. Mult tier nebula pulse ──────────────────────────────────────
function MultTierPulseLayer() {
  const [pulses, setPulses] = useState<Array<{ id: number; accent: string; tier: number }>>([]);
  useEffect(() => {
    let nextId = 1;
    const off = bus.on('onMultTierCross', ({ toTier, accent }) => {
      if (motionReduced()) return;
      const id = nextId++;
      setPulses((cur) => [...cur, { id, accent, tier: toTier }]);
      window.setTimeout(() => {
        setPulses((cur) => cur.filter((p) => p.id !== id));
      }, 900);
    });
    return off;
  }, []);
  if (pulses.length === 0) return null;
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {pulses.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse at 50% 45%, ${p.accent}55 0%, ${p.accent}22 35%, transparent 65%)`,
            mixBlendMode: 'screen',
            opacity: 0,
            animation: `cosmos-mult-tier-pulse 800ms cubic-bezier(0.3, 0, 0.4, 1) forwards`,
          }}
        />
      ))}
    </div>
  );
}

// ─── 2. Storm-incoming sky darken ───────────────────────────────────
function StormIncomingLayer() {
  const [storm, setStorm] = useState<{ accent: string } | null>(null);
  useEffect(() => {
    const offStorm = bus.on('onStormIncoming', ({ stormId }) => {
      if (motionReduced()) return;
      const def = lookupVoidstorm(stormId);
      const accent = def?.tone === 'boon' ? '#7be3ff' : '#aa66ff';
      setStorm({ accent });
    });
    const offBeat = bus.on('onScoreBeat', ({ beat }) => {
      // Clear when the actual storm hand begins (cast-swell on a new hand).
      if (beat.kind === 'cast-swell') setStorm(null);
    });
    return () => { offStorm(); offBeat(); };
  }, []);
  if (!storm) return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse at 50% 100%, ${storm.accent}55 0%, rgba(7,5,26,0.55) 50%, rgba(7,5,26,0.78) 100%)`,
        mixBlendMode: 'multiply',
        opacity: 0,
        animation: 'cosmos-storm-incoming 6000ms ease-out forwards',
      }}
    />
  );
}

// ─── 3. Boss-arrival eclipse ────────────────────────────────────────
function BossEclipseLayer() {
  const [eclipse, setEclipse] = useState<{ id: number; accent: string } | null>(null);
  useEffect(() => {
    let nextId = 1;
    const off = bus.on('onBossRevealed', ({ blindId }) => {
      if (motionReduced()) return;
      const boss = BOSS_BLINDS.find((b) => b.id === blindId);
      const accent = boss?.color ?? '#e2334a';
      const id = nextId++;
      setEclipse({ id, accent });
      // Eclipse sweep + settle: clear after 4s, leaving the persistent
      // settle to fade via the layer's own keyframe.
      window.setTimeout(() => setEclipse(null), 4000);
    });
    return off;
  }, []);
  if (!eclipse) return null;
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Shadow sweep moving left → right. */}
      <div
        style={{
          position: 'absolute', top: 0, bottom: 0,
          width: '150vw',
          background: 'linear-gradient(90deg, transparent 0%, rgba(7,5,26,0.78) 30%, rgba(7,5,26,0.92) 50%, rgba(7,5,26,0.78) 70%, transparent 100%)',
          left: '-150vw',
          animation: 'cosmos-boss-eclipse-sweep 1400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        }}
      />
      {/* Persistent eclipsed nebula behind the sweep. Fades in as the
          sweep clears, holds for ~2s, then fades out. */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, ${eclipse.accent}55 0%, ${eclipse.accent}22 35%, rgba(7,5,26,0.45) 75%, transparent 100%)`,
          mixBlendMode: 'multiply',
          opacity: 0,
          animation: 'cosmos-boss-eclipse-reveal 3800ms ease-out forwards',
        }}
      />
    </div>
  );
}

// ─── 4. Synergy-burst star alignment ────────────────────────────────
function SynergyAlignmentLayer() {
  const [bursts, setBursts] = useState<Array<{ id: number; stars: Array<{ x: number; y: number }> }>>([]);
  useEffect(() => {
    let nextId = 1;
    const off = bus.on('onSynergyBurst', () => {
      if (motionReduced()) return;
      // Deterministic seed for repeatable star pattern within a session.
      const id = nextId++;
      const stars: Array<{ x: number; y: number }> = [];
      const count = 6;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const r = 26 + (i % 2 === 0 ? 6 : 0);
        stars.push({
          x: 50 + Math.cos(angle) * r,
          y: 38 + Math.sin(angle) * (r * 0.55),
        });
      }
      setBursts((cur) => [...cur, { id, stars }]);
      window.setTimeout(() => setBursts((cur) => cur.filter((b) => b.id !== id)), 1400);
    });
    return off;
  }, []);
  if (bursts.length === 0) return null;
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
    >
      {bursts.flatMap((burst) => [
        // Lines connecting adjacent stars (closed loop).
        ...burst.stars.map((s, i) => {
          const next = burst.stars[(i + 1) % burst.stars.length]!;
          return (
            <line
              key={`burst-${burst.id}-l${i}`}
              x1={s.x} y1={s.y} x2={next.x} y2={next.y}
              stroke="#f5c451"
              strokeWidth={0.18}
              strokeLinecap="round"
              opacity={0}
              style={{ animation: `cosmos-synergy-line 1200ms ease-out ${i * 60}ms forwards` }}
            />
          );
        }),
        // Star halos.
        ...burst.stars.map((s, i) => (
          <g key={`burst-${burst.id}-s${i}`}>
            <circle cx={s.x} cy={s.y} r={1.6} fill="#f5c451" opacity={0}
              style={{ animation: `cosmos-synergy-star 900ms cubic-bezier(0.2, 1.4, 0.4, 1) ${i * 60}ms forwards` }} />
            <circle cx={s.x} cy={s.y} r={0.6} fill="#fff7e0" opacity={0}
              style={{ animation: `cosmos-synergy-star 900ms cubic-bezier(0.2, 1.4, 0.4, 1) ${i * 60 + 40}ms forwards` }} />
          </g>
        )),
      ])}
    </svg>
  );
}

// ─── 5. Sustained-phase warmth bloom ────────────────────────────────
function SustainedWarmthLayer() {
  const [phase, setPhase] = useState<'idle' | 'sustained' | 'held-breath' | 'release'>('idle');
  useEffect(() => {
    const off = bus.on('onTheaterPhase', ({ phase: p }) => {
      if (p === 'sustained' || p === 'held-breath' || p === 'release') setPhase(p);
      else setPhase('idle');
    });
    return off;
  }, []);
  const active = phase === 'sustained' || phase === 'held-breath';
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(255, 157, 74, 1) 0%, rgba(245, 196, 81, 0.5) 50%, transparent 80%)',
        mixBlendMode: 'overlay',
        opacity: active ? 0.32 : 0,
        transition: 'opacity 800ms cubic-bezier(0.3, 0, 0.4, 1)',
        willChange: 'opacity',
      }}
    />
  );
}

// ─── 6. Near-bust twinkle ───────────────────────────────────────────
// Scatters crimson "stars" across the night sky that twinkle in
// place (opacity + scale pulse) for the duration of the near-bust
// state. Reads as "the sky is watching" rather than "the world is
// falling apart" — restrained anxiety, not panic.
function NearBustDustLayer() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const offNear = bus.on('onNearBust', () => setActive(true));
    const offSafe = bus.on('onSafe', () => setActive(false));
    return () => { offNear(); offSafe(); };
  }, []);
  // Scatter 18 crimson twinklers across the sky. Deterministic
  // pseudo-random so they sit in the same constellation each time.
  const motes = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    left: ((i * 137 + 23) % 1000) / 10,   // 0-100 across
    top:  ((i * 211 + 71) % 700)  / 10,   // 0-70 down (avoid HUD bottom)
    size: 1.6 + ((i * 7) % 18) / 10,      // 1.6-3.4 px
    delay: (i * 230) % 3600,
    duration: 2600 + ((i * 170) % 1800),
  })), []);
  if (!active || motionReduced()) return null;
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {motes.map((m, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: m.size, height: m.size,
            borderRadius: '50%',
            background: '#ff5a6e',
            boxShadow: '0 0 4px rgba(255, 90, 110, 0.9), 0 0 9px rgba(226, 51, 74, 0.55)',
            opacity: 0,
            animation: `cosmos-nearbust-twinkle ${m.duration}ms ease-in-out ${m.delay}ms infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─── 7. Last-hand star dim ──────────────────────────────────────────
// Drives a CSS class on the cosmos root so the existing starfield
// opacity reduces. Cleaner than re-rendering stars with a new prop.
function LastHandDimLayer() {
  useEffect(() => {
    const offLast = bus.on('onLastHandOfBlind', () => {
      const host = document.getElementById('cosmos-root');
      host?.classList.add('cosmos-last-hand-dim');
    });
    const offBeat = bus.on('onScoreBeat', ({ beat }) => {
      // Clear on new cast-swell (next hand commits).
      if (beat.kind === 'cast-swell') {
        const host = document.getElementById('cosmos-root');
        host?.classList.remove('cosmos-last-hand-dim');
      }
    });
    return () => { offLast(); offBeat(); };
  }, []);
  return null;
}

// ─── 8. Crystalline cosmic echo ─────────────────────────────────────
function CrystallineEchoLayer() {
  const [echoes, setEchoes] = useState<Array<{ id: number; color: string }>>([]);
  useEffect(() => {
    let nextId = 1;
    const off = bus.on('onCrystallineEdgeCatch', ({ color }) => {
      if (motionReduced()) return;
      const id = nextId++;
      setEchoes((cur) => [...cur, { id, color }]);
      window.setTimeout(() => setEchoes((cur) => cur.filter((e) => e.id !== id)), 800);
    });
    return off;
  }, []);
  if (echoes.length === 0) return null;
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {echoes.map((e) => (
        <div
          key={e.id}
          style={{
            position: 'absolute',
            left: '50%', top: '45%',
            transform: 'translate(-50%, -50%)',
            width: 80, height: 80,
            borderRadius: '50%',
            border: `2px solid ${e.color}`,
            boxShadow: `0 0 24px ${e.color}77, 0 0 48px ${e.color}44`,
            opacity: 0,
            animation: 'cosmos-crystalline-echo 700ms cubic-bezier(0.3, 0.7, 0.4, 1) forwards',
            mixBlendMode: 'screen',
          }}
        />
      ))}
    </div>
  );
}

// ─── 9. Boom cosmic ringing ─────────────────────────────────────────
// Adds a brief shake class to #cosmos-root so the stars vibrate.
function BoomRingingLayer() {
  useEffect(() => {
    const off = bus.on('onScoreBeat', ({ beat }) => {
      if (beat.kind !== 'boom') return;
      if (motionReduced()) return;
      const ratio = beat.megaRatio ?? 0;
      if (ratio < 3) return;
      const host = document.getElementById('cosmos-root');
      if (!host) return;
      host.classList.add('cosmos-boom-ringing');
      window.setTimeout(() => host.classList.remove('cosmos-boom-ringing'), 460);
    });
    return off;
  }, []);
  return null;
}

// ─── 10. Blind-cleared celestial sigh ────────────────────────────────
// On cleared blind, drive a "settle" class that softens the cosmos
// for ~1.5s — drift slows + starfield brightens slightly, framing the
// recovery moment.
function BlindClearedResetLayer() {
  useEffect(() => {
    const off = bus.on('onBlindCleared', () => {
      const host = document.getElementById('cosmos-root');
      if (!host) return;
      host.classList.add('cosmos-blind-cleared-sigh');
      window.setTimeout(() => host.classList.remove('cosmos-blind-cleared-sigh'), 1600);
    });
    return off;
  }, []);
  return null;
}

// ─── Aggregate mount ────────────────────────────────────────────────
export function CosmosEvents({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    // Even when overlays are gated by perf, we still mount the
    // class-based layers (LastHandDim, BoomRinging, BlindClearedReset)
    // because they're effectively free (one CSS class toggle).
    return (
      <>
        <LastHandDimLayer />
        <BoomRingingLayer />
        <BlindClearedResetLayer />
      </>
    );
  }
  return (
    <>
      <MultTierPulseLayer />
      <StormIncomingLayer />
      <BossEclipseLayer />
      <SynergyAlignmentLayer />
      <SustainedWarmthLayer />
      <NearBustDustLayer />
      <LastHandDimLayer />
      <CrystallineEchoLayer />
      <BoomRingingLayer />
      <BlindClearedResetLayer />
    </>
  );
}
