// Cross-catalyst Resonance pairs. When a player owns BOTH halves of a
// pair, a third "resonance" effect fires once per scoring hand on top of
// the catalysts' individual contributions. Pairs are hand-authored
// rather than generated — the goal is *named* combos players talk about,
// not algorithmic synergies.
//
// Apply order: AFTER the main catalyst loop in core/phases/upgrades.ts,
// so a pair's bonus rides any earlier catalyst multipliers (Tempo,
// Compounding Bias, etc.) but doesn't compound with itself.
//
// Discovery loop: the shop hint (see core/shop/synergyHint.ts when
// shipped) flags an offered catalyst that resonates with one already
// owned, so players naturally encounter pairs without a wiki dive.

export type ResonanceEffect =
  // +N flat chips added to the running chip total this hand.
  | { kind: 'chips'; value: number }
  // +N flat mult added to the running mult total this hand.
  | { kind: 'mult'; value: number }
  // Both — for the strongest hero pairs.
  | { kind: 'both'; chips: number; mult: number };

export type ResonanceDef = {
  // Stable id used in 'resonance:<id>' fire events.
  id: string;
  // Required pair — both catalyst ids must be present in run.catalysts
  // for this resonance to fire. Order is irrelevant.
  a: string;
  b: string;
  name: string;
  flavor: string;
  effect: ResonanceEffect;
};

// 12 hand-authored pairs. Tuned conservatively — a resonance is a
// "discovered" payoff and should reward focused builds without breaking
// the underlying balance curve. Power roughly scales with the rarity of
// the rarer half of the pair.
export const RESONANCES: ResonanceDef[] = [
  // -- Mods tribe -------------------------------------------------------
  {
    id: 'symphony',
    a: 'conductor',
    b: 'encore',
    name: 'Symphony',
    flavor: 'The orchestra plays on. The crowd refuses to leave.',
    effect: { kind: 'mult', value: 5 },
  },
  {
    id: 'resonant_lattice',
    a: 'phase_shift',
    b: 'conductor',
    name: 'Resonant Lattice',
    flavor: 'Every thread sings the same note. Louder than the sum.',
    effect: { kind: 'chips', value: 30 },
  },

  // -- Face tribe -------------------------------------------------------
  {
    id: 'loaded_die',
    a: 'six_bias',
    b: 'iron_six',
    name: 'Loaded Die',
    flavor: 'Heavier at the top. Heavier at the bottom. Heavier all over.',
    effect: { kind: 'both', chips: 20, mult: 2 },
  },
  {
    id: 'furnace',
    a: 'solar_flare',
    b: 'iron_six',
    name: 'Furnace',
    flavor: 'Iron in the corona. The wheel runs hot.',
    effect: { kind: 'mult', value: 4 },
  },

  // -- Combo tribe ------------------------------------------------------
  {
    id: 'long_arc',
    a: 'magnitude',
    b: 'chaos_theory',
    name: 'Long Arc',
    flavor: 'Order traced through chaos. The line holds, blazing.',
    effect: { kind: 'chips', value: 40 },
  },
  {
    id: 'pair_to_set',
    a: 'pair_dynamo',
    b: 'triplet_engine',
    name: 'Pair to Set',
    flavor: 'Two becomes three becomes everything.',
    effect: { kind: 'mult', value: 3 },
  },
  {
    id: 'all_together_now',
    a: 'cold_hand',
    b: 'entropy_index',
    name: 'All Together Now',
    flavor: 'No pattern, no repeats. The void scores anyway.',
    effect: { kind: 'mult', value: 4 },
  },

  // -- Economy tribe ----------------------------------------------------
  {
    id: 'tithe',
    a: 'shard_sink',
    b: 'stipend',
    name: 'Tithe',
    flavor: 'The drip fills the offering plate. The plate empties itself.',
    effect: { kind: 'chips', value: 25 },
  },
  {
    id: 'deep_vein',
    a: 'recursive_sink',
    b: 'shard_sink',
    name: 'Deep Vein',
    flavor: 'Every shard struck pays out the next strike.',
    effect: { kind: 'mult', value: 4 },
  },

  // -- Timing tribe -----------------------------------------------------
  {
    id: 'closer',
    a: 'patience_counter',
    b: 'last_throw',
    name: 'Closer',
    flavor: 'Wait. Wait. Wait. Strike.',
    effect: { kind: 'chips', value: 50 },
  },
  {
    id: 'locked_in',
    a: 'stratifier',
    b: 'quorum',
    name: 'Locked In',
    flavor: 'The verdict held twice. Triple penalty.',
    effect: { kind: 'mult', value: 3 },
  },

  // -- Scaling tribe ----------------------------------------------------
  {
    id: 'crescendo',
    a: 'tempo',
    b: 'compounding_bias',
    name: 'Crescendo',
    flavor: 'The line still climbs. The line never came down.',
    effect: { kind: 'mult', value: 3 },
  },
];

export function lookupResonance(id: string): ResonanceDef | undefined {
  return RESONANCES.find((r) => r.id === id);
}

// Returns all resonance pair ids that fire given a set of owned
// catalysts. Order-independent. Used by the upgrades phase to apply
// effects, by the catalyst strip to render a "linked" treatment between
// owned halves, and by the shop hint to mark an offer as a synergy buy.
export function activeResonances(ownedCatalysts: ReadonlyArray<string>): ResonanceDef[] {
  const owned = new Set(ownedCatalysts);
  return RESONANCES.filter((r) => owned.has(r.a) && owned.has(r.b));
}

// Returns the resonance pairs an offered catalyst would COMPLETE given
// the player's current set. Used to flag synergy buys in the shop UI.
export function pairsCompletedBy(
  offeredId: string,
  ownedCatalysts: ReadonlyArray<string>,
): ResonanceDef[] {
  const owned = new Set(ownedCatalysts);
  if (owned.has(offeredId)) return []; // already counted
  return RESONANCES.filter((r) => {
    if (r.a === offeredId && owned.has(r.b)) return true;
    if (r.b === offeredId && owned.has(r.a)) return true;
    return false;
  });
}
