import type { GameState } from '../state/store';
import { safeReadJSON, safeWriteJSON } from '../state/storage';

const KEY = 'dev:snapshots';

type Bag = Record<string, GameState>;

function load(): Bag {
  const parsed = safeReadJSON(KEY);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return parsed as Bag;
}

function persist(bag: Bag): void {
  safeWriteJSON(KEY, bag);
}

export function listSnapshots(): { name: string; state: GameState }[] {
  const bag = load();
  return Object.keys(bag).sort().map((name) => ({ name, state: bag[name] }));
}

export function saveSnapshot(name: string, state: GameState): void {
  const bag = load();
  bag[name] = clone(state);
  persist(bag);
}

export function deleteSnapshot(name: string): void {
  const bag = load();
  delete bag[name];
  persist(bag);
}

export function getSnapshot(name: string): GameState | null {
  const bag = load();
  return bag[name] ?? null;
}

function clone<T>(v: T): T {
  if (typeof structuredClone === 'function') {
    try { return structuredClone(v); } catch { /* fall through */ }
  }
  return JSON.parse(JSON.stringify(v));
}
