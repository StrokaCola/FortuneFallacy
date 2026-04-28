import type { DieSnapshot } from '../../events/types';

export type RoundSlice = {
  active: boolean;
  blindId: string | null;
  blindIndex: number;
  isBoss: boolean;
  target: number;
  score: number;
  handsLeft: number;
  handsMax: number;
  rerollsLeft: number;
  dice: DieSnapshot[];
  hand: number[];
  handInProgress: boolean;
  scoring: boolean;
  chainLen: number;
  chainTier: number;
  diceRunes: string[][];
  lastScoringCtx?: {
    combo: { id: string; tier: number } | null;
    chips: number;
    mult: number;
    chain: { mult: number };
    total: number;
    state: { round: { dice: Array<{ face: number }> } };
  } | null;
  pendingRoundEnd?: 'clear' | 'bust' | null;
};

export const initialRoundSlice = (): RoundSlice => ({
  active: false,
  blindId: null,
  blindIndex: 0,
  isBoss: false,
  target: 0,
  score: 0,
  handsLeft: 3,
  handsMax: 3,
  rerollsLeft: 2,
  dice: Array.from({ length: 5 }, (_, id) => ({ id, face: 1, locked: false })),
  hand: [],
  handInProgress: false,
  scoring: false,
  chainLen: 0,
  chainTier: -1,
  diceRunes: Array.from({ length: 5 }, () => [] as string[]),
});
