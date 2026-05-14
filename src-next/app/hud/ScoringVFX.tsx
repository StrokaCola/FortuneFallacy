import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { triggerShake } from '../visual/screenShake';
import { Z } from './zLayers';

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

type Effect = SlamEvent | StampEvent | BoomEvent;

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
  const cracks = [];
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
      const color = colors[i % colors.length];
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
          {s.variant === 0 && <Sparkle4 size={s.size} color={s.color} />}
          {s.variant === 1 && <Star5 size={s.size + 2} color={s.color} />}
          {s.variant === 2 && <Burst6 size={s.size} color={s.color} />}
        </div>
      ))}
    </div>
  );
}

function ConfettiRain({ count = 28 }: { count?: number }) {
  const pieces = useMemo(() => {
    const colors = ['#ffd97a', '#f5c451', '#b18bff', '#7be3ff'];
    return Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 600,
      dur: 1800 + Math.random() * 900,
      drift: (Math.random() - 0.5) * 200,
      rot: (Math.random() > 0.5 ? 1 : -1) * (540 + Math.random() * 720),
      color: colors[i % colors.length],
      size: 10 + Math.random() * 8,
      variant: i % 3,
    }));
  }, [count]);
  return (
    <div className="vfx-boom-confetti">
      {pieces.map((p, i) => (
        <div
          key={i}
          className="vfx-confetti-piece"
          style={{
            left: `${p.left}%`,
            ['--delay' as never]: `${p.delay}ms`,
            ['--dur' as never]: `${p.dur}ms`,
            ['--drift' as never]: `${p.drift}px`,
            ['--rot' as never]: `${p.rot}deg`,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.dur}ms`,
          } as React.CSSProperties}
        >
          {p.variant === 0 && <Sparkle4 size={p.size} color={p.color} />}
          {p.variant === 1 && <Shard size={p.size * 1.5} color={p.color} />}
          {p.variant === 2 && <Burst6 size={p.size} color={p.color} />}
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
  return (
    <div className="vfx-stamp-root">
      <Sunburst color="#f5c451" spokes={Math.round(20 + INTENSITY * 2)} />
      <div className="vfx-stamp-text">TARGET BEAT</div>
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
  const [phase, setPhase] = useState<'pop' | 'fly'>('pop');

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase('fly'), 1700);
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
        <BoomSparks count={variant === 'mega' ? 36 : variant === 'gold' ? 28 : 18} />
      )}

      <div
        className={`vfx-boom-number ${variant} ${phase}`}
        style={
          phase === 'fly'
            ? ({ ['--fx' as never]: `${counterFx}px`, ['--fy' as never]: `${counterFy}px` } as React.CSSProperties)
            : undefined
        }
      >
        {total.toLocaleString()}
      </div>

      {(variant === 'gold' || variant === 'mega') && (
        <ConfettiRain count={variant === 'mega' ? 36 : 24} />
      )}

      {phase === 'fly' && <StarTrails count={variant === 'mega' ? 14 : 10} targetX={counterFx} targetY={counterFy} />}

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
};

export const scoringVFX = {
  callbacks: {
    slam: null,
    targetBeat: null,
    bail: null,
    boom: null,
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

    return () => {
      scoringVFX.callbacks.slam = null;
      scoringVFX.callbacks.targetBeat = null;
      scoringVFX.callbacks.bail = null;
      scoringVFX.callbacks.boom = null;
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

      {/* Effects layer (positioned at viewport center). The chromatic
          aberration filter is applied on this wrapper so all child SVG
          + DOM particles inherit the channel shift. */}
      <div className="vfx-effects-layer">
        {effects.map((eff) => {
          if (eff.kind === 'slam') return <MultSlam key={eff.id} label={eff.label} color={eff.color} />;
          if (eff.kind === 'target') return <TargetBeatStamp key={eff.id} />;
          if (eff.kind === 'bail') return <BailStampInner key={eff.id} />;
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
