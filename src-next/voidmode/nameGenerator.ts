// src-next/voidmode/nameGenerator.ts
// Pure, seeded name + flavor generators. No global state, no side effects.
// All randomness flows through the caller-supplied RNG.

import type { AffixDef } from './types';
import type { SeededRng } from '../core/rng';
import { FLAVOR_POOL, ALIAS_HEADS } from './nameData';

function pick<T>(rng: SeededRng, arr: ReadonlyArray<T>): T {
  return arr[Math.floor(rng.next() * arr.length)] as T;
}

export function generateItemName(baseName: string, affixes: ReadonlyArray<AffixDef>): string {
  const prefix = affixes.find(a => a.slot === 'prefix');
  const suffix = affixes.find(a => a.slot === 'suffix');
  const mid = affixes.find(a => a.slot === 'mid');

  let core = baseName;
  if (mid) {
    core = baseName.replace(/\s+/g, '-') + '-' + mid.nameTemplate;
  }

  const parts: string[] = [];
  if (prefix) parts.push(prefix.nameTemplate);
  parts.push(core);
  if (suffix) parts.push(suffix.nameTemplate);
  return parts.join(' ');
}

export function generateFlavor(rng: SeededRng, affixes: ReadonlyArray<AffixDef>): string {
  const tags = new Set<string>();
  for (const a of affixes) for (const t of a.flavorTags) tags.add(t);
  const matches = FLAVOR_POOL.filter(line => line.tags.some(t => tags.has(t)));
  if (matches.length === 0) {
    return pick(rng, FLAVOR_POOL).text;
  }
  return pick(rng, matches).text;
}

export function generateRunAlias(rng: SeededRng): string {
  const head = pick(rng, ALIAS_HEADS);
  const useNumber = rng.next() < 0.5;
  if (useNumber) {
    const n = Math.floor(rng.next() * 99) + 1;
    return `${head} ${n}`;
  }
  const tail = pick(rng, ALIAS_HEADS.filter(h => h !== head));
  return `${head} ${tail}`;
}
