import { detectCombo } from '../scoring/detectCombo';
import { lookupMod } from './index';

/**
 * Resolve Wildcard mod faces to whatever values maximize the combo tier of
 * the held/scoring set. Pure function: returns a new face array (mutated only
 * at wildcard die positions). Wildcard dice that are showing 1 while
 * `lockOnes` is true are NOT remapped (Pluto debuff).
 *
 * Tiebreak: highest base chips, then highest sum-of-faces (rough proxy for
 * "strongest hand"). With 1-2 wildcard dice this is at most 36 evaluations.
 */
export function resolveWildcards(
  faces: number[],
  diceMods: string[][],
  scoringIdxs: number[],
  lockOnes = false,
): { faces: number[]; events: { dieIdx: number; modId: string; faceValue: number }[] } {
  const wildcardIdxs: number[] = [];
  for (const idx of scoringIdxs) {
    const mods = diceMods[idx] ?? [];
    const hasWild = mods.some((id) => lookupMod(id)?.wildcard);
    if (!hasWild) continue;
    if (lockOnes && faces[idx] === 1) continue;
    wildcardIdxs.push(idx);
  }
  if (wildcardIdxs.length === 0) return { faces, events: [] };

  // Cap search size — combinatorial explosion past 3 wildcards is unrealistic.
  const searchIdxs = wildcardIdxs.slice(0, 3);

  let bestFaces = [...faces];
  let bestKey = scoreKey(faces, scoringIdxs);
  const total = 6 ** searchIdxs.length;
  for (let n = 0; n < total; n++) {
    const trial = [...faces];
    let m = n;
    for (const idx of searchIdxs) {
      trial[idx] = (m % 6) + 1;
      m = Math.floor(m / 6);
    }
    const key = scoreKey(trial, scoringIdxs);
    if (key > bestKey) {
      bestKey = key;
      bestFaces = trial;
    }
  }

  const events = wildcardIdxs
    .filter((idx) => bestFaces[idx] !== faces[idx])
    .map((idx) => ({
      dieIdx: idx,
      modId: firstWildcardModId(diceMods[idx] ?? []) ?? 'wildcard',
      faceValue: faces[idx]!,
    }));
  return { faces: bestFaces, events };
}

function scoreKey(faces: number[], scoringIdxs: number[]): number {
  const heldFaces = scoringIdxs.map((i) => faces[i]!);
  const combo = detectCombo(heldFaces);
  const sum = heldFaces.reduce((s, f) => s + f, 0);
  // tier dominates; chips dominate within tier; sumFaces is the final tiebreak.
  return combo.tier * 100000 + combo.chips * 100 + sum;
}

function firstWildcardModId(mods: string[]): string | undefined {
  for (const id of mods) {
    if (lookupMod(id)?.wildcard) return id;
  }
  return undefined;
}
