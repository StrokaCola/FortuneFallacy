// Per-card transient animation records, keyed by an autoincrementing
// id so React can `.map()` cleanly and the parent can drop entries
// after their CSS animation finishes.

export type FloaterRecord = {
  key: number;
  catalystId: string;
  text: string;
  // Tone drives the floater's color + shadow palette. `chips` is the
  // default cyan, `mult` is ember orange (matching the multiplier
  // tier-0 token), `scaling` is emerald so accumulated bonuses from
  // the 2026-05-11 scaling pack read distinct from regular +chips.
  tone: 'chips' | 'mult' | 'scaling';
};

export type RingRecord = {
  key: number;
  catalystId: string;
  color: string;
};

// Pulse kinds — drives which CSS keyframe animation runs on the card.
// Priority: legendary > scaling > collision > chain > regular fire.
// `chain` is reserved for catalyst_bench's ripple-through.
export type PulseKind =
  | 'fire'
  | 'fire-legendary'
  | 'chain'
  | 'scaling'
  | 'collision';
