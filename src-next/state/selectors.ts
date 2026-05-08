import type { GameState } from './store';
import { selectTension, type TensionInputs } from '../audio/heat';
import { maxCatalystSlots, effectiveCatalystSlotsUsed } from '../core/vouchers';
import { lookupConstellation } from '../data/constellations';

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

// Run-wide accent color. Boss debuffs override the constellation tint
// (red trumps everything — players need to recognise boss state at a
// glance) so this is intentionally a derived selector rather than a
// raw read off run.constellationId.
export function selectAccent(s: GameState): string {
  if (s.round.isBoss) return '#e2334a';
  return lookupConstellation(s.run.constellationId).color;
}
export const selectShopOffers = (s: GameState) => s.shop.offers;
export const selectShopRerollCost = (s: GameState) => s.shop.rerollCost;
export const selectPendingPack = (s: GameState) => s.shop.pendingPack;
export const selectComboLevels = (s: GameState) => s.run.comboLevels;
export const selectOwnedMods = (s: GameState) => s.run.ownedMods;
export const selectCatalysts  = (s: GameState) => s.run.catalysts;
export const selectMaxCatalystSlots = (s: GameState) => maxCatalystSlots(s);
// Effective catalyst slots used: catalysts.length minus catalysts marked
// 'void' edition (which take zero slots). Drives the slot fraction in
// the TopBar so a void-stamped catalyst doesn't push the player past
// their cap visually or mechanically.
export const selectEffectiveCatalystSlotsUsed = (s: GameState) => effectiveCatalystSlotsUsed(s);
export const selectVouchers   = (s: GameState) => s.run.vouchers;
export const selectPlayerName = (s: GameState) => s.meta.playerName;
export const selectUnlocks    = (s: GameState) => s.meta.unlocks;
export const selectIsConstellationUnlocked = (id: string) => (s: GameState) =>
  s.meta.unlocks.includes(id);

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
