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

import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { bus } from '../../../events/bus';
import { store } from '../../../state/store';
import { Z } from '../zLayers';
import { lookupResonance } from '../../../data/resonances';

const FLY_DURATION_MS = 700;

type Floater = {
  id: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  text: string;
  color: string;
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

function getCounterCenter(): { x: number; y: number } | null {
  const el = document.querySelector<HTMLElement>('[data-score-counter]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
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
    return value > 0 ? `+${value} chips` : `${value} chips`;
  }
  // upgrade-mult: positive = additive bonus.
  return value > 0 ? `+${value} mult` : `${value} mult`;
}

let nextId = 1;

export function FlyToCounter() {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  // Per-resonance lit-up class toggles on member cards. Cleared on
  // cast-swell so each new hand starts fresh.
  const litMembersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const offBeat = bus.on('onScoreBeat', ({ beat }) => {
      if (motionReduced()) return;
      if (beat.kind !== 'upgrade-chip' && beat.kind !== 'upgrade-mult') return;
      const sourceType = beat.sourceType ?? 'unknown';
      const sourceId = beat.sourceId;
      const dieIdx = (beat.kind === 'upgrade-chip' || beat.kind === 'upgrade-mult') ? beat.dieIdx : undefined;
      const value = beat.kind === 'upgrade-chip' ? beat.chipDelta : beat.multDelta;
      const text = formatBeatText(beat.kind, value);

      // Resolve start position by source.
      let start: { x: number; y: number } | null = null;
      let label = text;
      if (sourceType === 'catalyst' && sourceId) {
        start = getCatalystCardCenter(sourceId);
      } else if (sourceType === 'mod') {
        if (typeof dieIdx === 'number') start = getDieScreenByIdx(dieIdx);
      } else if (sourceType === 'resonance' && sourceId) {
        // Light up BOTH members + start arc from midpoint between them.
        const pair = lookupResonance(sourceId);
        if (pair) {
          const members = [pair.a, pair.b];
          const a = getCatalystCardCenter(members[0]!);
          const b = getCatalystCardCenter(members[1]!);
          if (a && b) {
            start = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            label = `${pair.name} · ${text}`;
            // Light up the member cards for the floater's flight.
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

      const end = getCounterCenter();
      if (!end) return;

      const color = SOURCE_COLOR[sourceType] ?? '#bba8ff';
      const orphan = start == null;
      if (!start) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        start = { x: w / 2, y: h * 0.55 };
      }
      const id = nextId++;
      const f: Floater = { id, x0: start.x, y0: start.y, x1: end.x, y1: end.y, text: label, color, orphan };
      setFloaters((cur) => [...cur, f]);
      window.setTimeout(() => {
        setFloaters((cur) => cur.filter((x) => x.id !== id));
      }, FLY_DURATION_MS + 80);
    });
    const offReset = bus.on('onScoreBeat', ({ beat }) => {
      if (beat.kind === 'cast-swell') {
        // New hand begins — clear any stale lit-member state.
        for (const memberId of litMembersRef.current) {
          const el = document.querySelector<HTMLElement>(`[data-catalyst-id="${memberId}"]`);
          if (el) el.classList.remove('theater-resonance-lit');
        }
        litMembersRef.current.clear();
      }
    });
    return () => { offBeat(); offReset(); };
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
  const style: React.CSSProperties & Record<string, string | number> = {
    position: 'absolute',
    left: f.x0,
    top: f.y0,
    transform: 'translate(-50%, -50%)',
    color: f.color,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: f.orphan ? 14 : 13,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textShadow: `0 0 8px ${f.color}, 0 0 14px ${f.color}55`,
    whiteSpace: 'nowrap',
    animation: `theater-fly-to-counter ${FLY_DURATION_MS}ms cubic-bezier(0.35, 0.05, 0.2, 1) forwards`,
    willChange: 'transform, opacity',
    pointerEvents: 'none',
    ['--fly-dx' as string]: `${dx}px`,
    ['--fly-dy' as string]: `${dy}px`,
  };
  return <div style={style}>{f.text}</div>;
}
