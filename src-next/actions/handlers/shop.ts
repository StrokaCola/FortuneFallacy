import type { ActionHandler } from './types';
import type { GameState } from '../../state/store';
import { lookupConsumable } from '../../core/consumables';
import { VOUCHERS, freeShopReroll, maxConsumableSlots, maxCatalystSlots, maxModSlots, effectiveCatalystSlotsUsed } from '../../core/vouchers';
import { MOD_IDS } from '../../core/mods';
import { areModsDisabled, getDiceSpec, getComboCtx } from '../../core/run/diceContext';
import { sellRefund } from '../../core/shop/sellRefund';
import { sellTriggerFor } from '../../core/shop/sellTriggers';
import type { GameEventEmission, ShopOffer } from '../../events/types';
import { PACK_DEFS, lookupPack, rollPackContents, rollManeuverContents } from '../../core/consumables/galaxies';
import { drawWeightedCatalysts, LEGENDARY_UNLOCK_PREFIX } from '../../core/shop/catalystDraw';
import { rollCatalystEdition } from '../../core/upgrades/editions';
import { stakeContext } from '../../core/run/stakeContext';
import { makeSeedRng } from '../../core/seed/rng';
import { rerollDiscount } from '../../core/run/applyAstralPerks';
import { TUTORIAL_SHOP_OFFERS, TUTORIAL_MIN_SHARDS, isTutorialActive } from '../../app/onboarding/tutorial/deterministicScript';
// Mods whose effects key on specific face values that some constellations
// can never roll. When the active face universe lacks ALL the required
// faces, the mod is removed from the offer pool so the player isn't sold
// a trap (e.g. Crown's +1.5× mult on face 6 on Eclipse, whose universe is
// [0, 1] and never rolls a 6).
//
// 2026-05-13 (dead-pick audit): expanded from risk-only to cover every
// face-gated mod. Each entry is the SET of faces that satisfy the mod —
// the mod stays in the pool iff at least one face is present in the
// constellation's universe. Risk stays a single-face gate because its
// asymmetric +6/-3 still loses on Triumvirate-like universes that lack 6
// even when they have 1.
const FACE_GATED_MODS: Record<string, ReadonlyArray<number>> = {
  // Risk: +6 mult on 6, -3 mult on 1. Strictly negative when 6 never
  // rolls, even if 1 does. Gate keys on 6.
  risk: [6],
  // Crown: ×1.5 mult on face 6. Universal dead pick when 6 missing.
  crown: [6],
  // High Roller: +1 mult on 5 OR 6. Survives Ophiuchus (face 5 exists)
  // but dies on Eclipse where neither rolls.
  high_roller: [5, 6],
  // Even Keel: +2 mult on faces 2/4/6 specifically (the mod's desc
  // enumerates these — face 0 doesn't count even though it's
  // mathematically even). Eclipse [0, 1] lacks all three.
  even_keel: [2, 4, 6],
  // Glutton: only stacks on face 6 rolls. Dead on Eclipse, Ophiuchus
  // (no native 6 in either universe).
  glutton: [6],
};

function gateModsByFaceUniverse(modIds: readonly string[], s: GameState): string[] {
  const universe = new Set(getComboCtx(s).faceUniverse);
  return modIds.filter((id) => {
    const requiredFaces = FACE_GATED_MODS[id];
    if (!requiredFaces) return true;
    return requiredFaces.some((f) => universe.has(f));
  });
}

// When the extra_die voucher is purchased, pad the per-die parallel
// arrays so their length matches the new dice spec. Mirrors how new
// runs initialize these arrays — a missing entry would crash the
// pipeline at the first roll because applyDieModStep indexes by die.
function padDiceArraysAfterVoucher(state: GameState): GameState {
  const spec = getDiceSpec(state);
  const target = spec.length;
  const dice = state.round.dice;
  const diceMods = state.run.diceMods;
  const diceModEditions = state.run.diceModEditions ?? [];
  if (dice.length >= target && diceMods.length >= target && diceModEditions.length >= target) {
    return state;
  }
  const padDice = [...dice];
  while (padDice.length < target) {
    padDice.push({ id: padDice.length, face: 1, locked: true });
  }
  const padMods = [...diceMods];
  while (padMods.length < target) padMods.push([] as string[]);
  const padModEds = [...diceModEditions];
  while (padModEds.length < target) padModEds.push([] as (typeof diceModEditions)[number]);
  return {
    ...state,
    run: { ...state.run, diceMods: padMods, diceModEditions: padModEds },
    round: { ...state.round, dice: padDice },
  };
}

