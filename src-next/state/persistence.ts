import { store, type GameState } from './store';
import { safeReadJSON, safeWriteJSON } from './storage';
import { migrateRetheme } from './migrations/v1_retheme';
import { SEEDED_UNLOCKS } from './slices/meta';
import { begin as perfBegin } from '../devtools/perf';

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
      const end = perfBegin('persistence');
      const snapshot: SavedState = { run: s.run, meta: s.meta, round: s.round, ui: s.ui };
      safeWriteJSON(KEY, snapshot);
      end();
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
  // Cosmic Dust + Astral Perks (added 2026-05). Older saves predate these
  // fields; default to a fresh-player state.
  mergedMeta.cosmicDust = mergedMeta.cosmicDust ?? 0;
  mergedMeta.cosmicDustLifetime = mergedMeta.cosmicDustLifetime ?? 0;
  mergedMeta.astralPerks = mergedMeta.astralPerks ?? [];
  // Onboarding (added 2026-05). Legacy saves with no field default to a
  // fresh-player tour state. Players already past their first runs get the
  // tour anyway — that's the price of not tracking save versions; the cost
  // is one popup per screen the first time after upgrade.
  const savedOnb = mergedMeta.onboarding ?? {};
  mergedMeta.onboarding = {
    seen: savedOnb.seen ?? [],
    dismissed: savedOnb.dismissed ?? false,
  };
  const savedDisc = mergedMeta.discovered ?? {};
  mergedMeta.discovered = {
    catalysts: savedDisc.catalysts ?? [],
    mods: savedDisc.mods ?? [],
    vouchers: savedDisc.vouchers ?? [],
    bosses: savedDisc.bosses ?? [],
    consumables: savedDisc.consumables ?? [],
  };
  // Daily Challenge history (added 2026-05). Legacy saves predate this field;
  // default to an empty record so the Title screen treats every prior date
  // as "never attempted". See online/dailyChallenge.ts.
  mergedMeta.dailyHistory = mergedMeta.dailyHistory ?? {};
  const mergedRun = { ...s.run, ...saved.run };
  mergedRun.stakeId = mergedRun.stakeId ?? 'spark';
  mergedRun.challengeId = mergedRun.challengeId ?? '';
  // dailyDate (added 2026-05) marks a run as a daily-challenge attempt.
  // Legacy saves default to null (= a regular run) so they don't accidentally
  // submit to today's daily leaderboard on next clear/bust.
  mergedRun.dailyDate = mergedRun.dailyDate ?? null;
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
