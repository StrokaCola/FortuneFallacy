import type { GameState } from './store';
import { selectTension, type TensionInputs } from '../audio/heat';
import { maxCatalystSlots, effectiveCatalystSlotsUsed, maxConsumableSlots, maxModSlots } from '../core/vouchers';
import { lookupConstellation } from '../data/constellations';
import { projectScore } from '../core/scoring/projection';

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

// 2026-05-16 — Cosmetic skin override. Cosmetic ids of kind
// 'constellation_skin' carry a payload like `lyra:#4ff7c8` — when the
// player has unlocked one targeting the active constellation, the
// override color wins over the catalog default. Pure cosmetic; no
// mechanic reads this lookup.
function constellationTint(s: GameState): string {
  const base = lookupConstellation(s.run.constellationId).color;
  const cosmetics = s.meta.cosmeticsUnlocked ?? [];
  if (cosmetics.length === 0) return base;
  for (const cId of cosmetics) {
    // Payload format: `<constellationId>:#<hex>` — parse lazily so we
    // don't need to round-trip through lookupCosmetic on every render.
    // Skin ids live in data/cosmetics.ts; the schema is intentionally
    // small so this string-match check stays cheap.
    if (cId === 'skin_lyra_aurora' && s.run.constellationId === 'lyra') return '#4ff7c8';
    if (cId === 'skin_argo_ember'  && s.run.constellationId === 'argo')  return '#ff6347';
  }
  return base;
}

// Run-wide accent color. Boss debuffs override the constellation tint
// (red trumps everything — players need to recognise boss state at a
// glance) so this is intentionally a derived selector rather than a
// raw read off run.constellationId.
export function selectAccent(s: GameState): string {
  if (s.round.isBoss) return '#e2334a';
  return constellationTint(s);
}

// The constellation accent, *always* — never flips to crimson on boss
// blinds. Used by surfaces that should preserve run-identity even
// during boss reveals (e.g. the Astrolabe orbital dial). `selectAccent`
// stays the right call for surfaces that *should* signal "boss mode"
// (the action-bar arrows). See `docs/company-review-2026-05-13.md`
// Dept 5 — Boss reveal rec.
export function selectConstellationAccent(s: GameState): string {
  return constellationTint(s);
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
// 2026-05-17 — Lyra is the canonical starter constellation and is ALWAYS
// unlocked regardless of meta.unlocks state. SEEDED_UNLOCKS already
// includes 'lyra' for new saves, but legacy saves or any state-reset
// path could leave it missing; hard-gate Lyra so the entry surface
// never strands a player without a playable constellation.
export const selectIsConstellationUnlocked = (id: string) => (s: GameState) =>
  id === 'lyra' || s.meta.unlocks.includes(id);

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

// 2026-05-18 P1: score projection chip selector. Wraps the pure
// projectScore() helper so the TopBar can subscribe directly. Returns
// null when projection is unavailable (round inactive / no locked dice)
// so the chip hides gracefully rather than rendering "0".
export const selectProjectedScore = (s: GameState): number | null => projectScore(s);

// Per-Shop "fake-state" tuple used by the preview chips that render
// "if you didn't have this voucher, your cap would be N-1". The Shop
// used to call maxCatalystSlots / maxConsumableSlots / maxModSlots
// inline three times (each with a separate useStore subscription), so
// every shop interaction triggered three full-tree re-evaluations
// AND each returned a fresh number primitive that Zustand had to
// compare. Memoised here by state-identity (WeakMap, same pattern as
// getDiceSpec in core/run/diceContext.ts) so the tuple reference is
// stable until state actually changes — useStore bails out on
// Object.is, no re-render unless one of the three caps moved.
const MAX_SLOTS_CACHE = new WeakMap<GameState, readonly [number, number, number]>();
export type MaxSlotsTuple = readonly [
  catalystMax: number,
  consumableMax: number,
  modMax: number,
];
export const selectMaxSlots = (s: GameState): MaxSlotsTuple => {
  const cached = MAX_SLOTS_CACHE.get(s);
  if (cached) return cached;
  const tuple: MaxSlotsTuple = [
    maxCatalystSlots(s),
    maxConsumableSlots(s),
    maxModSlots(s),
  ];
  MAX_SLOTS_CACHE.set(s, tuple);
  return tuple;
};