// Effective reroll cost: BASE − astral perk discounts (floor 0). Free Refresh
// voucher overrides everything to 0.
function initialRerollCost(s: GameState): number {
  if (freeShopReroll(s)) return 0;
  return Math.max(0, BASE_REROLL_COST - rerollDiscount(s));
}

// Catalyst-count gates for legendary unlocks. Each tier opens a different
// legendary so the player has a progression staircase tied to the natural
// "stack more catalysts" loop.
//   4 catalysts → All-Band (was the original gate)
//   6 catalysts → Recursion Lens (high catalyst density rewards a retrigger
//                 legendary)
// Eclipse Pact and Heirloom Locket use non-shop conditions and are unlocked
// in core/round/transitions.ts at clearBlind time.
function maybeUnlockLegendaries(s: GameState): { state: GameState; events: GameEventEmission[] } {
  const count = s.run.catalysts.length;
  const toAdd: string[] = [];
  if (count >= 4 && !s.meta.unlocks.includes(`${LEGENDARY_UNLOCK_PREFIX}all_band`)) {
    toAdd.push(`${LEGENDARY_UNLOCK_PREFIX}all_band`);
  }
  if (count >= 6 && !s.meta.unlocks.includes(`${LEGENDARY_UNLOCK_PREFIX}recursion_lens`)) {
    toAdd.push(`${LEGENDARY_UNLOCK_PREFIX}recursion_lens`);
  }
  if (toAdd.length === 0) return { state: s, events: [] };
  return {
    state: { ...s, meta: { ...s.meta, unlocks: [...s.meta.unlocks, ...toAdd] } },
    events: [],
  };
}

// Back-compat alias: existing call sites still reference maybeUnlockAllBand.
const maybeUnlockAllBand = maybeUnlockLegendaries;

const BASE_REROLL_COST = 3;
const MOD_OFFER_PRICE = 4;

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function applyShopPriceMult(offers: ShopOffer[], mult: number): ShopOffer[] {
  if (mult === 1) return offers;
  return offers.map((o) => ({ ...o, price: Math.max(1, Math.round(o.price * mult)) }));
}

