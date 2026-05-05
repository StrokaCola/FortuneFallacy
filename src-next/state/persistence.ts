import { store, type GameState } from './store';
import { safeReadJSON, safeWriteJSON } from './storage';
import { migrateRetheme } from './migrations/v1_retheme';
import { SEEDED_UNLOCKS } from './slices/meta';

const KEY = 'ff_next_save';

type SavedState = Pick<GameState, 'run' | 'meta' | 'round' | 'ui'>;

export function loadSaved(): SavedState | null {
  const parsed = safeReadJSON(KEY);
  if (parsed === undefined) return null;
  return migrateRetheme(parsed) as SavedState;
}

export function startPersistence(): () => void {
  let timer: number | null = null;
  return store.subscribe((s) => {
    if (timer != null) return;
    timer = window.setTimeout(() => {
      timer = null;
      const snapshot: SavedState = { run: s.run, meta: s.meta, round: s.round, ui: s.ui };
      safeWriteJSON(KEY, snapshot);
    }, 400);
  });
}

export function applySavedToInitial(s: GameState): GameState {
  const saved = loadSaved();
  if (!saved) return s;
  const mergedMeta = { ...s.meta, ...saved.meta };
  // Saves predating the seeded-unlocks change can carry an empty or partial
  // unlocks array; union with the current seed so legacy players don't see
  // every constellation locked after upgrading.
  const savedUnlocks = saved.meta?.unlocks ?? [];
  mergedMeta.unlocks = Array.from(new Set([...SEEDED_UNLOCKS, ...savedUnlocks]));
  return {
    ...s,
    run:   { ...s.run,   ...saved.run   },
    meta:  mergedMeta,
    round: saved.round?.active ? { ...s.round, ...saved.round, handInProgress: false } : s.round,
    ui:    { ...s.ui, screen: saved.ui?.screen ?? s.ui.screen },
  };
}
