import type { ActionHandler } from './types';

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
    default:
      return { state: s, events: [] };
  }
};