// rng is built per shop roll from `(run.seed, 'shop:goal=N:seq=K')` so
// the same seed + same shopSeq always produces the same offers, and
// each successive REROLL_SHOP advances shopSeq → fresh deterministic
// offers. See OPEN_SHOP / REROLL_SHOP for the scope construction.
function rollOffers(s: GameState, rng: () => number): ShopOffer[] {
  const offers: ShopOffer[] = [];
  const ownedVouchers = s.run.vouchers;
  const modsOff = areModsDisabled(s);

  if (!modsOff) {
    // 2026-05-16 unlock-content roadmap — filter out roadmap-gated mods
    // until the player has earned the matching unlock flag. Same
    // `unlock:<id>` prefix as gated catalysts (see catalystDraw.ts).
    const ROADMAP_GATED_MOD_IDS = new Set(['calibrated', 'reckless', 'sun_forged', 'heirbound', 'veiled']);
    const unlocks = s.meta.unlocks ?? [];
    const unlockable = (MOD_IDS as readonly string[]).filter((id) =>
      !ROADMAP_GATED_MOD_IDS.has(id) || unlocks.includes(`unlock:${id}`),
    );
    const eligible = gateModsByFaceUniverse(unlockable, s);
    const modIds = shuffle(eligible, rng).slice(0, 2);
    for (const id of modIds) {
      // Mod editions roll independently, same drop weights as catalysts:
      // foil 5%, holo 3%, poly 2%, otherwise plain. See editions.ts.
      const edition = rollCatalystEdition(rng);
      offers.push({ kind: 'mod', id, price: MOD_OFFER_PRICE, ...(edition ? { edition } : {}) });
    }
  }

  // Constellations like Argo replace mod slots with extra catalyst breadth, so
  // surface a third catalyst when mods are off to keep the offer count steady.
  const catalystCount = modsOff ? 3 : 2;
  const catalystIds = drawWeightedCatalysts(catalystCount, s.run.ante, s.meta.unlocks, rng, s.run.catalysts, s.run.constellationId, new Set(getComboCtx(s).faceUniverse));
  for (const id of catalystIds) {
    const edition = rollCatalystEdition(rng);
    offers.push({ kind: 'catalyst', id, price: 5, ...(edition ? { edition } : {}) });
  }

  // 2026-05-16 polish — Sixth Star (+1 die for the run) is the single
  // biggest power swing in the voucher pool; gate it behind ante 3 so
  // early shops can't pivot the whole run on a coin-flip voucher draw.
  // Other vouchers stay open from ante 1 — only the +1-die slot needs
  // the lockout. Matches Balatro's late-tier voucher cadence.
  const SIXTH_STAR_MIN_ANTE = 3;
  const availableVouchers = VOUCHERS.filter((v) => {
    if (ownedVouchers.includes(v.id)) return false;
    if (v.id === 'extra_die' && s.run.ante < SIXTH_STAR_MIN_ANTE) return false;
    return true;
  });
  // 2026-05-13 (post-Pillar-G): Consumables are no longer offered in the
  // shop. They're acquired exclusively via Skip Bounty (Pillar G) and
  // event encounters (Pillar C), which gives skipping a real second-
  // axis payoff and tightens the shop's identity around mods, catalysts,
  // vouchers, and packs. Galaxy/spectral consumables continue to drop
  // through their dedicated packs.

  // Two-way roll for the final slot: pack | voucher.
  // ~25% pack, then voucher when one is unowned; otherwise an extra
  // catalyst keeps the offer count stable when no voucher is available.
  const r = rng();
  if (r < 0.25) {
    // Pack tier weighted: 45% Celestial, 22% Stellar, 8% Galactic, 25% Maneuver.
    // Pulled by index from PACK_DEFS to avoid drift if the table is reordered.
    const tierRoll = rng();
    const pack =
      tierRoll < 0.45 ? PACK_DEFS[0]! :
      tierRoll < 0.67 ? PACK_DEFS[1]! :
      tierRoll < 0.75 ? PACK_DEFS[2]! :
      PACK_DEFS[3]!;
    offers.push({ kind: 'pack', id: pack.kind, price: pack.price });
  } else if (availableVouchers.length > 0) {
    const v = shuffle(availableVouchers, rng)[0]!;
    offers.push({ kind: 'voucher', id: v.id, price: v.price });
  } else {
    // No vouchers left to offer — fill the slot with one extra catalyst
    // so the shop doesn't shrink late-run. Mirrors the modsOff branch's
    // approach of using catalyst breadth as the fallback currency.
    const extra = drawWeightedCatalysts(1, s.run.ante, s.meta.unlocks, rng, s.run.catalysts, s.run.constellationId);
    if (extra[0]) {
      const edition = rollCatalystEdition(rng);
      offers.push({ kind: 'catalyst', id: extra[0], price: 5, ...(edition ? { edition } : {}) });
    }
  }

  return applyShopPriceMult(offers, stakeContext(s).shopPriceMult);
}

// Open a freshly purchased pack: roll its contents, mark all rolled galaxy
// ids as discovered in meta.unlocks, and stash the open state in shop.pendingPack.
function openPack(s: GameState, packKind: string): { state: GameState; events: GameEventEmission[] } {
  const def = lookupPack(packKind);
  if (!def) return { state: s, events: [] };
  // Maneuver Packs draw from the orbital-maneuver pool; the rest draw from
  // the galaxy pool. The PackOverlay reads ids generically through
  // lookupConsumable so the same UI handles both.
  const galaxyIds = packKind === 'maneuver'
    ? rollManeuverContents(def.showCount, Math.random)
    : rollPackContents(def.showCount, Math.random, def.quasarWeightMultiplier ?? 1);
  const events: GameEventEmission[] = [
    { type: 'onPackOpened', payload: { kind: packKind, galaxyIds, picksAllowed: def.pickCount } },
  ];

  // Snapshot pre-open unlocks so the PackOverlay can render `???` for
  // first-encounter galaxies. We freeze this BEFORE mutating meta.unlocks
  // below — the snapshot captures "what the player already knew" at the
  // moment they cracked the pack.
  const unlockedAtOpen = [...s.meta.unlocks];

  // Discovery: any galaxy in this pack the player hasn't seen before goes
  // into meta.unlocks. The codex / future hub uses this to flip cards
  // permanently; the in-pack `???` rendering keys off `unlockedAtOpen`.
  const unlocks = new Set(s.meta.unlocks);
  for (const gid of galaxyIds) {
    if (!unlocks.has(gid)) {
      unlocks.add(gid);
      events.push({ type: 'onGalaxyDiscovered', payload: { galaxyId: gid } });
    }
  }

  return {
    state: {
      ...s,
      meta: { ...s.meta, unlocks: [...unlocks] },
      shop: {
        ...s.shop,
        pendingPack: {
          kind: packKind,
          galaxyIds,
          picksLeft: def.pickCount,
          pickedSoFar: [],
          unlockedAtOpen,
        },
      },
    },
    events,
  };
}

