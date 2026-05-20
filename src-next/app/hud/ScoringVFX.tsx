import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { triggerShake } from '../visual/screenShake';
import { Z } from './zLayers';
import { useIsTightStage } from '../hooks/useIsCompactStage';

/**
 * ScoringVFX — SCORING_VFX_HANDOFF.md handoff
 *
 * Procedural SVG particles (zero emoji), balatro-juicy timing, screen-level
 * orchestration. Replaces the previous DOM-emoji slams/booms with custom
 * SVG primitives (Sparkle4, Star5, Burst6, Shard, SlamBurst, Sunburst,
 * BailCracks, PolyRing) and layered screen effects (godrays, vignette,
 * time-dilation flash, chromatic aberration).
 *
 * Public API (per handoff):
 *   scoringVFX.fireSlam(label, color?, shake?)
 *   scoringVFX.fireTargetBeat()
 *   scoringVFX.fireBail()
 *   scoringVFX.fireBoom(variant, total)
 */

type ShakeKind = 'sm' | 'md' | 'lg';
type BoomVariant = 'normal' | 'gold' | 'mega';

type SlamEvent = {
  kind: 'slam';
  id: number;
  label: string;
  color: string;
};

type StampEvent = {
  kind: 'target' | 'bail';
  id: number;
};

type BoomEvent = {
  kind: 'boom';
  id: number;
  total: number;
  variant: BoomVariant;
  counterFx: number;
  counterFy: number;
  newBest: boolean;
};

// 2026-05-14 fancy-FX pass — four scene-affecting moves that move
// scoring juice away from "more circles at the boom point" toward
// "the world reacts." Each event carries the inputs it needs to
// render without re-querying the store.
type StarRippleEvent = {
  kind: 'starRipple';
  id: number;
  intensity: 'normal' | 'mega'; // mega adds an extra ring + larger radius
};
type ConstellationSealEvent = {
  kind: 'constellationSeal';
  id: number;
  glyph: { x: number; y: number }[];
  color: string;
  name: string;
};
type ConductiveArcsEvent = {
  kind: 'conductiveArcs';
  id: number;
  diePositions: Array<{ x: number; y: number }>; // viewport-relative
  accent: string;
};

type Effect = SlamEvent | StampEvent | BoomEvent
  | StarRippleEvent | ConstellationSealEvent | ConductiveArcsEvent;

// Default particle intensity (the demo's tweak slider goes 1–5; production
// uses the tuned mid-high value).
const INTENSITY = 4;

// Map handoff shake kinds onto the existing #stage-root triggerShake.
function mapShake(kind: ShakeKind): 'tiny' | 'mid' | 'big' {
  return kind === 'sm' ? 'tiny' : kind === 'md' ? 'mid' : 'big';
}

// ─── SVG PRIMITIVES ────────────────────────────────────────
function Sparkle4({ size = 18, color = 'currentColor', glow = true }: { size?: number; color?: string; glow?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="-20 -20 40 40" style={{ overflow: 'visible' }}>
      <path
        d="M0,-18 C2,-6 6,-2 18,0 C6,2 2,6 0,18 C-2,6 -6,2 -18,0 C-6,-2 -2,-6 0,-18 Z"
        fill={color}
        style={glow ? { filter: `drop-shadow(0 0 6px ${color})` } : undefined}
      />
    </svg>
  );
}

function Star5({ size = 22, color = 'currentColor', glow = true }: { size?: number; color?: string; glow?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="-20 -20 40 40" style={{ overflow: 'visible' }}>
      <path
        d="M0,-18 L5.5,-6 L18,-5 L8.5,3 L11,16 L0,9 L-11,16 L-8.5,3 L-18,-5 L-5.5,-6 Z"
        fill={color}
        style={glow ? { filter: `drop-shadow(0 0 6px ${color})` } : undefined}
      />
    </svg>
  );
}

function Burst6({ size = 20, color = 'currentColor', glow = true }: { size?: number; color?: string; glow?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="-20 -20 40 40" style={{ overflow: 'visible' }}>
      <path
        d="M0,-18 L4,-4 L18,0 L4,4 L0,18 L-4,4 L-18,0 L-4,-4 Z"
        fill={color}
        style={glow ? { filter: `drop-shadow(0 0 6px ${color})` } : undefined}
      />
    </svg>
  );
}

