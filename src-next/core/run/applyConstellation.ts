// Pure: take a fresh RunSlice and a Constellation, return the seeded RunSlice.
// Sizes diceMods to match the dice spec, applies starting catalysts/mods/shards,
// records the constellationId for downstream resolvers.

import type { RunSlice } from '../../state/slices/run';
import type { Constellation } from '../../data/constellations';

export function applyConstellation(base: RunSlice, c: Constellation): RunSlice {
  const diceCount = c.dice.length;
  return {
    ...base,
    constellationId: c.id,
    shards: base.shards + (c.modifiers?.startingShards ?? 0),
    catalysts: [...(c.startingCatalysts ?? [])],
    ownedMods: [...(c.startingMods ?? [])],
    diceMods: Array.from({ length: diceCount }, () => [] as string[]),
  };
}
