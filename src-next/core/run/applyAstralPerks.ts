// Apply layer for Astral Perks. Called by the NEW_RUN handler after
// applyConstellation has produced the seeded run slice. Each perk's effect
// is resolved here so the perk catalog (data/astralPerks.ts) stays a
// declarative single source of truth.
//
// Read-side perks (reroll discount, slot capacity, boss reveal) are queried
// via `hasAstralPerk(s, id)` from the relevant systems — they don't mutate
// the run slice at run start, they affect run-time computations.

import type { GameState } from '../../state/store';
import type { RunSlice } from '../../state/slices/run';
import { ASTRAL_PERKS, lookupAstralPerk } from '../../data/astralPerks';
import { CONSUMABLES } from '../consumables';

export function hasAstralPerk(s: GameState, id: string): boolean {
  return (s.meta.astralPerks ?? []).includes(id);
}

// Mutating effects: applied once at NEW_RUN time. Returns a new RunSlice.
export function applyAstralPerksToNewRun(
  base: RunSlice,
  ownedPerkIds: string[],
  rng: () => number = Math.random,
): RunSlice {
  let next = base;
  for (const id of ownedPerkIds) {
    const perk = lookupAstralPerk(id);
    if (!perk) continue;
    const e = perk.effect;
    if (e.kind === 'starting_shards') {
      next = { ...next, shards: next.shards + e.amount };
    } else if (e.kind === 'starting_consumable') {
      const pool = CONSUMABLES.filter((c) => c.type !== 'galaxy' && c.type !== 'spectral');
      if (pool.length > 0 && next.consumables.length < 4) {
        const pick = pool[Math.floor(rng() * pool.length)]!;
        next = { ...next, consumables: [...next.consumables, pick.id] };
      }
    }
    // Read-side perks (reroll_discount, starting_catalyst_slot,
    // first_blind_extra_hands, reveal_next_boss) don't mutate the slice
    // at NEW_RUN time. Their effects are queried from the appropriate
    // systems via hasAstralPerk + helper functions below.
  }
  return next;
}

// Read helpers — the systems that actually use these query at compute time.
// All accept the full GameState so they can read meta.astralPerks once.

export function rerollDiscount(s: GameState): number {
  let n = 0;
  for (const id of s.meta.astralPerks ?? []) {
    const e = lookupAstralPerk(id)?.effect;
    if (e?.kind === 'reroll_discount') n += e.amount;
  }
  return n;
}

export function startingCatalystSlotBonus(s: GameState): number {
  let n = 0;
  for (const id of s.meta.astralPerks ?? []) {
    const e = lookupAstralPerk(id)?.effect;
    if (e?.kind === 'starting_catalyst_slot') n += e.amount;
  }
  return n;
}

export function firstBlindExtraHands(s: GameState): number {
  let n = 0;
  for (const id of s.meta.astralPerks ?? []) {
    const e = lookupAstralPerk(id)?.effect;
    if (e?.kind === 'first_blind_extra_hands') n += e.amount;
  }
  return n;
}

export function shouldRevealNextBoss(s: GameState): boolean {
  return (s.meta.astralPerks ?? []).some((id) => lookupAstralPerk(id)?.effect.kind === 'reveal_next_boss');
}

export const ASTRAL_PERK_IDS = ASTRAL_PERKS.map((p) => p.id);
