import type { ActionHandler } from './types';
import type { GameState } from '../../state/store';
import { LEGENDARY_UNLOCK_PREFIX } from '../../core/shop/catalystDraw';

// Mirror of the legendary-unlock check in the shop handler — keeping it here
// means dev-tools / cheat-code GRANT_CATALYST flows also progress the gate.
// 4+ catalysts → All-Band, 6+ → Recursion Lens. See shop.ts for the
// rationale.
function maybeUnlockAllBand(s: GameState): GameState {
  const count = s.run.catalysts.length;
  const toAdd: string[] = [];
  if (count >= 4 && !s.meta.unlocks.includes(`${LEGENDARY_UNLOCK_PREFIX}all_band`)) {
    toAdd.push(`${LEGENDARY_UNLOCK_PREFIX}all_band`);
  }
  if (count >= 6 && !s.meta.unlocks.includes(`${LEGENDARY_UNLOCK_PREFIX}recursion_lens`)) {
    toAdd.push(`${LEGENDARY_UNLOCK_PREFIX}recursion_lens`);
  }
  if (toAdd.length === 0) return s;
  return { ...s, meta: { ...s.meta, unlocks: [...s.meta.unlocks, ...toAdd] } };
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
