import type { UpgradeDef, Phase } from '../pipeline/types';

const registry = new Map<string, UpgradeDef>();

export function register(def: UpgradeDef): void {
  if (registry.has(def.id)) {
    throw new Error(`[upgrades] duplicate id: ${def.id}`);
  }
  registry.set(def.id, def);
}

export function unregister(id: string): void {
  registry.delete(id);
}

export function getAll(): UpgradeDef[] {
  return [...registry.values()];
}

export function getByPhase(phase: Phase): UpgradeDef[] {
  return getAll()
    .filter((u) => u.phase === phase)
    .sort((a, b) => a.priority - b.priority);
}

export function clearRegistry(): void {
  registry.clear();
}
