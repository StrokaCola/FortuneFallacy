// Tiny pub/sub for inspector cross-tab state. Mirrors the bus.ts shape but
// keyed on a fixed set of fields. Lives outside React so plain modules
// (BoundsOverlay's RAF loop, the element registry) can read/write without
// hooks, and tabs can subscribe via useInspectorState().
import { useSyncExternalStore } from 'react';

export type InspectorOverride = {
  dx: number;
  dy: number;
  scale: number;
  rotate: number;
};

export type SpawnLogEntry = {
  id: number;
  ts: number;
  key: string;
  x: number;
  y: number;
};

export type InspectorState = {
  pickerArmed: boolean;
  moveArmed: boolean;
  effectsOverlayOn: boolean;
  hoverId: string | null;
  selectedId: string | null;
  // Override map is mutated structurally on each write; consumers
  // compare references to detect changes.
  overrides: Record<string, InspectorOverride>;
  // Spawn log is a ring buffer; capped at SPAWN_CAP.
  spawnLog: SpawnLogEntry[];
};

const SPAWN_CAP = 200;

const initial: InspectorState = {
  pickerArmed: false,
  moveArmed: false,
  effectsOverlayOn: false,
  hoverId: null,
  selectedId: null,
  overrides: {},
  spawnLog: [],
};

let state: InspectorState = initial;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) {
    try { l(); } catch (e) { console.error('[inspector] listener threw', e); }
  }
}

export function getInspectorState(): InspectorState {
  return state;
}

export function subscribeInspector(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function useInspectorState<T>(selector: (s: InspectorState) => T): T {
  return useSyncExternalStore(
    subscribeInspector,
    () => selector(state),
    () => selector(initial),
  );
}

export function setInspector(patch: Partial<InspectorState>): void {
  state = { ...state, ...patch };
  emit();
}

export function setOverride(id: string, patch: Partial<InspectorOverride>): void {
  const cur = state.overrides[id] ?? { dx: 0, dy: 0, scale: 1, rotate: 0 };
  const next = { ...cur, ...patch };
  state = { ...state, overrides: { ...state.overrides, [id]: next } };
  emit();
}

export function clearOverride(id: string): void {
  if (!(id in state.overrides)) return;
  const next = { ...state.overrides };
  delete next[id];
  state = { ...state, overrides: next };
  emit();
}

export function clearAllOverrides(): void {
  state = { ...state, overrides: {} };
  emit();
}

export function replaceOverrides(map: Record<string, InspectorOverride>): void {
  state = { ...state, overrides: { ...map } };
  emit();
}

export function pushSpawn(entry: Omit<SpawnLogEntry, 'id'>): void {
  const id = nextSpawnId++;
  const log = state.spawnLog.length >= SPAWN_CAP
    ? state.spawnLog.slice(state.spawnLog.length - SPAWN_CAP + 1)
    : state.spawnLog.slice();
  log.push({ ...entry, id });
  state = { ...state, spawnLog: log };
  emit();
}

export function clearSpawnLog(): void {
  state = { ...state, spawnLog: [] };
  emit();
}

let nextSpawnId = 1;

export const DEFAULT_OVERRIDE: InspectorOverride = { dx: 0, dy: 0, scale: 1, rotate: 0 };
