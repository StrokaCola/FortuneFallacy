// Skip Bounty roller (Pillar G) — rolls 3 distinct bounty options
// when the player skips a non-boss trial. Pure function over an RNG
// supplier so it stays deterministic from the run seed.
//
// The 3-option pool guarantees variety: always one "shards" option
// (legacy comfort), one "consumable" option (a roll-time fresh
// galaxy/maneuver), and one "catalyst" option (a common-rarity
// catalyst, granted directly to run.catalysts if slot available).
//
// If a slot is unavailable (e.g. player at consumable cap or catalyst
// cap), the bounty modal still offers that option, but RESOLVE_SKIP_
// BOUNTY converts it to shards on resolve. This keeps the modal
// always-3-choice and doesn't require state-aware roll logic here.

import type { SkipBountyOption } from '../../state/slices/shop';
import { CATALYST_META } from '../../data/catalysts';
import { CONSUMABLES } from '../consumables';

export type SkipBountyRollInput = {
  rng: () => number;
  // Base shards from BLIND_DEFS skipReward — the shards bounty option
  // is an INCREMENT on top of this. Default +5.
  baseShards: number;
  // Filter ids the player already owns at cap. The roller still emits
  // the option (the resolver converts to shards), but we avoid picking
  // an exact duplicate consumable.
  ownedConsumables: ReadonlyArray<string>;
  ownedCatalysts: ReadonlyArray<string>;
};

export function rollSkipBountyOptions(input: SkipBountyRollInput): SkipBountyOption[] {
  const shardsOption: SkipBountyOption = {
    kind: 'shards',
    amount: 5,
    label: '+5 shards',
  };
  const consumablePool = CONSUMABLES.filter(
    (c) => c.type !== 'galaxy' && c.type !== 'spectral' && !input.ownedConsumables.includes(c.id),
  );
  const consumablePick = consumablePool.length > 0
    ? consumablePool[Math.floor(input.rng() * consumablePool.length)]!
    : null;
  const consumableOption: SkipBountyOption = consumablePick
    ? { kind: 'consumable', consumableId: consumablePick.id, label: `Take ${consumablePick.name}` }
    : { kind: 'pack', packKind: 'celestial', label: 'Free Celestial Pack' };

  const catalystPool = CATALYST_META.filter(
    (c) => c.rarity === 'common' && !input.ownedCatalysts.includes(c.id),
  );
  const catalystPick = catalystPool.length > 0
    ? catalystPool[Math.floor(input.rng() * catalystPool.length)]!
    : null;
  const catalystOption: SkipBountyOption = catalystPick
    ? { kind: 'catalyst', catalystId: catalystPick.id, label: `Take ${catalystPick.name}` }
    : { kind: 'shards', amount: 8, label: '+8 shards (catalyst pool exhausted)' };

  return [shardsOption, consumableOption, catalystOption];
}
