import { store } from '../state/store';
import { bus } from '../events/bus';
import type { Action } from './types';
import { metaHandler } from './handlers/meta';
import { rollHandler } from './handlers/roll';
import { catalystHandler } from './handlers/catalyst';
import { diceHandler } from './handlers/dice';
import { roundHandler } from './handlers/round';
import { shopHandler } from './handlers/shop';
import { consumableHandler } from './handlers/consumable';
import type { ActionHandler, HandlerResult } from './handlers/types';
import '../core/upgrades/catalysts';

const ROUTING: Record<Action['type'], ActionHandler> = {
  PING: metaHandler,
  SET_SCREEN: metaHandler,
  SET_PLAYER_NAME: metaHandler,
  TOGGLE_PAUSE: metaHandler,
  BUY_ASTRAL_PERK: metaHandler,
  SEE_COACHMARK: metaHandler,
  SKIP_ONBOARDING: metaHandler,
  RESET_ONBOARDING: metaHandler,
  UNLOCK_ACHIEVEMENT: metaHandler,
  CLAIM_DAILY_LOGIN: metaHandler,
  RESOLVE_AUDIT: metaHandler,
  SHOW_DIE_TIP: metaHandler,
  HIDE_DIE_TIP: metaHandler,
  ROLL_REQUESTED: rollHandler,
  REROLL_REQUESTED: rollHandler,
  ROLL_SETTLED: rollHandler,
  SCORE_HAND: rollHandler,
  END_SCORING: rollHandler,
  GRANT_CATALYST: catalystHandler,
  REVOKE_CATALYST: catalystHandler,
  TOGGLE_LOCK: diceHandler,
  RESET_ROUND: diceHandler,
  ATTACH_MOD: diceHandler,
  DETACH_MOD: diceHandler,
  REORDER_HOLD: diceHandler,
  FORGE_MOD: diceHandler,
  START_BLIND: roundHandler,
  CLEAR_BLIND: roundHandler,
  BUST_BLIND: roundHandler,
  SKIP_BLIND: roundHandler,
  NEW_RUN: roundHandler,
  OPEN_SHOP: shopHandler,
  CLOSE_SHOP: shopHandler,
  BUY_OFFER: shopHandler,
  SELL_UPGRADE: shopHandler,
  REROLL_SHOP: shopHandler,
  PICK_FROM_PACK: shopHandler,
  SKIP_PACK: shopHandler,
  RESOLVE_SKIP_BOUNTY: shopHandler,
  START_COSMIC_LAP: roundHandler,
  RESOLVE_EVENT_CHOICE: roundHandler,
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
