// Wave T Scoring Theater (Batch H, 2026-05-19) — per-trigger
// attribution floater. Listens to onScoreBeat for upgrade-chip /
// upgrade-mult beats, reads the beat's sourceType/sourceId/dieIdx,
// resolves a screen-space anchor (catalyst card, mod-bearing die,
// resonance pair midpoint), and arcs a "+N chips" / "×N mult"
// floater from that anchor to the score counter.
//
// Replaces the audit-flagged "floater pops up and fades" pattern with
// Balatro-style directional flight that visually attributes each
// contribution to its source.
//
// Wave T+1 (2026-05-19) Balatro polish:
//   - Queued dispatch: floaters dequeue at min 110ms spacing so rapid
//     same-frame events read as separate pops (Balatro pacing).
//   - Value-scaled fontSize: log10(|delta|) → bigger numbers visibly
//     bigger.
//   - Mult slam-impact: upgrade-mult floaters skip the arc and
//     center-slam at the counter with a screen-shake on big deltas.

import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { bus } from '../../../events/bus';
import { store } from '../../../state/store';
import { Z } from '../zLayers';
import { lookupResonance } from '../../../data/resonances';
import { triggerShake } from '../../visual/screenShake';
import { beatIntensity } from '../../../core/scoring/types';

const FLY_DURATION_MS = 700;
const SLAM_DURATION_MS = 1000;
const QUEUE_SPACING_MS = 110;
const MULT_SHAKE_THRESHOLD = 3;

type FloaterKind = 'chip' | 'mult';

