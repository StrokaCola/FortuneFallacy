import type { SimulationResult } from '../events/types';

export type Action =
  | { type: 'PING'; msg: string }
  | { type: 'SET_SCREEN'; screen: import('../state/slices/ui').Screen }
  | { type: 'ROLL_REQUESTED' }
  | { type: 'REROLL_REQUESTED' }
  | { type: 'ROLL_SETTLED'; result: SimulationResult }
  | { type: 'SCORE_HAND' }
  | { type: 'OPEN_SHOP' }
  | { type: 'CLOSE_SHOP' }
  | { type: 'BUY_OFFER'; offerIdx: number }
  | { type: 'USE_CONSUMABLE'; index: number; targets?: number[] }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'GRANT_ORACLE'; id: string }
  | { type: 'REVOKE_ORACLE'; id: string }
  | { type: 'TOGGLE_LOCK'; dieIdx: number }
  | { type: 'RESET_ROUND' }
  | { type: 'START_BLIND' }
  | { type: 'CLEAR_BLIND' }
  | { type: 'BUST_BLIND' }
  | { type: 'NEW_RUN' }
  | { type: 'GRANT_CONSUMABLE'; id: string }
  | { type: 'DISCARD_CONSUMABLE'; index: number }
  | { type: 'ATTACH_RUNE'; dieIdx: number; runeId: string }
  | { type: 'DETACH_RUNE'; dieIdx: number; runeIdx: number }
  | { type: 'SKIP_BLIND' }
  | { type: 'END_SCORING' };

export type ActionOf<T extends Action['type']> = Extract<Action, { type: T }>;
