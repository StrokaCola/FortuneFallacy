import { safeReadJSON, safeWriteJSON } from '../state/storage';

export type SeedEntry = { name: string; seed: number; note?: string };

const KEY = 'dev:seeds';

export function listSeeds(): SeedEntry[] {
  const parsed = safeReadJSON(KEY);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isSeedEntry);
}

export function saveSeed(entry: SeedEntry): void {
  const all = listSeeds().filter((s) => s.name !== entry.name);
  all.push(entry);
  safeWriteJSON(KEY, all);
}

export function deleteSeed(name: string): void {
  const all = listSeeds().filter((s) => s.name !== name);
  safeWriteJSON(KEY, all);
}

function isSeedEntry(x: unknown): x is SeedEntry {
  if (x === null || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o.name === 'string' && typeof o.seed === 'number';
}
