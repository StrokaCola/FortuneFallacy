// Wave T+1 (2026-05-19) Scoring Architecture — BeatTracer.
//
// Listens to onScoreBeat upgrade-chip / upgrade-mult / combo-bonus.
// When the beat carries a known source (catalyst card / mod-bearing
// die / resonance pair midpoint) AND a known targetId ('pips' /
// 'mult'), draws a brief SVG arc from source DOM rect → target
// scoreboard panel rect. The arc reads as "this contribution flowed
// from HERE to HERE", giving the player visible cause-and-effect on
// every beat — not just the rising floater number.
//
// Intensity tier drives stroke width and glow so a major catalyst
// fire visually dwarfs a minor mod tick. Reduced-motion users skip
// the layer entirely (the floater + panel pulse still communicate
// the same information without the moving line).

import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { bus } from '../../../events/bus';
import { store } from '../../../state/store';
import { Z } from '../zLayers';
import { lookupResonance } from '../../../data/resonances';
import { beatIntensity } from '../../../core/scoring/types';
import type { BeatTarget } from '../../../core/scoring/types';

const TRACER_DURATION_MS = 360;

type Tracer = {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  glow: number;
  dashLen: number;
};

const SOURCE_COLOR: Record<string, string> = {
  catalyst: '#7be3ff',
  mod: '#ff9d4a',
  resonance: '#cc88ff',
  combo: '#f5c451',
  chain: '#f5c451',
  unknown: '#bba8ff',
};

function motionReduced(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('reduce-motion');
}

function getCenter(selector: string): { x: number; y: number } | null {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function getCatalystCenter(id: string): { x: number; y: number } | null {
  return getCenter(`[data-catalyst-id="${id}"]`);
}

function getDieScreenByIdx(dieIdx: number): { x: number; y: number } | null {
  if (typeof window === 'undefined') return null;
  const d3 = (window as unknown as { __dice3d?: { getScoringDieScreenPositions: () => Array<{ x: number; y: number }> } }).__dice3d;
  if (!d3 || typeof d3.getScoringDieScreenPositions !== 'function') return null;
  let positions: Array<{ x: number; y: number }> = [];
  try { positions = d3.getScoringDieScreenPositions(); } catch { return null; }
  if (positions.length === 0) return null;
  const scoringOrder = store.getState().round.scoringOrder ?? [];
  let cursor = 0;
  for (const idx of scoringOrder) {
    if (idx === dieIdx) return positions[cursor] ?? null;
    cursor += 1;
  }
  return null;
}

function getTargetCenter(targetId: BeatTarget): { x: number; y: number } | null {
  if (targetId === 'pips') return getCenter('[data-score-chips]');
  if (targetId === 'mult') return getCenter('[data-score-mult]');
  return getCenter('[data-score-counter]');
}

let nextId = 1;

export function BeatTracer() {
  const [tracers, setTracers] = useState<Tracer[]>([]);
  const cleanupRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const off = bus.on('onScoreBeat', ({ beat }) => {
      if (motionReduced()) return;
      // Wave T+1 (2026-05-19) UX loop 2 — combo-bonus now also traces
      // an arc (from screen-center-bottom dice cluster → PIPS panel)
      // so the combo's base contribution has visible causality, not
      // just a silent panel ratchet.
      if (beat.kind !== 'upgrade-chip' && beat.kind !== 'upgrade-mult' && beat.kind !== 'combo-bonus') return;
      const targetId: BeatTarget | undefined = beat.targetId
        ?? (beat.kind === 'upgrade-mult' ? 'mult' : 'pips');
      const sourceType = beat.sourceType ?? (beat.kind === 'combo-bonus' ? 'combo' : 'unknown');
      const sourceId = beat.sourceId;
      const dieIdx = 'dieIdx' in beat ? beat.dieIdx : undefined;

      // Resolve source position.
      let source: { x: number; y: number } | null = null;
      if (beat.kind === 'combo-bonus') {
        // Combo bonus originates from the playing dice cluster as a
        // group — pick the center of the scoring-die row so the arc
        // reads as "the combo itself contributed".
        if (typeof window !== 'undefined') {
          const d3 = (window as unknown as { __dice3d?: { getScoringDieScreenPositions: () => Array<{ x: number; y: number }> } }).__dice3d;
          if (d3 && typeof d3.getScoringDieScreenPositions === 'function') {
            try {
              const positions = d3.getScoringDieScreenPositions();
              if (positions.length > 0) {
                const sumX = positions.reduce((a, p) => a + p.x, 0);
                const sumY = positions.reduce((a, p) => a + p.y, 0);
                source = { x: sumX / positions.length, y: sumY / positions.length };
              }
            } catch { /* canvas not ready */ }
          }
        }
      } else if (sourceType === 'catalyst' && sourceId) {
        source = getCatalystCenter(sourceId);
      } else if (sourceType === 'mod' && typeof dieIdx === 'number') {
        source = getDieScreenByIdx(dieIdx);
      } else if (sourceType === 'resonance' && sourceId) {
        const pair = lookupResonance(sourceId);
        if (pair) {
          const a = getCatalystCenter(pair.a);
          const b = getCatalystCenter(pair.b);
          if (a && b) source = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          else if (a || b) source = a ?? b;
        }
      }
      if (!source) return;

      const target = getTargetCenter(targetId);
      if (!target) return;

      const intensity = beatIntensity(beat);
      const id = nextId++;
      const color = SOURCE_COLOR[sourceType] ?? '#bba8ff';
      const width = 1.5 + intensity * 2.5;        // 1.5 → 4.0
      const glow = 6 + intensity * 14;            // 6 → 20
      // Dash length scales with intensity so finale beats feel like a
      // continuous beam, minor beats stay thin dashed.
      const dashLen = 6 + intensity * 18;
      const tracer: Tracer = {
        id, x1: source.x, y1: source.y, x2: target.x, y2: target.y,
        color, width, glow, dashLen,
      };
      setTracers((cur) => [...cur, tracer]);
      const timer = window.setTimeout(() => {
        setTracers((cur) => cur.filter((t) => t.id !== id));
        cleanupRef.current.delete(id);
      }, TRACER_DURATION_MS + 80);
      cleanupRef.current.set(id, timer);
    });

    const cleanups = cleanupRef.current;
    const offReset = bus.on('onScoreBeat', ({ beat }) => {
      if (beat.kind === 'cast-swell') {
        for (const t of cleanups.values()) clearTimeout(t);
        cleanups.clear();
        setTracers([]);
      }
    });
    return () => {
      off();
      offReset();
      for (const t of cleanups.values()) clearTimeout(t);
      cleanups.clear();
    };
  }, []);

  if (tracers.length === 0) return null;
  return (
    <svg
      aria-hidden
      style={{
        position: 'fixed', inset: 0,
        pointerEvents: 'none',
        zIndex: Z.fx,
        width: '100vw', height: '100vh',
        overflow: 'visible',
      }}
    >
      {tracers.map((t) => (
        <BeatTracerArc key={t.id} t={t} />
      ))}
    </svg>
  );
}

