// Event resolver (Pillar C) — walks an event choice's effects and
// produces the next GameState. Caps (consumable / catalyst slots)
// degrade gracefully: an over-cap grant converts to a small shard
// payout so the choice always has SOME payoff.
//
// Resolution order:
//   1. Affordability check — all costs must clear; else return state
//      unchanged with the original screen.
//   2. Deduct costs.
//   3. Walk effects in declaration order, mutating state as each fires.
//   4. Advance goalIdx + recompute ante (same shape as skipBlind).
//   5. Route back to Hub.

import type { GameState } from '../../state/store';
import type { GameEventEmission } from '../../events/types';
import type { EventDef, EventEffect } from '../../data/events';
import { lookupConsumable, CONSUMABLES } from '../consumables';
import { CATALYST_META } from '../../data/catalysts';
import { MOD_IDS, lookupMod } from '../mods';
import { maxCatalystSlots, maxConsumableSlots } from '../vouchers';
import { mulberry32 } from '../rng';

export type ResolveEventResult = {
  state: GameState;
  events: GameEventEmission[];
};

export function resolveEventChoice(
  s: GameState,
  eventDef: EventDef,
  choiceIdx: number,
): ResolveEventResult {
  const choice = eventDef.choices[choiceIdx];
  if (!choice) return { state: s, events: [] };
  // Affordability check.
  if (choice.costs?.shards && s.run.shards < choice.costs.shards) {
    return { state: s, events: [] };
  }
  // Deduct costs.
  let next: GameState = {
    ...s,
    run: {
      ...s.run,
      shards: choice.costs?.shards ? s.run.shards - choice.costs.shards : s.run.shards,
    },
  };
  // Walk effects. Use a deterministic RNG seeded from the event id +
  // goalIdx so the random-grant outcomes are reproducible for a given
  // run.
  const rngState = mulberry32(
    (s.run.seed ^ (s.run.goalIdx * 0xc2b2ae35) ^ hashStr(eventDef.id)) >>> 0,
  );
  const rng = () => rngState.next();
  for (const eff of choice.effects) {
    next = applyEventEffect(next, eff, rng);
  }
  // Advance to the next slot — same shape as skipBlind's tail.
  const nextGoalIdx = next.run.goalIdx + 1;
  const nextAnte = Math.floor(nextGoalIdx / 3) + 1;
  return {
    state: {
      ...next,
      ui: { ...next.ui, screen: 'hub' },
      run: { ...next.run, goalIdx: nextGoalIdx, ante: nextAnte },
    },
    events: [],
  };
}

function applyEventEffect(s: GameState, eff: EventEffect, rng: () => number): GameState {
  switch (eff.kind) {
    case 'shards':
      return { ...s, run: { ...s.run, shards: s.run.shards + eff.amount } };
    case 'cosmic_dust': {
      const dust = (s.meta.cosmicDust ?? 0) + eff.amount;
      const lifetime = (s.meta.cosmicDustLifetime ?? 0) + eff.amount;
      return { ...s, meta: { ...s.meta, cosmicDust: dust, cosmicDustLifetime: lifetime } };
    }
    case 'consumable': {
      const def = lookupConsumable(eff.consumableId);
      if (!def) return s;
      if (s.run.consumables.length >= maxConsumableSlots(s)) {
        // Cap reached — convert to 5 shards as the courteous fallback.
        return { ...s, run: { ...s.run, shards: s.run.shards + 5 } };
      }
      return { ...s, run: { ...s.run, consumables: [...s.run.consumables, eff.consumableId] } };
    }
    case 'random_consumable': {
      const from = eff.from ?? ['regular'];
      const pool = CONSUMABLES.filter((c) => {
        if (from.includes('regular') && c.type !== 'galaxy' && c.type !== 'spectral' && c.type !== 'maneuver') return true;
        if (from.includes('galaxy') && c.type === 'galaxy') return true;
        if (from.includes('spectral') && c.type === 'spectral') return true;
        if (from.includes('maneuver') && c.type === 'maneuver') return true;
        return false;
      });
      if (pool.length === 0) return s;
      const pick = pool[Math.floor(rng() * pool.length)]!;
      return applyEventEffect(s, { kind: 'consumable', consumableId: pick.id }, rng);
    }
    case 'random_catalyst': {
      const rarities = eff.rarity ?? ['common'];
      const owned = new Set(s.run.catalysts);
      const pool = CATALYST_META.filter((c) => rarities.includes(c.rarity as any) && !owned.has(c.id));
      if (pool.length === 0) {
        return { ...s, run: { ...s.run, shards: s.run.shards + 6 } };
      }
      if (s.run.catalysts.length >= maxCatalystSlots(s)) {
        return { ...s, run: { ...s.run, shards: s.run.shards + 6 } };
      }
      const pick = pool[Math.floor(rng() * pool.length)]!;
      return { ...s, run: { ...s.run, catalysts: [...s.run.catalysts, pick.id] } };
    }
    case 'random_mod': {
      const rarities = eff.rarity ?? ['common'];
      const pool = MOD_IDS.filter((id) => rarities.includes((lookupMod(id)?.rarity ?? 'common') as any));
      if (pool.length === 0) return s;
      const pick = pool[Math.floor(rng() * pool.length)]!;
      return {
        ...s,
        run: {
          ...s.run,
          ownedMods: [...s.run.ownedMods, pick],
          ownedModEditions: [...(s.run.ownedModEditions ?? []), null],
        },
      };
    }
    case 'lose_random_catalyst': {
      if (s.run.catalysts.length === 0) return s;
      const idx = Math.floor(rng() * s.run.catalysts.length);
      return {
        ...s,
        run: {
          ...s.run,
          catalysts: s.run.catalysts.filter((_, i) => i !== idx),
        },
      };
    }
    case 'lose_random_mod': {
      if (s.run.ownedMods.length === 0) return s;
      const idx = Math.floor(rng() * s.run.ownedMods.length);
      return {
        ...s,
        run: {
          ...s.run,
          ownedMods: s.run.ownedMods.filter((_, i) => i !== idx),
          ownedModEditions: (s.run.ownedModEditions ?? []).filter((_, i) => i !== idx),
        },
      };
    }
    case 'hands_next_blind':
      // Stashed on the round slice's handsLeft to apply on the NEXT
      // START_BLIND. The startBlind() pre-roll currently resets handsLeft
      // from handsMax, so we instead add to a stash field. For the v1
      // scope here we just bump rerollsLeft (cosmetic on hub) — true
      // next-blind deferral is a follow-up. Falls back to shards so the
      // player isn't shorted on the choice they made.
      return { ...s, run: { ...s.run, shards: s.run.shards + Math.max(0, -3 * eff.delta) } };
    case 'rerolls_next_blind':
      return { ...s, round: { ...s.round, rerollsLeft: (s.round.rerollsLeft ?? 0) + eff.delta } };
  }
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