function Shard({ size = 24, color = 'currentColor', glow = true }: { size?: number; color?: string; glow?: boolean }) {
  return (
    <svg width={size} height={size * 0.32} viewBox="-30 -10 60 20" style={{ overflow: 'visible' }}>
      <path
        d="M-28,0 L-4,-7 L28,0 L-4,7 Z"
        fill={color}
        style={glow ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined}
      />
    </svg>
  );
}

function SlamBurst({ size = 320, color = '#7be3ff', spokes = 16 }: { size?: number; color?: string; spokes?: number }) {
  const rays = [];
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const len = i % 2 === 0 ? 110 : 70;
    rays.push(
      <path
        key={i}
        d={`M0,0 L${Math.cos(a - 0.06) * 16},${Math.sin(a - 0.06) * 16} L${Math.cos(a) * len},${Math.sin(a) * len} L${Math.cos(a + 0.06) * 16},${Math.sin(a + 0.06) * 16} Z`}
        fill={`url(#vfx-slam-grad-${color.replace('#', '')})`}
      />,
    );
  }
  const gid = `vfx-slam-grad-${color.replace('#', '')}`;
  return (
    <svg className="vfx-slam-burst-svg" width={size} height={size} viewBox="-120 -120 240 240" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={gid} cx="0" cy="0" r="0.5">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="60%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g style={{ filter: `drop-shadow(0 0 16px ${color})` }}>{rays}</g>
      <circle r="14" fill={color} opacity="0.85" />
    </svg>
  );
}

function Sunburst({ size = 460, color = '#f5c451', spokes = 24, gradId = 'vfx-sun-grad' }: { size?: number; color?: string; spokes?: number; gradId?: string }) {
  const rays = [];
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const len = i % 2 === 0 ? 180 : 110;
    const w = i % 2 === 0 ? 0.05 : 0.04;
    rays.push(
      <path
        key={i}
        d={`M0,0 L${Math.cos(a - w) * 22},${Math.sin(a - w) * 22} L${Math.cos(a) * len},${Math.sin(a) * len} L${Math.cos(a + w) * 22},${Math.sin(a + w) * 22} Z`}
        fill={`url(#${gradId})`}
      />,
    );
  }
  return (
    <svg className="vfx-stamp-sun" width={size} height={size} viewBox="-200 -200 400 400" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={gradId} cx="0" cy="0" r="0.5">
          <stop offset="0%" stopColor="#fff5d0" stopOpacity="1" />
          <stop offset="40%" stopColor={color} stopOpacity="0.85" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g style={{ filter: `drop-shadow(0 0 24px ${color})` }}>{rays}</g>
      <circle r="22" fill="#fff5d0" opacity="0.6" />
    </svg>
  );
}

function BailCracks({ size = 360, color = '#ff4d6d' }: { size?: number; color?: string }) {
  const cracks: React.JSX.Element[] = [];
  const angles = [0, 28, 62, 95, 132, 168, 198, 232, 268, 300, 332];
  angles.forEach((a, i) => {
    const rad = (a * Math.PI) / 180;
    const len = 100 + (i % 3) * 30;
    const p1 = [Math.cos(rad) * 18, Math.sin(rad) * 18];
    const p2 = [Math.cos(rad + 0.04) * (len * 0.4), Math.sin(rad + 0.04) * (len * 0.4)];
    const p3 = [Math.cos(rad - 0.05) * (len * 0.7), Math.sin(rad - 0.05) * (len * 0.7)];
    const p4 = [Math.cos(rad) * len, Math.sin(rad) * len];
    cracks.push(
      <path
        key={i}
        d={`M${p1[0]},${p1[1]} L${p2[0]},${p2[1]} L${p3[0]},${p3[1]} L${p4[0]},${p4[1]}`}
        stroke={color}
        strokeWidth="1.6"
        fill="none"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />,
    );
  });
  return (
    <svg className="vfx-bail-cracks" width={size} height={size} viewBox="-180 -180 360 360" style={{ overflow: 'visible' }}>
      <circle r="14" fill="none" stroke={color} strokeWidth="1.5" opacity="0.7" />
      {cracks}
    </svg>
  );
}

