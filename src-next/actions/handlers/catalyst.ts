import type { ActionHandler } from './types';
import type { GameState } from '../../state/store';
import { LEGENDARY_UNLOCK_PREFIX } from '../../core/shop/catalystDraw';

// Mirror of the unlock check in the shop handler — keeping it here means
// dev-tools / cheat-code GRANT_CATALYST flows also progress the gate.
function maybeUnlockAllBand(s: GameState): GameState {
  if (s.run.catalysts.length < 4) return s;
  const unlockId = `${LEGENDARY_UNLOCK_PREFIX}all_band`;
  if (s.meta.unlocks.includes(unlockId)) return s;
  return { ...s, meta: { ...s.meta, unlocks: [...s.meta.unlocks, unlockId] } };
}

export const catalystHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'GRANT_CATALYST': {
      if (s.run.catalysts.includes(a.id)) return { state: s, events: [] };
      const granted: GameState = { ...s, run: { ...s.run, catalysts: [...s.run.catalysts, a.id] } };
      return { state: maybeUnlockAllBand(granted), events: [] };
    }
    case 'REVOKE_CATALYST':
      return {
        state: { ...s, run: { ...s.run, catalysts: s.run.catalysts.filter((x) => x !== a.id) } },
        events: [],
      };
    default:
      return { state: s, events: [] };
  }
};
