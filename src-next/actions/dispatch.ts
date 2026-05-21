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
import { tutorialHandler } from './handlers/tutorial';
import { lookupStep } from '../app/onboarding/tutorial/tutorialScript';
import type { ActionHandler, HandlerResult } from './handlers/types';
import '../core/upgrades/catalysts';

const ROUTING: Record<Action['type'], ActionHandler> = {
  PING: metaHandler,
  SET_SCREEN: metaHandler,
  SET_PLAYER_NAME: metaHandler,
  TOGGLE_PAUSE: metaHandler,
  BUY_ASTRAL_PERK: metaHandler,
  BUY_COSMETIC: metaHandler,
  SEE_COACHMARK: metaHandler,
  SKIP_ONBOARDING: metaHandler,
  RESET_ONBOARDING: metaHandler,
  UNLOCK_ACHIEVEMENT: metaHandler,
  UNLOCK_CONSTELLATION: metaHandler,
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
  START_VOID_RUN: roundHandler,
  END_VOID_RUN: roundHandler,
  DISMISS_VOID_ONBOARDING: metaHandler,
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
  OPEN_OPT_IN: tutorialHandler,
  DISMISS_OPT_IN: tutorialHandler,
  START_TUTORIAL: tutorialHandler,
  ADVANCE_TUTORIAL: tutorialHandler,
  END_TUTORIAL: tutorialHandler,
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
  // Tutorial advance observer — if the just-dispatched action matches the
  // active step's `action` trigger, fire ADVANCE_TUTORIAL. Skip re-entry
  // on the tour's own actions to avoid loops.
  if (action.type !== 'ADVANCE_TUTORIAL' && action.type !== 'START_TUTORIAL' && action.type !== 'END_TUTORIAL') {
    maybeAdvanceTutorial(action);
  }
}

function maybeAdvanceTutorial(action: Action): void {
  const s = store.getState();
  if (!s.tutorial.active || s.tutorial.step == null) return;
  const step = lookupStep(s.tutorial.step);
  if (!step) return;
  const trig = step.advance;
  if (trig.kind !== 'action') return;
  if (action.type !== trig.actionType) return;
  if (trig.pred && !trig.pred(s, action)) return;
  dispatch({ type: 'ADVANCE_TUTORIAL' });
}
