import { COMBOS, type ComboDef } from './combos';

export type ComboMatchResult = ComboDef;

export function detectCombo(faces: readonly number[]): ComboMatchResult {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const f of faces) {
    if (f >= 1 && f <= 6) counts[f]! += 1;
  }
  const vals = counts.filter((c) => c > 0).sort((a, b) => b - a);

  const present = [...new Set(faces)].sort((a, b) => a - b);
  let seq = 1;
  let best = present.length > 0 ? 1 : 0;
  for (let i = 1; i < present.length; i++) {
    seq = present[i] === present[i - 1]! + 1 ? seq + 1 : 1;
    if (seq > best) best = seq;
  }

  for (const c of COMBOS) {
    if (c.test(vals, best)) return { ...c };
  }
  return { ...COMBOS[COMBOS.length - 1]! };
}
