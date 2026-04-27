import { store } from '../state/store';
import { bus } from '../events/bus';
import type { Action } from './types';
import { metaHandler } from './handlers/meta';
import { rollHandler } from './handlers/roll';
import { oracleHandler } from './handlers/oracle';
import { diceHandler } from './handlers/dice';
import { roundHandler } from './handlers/round';
import { shopHandler } from './handlers/shop';
import { consumableHandler } from './handlers/consumable';
import type { ActionHandler, HandlerResult } from './handlers/types';
import '../core/upgrades/oracles';

const ROUTING: Record<Action['type'], ActionHandler> = {
  PING: metaHandler,
  SET_SCREEN: metaHandler,
  TOGGLE_PAUSE: metaHandler,
  ROLL_REQUESTED: rollHandler,
  REROLL_REQUESTED: rollHandler,
  ROLL_SETTLED: rollHandler,
  SCORE_HAND: rollHandler,
  GRANT_ORACLE: oracleHandler,
  REVOKE_ORACLE: oracleHandler,
  TOGGLE_LOCK: diceHandler,
  RESET_ROUND: diceHandler,
  ATTACH_RUNE: diceHandler,
  DETACH_RUNE: diceHandler,
  START_BLIND: roundHandler,
  CLEAR_BLIND: roundHandler,
  BUST_BLIND: roundHandler,
  SKIP_BLIND: roundHandler,
  NEW_RUN: roundHandler,
  OPEN_SHOP: shopHandler,
  CLOSE_SHOP: shopHandler,
  BUY_OFFER: shopHandler,
  USE_CONSUMABLE: consumableHandler,
  GRANT_CONSUMABLE: consumableHandler,
  DISCARD_CONSUMABLE: consumableHandler,
};

export function dispatch(action: Action): void {
  const before = store.getState();
  const handler = ROUTING[action.type];
  if (!handler) {
    console.warn(`[dispatch] no handler for ${action.type}`);
    return;
  }
  const { state: after, events }: HandlerResult = handler(action, before);
  store.setState(after, true);
  for (const e of events) bus.emit(e.type, e.payload as never);
}