export const shopHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'OPEN_SHOP': {
      // Challenge overlay can lock the shop entirely. Stay in hub.
      if (stakeContext(s).shopDisabled) return { state: s, events: [] };
      // Tutorial: hand-built scripted offers + a shard top-up so the
      // recommended buy is affordable. Bypasses the normal seeded roll.
      if (isTutorialActive(s)) {
        const offers = [...TUTORIAL_SHOP_OFFERS];
        const shards = Math.max(s.run.shards, TUTORIAL_MIN_SHARDS);
        return {
          state: {
            ...s,
            run: { ...s.run, shards },
            shop: { ...s.shop, open: true, offers, rerollCost: initialRerollCost(s) },
            ui: { ...s.ui, screen: 'shop' },
          },
          events: [{ type: 'onShopOpened', payload: { offers } }],
        };
      }
      // Seeded RNG keyed by run.seed + the monotonic shopSeq counter.
      // Two players entering the same seed see the same offers on each
      // hub re-entry, and a refresh mid-roll can't shuffle the wares
      // (the saved shopSeq replays the same scope).
      const seq = s.run.shopSeq ?? 0;
      const rng = makeSeedRng(s.run.seed, `shop:seq=${seq}`);
      const offers = rollOffers(s, rng);
      return {
        state: {
          ...s,
          run: { ...s.run, shopSeq: seq + 1 },
          shop: { ...s.shop, open: true, offers, rerollCost: initialRerollCost(s) },
          ui: { ...s.ui, screen: 'shop' },
        },
        events: [{ type: 'onShopOpened', payload: { offers } }],
      };
    }
    case 'CLOSE_SHOP':
      return {
        state: { ...s, shop: { ...s.shop, open: false, pendingPack: null }, ui: { ...s.ui, screen: 'round' } },
        events: [],
      };
    case 'REROLL_SHOP': {
      if (!s.shop.open) return { state: s, events: [] };
      // Pack picker is modal — block rerolls until it's resolved.
      if (s.shop.pendingPack) return { state: s, events: [] };
      const cost = s.shop.rerollCost;
      if (s.run.shards < cost) return { state: s, events: [] };
      const seq = s.run.shopSeq ?? 0;
      const rng = makeSeedRng(s.run.seed, `shop:seq=${seq}`);
      const offers = rollOffers(s, rng);
      const nextCost = freeShopReroll(s) ? 0 : cost + 1;
      return {
        state: {
          ...s,
          run: { ...s.run, shards: s.run.shards - cost, shopSeq: seq + 1 },
          shop: { ...s.shop, offers, rerollCost: nextCost },
        },
        events: [{ type: 'onShopOpened', payload: { offers } }],
      };
    }
    case 'BUY_OFFER': {
      const offer = s.shop.offers[a.offerIdx];
      if (!offer || s.run.shards < offer.price) return { state: s, events: [] };
      // Pack picker is modal — no further buys until it's resolved.
      if (s.shop.pendingPack) return { state: s, events: [] };
      const remaining = s.shop.offers.filter((_, i) => i !== a.offerIdx);

      if (offer.kind === 'pack') {
        // Buying a pack debits shards, removes the offer, and opens the
        // pack picker. The picker grants galaxies via PICK_FROM_PACK.
        const debited: GameState = {
          ...s,
          run: { ...s.run, shards: s.run.shards - offer.price },
          shop: { ...s.shop, offers: remaining },
        };
        const opened = openPack(debited, offer.id);
        return {
          state: opened.state,
          events: [
            { type: 'onOfferBought', payload: { kind: offer.kind, id: offer.id, price: offer.price } },
            ...opened.events,
          ],
        };
      }

      const catalysts = offer.kind === 'catalyst' ? [...s.run.catalysts, offer.id] : s.run.catalysts;
      const consumables = offer.kind === 'consumable' && s.run.consumables.length < maxConsumableSlots(s)
        ? [...s.run.consumables, offer.id]
        : s.run.consumables;
      const vouchers = offer.kind === 'voucher' ? [...s.run.vouchers, offer.id] : s.run.vouchers;
      const ownedMods = offer.kind === 'mod' ? [...s.run.ownedMods, offer.id] : s.run.ownedMods;
      // Carry the offer's rolled edition stamp into run.catalystEditions
      // so the upgrades phase can read it on every score.
      const catalystEditions =
        offer.kind === 'catalyst' && offer.edition
          ? { ...s.run.catalystEditions, [offer.id]: offer.edition }
          : s.run.catalystEditions;
      // Mods carry their edition in a parallel array — push or keep length-
      // synced regardless of whether this offer had an edition.
      const ownedModEditions =
        offer.kind === 'mod'
          ? [...(s.run.ownedModEditions ?? []), offer.edition ?? null]
          : (s.run.ownedModEditions ?? []);
      // Audit catalyst tracks total catalyst spend in the run. Other kinds
      // (mods, vouchers, consumables) don't contribute — only catalyst price.
      const catalystShardSpend =
        offer.kind === 'catalyst'
          ? (s.run.catalystShardSpend ?? 0) + offer.price
          : (s.run.catalystShardSpend ?? 0);
      const boughtRaw: GameState = {
        ...s,
        run: { ...s.run, shards: s.run.shards - offer.price, catalysts, consumables, vouchers, ownedMods, catalystEditions, ownedModEditions, catalystShardSpend },
        shop: { ...s.shop, offers: remaining },
      };
      // Extra-die voucher: extend round.dice / run.diceMods / diceModEditions
      // to match the new spec length so the pipeline doesn't read undefined.
      const bought = offer.kind === 'voucher' && offer.id === 'extra_die'
        ? padDiceArraysAfterVoucher(boughtRaw)
        : boughtRaw;
      // Catalyst purchase may cross the 4-catalyst threshold for the first
      // time, unlocking the All-Band legendary in meta.unlocks.
      const withUnlock = offer.kind === 'catalyst' ? maybeUnlockAllBand(bought) : { state: bought, events: [] };
      return {
        state: withUnlock.state,
        events: [
          { type: 'onOfferBought', payload: { kind: offer.kind, id: offer.id, price: offer.price } },
          ...withUnlock.events,
        ],
      };
    }
    case 'PICK_FROM_PACK': {
      const pack = s.shop.pendingPack;
      if (!pack) return { state: s, events: [] };
      const galaxyId = pack.galaxyIds[a.galaxyIdx];
      if (!galaxyId || pack.pickedSoFar.includes(galaxyId)) return { state: s, events: [] };
      const def = lookupConsumable(galaxyId);
      if (!def) return { state: s, events: [] };

      // Galaxies apply immediately (combo level bump). Maneuvers go into the
      // consumable tray so the player can choose when to fire them. Other
      // types are rejected for safety.
      let applied: { state: GameState; events: GameEventEmission[] };
      if (def.type === 'galaxy') {
        applied = def.apply(s, []);
      } else if (def.type === 'maneuver') {
        if (s.run.consumables.length >= maxConsumableSlots(s)) {
          // Inventory full — skip silently. The pick still counts so the
          // player can move on; alternative is to refund a pick, but the
          // simpler flow keeps overlay logic clean.
          applied = { state: s, events: [] };
        } else {
          applied = {
            state: { ...s, run: { ...s.run, consumables: [...s.run.consumables, def.id] } },
            events: [],
          };
        }
      } else {
        return { state: s, events: [] };
      }
      const picksLeft = pack.picksLeft - 1;
      const pickedSoFar = [...pack.pickedSoFar, galaxyId];
      const events: GameEventEmission[] = [
        ...applied.events,
        { type: 'onPackPicked', payload: { galaxyId, remainingPicks: picksLeft } },
      ];

      if (picksLeft <= 0) {
        // Pack exhausted — close it and move on.
        events.push({
          type: 'onPackClosed',
          payload: {
            kind: pack.kind,
            pickedCount: pickedSoFar.length,
            skippedCount: pack.galaxyIds.length - pickedSoFar.length,
          },
        });
        return {
          state: { ...applied.state, shop: { ...applied.state.shop, pendingPack: null } },
          events,
        };
      }

      return {
        state: {
          ...applied.state,
          shop: { ...applied.state.shop, pendingPack: { ...pack, picksLeft, pickedSoFar } },
        },
        events,
      };
    }
    case 'SKIP_PACK': {
      const pack = s.shop.pendingPack;
      if (!pack) return { state: s, events: [] };
      return {
        state: { ...s, shop: { ...s.shop, pendingPack: null } },
        events: [
          {
            type: 'onPackClosed',
            payload: {
              kind: pack.kind,
              pickedCount: pack.pickedSoFar.length,
              skippedCount: pack.galaxyIds.length - pack.pickedSoFar.length,
            },
          },
        ],
      };
    }
    case 'RESOLVE_SKIP_BOUNTY': {
      return resolveSkipBounty(s, a.optionIdx);
    }
    case 'SELL_UPGRADE': {
      const removeAt = <T,>(arr: T[], idx: number): T[] => arr.filter((_, i) => i !== idx);
      if (a.kind === 'catalyst') {
        const id = s.run.catalysts[a.index];
        if (!id) return { state: s, events: [] };
        const refund = sellRefund('catalyst', id);
        // 2026-05-18 audit: Dust-Off no longer boosts sell refunds — it
        // now grants a per-reroll shard discount (see rerollDiscount).
        // Pre-audit sell boost almost never fired (players rarely sell)
        // and made the common a trap pick.
        // Drop the edition stamp (if any) so a re-bought catalyst with
        // the same id doesn't inherit the prior edition.
        const { [id]: _dropped, ...remainingEditions } = s.run.catalystEditions ?? {};
        // Build the post-removal state first; sell-trigger effects then
        // observe and mutate THAT (so e.g. compounding-bias clears its
        // own stacks even though the catalyst is already gone).
        const afterRemoval: GameState = {
          ...s,
          run: {
            ...s.run,
            shards: s.run.shards + refund,
            catalysts: removeAt(s.run.catalysts, a.index),
            catalystEditions: remainingEditions,
          },
        };
        const trigger = sellTriggerFor(id);
        const finalState: GameState = trigger
          ? { ...afterRemoval, run: { ...afterRemoval.run, ...trigger.apply(afterRemoval) } }
          : afterRemoval;
        const events: GameEventEmission[] = [
          { type: 'onUpgradeSold', payload: { kind: 'catalyst', id, refund } },
        ];
        if (trigger) {
          events.push({
            type: 'onSellTrigger',
            payload: {
              catalystId: id,
              label: trigger.label,
              shardsBefore: afterRemoval.run.shards,
              shardsAfter: finalState.run.shards,
            },
          });
        }
        return { state: finalState, events };
      }
      if (a.kind === 'consumable') {
        const id = s.run.consumables[a.index];
        if (!id) return { state: s, events: [] };
        const refund = sellRefund('consumable', id);
        return {
          state: { ...s, run: { ...s.run, shards: s.run.shards + refund, consumables: removeAt(s.run.consumables, a.index) } },
          events: [{ type: 'onUpgradeSold', payload: { kind: 'consumable', id, refund } }],
        };
      }
      if (a.kind === 'mod') {
        // Only sellable from the owned-mods inventory; attached mods must be
        // detached in the Forge first so we don't mutate diceMods here.
        const id = s.run.ownedMods[a.index];
        if (!id) return { state: s, events: [] };
        const refund = sellRefund('mod', id);
        // Drop the parallel edition entry at the same index.
        const ownedModEditions = removeAt(s.run.ownedModEditions ?? [], a.index);
        return {
          state: {
            ...s,
            run: {
              ...s.run,
              shards: s.run.shards + refund,
              ownedMods: removeAt(s.run.ownedMods, a.index),
              ownedModEditions,
            },
          },
          events: [{ type: 'onUpgradeSold', payload: { kind: 'mod', id, refund } }],
        };
      }
      if (a.kind === 'voucher') {
        const id = s.run.vouchers[a.index];
        if (!id) return { state: s, events: [] };
        // Selling a voucher that grants a slot must not strand items above
        // the resulting cap. The caps are computed from current vouchers, so
        // a sell would shrink them by 1 in that direction.
        if (id === 'bench' && effectiveCatalystSlotsUsed(s) > maxCatalystSlots(s) - 1) return { state: s, events: [] };
        if (id === 'capacity' && s.run.consumables.length > maxConsumableSlots(s) - 1) return { state: s, events: [] };
        if (id === 'forged_links' && s.run.diceMods.some((slots) => slots.length > maxModSlots(s) - 1)) return { state: s, events: [] };
        const refund = sellRefund('voucher', id);
        return {
          state: { ...s, run: { ...s.run, shards: s.run.shards + refund, vouchers: removeAt(s.run.vouchers, a.index) } },
          events: [{ type: 'onUpgradeSold', payload: { kind: 'voucher', id, refund } }],
        };
      }
      return { state: s, events: [] };
    }
    default:
      return { state: s, events: [] };
  }
};

