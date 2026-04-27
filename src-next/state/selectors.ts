import type { GameState } from './store';
import { selectTension, type TensionInputs } from '../audio/heat';

export const selectScreen      = (s: GameState) => s.ui.screen;
export const selectScore       = (s: GameState) => s.round.score;
export const selectTarget      = (s: GameState) => s.round.target;
export const selectShards      = (s: GameState) => s.run.shards;
export const selectAnte        = (s: GameState) => s.run.ante;
export const selectGoalIdx     = (s: GameState) => s.run.goalIdx;
export const selectDice        = (s: GameState) => s.round.dice;
export const selectHandsLeft   = (s: GameState) => s.round.handsLeft;
export const selectRerollsLeft = (s: GameState) => s.round.rerollsLeft;
export const selectPingCount   = (s: GameState) => s.pingCount;
export const selectChainLen   = (s: GameState) => s.round.chainLen;
export const selectChainTier  = (s: GameState) => s.round.chainTier;
export const selectRoundActive = (s: GameState) => s.round.active;
export const selectBlindId    = (s: GameState) => s.round.blindId;
export const selectIsBoss     = (s: GameState) => s.round.isBoss;
export const selectShopOffers = (s: GameState) => s.shop.offers;
export const selectOracles    = (s: GameState) => s.run.oracles;
export const selectVouchers   = (s: GameState) => s.run.vouchers;
export const selectPlayerName = (s: GameState) => s.meta.playerName;

export const selectTensionFromState = (s: GameState): number => {
  const inputs: TensionInputs = {
    score: s.round.score,
    target: s.round.target,
    handsLeft: s.round.handsLeft,
    handsTotal: s.round.handsMax,
    scoring: s.round.scoring,
  };
  return selectTension(inputs);
};
