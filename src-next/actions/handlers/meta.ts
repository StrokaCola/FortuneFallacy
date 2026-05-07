import type { ActionHandler } from './types';
import { lookupAstralPerk } from '../../data/astralPerks';

export const metaHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'PING':
      return {
        state: { ...s, pingCount: s.pingCount + 1 },
        events: [{ type: 'onPing', payload: { msg: a.msg } }],
      };
    case 'SET_SCREEN':
      return { state: { ...s, ui: { ...s.ui, screen: a.screen } }, events: [] };
    case 'SET_PLAYER_NAME':
      return { state: { ...s, meta: { ...s.meta, playerName: a.name } }, events: [] };
    case 'TOGGLE_PAUSE':
      return { state: { ...s, ui: { ...s.ui, paused: !s.ui.paused } }, events: [] };
    case 'BUY_ASTRAL_PERK': {
      const perk = lookupAstralPerk(a.perkId);
      if (!perk) return { state: s, events: [] };
      // Already owned — silent no-op.
      const owned = s.meta.astralPerks ?? [];
      if (owned.includes(a.perkId)) return { state: s, events: [] };
      // Affordability check.
      const dust = s.meta.cosmicDust ?? 0;
      if (dust < perk.cost) return { state: s, events: [] };
      return {
        state: {
          ...s,
          meta: {
            ...s.meta,
            cosmicDust: dust - perk.cost,
            astralPerks: [...owned, a.perkId],
          },
        },
        events: [{ type: 'onAstralPerkBought', payload: { perkId: a.perkId, cost: perk.cost } }],
      };
    }
    default:
      return { state: s, events: [] };
  }
};