type Floater = {
  id: number;
  kind: FloaterKind;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  text: string;
  color: string;
  fontSize: number;
  // True when the floater's anchor is unknown (no DOM/canvas position
  // could be resolved). Such floaters render center-of-screen so the
  // event is still SEEN, just not attributed.
  orphan: boolean;
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

function getCatalystCardCenter(id: string): { x: number; y: number } | null {
  const el = document.querySelector<HTMLElement>(`[data-catalyst-id="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function getScoringDieScreenPositions(): Array<{ x: number; y: number }> {
  if (typeof window === 'undefined') return [];
  const d3 = (window as unknown as { __dice3d?: { getScoringDieScreenPositions: () => Array<{ x: number; y: number }> } }).__dice3d;
  if (!d3 || typeof d3.getScoringDieScreenPositions !== 'function') return [];
  try { return d3.getScoringDieScreenPositions(); } catch { return []; }
}

// Mod beats carry dieIdx of the die that triggered the fire. The 3D
// canvas returns positions in scoringOrder; zip scoringOrder with the
// returned positions to find the screen pos for the requested
// original die index.
function getDieScreenByIdx(dieIdx: number): { x: number; y: number } | null {
  if (typeof window === 'undefined') return null;
  const scoringOrder = store.getState().round.scoringOrder ?? [];
  const positions = getScoringDieScreenPositions();
  if (positions.length === 0) return null;
  // Walk the scoring order in the same way Dice3D builds positions:
  // first the dice listed in scoringOrder (skipping unlocked),
  // then any remaining locked dice. We can only fast-match the first
  // chunk reliably without the original die.locked snapshot, so fall
  // back to "first position" if the index isn't found.
  let cursor = 0;
  for (const idx of scoringOrder) {
    if (idx === dieIdx) return positions[cursor] ?? null;
    cursor += 1;
  }
  return null;
}

function formatBeatText(kind: 'upgrade-chip' | 'upgrade-mult', value: number): string {
  if (kind === 'upgrade-chip') {
    return value > 0 ? `+${value} pips` : `${value} pips`;
  }
  // upgrade-mult: positive = additive bonus.
  return value > 0 ? `+${value} mult` : `${value} mult`;
}

// Value-magnitude scaled fontSize. Small chip nudges stay readable
// (12-14px); big late-game catalysts pop to the 22px cap. log10
// keeps the ramp gentle so a +500 doesn't dwarf a +50.
function scaledFontSize(absValue: number, isMult: boolean): number {
  const magnitude = Math.max(1, absValue);
  const base = isMult ? 14 : 12;
  const px = base + Math.log10(magnitude) * 4.0;
  const cap = isMult ? 24 : 22;
  return Math.round(Math.min(cap, Math.max(base, px)));
}

let nextId = 1;

type PendingBeat = {
  kind: 'upgrade-chip' | 'upgrade-mult';
  sourceType: string;
  sourceId?: string;
  dieIdx?: number;
  value: number;
  text: string;
  // Wave T+1 (2026-05-19) — importance scales font/glow/spawn punch
  // so a major catalyst fire visually dwarfs a minor mod tick.
  intensity: number;
  triggerReason?: string;
  retrigger?: boolean;
};

export function FlyToCounter() {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  // Per-resonance lit-up class toggles on member cards. Cleared on
  // cast-swell so each new hand starts fresh.
  const litMembersRef = useRef<Set<string>>(new Set());
  // Wave T+1 (2026-05-19) — beat queue. Floaters spawn at min
  // QUEUE_SPACING_MS intervals so rapid same-frame upgrade beats
  // read as separate pops (Balatro pacing). Mult floaters DO go
  // through the queue so they don't visually overlap chip pops, but
  // their render path is the slam-impact, not the arc.
  const queueRef = useRef<PendingBeat[]>([]);
  const lastDispatchRef = useRef<number>(0);
  const dispatchTimerRef = useRef<number | null>(null);
  // Wave T+1 (2026-05-19) clarity pass — per-source recent-spawn
  // tracker. When the same source (catalyst id / die idx) fires
  // multiple floaters within a 650ms window, each subsequent floater
  // gets a CUMULATIVE vertical offset (22px per stacked floater) so
  // the text labels stack readably. Stack counter resets per source
  // when 650ms idle elapses.
  const recentSourceSpawnRef = useRef<Map<string, { lastT: number; depth: number }>>(new Map());

  useEffect(() => {
    const spawnFloater = (pending: PendingBeat) => {
      const { kind, sourceType, sourceId, dieIdx, value, text } = pending;
      const isMult = kind === 'upgrade-mult';

      // Resolve start position by source.
      let start: { x: number; y: number } | null = null;
      let label = text;
      if (sourceType === 'catalyst' && sourceId) {
        start = getCatalystCardCenter(sourceId);
      } else if (sourceType === 'mod') {
        if (typeof dieIdx === 'number') start = getDieScreenByIdx(dieIdx);
      } else if (sourceType === 'resonance' && sourceId) {
        const pair = lookupResonance(sourceId);
        if (pair) {
          const members = [pair.a, pair.b];
          const a = getCatalystCardCenter(members[0]!);
          const b = getCatalystCardCenter(members[1]!);
          if (a && b) {
            start = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            label = `${pair.name} · ${text}`;
            for (const memberId of members) {
              const el = document.querySelector<HTMLElement>(`[data-catalyst-id="${memberId}"]`);
              if (el) {
                el.classList.add('theater-resonance-lit');
                litMembersRef.current.add(memberId);
                window.setTimeout(() => {
                  el.classList.remove('theater-resonance-lit');
                  litMembersRef.current.delete(memberId);
                }, FLY_DURATION_MS + 200);
              }
            }
          } else if (a || b) {
            start = a ?? b;
            label = `${pair.name} · ${text}`;
          }
        }
      }

      // Wave T+1 (2026-05-19) Balatro polish — floaters now RISE from
      // their origin (catalyst card / mod-bearing die / resonance
      // midpoint) and fade out, instead of arcing across the screen.
      // The CHIPS / MULT panels still ratchet in real time via direct
      // subscription in ScoreBreakdown so the math home updates with
      // the beat. Mults keep the slam-impact signature (bigger scale,
      // jitter, screen-shake on big deltas); chips rise simply.
      if (!start) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        start = { x: w / 2, y: h * 0.55 };
      }
      const color = SOURCE_COLOR[sourceType] ?? '#bba8ff';
      const orphan = start == null;

      // Wave T+1 — importance multiplier on font size. Minor beats
      // shrink ~10%, finale beats grow ~20%, layered on top of the
      // existing log-scaled magnitude sizing.
      const intensityMul = 0.9 + (pending.intensity ?? 0.4) * 0.35;

      // Wave T+1 (2026-05-19) clarity pass — per-source CUMULATIVE
      // stagger. The same catalyst / die firing rapid-fire stacks each
      // subsequent floater 22px above the prior one until 650ms of
      // idle resets the stack. Caps at 4 stacked floaters so a 5+
      // chain doesn't run off the top of the strip.
      const sourceKey = sourceType === 'mod'
        ? `mod:${typeof dieIdx === 'number' ? dieIdx : '?'}`
        : `${sourceType}:${sourceId ?? '?'}`;
      const now = performance.now();
      const prev = recentSourceSpawnRef.current.get(sourceKey);
      const elapsedSinceSource = prev ? now - prev.lastT : Infinity;
      const depth = elapsedSinceSource < 650 ? Math.min(4, (prev?.depth ?? 0) + 1) : 0;
      const stackOffset = depth * 22;
      recentSourceSpawnRef.current.set(sourceKey, { lastT: now, depth });
      if (stackOffset > 0) {
        start = { x: start.x, y: start.y - stackOffset };
      }

      if (isMult) {
        const id = nextId++;
        const f: Floater = {
          id,
          kind: 'mult',
          x0: start.x,
          y0: start.y,
          x1: start.x,
          y1: start.y,
          text: label,
          color,
          fontSize: Math.round(scaledFontSize(Math.abs(value), true) * intensityMul),
          orphan,
        };
        setFloaters((cur) => [...cur, f]);
        if (Math.abs(value) >= MULT_SHAKE_THRESHOLD) {
          try { triggerShake('tiny'); } catch { /* shake utility missing */ }
        }
        window.setTimeout(() => {
          setFloaters((cur) => cur.filter((x) => x.id !== id));
        }, SLAM_DURATION_MS + 60);
        return;
      }

      const id = nextId++;
      const f: Floater = {
        id,
        kind: 'chip',
        x0: start.x,
        y0: start.y,
        x1: start.x,
        y1: start.y,
        text: label,
        color,
        fontSize: Math.round(scaledFontSize(Math.abs(value), false) * intensityMul),
        orphan,
      };
      setFloaters((cur) => [...cur, f]);
      window.setTimeout(() => {
        setFloaters((cur) => cur.filter((x) => x.id !== id));
      }, FLY_DURATION_MS + 80);
    };

    const drain = () => {
      dispatchTimerRef.current = null;
      const next = queueRef.current.shift();
      if (!next) return;
      lastDispatchRef.current = performance.now();
      spawnFloater(next);
      if (queueRef.current.length > 0) {
        dispatchTimerRef.current = window.setTimeout(drain, QUEUE_SPACING_MS);
      }
    };

    const enqueue = (pending: PendingBeat) => {
      const now = performance.now();
      const elapsed = now - lastDispatchRef.current;
      // Empty queue + enough elapsed since last dispatch = fire now.
      if (queueRef.current.length === 0 && elapsed >= QUEUE_SPACING_MS && dispatchTimerRef.current == null) {
        lastDispatchRef.current = now;
        spawnFloater(pending);
        return;
      }
      queueRef.current.push(pending);
      if (dispatchTimerRef.current == null) {
        const wait = Math.max(0, QUEUE_SPACING_MS - elapsed);
        dispatchTimerRef.current = window.setTimeout(drain, wait);
      }
    };

    const offBeat = bus.on('onScoreBeat', ({ beat }) => {
      if (motionReduced()) return;
      if (beat.kind !== 'upgrade-chip' && beat.kind !== 'upgrade-mult') return;
      const sourceType = beat.sourceType ?? 'unknown';
      const sourceId = beat.sourceId;
      const dieIdx = beat.dieIdx;
      const value = beat.kind === 'upgrade-chip' ? beat.chipDelta : beat.multDelta;
      // Wave T+1 (2026-05-19) clarity pass — floater text reverted to
      // bare delta. Source attribution comes from the BeatTracer arc
      // anchored at the source card; appending the triggerReason here
      // stacked long labels at the catalyst position and tangled when
      // multiple beats fired from the same card.
      const text = formatBeatText(beat.kind, value);
      enqueue({
        kind: beat.kind, sourceType, sourceId, dieIdx, value, text,
        intensity: beatIntensity(beat),
        triggerReason: beat.triggerReason,
        retrigger: beat.retrigger,
      });
    });

    const offReset = bus.on('onScoreBeat', ({ beat }) => {
      if (beat.kind === 'cast-swell') {
        // New hand begins — clear any stale lit-member state and any
        // queued floaters from a previous (interrupted) sequence.
        for (const memberId of litMembersRef.current) {
          const el = document.querySelector<HTMLElement>(`[data-catalyst-id="${memberId}"]`);
          if (el) el.classList.remove('theater-resonance-lit');
        }
        litMembersRef.current.clear();
        queueRef.current = [];
        if (dispatchTimerRef.current != null) {
          clearTimeout(dispatchTimerRef.current);
          dispatchTimerRef.current = null;
        }
        lastDispatchRef.current = 0;
        // Clear per-source spawn tracker so stale offsets from prior
        // sequence don't bleed in.
        recentSourceSpawnRef.current.clear();
      }
    });
    return () => {
      offBeat();
      offReset();
      if (dispatchTimerRef.current != null) {
        clearTimeout(dispatchTimerRef.current);
        dispatchTimerRef.current = null;
      }
      queueRef.current = [];
    };
  }, []);

  if (floaters.length === 0) return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', inset: 0,
        pointerEvents: 'none',
        zIndex: Z.fx,
        overflow: 'hidden',
      }}
    >
      {floaters.map((f) => (
        <FlyToCounterFloater key={f.id} f={f} />
      ))}
    </div>
  );
}

function FlyToCounterFloater({ f }: { f: Floater }) {
  const dx = f.x1 - f.x0;
  const dy = f.y1 - f.y0;
  const isMult = f.kind === 'mult';
  const style: React.CSSProperties & Record<string, string | number> = {
    position: 'absolute',
    left: f.x0,
    top: f.y0,
    transform: 'translate(-50%, -50%)',
    color: f.color,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: f.fontSize,
    fontWeight: isMult ? 800 : 700,
    letterSpacing: isMult ? '0.08em' : '0.04em',
    textShadow: isMult
      ? `0 0 14px ${f.color}, 0 0 26px ${f.color}88, 0 2px 0 rgba(0,0,0,0.45)`
      : `0 0 8px ${f.color}, 0 0 14px ${f.color}55`,
    whiteSpace: 'nowrap',
    animation: isMult
      ? `theater-mult-slam-impact ${SLAM_DURATION_MS}ms cubic-bezier(0.2, 1.4, 0.4, 1) forwards`
      : `theater-fly-to-counter ${FLY_DURATION_MS}ms cubic-bezier(0.35, 0.05, 0.2, 1) forwards`,
    willChange: 'transform, opacity',
    pointerEvents: 'none',
    ['--fly-dx' as string]: `${dx}px`,
    ['--fly-dy' as string]: `${dy}px`,
  };
  return <div style={style} className={isMult ? 'theater-mult-slam-impact' : undefined}>{f.text}</div>;
}