function PolyRing({ sides = 12, radius = 110, color = '#b18bff' }: { sides?: number; radius?: number; color?: string }) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${Math.cos(a) * radius},${Math.sin(a) * radius}`);
  }
  return (
    <svg
      className="vfx-boom-poly"
      width={radius * 2.6}
      height={radius * 2.6}
      viewBox={`${-radius * 1.3} ${-radius * 1.3} ${radius * 2.6} ${radius * 2.6}`}
      style={{ overflow: 'visible' }}
    >
      <polygon
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        style={{ filter: `drop-shadow(0 0 8px ${color})` }}
      />
      <polygon
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="0.5"
        opacity="0.5"
        transform="scale(0.7)"
      />
    </svg>
  );
}

// ─── PARTICLE SYSTEMS ─────────────────────────────────────
function SlamSparks({ count = 10, color, intensity = INTENSITY }: { count?: number; color: string; intensity?: number }) {
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (360 / count) * i + (Math.random() - 0.5) * 12;
        const dist = (80 + Math.random() * 50) * (0.6 + intensity * 0.12);
        const size = 12 + Math.random() * 6;
        const useShard = i % 2 === 0;
        return { angle, dist, size, useShard, delay: Math.random() * 60 };
      }),
    [count, intensity],
  );
  return (
    <div className="vfx-slam-sparks" style={{ color }}>
      {sparks.map((s, i) => (
        <div
          key={i}
          className="vfx-slam-spark"
          style={{
            ['--angle' as never]: `${s.angle}deg`,
            ['--dist' as never]: `${s.dist}px`,
            animationDelay: `${s.delay}ms`,
          } as React.CSSProperties}
        >
          {s.useShard
            ? <Shard size={s.size * 1.6} color={color} />
            : <Sparkle4 size={s.size} color={color} />}
        </div>
      ))}
    </div>
  );
}

function StampShards({ count = 16, color = '#f5c451', intensity = INTENSITY }: { count?: number; color?: string; intensity?: number }) {
  const shards = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (360 / count) * i + (Math.random() - 0.5) * 10;
        const dist = (120 + Math.random() * 80) * (0.6 + intensity * 0.12);
        const size = 14 + Math.random() * 10;
        const spinStart = (Math.random() - 0.5) * 80;
        const spinEnd = spinStart + (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360);
        const variant = i % 3;
        return { angle, dist, size, spinStart, spinEnd, variant };
      }),
    [count, intensity],
  );
  return (
    <div className="vfx-stamp-shards" style={{ color }}>
      {shards.map((s, i) => (
        <div
          key={i}
          className="vfx-stamp-shard"
          style={{
            ['--angle' as never]: `${s.angle}deg`,
            ['--dist' as never]: `${s.dist}px`,
            ['--spin-start' as never]: `${s.spinStart}deg`,
            ['--spin-end' as never]: `${s.spinEnd}deg`,
          } as React.CSSProperties}
        >
          {s.variant === 0 && <Sparkle4 size={s.size} color={color} />}
          {s.variant === 1 && <Star5 size={s.size + 2} color={color} />}
          {s.variant === 2 && <Shard size={s.size * 1.4} color={color} />}
        </div>
      ))}
    </div>
  );
}

function BailAsh({ count = 12 }: { count?: number }) {
  const dots = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (Math.random() - 0.5) * 240,
        delay: i * 60 + Math.random() * 80,
      })),
    [count],
  );
  return (
    <div className="vfx-bail-ash">
      {dots.map((d, i) => (
        <div
          key={i}
          className="vfx-bail-ash-dot"
          style={{ ['--x' as never]: `${d.x}px`, animationDelay: `${d.delay}ms` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function BoomSparks({ count = 24, intensity = INTENSITY }: { count?: number; intensity?: number }) {
  const sparks = useMemo(() => {
    const out = [] as Array<{ angle: number; dist: number; size: number; color: string; variant: number; spin: number; dur: number; delay: number }>;
    const colors = ['#ffd97a', '#f5c451', '#7be3ff', '#ff52c8', '#b18bff'];
    for (let i = 0; i < count; i++) {
      const angle = (360 / count) * i + (Math.random() - 0.5) * 18;
      const dist = (140 + Math.random() * 180) * (0.6 + intensity * 0.12);
      const size = 14 + Math.random() * 12;
      const color = colors[i % colors.length]!;
      const variant = i % 3;
      const spin = (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540);
      const dur = 900 + Math.random() * 400;
      const delay = i * 22 + Math.random() * 30;
      out.push({ angle, dist, size, color, variant, spin, dur, delay });
    }
    return out;
  }, [count, intensity]);
  return (
    <div className="vfx-boom-sparks">
      {sparks.map((s, i) => (
        <div
          key={i}
          className="vfx-boom-spark"
          style={{
            ['--angle' as never]: `${s.angle}deg`,
            ['--dist' as never]: `${s.dist}px`,
            ['--spin' as never]: `${s.spin}deg`,
            ['--dur' as never]: `${s.dur}ms`,
            ['--delay' as never]: `${s.delay}ms`,
            color: s.color,
          } as React.CSSProperties}
        >
          {/* glow=false — the parent .vfx-boom-sparks wrapper carries
              a single drop-shadow filter so we don't pay N×
              filter-rasterization passes per frame for 18-36
              particles. */}
          {s.variant === 0 && <Sparkle4 size={s.size} color={s.color} glow={false} />}
          {s.variant === 1 && <Star5 size={s.size + 2} color={s.color} glow={false} />}
          {s.variant === 2 && <Burst6 size={s.size} color={s.color} glow={false} />}
        </div>
      ))}
    </div>
  );
}

function StarTrails({ count = 10, targetX, targetY }: { count?: number; targetX: number; targetY: number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        delay: i * 36,
        fx: targetX + (Math.random() - 0.5) * 24,
        fy: targetY + (Math.random() - 0.5) * 24,
        size: 16 + Math.random() * 8,
      })),
    [count, targetX, targetY],
  );
  return (
    <div className="vfx-star-trails">
      {stars.map((s, i) => (
        <div
          key={i}
          className="vfx-star-trail"
          style={{
            ['--fx' as never]: `${s.fx}px`,
            ['--fy' as never]: `${s.fy}px`,
            ['--delay' as never]: `${s.delay}ms`,
            animationDelay: `${s.delay}ms`,
          } as React.CSSProperties}
        >
          <Star5 size={s.size} color="#ffd97a" />
        </div>
      ))}
    </div>
  );
}

// ─── EFFECT COMPONENTS ───────────────────────────────────
function MultSlam({ label, color }: { label: string; color: string }) {
  const tintClass = color === '#f5c451' ? 'gold' : color === '#ff52c8' ? 'magenta' : 'cyan';
  return (
    <div className="vfx-slam-root">
      <SlamBurst color={color} spokes={Math.round(12 + INTENSITY * 2)} />
      <div className={`vfx-slam-pill ${tintClass}`}>{label}</div>
      <SlamSparks count={Math.round(8 + INTENSITY * 2)} color={color} />
    </div>
  );
}

function TargetBeatStamp() {
  // 2026-05-14 fancy-FX pass — the literal "TARGET BEAT" text was
  // pulled. The constellation seal (rendered alongside this) now
  // carries the identity message in the center; the sunburst + stamp
  // shards stay as the radial celebration energy that radiates AROUND
  // the seal. Together they read as one composed beat instead of two
  // competing centerpieces.
  return (
    <div className="vfx-stamp-root">
      <Sunburst color="#f5c451" spokes={Math.round(20 + INTENSITY * 2)} />
      <StampShards count={Math.round(14 + INTENSITY * 3)} />
    </div>
  );
}

function BailStampInner() {
  return (
    <div className="vfx-bail-root">
      <BailCracks color="#ff4d6d" />
      <div className="vfx-bail-text">NOT ENOUGH</div>
      <BailAsh count={10 + INTENSITY * 2} />
    </div>
  );
}

// Star-cluster ignite ripple — three staggered concentric brightening
// rings emanating from the play-area center. The CSS animation uses
// screen-blend so the rings WASH the underlying cosmos starfield
// brighter rather than draw new circles. 'mega' adds a fourth outer
// ring + bumps each ring's max radius. Stays on the world-canvas
// layer (NOT inside the centered effects-layer) because it spans the
// whole viewport.
function StarRipple({ intensity }: { intensity: 'normal' | 'mega' }) {
  const rings = intensity === 'mega' ? 4 : 3;
  return (
    <div className="vfx-star-ripple-root" aria-hidden="true">
      {Array.from({ length: rings }).map((_, i) => (
        <div
          key={i}
          className={`vfx-star-ripple vfx-star-ripple-${intensity}`}
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </div>
  );
}

// Constellation seal — stamps the active constellation's GLYPH (the
// same point-array used in ConstellationSelect.Glyph) at the center
// of the play area. Stars connect via dashed lines + each point
// lights as a small pip, giving the seal the same visual vocabulary
// as the picker. Replaces the generic gold "TARGET BEAT" ceremony
// with the run's identity.
function ConstellationSeal({ glyph, color, name }: { glyph: { x: number; y: number }[]; color: string; name: string }) {
  // Wave T+1 (2026-05-19) bespoke theater — Move 2 — constellation
  // now DRAWS itself on cross-target. Each connecting line strokes in
  // sequentially (stroke-dashoffset animation), and each star halo
  // ignites right after the line reaches it. Reads as the active
  // constellation completing across the play area as the player
  // crosses target — the ritual that earns the moment.
  const LINE_DRAW_MS = 320;
  const PER_STAR_STAGGER_MS = 120;
  return (
    <div className="vfx-cons-seal-root" aria-hidden="true">
      <svg
        viewBox="0 0 100 100"
        width="320"
        height="320"
        className="vfx-cons-seal-svg"
        style={{ ['--seal-accent' as string]: color }}
      >
        {/* Connecting lines — each draws in sequentially via stroke-dashoffset. */}
        {glyph.slice(0, -1).map((p, i) => {
          const next = glyph[i + 1]!;
          const dx = next.x - p.x;
          const dy = next.y - p.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const delay = i * PER_STAR_STAGGER_MS;
          return (
            <line
              key={`l${i}`}
              x1={p.x} y1={p.y} x2={next.x} y2={next.y}
              stroke={color}
              strokeWidth={0.6}
              strokeLinecap="round"
              opacity={0.85}
              style={{
                strokeDasharray: len,
                strokeDashoffset: len,
                animation: `vfx-cons-line-draw ${LINE_DRAW_MS}ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms forwards`,
              }}
            />
          );
        })}
        {/* Stars — each ignites slightly after the line that arrives at it. */}
        {glyph.map((p, i) => {
          const isPrimary = i === 0;
          const r = isPrimary ? 2.6 : 1.8;
          // Star at index i ignites when line (i-1) finishes drawing,
          // or immediately for the first star.
          const delay = Math.max(0, i * PER_STAR_STAGGER_MS - 40);
          return (
            <g
              key={`s${i}`}
              style={{
                opacity: 0,
                animation: `vfx-cons-star-ignite 280ms cubic-bezier(0.3, 1.4, 0.4, 1) ${delay}ms forwards`,
              }}
            >
              <circle cx={p.x} cy={p.y} r={r * 2.4} fill={color} opacity={0.18} />
              <circle cx={p.x} cy={p.y} r={r * 1.5} fill={color} opacity={0.4} />
              <circle cx={p.x} cy={p.y} r={r} fill="#fff7e0" />
            </g>
          );
        })}
      </svg>
      <div className="vfx-cons-seal-name" style={{ color }}>
        {name}
      </div>
    </div>
  );
}

// Conductive arcs — the "constellation traced by the dice" beat.
// Single chain that walks die0 → die1 → … in scoring order. Each
// segment is a quadratic bezier whose control point is offset
// perpendicular to the segment so the chain wobbles like a
// hand-traced constellation rather than a straight polyline. The
// anchor pulse sits ON the first die instead of floating above the
// play area, and each subsequent segment paints in 80ms after its
// predecessor so the constellation reads as being drawn forward in
// scoring sequence.
//
// Skips the effect entirely if fewer than 3 die positions are
// supplied (the shorter sequences don't earn the visual; reserve
// the moment for chains).
function ConductiveArcs({ diePositions, accent }: { diePositions: Array<{ x: number; y: number }>; accent: string }) {
  if (diePositions.length < 3) return null;
  // Cap to the first 8 dice (largest scoring count is ~7 anyway).
  const dice = diePositions.slice(0, 8);
  const first = dice[0]!;
  // Per-segment jitter: perpendicular offset on the control point,
  // alternating sign so the chain wobbles back-and-forth. Magnitude
  // scales with segment length so short segments still curve, long
  // segments don't overshoot. Deterministic — same dice produce the
  // same chain.
  const segments = dice.slice(1).map((b, segIdx) => {
    const a = dice[segIdx]!;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const sign = segIdx % 2 === 0 ? 1 : -1;
    const jitterMag = Math.min(28, Math.max(10, len * 0.18));
    const cx = mx + nx * jitterMag * sign;
    const cy = my + ny * jitterMag * sign;
    return { a, b, cx, cy };
  });
  return (
    <svg
      className="vfx-conductive-root"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
      }}
    >
      {/* Anchor pulse — sits on the first scoring die so the chain
          reads as starting from the dice themselves, not from a
          floating point above the play area. */}
      <circle
        cx={first.x} cy={first.y} r="6"
        fill={accent}
        className="vfx-conductive-anchor"
        style={{ filter: `drop-shadow(0 0 10px ${accent})` }}
      />
      {segments.map((s, i) => (
        <path
          key={i}
          d={`M ${s.a.x} ${s.a.y} Q ${s.cx} ${s.cy} ${s.b.x} ${s.b.y}`}
          stroke={accent}
          strokeWidth="1.4"
          fill="none"
          strokeDasharray="2 4"
          strokeLinecap="round"
          opacity={0}
          className="vfx-conductive-arc"
          style={{
            animationDelay: `${i * 80}ms`,
            filter: `drop-shadow(0 0 4px ${accent})`,
          }}
        />
      ))}
    </svg>
  );
}

function BoomNumber({
  total,
  variant,
  counterFx,
  counterFy,
  newBest,
}: {
  total: number;
  variant: BoomVariant;
  counterFx: number;
  counterFy: number;
  newBest: boolean;
}) {
  // Wave T+1 (2026-05-19) UI/UX refinement — BoomNumber simplified to
  // a single pop+dissolve phase. The old pop(1700ms)→fly(800ms) pattern
  // is replaced by a tighter 600ms pop hold + CSS-driven dissolve.
  // Counter fill now starts immediately after the pop hold (driven by
  // ScoreMoment) so the meter visibly tweens up under the dissolving
  // BoomNumber instead of waiting for star-trails to bridge.
  const [phase, setPhase] = useState<'pop' | 'dissolve'>('pop');
  // Tight stage = phones / split-landscape. Cut the spark count
  // roughly in half so 36 mega particles → 18, etc. — the boom's
  // GPU load on integrated mobile GPUs was dominated by these
  // per-particle SVGs even after the per-particle drop-shadow
  // collapse onto the wrapper.
  const tight = useIsTightStage();

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase('dissolve'), 600);
    return () => {
      window.clearTimeout(t1);
    };
  }, []);

  const ringColor = variant === 'normal' ? '#7be3ff' : '#f5c451';
  const polyColor = variant === 'mega' ? '#ff52c8' : '#b18bff';

  return (
    <div className="vfx-boom-root">
      <div className="vfx-boom-rings">
        <div
          className="vfx-boom-ring vfx-boom-ring-1"
          style={{
            borderColor: ringColor,
            boxShadow: `0 0 30px ${ringColor}99, inset 0 0 24px ${ringColor}55`,
          }}
        />
        <div className="vfx-boom-ring vfx-boom-ring-2" style={{ borderColor: polyColor }} />
        <div className="vfx-boom-ring vfx-boom-ring-3" style={{ borderColor: '#7be3ff' }} />
      </div>

      <PolyRing sides={variant === 'mega' ? 16 : 12} radius={130} color={polyColor} />

      {phase === 'pop' && (
        <BoomSparks count={
          tight
            ? (variant === 'mega' ? 18 : variant === 'gold' ? 14 : 10)
            : (variant === 'mega' ? 36 : variant === 'gold' ? 28 : 18)
        } />
      )}

      <div
        className={`vfx-boom-number ${variant} ${phase}`}
      >
        {total.toLocaleString()}
      </div>

      {newBest && phase === 'pop' && (
        <div className="vfx-newbest">★ NEW BEST ★</div>
      )}
    </div>
  );
}

// ─── PUBLIC API ───────────────────────────────────────────
type Callbacks = {
  slam: ((label: string, color: string, shake: ShakeKind) => void) | null;
  targetBeat: (() => void) | null;
  bail: (() => void) | null;
  boom: ((variant: BoomVariant, total: number, newBest: boolean) => void) | null;
  // Fancy-FX-pass additions:
  starRipple: ((intensity: 'normal' | 'mega') => void) | null;
  constellationSeal: ((glyph: { x: number; y: number }[], color: string, name: string) => void) | null;
  conductiveArcs: ((diePositions: Array<{ x: number; y: number }>, accent: string) => void) | null;
};

export const scoringVFX = {
  callbacks: {
    slam: null,
    targetBeat: null,
    bail: null,
    boom: null,
    starRipple: null,
    constellationSeal: null,
    conductiveArcs: null,
  } as Callbacks,

  fireSlam(label: string, color: string = '#7be3ff', shake: ShakeKind = 'sm') {
    if (this.callbacks.slam) this.callbacks.slam(label, color, shake);
  },

  fireTargetBeat() {
    if (this.callbacks.targetBeat) this.callbacks.targetBeat();
  },

  fireBail() {
    if (this.callbacks.bail) this.callbacks.bail();
  },

  fireBoom(variant: BoomVariant, total: number, newBest: boolean = false) {
    if (this.callbacks.boom) this.callbacks.boom(variant, total, newBest);
  },

  /**
   * Star-cluster ignite ripple — three staggered concentric brightening
   * waves that wash outward from the play area through the cosmos
   * starfield. Reads as the cosmos noticing the boom rather than as
   * "more circles at the boom point." 'mega' adds an outer ring and
   * pushes the wave further before it fades.
   */
  fireStarRipple(intensity: 'normal' | 'mega' = 'normal') {
    if (this.callbacks.starRipple) this.callbacks.starRipple(intensity);
  },

  /**
   * Constellation seal — stamps the active constellation's glyph in
   * the center of the play area at large scale on cross-target. Ties
   * the run's identity into the climax instead of a generic stamp.
   */
  fireConstellationSeal(glyph: { x: number; y: number }[], color: string, name: string) {
    if (this.callbacks.constellationSeal) this.callbacks.constellationSeal(glyph, color, name);
  },

  /**
   * Conductive arcs — traced bezier paths from a constellation anchor
   * point above the play area DOWN to each scoring die in scoring
   * order. Reads as "the constellation is conducting the dice."
   * diePositions are in viewport-relative pixels (top-left origin).
   */
  fireConductiveArcs(diePositions: Array<{ x: number; y: number }>, accent: string) {
    if (this.callbacks.conductiveArcs) this.callbacks.conductiveArcs(diePositions, accent);
  },
};

// ─── STAGE ─────────────────────────────────────────────────
function getCounterDelta(): { fx: number; fy: number } {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { fx: 0, fy: 0 };
  }
  const counter = document.querySelector<HTMLElement>('[data-score-counter]');
  if (!counter) return { fx: 0, fy: 0 };
  const rect = counter.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return { fx: cx - window.innerWidth / 2, fy: cy - window.innerHeight / 2 };
}

function isReducedMotion(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('reduce-motion');
}

function fireScreenClass(name: 'vfx-godrays-fire' | 'vfx-flash-fire' | 'vfx-timedilate-fire' | 'vfx-vignette-active' | 'vfx-ca-fire', durationMs: number) {
  if (typeof document === 'undefined') return;
  const layer = document.getElementById('vfx-scoring-layer');
  if (!layer) return;
  layer.classList.remove(name);
  // Force reflow so the animation restarts cleanly on back-to-back triggers.
  void layer.offsetWidth;
  layer.classList.add(name);
  window.setTimeout(() => layer.classList.remove(name), durationMs);
}

export function ScoringVFX() {
  const [effects, setEffects] = useState<Effect[]>([]);
  const nextId = useRef(0);

  const removeEffect = useCallback((id: number) => {
    setEffects((prev) => prev.filter((e) => e.id !== id));
  }, []);

  useEffect(() => {
    const reduced = isReducedMotion();

    scoringVFX.callbacks.slam = (label, color, shake) => {
      const id = ++nextId.current;
      const event: SlamEvent = { kind: 'slam', id, label, color };
      setEffects((prev) => [...prev, event]);
      window.setTimeout(() => removeEffect(id), 1000);
      if (!reduced) {
        triggerShake(mapShake(shake));
        fireScreenClass('vfx-ca-fire', 360);
      }
    };

    scoringVFX.callbacks.targetBeat = () => {
      const id = ++nextId.current;
      const event: StampEvent = { kind: 'target', id };
      setEffects((prev) => [...prev, event]);
      window.setTimeout(() => removeEffect(id), 1500);
      if (!reduced) {
        triggerShake('mid');
        fireScreenClass('vfx-godrays-fire', 1800);
        fireScreenClass('vfx-vignette-active', 1600);
        fireScreenClass('vfx-timedilate-fire', 260);
        fireScreenClass('vfx-flash-fire', 220);
      }
    };

    scoringVFX.callbacks.bail = () => {
      const id = ++nextId.current;
      const event: StampEvent = { kind: 'bail', id };
      setEffects((prev) => [...prev, event]);
      window.setTimeout(() => removeEffect(id), 1900);
      if (!reduced) {
        triggerShake('mid');
        fireScreenClass('vfx-vignette-active', 2000);
      }
    };

    scoringVFX.callbacks.boom = (variant, total, newBest) => {
      const id = ++nextId.current;
      const { fx, fy } = getCounterDelta();
      const event: BoomEvent = { kind: 'boom', id, total, variant, counterFx: fx, counterFy: fy, newBest };
      setEffects((prev) => [...prev, event]);
      // BoomNumber lives ~2500ms (pop 1700 + fly 800); stamp the New Best
      // a touch longer so it can hold past the number leaving.
      window.setTimeout(() => removeEffect(id), 2700);
      if (reduced) return;
      const shake: ShakeKind = variant === 'mega' ? 'lg' : variant === 'gold' ? 'md' : 'sm';
      triggerShake(mapShake(shake));
      if (variant !== 'normal') {
        fireScreenClass('vfx-godrays-fire', 1800);
        fireScreenClass('vfx-vignette-active', 2400);
      }
      if (variant === 'mega') {
        fireScreenClass('vfx-timedilate-fire', 260);
        fireScreenClass('vfx-flash-fire', 220);
      }
      if (variant === 'gold' || variant === 'mega') {
        fireScreenClass('vfx-ca-fire', 480);
      }
    };

    scoringVFX.callbacks.starRipple = (intensity) => {
      const id = ++nextId.current;
      const event: StarRippleEvent = { kind: 'starRipple', id, intensity };
      setEffects((prev) => [...prev, event]);
      // Lifetime: 1100ms (3 staggered rings × 300ms expand + 200ms fade tail).
      window.setTimeout(() => removeEffect(id), 1100);
    };

    scoringVFX.callbacks.constellationSeal = (glyph, color, name) => {
      const id = ++nextId.current;
      const event: ConstellationSealEvent = { kind: 'constellationSeal', id, glyph, color, name };
      setEffects((prev) => [...prev, event]);
      // Hold + fade ~1500ms to match the existing TargetBeatStamp lifetime.
      window.setTimeout(() => removeEffect(id), 1500);
    };

    scoringVFX.callbacks.conductiveArcs = (diePositions, accent) => {
      const id = ++nextId.current;
      const event: ConductiveArcsEvent = { kind: 'conductiveArcs', id, diePositions, accent };
      setEffects((prev) => [...prev, event]);
      // Stagger 80ms per arc + 200ms hold + 200ms fade. Cap at 8 dice.
      const lifetime = 80 * Math.min(8, diePositions.length) + 400;
      window.setTimeout(() => removeEffect(id), lifetime);
    };

    return () => {
      scoringVFX.callbacks.slam = null;
      scoringVFX.callbacks.targetBeat = null;
      scoringVFX.callbacks.bail = null;
      scoringVFX.callbacks.boom = null;
      scoringVFX.callbacks.starRipple = null;
      scoringVFX.callbacks.constellationSeal = null;
      scoringVFX.callbacks.conductiveArcs = null;
    };
  }, [removeEffect]);

  return (
    <div
      id="vfx-scoring-layer"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        // Was a raw 9998 — bumped down to Z.fx (10) so modals (50+),
        // arrival banners (40), and the boss banner (30) cover the
        // score particles cleanly. Toasts (12) and the DieTip (11)
        // also win, which is correct: those are explicit feedback for
        // the player's action and shouldn't disappear under a boom.
        zIndex: Z.fx,
        overflow: 'hidden',
      }}
    >
      {/* Screen-level overlays (godrays/vignette/flash/time-dilate) — toggled via classes */}
      <div className="vfx-vignette" />
      <div className="vfx-godrays" />
      <div className="vfx-timedilate" />
      <div className="vfx-flash" />

      {/* Scene-affecting effects sit OUTSIDE the centered effects-layer
          so they fill the whole viewport (cosmos backdrop, edge-to-edge
          meteor streaks, conductive arcs spanning to dice positions). */}
      {effects.map((eff) => {
        if (eff.kind === 'starRipple') return <StarRipple key={eff.id} intensity={eff.intensity} />;
        if (eff.kind === 'conductiveArcs') return <ConductiveArcs key={eff.id} diePositions={eff.diePositions} accent={eff.accent} />;
        return null;
      })}

      {/* Effects layer (positioned at viewport center). The chromatic
          aberration filter is applied on this wrapper so all child SVG
          + DOM particles inherit the channel shift. */}
      <div className="vfx-effects-layer">
        {effects.map((eff) => {
          if (eff.kind === 'slam') return <MultSlam key={eff.id} label={eff.label} color={eff.color} />;
          if (eff.kind === 'target') return <TargetBeatStamp key={eff.id} />;
          if (eff.kind === 'bail') return <BailStampInner key={eff.id} />;
          if (eff.kind === 'constellationSeal') {
            return <ConstellationSeal key={eff.id} glyph={eff.glyph} color={eff.color} name={eff.name} />;
          }
          if (eff.kind === 'boom') {
            return (
              <BoomNumber
                key={eff.id}
                total={eff.total}
                variant={eff.variant}
                counterFx={eff.counterFx}
                counterFy={eff.counterFy}
                newBest={eff.newBest}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

export default ScoringVFX;
