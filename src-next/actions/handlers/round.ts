import type { ActionHandler } from './types';
import { startBlind, clearBlind, bustBlind, skipBlind } from '../../core/round/transitions';
import { initialRunSlice } from '../../state/slices/run';
import { initialRoundSlice } from '../../state/slices/round';
import { initialShopSlice } from '../../state/slices/shop';
import { applyConstellation } from '../../core/run/applyConstellation';
import { lookupConstellation } from '../../data/constellations';

export const roundHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'START_BLIND':
      return startBlind(s);
    case 'CLEAR_BLIND':
      return clearBlind(s);
    case 'BUST_BLIND':
      return bustBlind(s);
    case 'SKIP_BLIND':
      return skipBlind(s);
    case 'NEW_RUN': {
      const constellation = lookupConstellation(a.constellationId);
      const baseRun = applyConstellation(initialRunSlice(), constellation);
      const run = {
        ...baseRun,
        stakeId: a.stakeId ?? 'spark',
        challengeId: a.challengeId ?? '',
      };
      return {
        state: {
          ...s,
          run,
          round: initialRoundSlice(),
          shop: initialShopSlice(),
          ui: { ...s.ui, screen: 'hub' },
        },
        events: [],
      };
    }
    default:
      return { state: s, events: [] };
  }
};
