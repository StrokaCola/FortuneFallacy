// Hand-curated sample payloads for every Action variant. Type-checked
// via `satisfies Record<Action['type'], Action>` so a missing variant
// produces a compile error.

import type { Action } from '../../actions/types';

type ActionSamples = Record<Action['type'], Action>;

export const actionSamples = {
  PING:                 { type: 'PING', msg: 'hello' },
  SET_SCREEN:           { type: 'SET_SCREEN', screen: 'hub' },
  SET_PLAYER_NAME:      { type: 'SET_PLAYER_NAME', name: 'tester' },
  ROLL_REQUESTED:       { type: 'ROLL_REQUESTED' },
  REROLL_REQUESTED:     { type: 'REROLL_REQUESTED' },
  ROLL_SETTLED:         {
    type: 'ROLL_SETTLED',
    result: {
      finalFaces: [1, 2, 3, 4, 5],
      restPositions: [],
      settleMs: [],
      peakVelocity: 0,
      collisionCount: 0,
      bounceHeights: [],
    },
  },
  SCORE_HAND:           { type: 'SCORE_HAND' },
  OPEN_SHOP:            { type: 'OPEN_SHOP' },
  CLOSE_SHOP:           { type: 'CLOSE_SHOP' },
  BUY_OFFER:            { type: 'BUY_OFFER', offerIdx: 0 },
  SELL_UPGRADE:         { type: 'SELL_UPGRADE', kind: 'catalyst', index: 0 },
  REROLL_SHOP:          { type: 'REROLL_SHOP' },
  USE_CONSUMABLE:       { type: 'USE_CONSUMABLE', index: 0 },
  TOGGLE_PAUSE:         { type: 'TOGGLE_PAUSE' },
  GRANT_CATALYST:       { type: 'GRANT_CATALYST', id: 'stipend' },
  REVOKE_CATALYST:      { type: 'REVOKE_CATALYST', id: 'stipend' },
  TOGGLE_LOCK:          { type: 'TOGGLE_LOCK', dieIdx: 0 },
  RESET_ROUND:          { type: 'RESET_ROUND' },
  START_BLIND:          { type: 'START_BLIND' },
  CLEAR_BLIND:          { type: 'CLEAR_BLIND' },
  BUST_BLIND:           { type: 'BUST_BLIND' },
  NEW_RUN:              { type: 'NEW_RUN' },
  GRANT_CONSUMABLE:     { type: 'GRANT_CONSUMABLE', id: 'cosmic_reroll' },
  DISCARD_CONSUMABLE:   { type: 'DISCARD_CONSUMABLE', index: 0 },
  ATTACH_MOD:           { type: 'ATTACH_MOD', dieIdx: 0, modId: 'edge_scoring' },
  DETACH_MOD:           { type: 'DETACH_MOD', dieIdx: 0, modIdx: 0 },
  REORDER_HOLD:         { type: 'REORDER_HOLD', newOrder: [0, 1, 2, 3, 4] },
  SKIP_BLIND:           { type: 'SKIP_BLIND' },
  END_SCORING:          { type: 'END_SCORING' },
  PICK_FROM_PACK:       { type: 'PICK_FROM_PACK', galaxyIdx: 0 },
  SKIP_PACK:            { type: 'SKIP_PACK' },
  FORGE_MOD:            { type: 'FORGE_MOD', modId: 'edge_scoring', targetEdition: 'foil' },
  BUY_ASTRAL_PERK:      { type: 'BUY_ASTRAL_PERK', perkId: 'starting_bank' },
  UNLOCK_ACHIEVEMENT:   { type: 'UNLOCK_ACHIEVEMENT', achievementId: 'first_run' },
  CLAIM_DAILY_LOGIN:    { type: 'CLAIM_DAILY_LOGIN', date: new Date().toISOString().slice(0, 10) },
  RESOLVE_AUDIT:        { type: 'RESOLVE_AUDIT', choice: 'skip' },
  SEE_COACHMARK:        { type: 'SEE_COACHMARK', id: 'first_roll' },
  SKIP_ONBOARDING:      { type: 'SKIP_ONBOARDING' },
  RESET_ONBOARDING:     { type: 'RESET_ONBOARDING' },
  SHOW_DIE_TIP:         { type: 'SHOW_DIE_TIP', dieIdx: 0, screenX: 100, screenY: 100, pointerType: 'touch' },
  HIDE_DIE_TIP:         { type: 'HIDE_DIE_TIP' },
} satisfies ActionSamples;

export const actionTypes: Action['type'][] = Object.keys(actionSamples) as Action['type'][];
