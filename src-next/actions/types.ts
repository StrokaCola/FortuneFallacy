import type { SimulationResult } from '../events/types';

export type Action =
  | { type: 'PING'; msg: string }
  | { type: 'SET_SCREEN'; screen: import('../state/slices/ui').Screen }
  | { type: 'SET_PLAYER_NAME'; name: string }
  | { type: 'ROLL_REQUESTED' }
  | { type: 'REROLL_REQUESTED' }
  | { type: 'ROLL_SETTLED'; result: SimulationResult }
  | { type: 'SCORE_HAND' }
  | { type: 'OPEN_SHOP' }
  | { type: 'CLOSE_SHOP' }
  | { type: 'BUY_OFFER'; offerIdx: number }
  | { type: 'SELL_UPGRADE'; kind: 'catalyst' | 'voucher' | 'consumable' | 'mod'; index: number }
  | { type: 'REROLL_SHOP' }
  | { type: 'USE_CONSUMABLE'; index: number; targets?: number[] }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'GRANT_CATALYST'; id: string }
  | { type: 'REVOKE_CATALYST'; id: string }
  | { type: 'TOGGLE_LOCK'; dieIdx: number }
  | { type: 'RESET_ROUND' }
  | { type: 'START_BLIND' }
  | { type: 'CLEAR_BLIND' }
  | { type: 'BUST_BLIND' }
  | { type: 'NEW_RUN'; constellationId?: string; stakeId?: string; challengeId?: string; daily?: boolean }
  | { type: 'GRANT_CONSUMABLE'; id: string }
  | { type: 'DISCARD_CONSUMABLE'; index: number }
  | { type: 'ATTACH_MOD'; dieIdx: number; modId: string }
  | { type: 'DETACH_MOD'; dieIdx: number; modIdx: number }
  | { type: 'REORDER_HOLD'; newOrder: number[] }
  | { type: 'SKIP_BLIND' }
  | { type: 'END_SCORING' }
  | { type: 'PICK_FROM_PACK'; galaxyIdx: number }
  | { type: 'SKIP_PACK' }
  | { type: 'FORGE_MOD'; modId: string; targetEdition: 'foil' | 'holo' | 'poly' }
  | { type: 'BUY_ASTRAL_PERK'; perkId: string }
  | { type: 'UNLOCK_ACHIEVEMENT'; achievementId: string }
  | { type: 'CLAIM_DAILY_LOGIN'; date: string }
  | { type: 'RESOLVE_AUDIT'; choice: 'gamble' | 'skip' }
  | { type: 'SEE_COACHMARK'; id: string }
  | { type: 'SKIP_ONBOARDING' }
  | { type: 'RESET_ONBOARDING' };

export type ActionOf<T extends Action['type']> = Extract<Action, { type: T }>;
