export type SeedEntry = { name: string; seed: number; note?: string };

const KEY = 'dev:seeds';

export function listSeeds(): SeedEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSeedEntry);
  } catch {
    return [];
  }
}

export function saveSeed(entry: SeedEntry): void {
  const all = listSeeds().filter((s) => s.name !== entry.name);
  all.push(entry);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* ignore */ }
}

export function deleteSeed(name: string): void {
  const all = listSeeds().filter((s) => s.name !== name);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* ignore */ }
}

function isSeedEntry(x: unknown): x is SeedEntry {
  if (x === null || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o.name === 'string' && typeof o.seed === 'number';
}
