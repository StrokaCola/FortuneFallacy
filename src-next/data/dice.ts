// Dice descriptor: how a single die looks and behaves.
//
// A constellation declares a `DiceSpec` (an array of `DieSpec`) which fully
// determines the dice rolled for that run. The simulation, scoring, and HUD
// all read through helpers in `core/run/diceContext.ts` rather than assuming
// the legacy "5 × d6 with faces 1..6" shape.

export type DieFace = number | 'WILD' | 'BLANK';

export type DieBehavior =
  | 'plain'
  | 'exploding'   // rolling max face triggers a bonus re-roll added on top
  | 'burning'     // face === 1 removes die for rest of blind
  | 'sparking'    // face === max grants permanent +1 mult next hand
  | 'linked';     // rolls identical to its linked partner (paired indices)

export type DieSpec = {
  faces: DieFace[];
  behavior?: DieBehavior;
  link?: number;
  display?: { glyph?: string; tint?: string; label?: string };
};

export type DiceSpec = DieSpec[];

const RANGE_CACHE = new Map<number, number[]>();
function rangeFaces(n: number): number[] {
  const cached = RANGE_CACHE.get(n);
  if (cached) return cached;
  const out = Array.from({ length: n }, (_, i) => i + 1);
  RANGE_CACHE.set(n, out);
  return out;
}

export const d6Plain   = (): DieSpec => ({ faces: rangeFaces(6),  display: { label: 'd6'   } });
export const d4Plain   = (): DieSpec => ({ faces: rangeFaces(4),  display: { label: 'd4'   } });
export const d8Plain   = (): DieSpec => ({ faces: rangeFaces(8),  display: { label: 'd8'   } });
export const d10Plain  = (): DieSpec => ({ faces: rangeFaces(10), display: { label: 'd10'  } });
export const d12Plain  = (): DieSpec => ({ faces: rangeFaces(12), display: { label: 'd12'  } });
export const d20Plain  = (): DieSpec => ({ faces: rangeFaces(20), display: { label: 'd20'  } });
export const d100Plain = (): DieSpec => ({ faces: rangeFaces(100), display: { label: 'd100' } });

export const dN = (faces: DieFace[], display?: DieSpec['display']): DieSpec => ({ faces, display });

// Treat 'WILD' and 'BLANK' as 0-valued for any sum/face-arithmetic step. The
// SCORING phase substitutes WILD with the best concrete value before this
// matters for combo detection.
export function faceValue(f: DieFace): number {
  if (typeof f === 'number') return f;
  return 0;
}

export function maxNumericFace(faces: readonly DieFace[]): number {
  let max = 0;
  for (const f of faces) if (typeof f === 'number' && f > max) max = f;
  return max;
}

export function describeDiceSpec(spec: DiceSpec): string {
  if (spec.length === 0) return '—';
  const counts = new Map<string, number>();
  for (const die of spec) {
    const label = die.display?.label ?? `d${die.faces.length}`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  if (counts.size === 1) {
    const [label, n] = [...counts.entries()][0]!;
    return n === 1 ? label : `${n} × ${label}`;
  }
  return [...counts.entries()].map(([label, n]) => (n === 1 ? label : `${n}×${label}`)).join(' ');
}
