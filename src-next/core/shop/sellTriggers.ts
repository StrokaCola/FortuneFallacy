// On-Sell triggers — a handful of catalysts fire a one-shot effect when
// sold, turning sell into an active decision rather than just a refund.
// Hand-authored for now; add new entries by extending the SELL_TRIGGERS
// table. Each trigger receives the pre-removal state and returns a
// state delta to merge.
//
// Apply order: AFTER the standard refund + array removal in
// actions/handlers/shop.ts SELL_UPGRADE. So a trigger that grants
// shards stacks on top of the refund.

import type { GameState } from '../../state/store';

export type SellTriggerEffect = {
  // Display label surfaced in the catalyst tooltip + sell-confirm UI.
  label: string;
  // Pure mutation — receives the state with the catalyst already
  // removed; returns a state delta. The delta is shallow-merged into
  // the run slice by the caller.
  apply: (s: GameState) => Partial<GameState['run']>;
};

export const SELL_TRIGGERS: Record<string, SellTriggerEffect> = {
  // Stipend pours the cup out before retiring.
  stipend: {
    label: 'On sell: gain 5 shards.',
    apply: (s) => ({ shards: s.run.shards + 5 }),
  },
  // Audit caches the run's catalyst-spend tally and pays it out as a
  // one-time bonus on sell. Stacks on top of the standard refund.
  audit: {
    label: 'On sell: gain 20 shards.',
    apply: (s) => ({ shards: s.run.shards + 20 }),
  },
  // Compounding Bias forfeits its accumulated stacks for an instant
  // shard payout proportional to the run's progress. Each cleared
  // trial that fed the bias = 3 shards on cash-out.
  compounding_bias: {
    label: 'On sell: gain 3 shards per stack.',
    apply: (s) => ({
      shards: s.run.shards + ((s.run.compoundingStacks ?? 0) * 3),
      compoundingStacks: 0,
    }),
  },
};

export function sellTriggerFor(catalystId: string): SellTriggerEffect | undefined {
  return SELL_TRIGGERS[catalystId];
}
