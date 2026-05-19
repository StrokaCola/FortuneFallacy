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
  | { type: 'NEW_RUN'; constellationId?: string; stakeId?: string; challengeId?: string; daily?: boolean; seed?: number }
  | { type: 'GRANT_CONSUMABLE'; id: string }
  | { type: 'DISCARD_CONSUMABLE'; index: number }
  | { type: 'ATTACH_MOD'; dieIdx: number; modId: string }
  | { type: 'DETACH_MOD'; dieIdx: number; modIdx: number }
  | { type: 'REORDER_HOLD'; newOrder: number[] }
  | { type: 'SKIP_BLIND' }
  | { type: 'END_SCORING' }
  | { type: 'PICK_FROM_PACK'; galaxyIdx: number }
  | { type: 'SKIP_PACK' }
  | { type: 'RESOLVE_SKIP_BOUNTY'; optionIdx: number }
  | { type: 'START_COSMIC_LAP' }
  | { type: 'RESOLVE_EVENT_CHOICE'; eventId: string; choiceIdx: number }
  | { type: 'FORGE_MOD'; modId: string; targetEdition: 'foil' | 'holo' | 'poly' }
  | { type: 'BUY_ASTRAL_PERK'; perkId: string }
  | { type: 'BUY_COSMETIC'; cosmeticId: string }
  | { type: 'UNLOCK_ACHIEVEMENT'; achievementId: string }
  | { type: 'UNLOCK_CONSTELLATION'; constellationId: string }
  | { type: 'CLAIM_DAILY_LOGIN'; date: string }
  | { type: 'RESOLVE_AUDIT'; choice: 'gamble' | 'skip' }
  | { type: 'SEE_COACHMARK'; id: string }
  | { type: 'SKIP_ONBOARDING' }
  | { type: 'RESET_ONBOARDING' }
  | { type: 'SHOW_DIE_TIP'; dieIdx: number; screenX: number; screenY: number; pointerType: 'mouse' | 'touch' | 'pen' }
  | { type: 'HIDE_DIE_TIP' }
  // Tutorial (guided first run). See state/slices/tutorial.ts.
  // OPEN_OPT_IN: ConstellationSelect dispatches after NEW_RUN on first
  //   launch — the opt-in modal mounts when tutorial.optInPending=true.
  // DISMISS_OPT_IN: modal's "No thanks" — clears optInPending and the
  //   meta.onboarding.firstLaunch flag so the modal doesn't re-fire.
  // START_TUTORIAL: modal's "Yes, show me" — pre-equips the starter
  //   catalyst, clears shop offers, advances to the first step.
  // ADVANCE_TUTORIAL: bumps step to next; auto-fires END_TUTORIAL on
  //   the last step. Dispatched both by bubble "Got it" clicks and by
  //   the dispatch-level observer when a step's action trigger fires.
  // END_TUTORIAL: ends the tour, sets endedAt.
  | { type: 'OPEN_OPT_IN' }
  | { type: 'DISMISS_OPT_IN' }
  | { type: 'START_TUTORIAL' }
  | { type: 'ADVANCE_TUTORIAL' }
  | { type: 'END_TUTORIAL'; reason: 'completed' | 'skipped' };

export type ActionOf<T extends Action['type']> = Extract<Action, { type: T }>;
