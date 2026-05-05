import { COMBOS, type ComboCtx, type ComboDef } from './combos';

export type ComboMatchResult = ComboDef;

export type DetectCtx = {
  comboCtx?: ComboCtx;
};

export function detectCombo(faces: readonly number[], ctx: DetectCtx = {}): ComboMatchResult {
  // Bucket counts by face value. Old code allocated a fixed length-7 array
  // because faces were always 1..6 — now we use a Map so faces from d12 / d100
  // / Fibonacci dice all bucket correctly.
  const counts = new Map<number, number>();
  for (const f of faces) {
    if (typeof f !== 'number') continue;
    counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  const vals = [...counts.values()].sort((a, b) => b - a);

  // Sequence detection: longest run of consecutive integer face values across
  // the dice presented. This works for any face universe (d6 / d12 / d100 /
  // mixed Polyhedra) because we just need consecutive integers.
  const present = [...new Set(faces.filter((f): f is number => typeof f === 'number'))].sort((a, b) => a - b);
  let seq = 1;
  let best = present.length > 0 ? 1 : 0;
  for (let i = 1; i < present.length; i++) {
    seq = present[i] === present[i - 1]! + 1 ? seq + 1 : 1;
    if (seq > best) best = seq;
  }

  for (const c of COMBOS) {
    if (c.test(vals, best, ctx.comboCtx)) return { ...c };
  }
  return { ...COMBOS[COMBOS.length - 1]! };
}
