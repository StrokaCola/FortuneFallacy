import { store, type GameState } from './store';

const KEY = 'ff_next_save';

type SavedState = Pick<GameState, 'run' | 'meta' | 'round' | 'ui'>;

export function loadSaved(): SavedState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedState;
  } catch {
    return null;
  }
}

export function startPersistence(): () => void {
  let timer: number | null = null;
  return store.subscribe((s) => {
    if (timer != null) return;
    timer = window.setTimeout(() => {
      timer = null;
      try {
        const snapshot: SavedState = { run: s.run, meta: s.meta, round: s.round, ui: s.ui };
        localStorage.setItem(KEY, JSON.stringify(snapshot));
      } catch { /* ignore */ }
    }, 400);
  });
}

export function applySavedToInitial(s: GameState): GameState {
  const saved = loadSaved();
  if (!saved) return s;
  return {
    ...s,
    run:   { ...s.run,   ...saved.run   },
    meta:  { ...s.meta,  ...saved.meta  },
    round: saved.round?.active ? { ...s.round, ...saved.round, handInProgress: false } : s.round,
    ui:    { ...s.ui, screen: saved.ui?.screen ?? s.ui.screen },
  };
}
