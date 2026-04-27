import type { ActionHandler } from './types';
import { startBlind, clearBlind, bustBlind, skipBlind } from '../../core/round/transitions';
import { initialRunSlice } from '../../state/slices/run';
import { initialRoundSlice } from '../../state/slices/round';
import { initialShopSlice } from '../../state/slices/shop';

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
    case 'NEW_RUN':
      return {
        state: {
          ...s,
          run: initialRunSlice(),
          round: initialRoundSlice(),
          shop: initialShopSlice(),
          ui: { ...s.ui, screen: 'hub' },
        },
        events: [],
      };
    default:
      return { state: s, events: [] };
  }
};