function BeatTracerArc({ t }: { t: Tracer }) {
  // Quadratic Bezier with a control point lifted ~80px above the
  // midpoint so the arc reads as an "energy bridge" rather than a
  // straight line. Curve direction matches the visual flow: source at
  // bottom-left of catalyst strip / dice row → target up at the panel.
  const midX = (t.x1 + t.x2) / 2;
  const midY = (t.y1 + t.y2) / 2;
  const lift = Math.min(120, Math.max(40, Math.abs(t.x2 - t.x1) * 0.25));
  const cx = midX;
  const cy = midY - lift;
  const path = `M ${t.x1} ${t.y1} Q ${cx} ${cy} ${t.x2} ${t.y2}`;
  // Path length approximation for dash-draw animation. Quadratic
  // bezier exact length is complex; chord + curve heuristic close enough.
  const chord = Math.hypot(t.x2 - t.x1, t.y2 - t.y1);
  const approxLen = chord + lift;
  const style: React.CSSProperties & Record<string, string | number> = {
    strokeDasharray: approxLen,
    strokeDashoffset: approxLen,
    animation: `beat-tracer-draw ${TRACER_DURATION_MS}ms cubic-bezier(0.4, 0.0, 0.2, 1) forwards`,
    filter: `drop-shadow(0 0 ${t.glow}px ${t.color}aa)`,
    ['--tracer-len' as string]: `${approxLen}`,
  };
  // Wave T+1 (2026-05-19) choreography — three motes ride the arc
  // path with staggered delays, reading as energy traveling from
  // source to target. Each mote uses SVG animateMotion (declarative
  // path-following) so no per-frame JS; browser handles the curve
  // interpolation. Motes fade as they arrive, leaving a brief glow
  // residue at the target.
  const moteSize = 2.5 + Math.min(3.0, t.width * 0.6);
  const pathId = `tracer-path-${t.id}`;
  const moteOffsets = [0, 80, 160]; // begin times in ms
  return (
    <>
      <path
        id={pathId}
        d={path}
        fill="none"
        stroke={t.color}
        strokeWidth={t.width}
        strokeLinecap="round"
        strokeDasharray={`${t.dashLen} ${t.dashLen * 0.4}`}
        style={style}
      />
      {moteOffsets.map((delay, i) => (
        <circle
          key={`mote-${t.id}-${i}`}
          r={moteSize}
          fill={t.color}
          style={{
            filter: `drop-shadow(0 0 ${t.glow * 0.6}px ${t.color})`,
            opacity: 0,
            animation: `beat-mote-fade 240ms ease-out ${delay + 60}ms forwards`,
          }}
        >
          <animateMotion
            dur={`${TRACER_DURATION_MS - 80}ms`}
            begin={`${delay}ms`}
            fill="freeze"
            calcMode="spline"
            keySplines="0.3 0 0.4 1"
            keyTimes="0;1"
          >
            <mpath href={`#${pathId}`} />
          </animateMotion>
        </circle>
      ))}
    </>
  );
}