// Pillar G — applies the player's chosen bounty option from the
// SkipBountyModal. Clears pendingSkipBounty either way. Slot caps are
// respected: a 'consumable' option converts to shards if the inventory
// is full; a 'catalyst' option converts to shards if the slot is full.
// The fallback shard amount (8) matches the "pool exhausted" copy
// authored in rollSkipBountyOptions for symmetry.
function resolveSkipBounty(s: GameState, optionIdx: number): { state: GameState; events: GameEventEmission[] } {
  const bounty = s.shop.pendingSkipBounty;
  if (!bounty) return { state: s, events: [] };
  const option = bounty.options[optionIdx];
  if (!option) return { state: s, events: [] };
  const cleared: GameState = {
    ...s,
    shop: { ...s.shop, pendingSkipBounty: null },
  };
  if (option.kind === 'shards') {
    return {
      state: { ...cleared, run: { ...cleared.run, shards: cleared.run.shards + option.amount } },
      events: [],
    };
  }
  if (option.kind === 'consumable') {
    const def = lookupConsumable(option.consumableId);
    if (!def) return { state: cleared, events: [] };
    if (cleared.run.consumables.length >= maxConsumableSlots(cleared)) {
      // Inventory full — convert to 8 shards as the courteous fallback.
      return {
        state: { ...cleared, run: { ...cleared.run, shards: cleared.run.shards + 8 } },
        events: [],
      };
    }
    return {
      state: {
        ...cleared,
        run: { ...cleared.run, consumables: [...cleared.run.consumables, option.consumableId] },
      },
      events: [],
    };
  }
  if (option.kind === 'catalyst') {
    if (cleared.run.catalysts.length >= maxCatalystSlots(cleared)) {
      return {
        state: { ...cleared, run: { ...cleared.run, shards: cleared.run.shards + 8 } },
        events: [],
      };
    }
    return {
      state: {
        ...cleared,
        run: { ...cleared.run, catalysts: [...cleared.run.catalysts, option.catalystId] },
      },
      events: [{
        type: 'onOfferBought',
        payload: { kind: 'catalyst', id: option.catalystId, price: 0 },
      }],
    };
  }
  if (option.kind === 'pack') {
    // Stage a celestial pack so the next shop visit opens it. Falls back
    // to shards if pack metadata is missing (shouldn't happen in prod).
    const packDef = lookupPack(option.packKind);
    if (!packDef) {
      return {
        state: { ...cleared, run: { ...cleared.run, shards: cleared.run.shards + 8 } },
        events: [],
      };
    }
    const galaxyIds = rollPackContents(packDef.showCount, Math.random, packDef.quasarWeightMultiplier ?? 1);
    const unlockedAtOpen = [...(cleared.meta.unlocks ?? [])];
    const newUnlocks = new Set(unlockedAtOpen);
    const events: GameEventEmission[] = [];
    for (const gid of galaxyIds) {
      if (!newUnlocks.has(gid)) {
        newUnlocks.add(gid);
        events.push({ type: 'onGalaxyDiscovered', payload: { galaxyId: gid } });
      }
    }
    events.push({
      type: 'onPackOpened',
      payload: { kind: option.packKind, galaxyIds, picksAllowed: packDef.pickCount },
    });
    return {
      state: {
        ...cleared,
        meta: { ...cleared.meta, unlocks: [...newUnlocks] },
        shop: {
          ...cleared.shop,
          pendingPack: {
            kind: option.packKind,
            galaxyIds,
            picksLeft: packDef.pickCount,
            pickedSoFar: [],
            unlockedAtOpen,
          },
        },
      },
      events,
    };
  }
  return { state: cleared, events: [] };
}
