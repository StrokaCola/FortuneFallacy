// Achievement listener — subscribes to the event bus and the store,
// runs all 50 achievement predicates on every relevant event, and
// dispatches UNLOCK_ACHIEVEMENT for any that fire and aren't yet
// unlocked.
//
// 50 cheap predicates per event is a non-issue performance-wise;
// gameplay events fire at human speeds, not frame rate. Already-
// unlocked achievements short-circuit at the dispatch handler so a
// hot predicate doesn't churn state.

import { bus } from '../../events/bus';
import { store, getState } from '../../state/store';
import { dispatch } from '../../actions/dispatch';
import { ACHIEVEMENTS } from '../../data/achievements';
import type { GameEventEmission } from '../../events/types';

// Subset of bus events that COULD trigger any achievement. Listening to
// every event in the bus would be over-broad; this list is a blocklist
// of "non-game-relevant" emissions that can never gate an achievement
// (audio settings changes, UI state ticks, etc. — none of those exist
// today, but the set is forward-defensive).
const RELEVANT_EVENT_TYPES: ReadonlyArray<keyof import('../../events/types').GameEventMap> = [
  'onRunEnded',
  'onScoreCalculated',
  'onComboDetected',
  'onUpgradeTriggered',
  'onBlindCleared',
  'onOfferBought',
  'onUpgradeSold',
  'onBossRevealed',
  'onAstralPerkBought',
];

function checkAndDispatch(event: GameEventEmission | null): void {
  const state = getState();
  const unlocked = new Set(state.meta.achievements?.unlocked ?? []);
  for (const def of ACHIEVEMENTS) {
    if (unlocked.has(def.id)) continue;
    let fired = false;
    try {
      fired = def.check(state, event);
    } catch (err) {
      // A buggy predicate must not break the run. Log + continue.
      console.warn(`[achievements] check failed for ${def.id}:`, err);
      continue;
    }
    if (fired) dispatch({ type: 'UNLOCK_ACHIEVEMENT', achievementId: def.id });
  }
}

export function startAchievementListener(): () => void {
  const subs = RELEVANT_EVENT_TYPES.map((type) =>
    bus.on(type, (payload) => {
      checkAndDispatch({ type, payload } as GameEventEmission);
    }),
  );

  // Store subscription handles state-only achievements (e.g. "discovered
  // 25 catalysts"). The discovery bridge mutates state without firing a
  // bus event, so we need this safety net. Throttled implicitly by
  // React's useSyncExternalStore — we just pay one walk per change.
  const offStore = store.subscribe(() => {
    checkAndDispatch(null);
  });

  return () => {
    subs.forEach((u) => u());
    offStore();
  };
}
