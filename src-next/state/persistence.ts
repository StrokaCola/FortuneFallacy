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
  // Defensive defaults for fields added after a player's first save.
  mergedMeta.stakeProgress = mergedMeta.stakeProgress ?? {};
  mergedMeta.challengeWins = mergedMeta.challengeWins ?? [];
  const savedDisc = mergedMeta.discovered ?? {};
  mergedMeta.discovered = {
    catalysts: savedDisc.catalysts ?? [],
    mods: savedDisc.mods ?? [],
    vouchers: savedDisc.vouchers ?? [],
    bosses: savedDisc.bosses ?? [],
    consumables: savedDisc.consumables ?? [],
  };
  const mergedRun = { ...s.run, ...saved.run };
  mergedRun.stakeId = mergedRun.stakeId ?? 'spark';
  mergedRun.challengeId = mergedRun.challengeId ?? '';
  // Defensive defaults for fields that might be missing in older saves but
  // are read by selectors in tight render paths. Without these, selectors
  // that fall back to a fresh `{}`/`[]` literal cause useSyncExternalStore
  // to tear-loop and crash with React #185.
  mergedRun.catalystEditions = mergedRun.catalystEditions ?? {};
  mergedRun.ownedModEditions = mergedRun.ownedModEditions ?? [];
  mergedRun.diceModEditions = mergedRun.diceModEditions ?? [];
  mergedRun.comboLevels = mergedRun.comboLevels ?? {};
  mergedRun.consumables = mergedRun.consumables ?? [];
  mergedRun.catalysts = mergedRun.catalysts ?? [];
  mergedRun.vouchers = mergedRun.vouchers ?? [];
  mergedRun.ownedMods = mergedRun.ownedMods ?? [];
  mergedRun.diceMods = mergedRun.diceMods ?? [];
  return {
    ...s,
    run:   mergedRun,
    meta:  mergedMeta,
    round: saved.round?.active ? { ...s.round, ...saved.round, handInProgress: false } : s.round,
    ui:    { ...s.ui, screen: saved.ui?.screen ?? s.ui.screen },
  };
}
