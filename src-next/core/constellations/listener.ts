// Constellation-unlock listener — mirrors the achievement listener.
// Subscribes to the event bus and the store, runs each predicate from
// data/constellationUnlocks.ts on every relevant emission, and dispatches
// UNLOCK_CONSTELLATION for any that fire. The dispatch handler dedupes
// against meta.unlocks so already-unlocked constellations are silent.

import { bus } from '../../events/bus';
import { store, getState } from '../../state/store';
import { dispatch } from '../../actions/dispatch';
import { CONSTELLATION_UNLOCKS } from '../../data/constellationUnlocks';
import type { GameEventEmission, GameEventMap } from '../../events/types';

const RELEVANT_EVENT_TYPES: ReadonlyArray<keyof GameEventMap> = [
  'onRunEnded',
  'onBlindCleared',
  'onComboDetected',
];

function checkAndDispatch(event: GameEventEmission | null): void {
  const state = getState();
  const unlocked = new Set(state.meta.unlocks ?? []);
  for (const def of CONSTELLATION_UNLOCKS) {
    if (unlocked.has(def.id)) continue;
    let fired = false;
    try {
      fired = def.check(state, event);
    } catch (err) {
      console.warn(`[constellations] check failed for ${def.id}:`, err);
      continue;
    }
    if (fired) dispatch({ type: 'UNLOCK_CONSTELLATION', constellationId: def.id });
  }
}

export function startConstellationUnlockListener(): () => void {
  const subs = RELEVANT_EVENT_TYPES.map((type) =>
    bus.on(type, (payload) => {
      checkAndDispatch({ type, payload } as GameEventEmission);
    }),
  );

  // Store subscription handles state-only predicates (Polyhedra: discovered
  // catalysts count). The discovery bridge mutates state without firing a
  // bus event, so we need the safety net the achievement listener uses.
  const offStore = store.subscribe(() => {
    checkAndDispatch(null);
  });

  return () => {
    subs.forEach((u) => u());
    offStore();
  };
}
