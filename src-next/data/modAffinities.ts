// Cross-mod affinity pairs — when two mods that "belong together" share
// a single die, the affinity surfaces as a gold link arc in the Forge
// orbit panel and (when the die scores) a brief gold connecting flash
// between the mods' satellites in the play area.
//
// 2026-05-11 Forge overhaul · Phase 3.1
//
// Authored, not generated. The goal is "named pairings the player
// stumbles on" — a Crown + Mirror Pair feels like a meaningful build,
// not a random heuristic.
//
// Implementation:
//   - Forge orbit panel reads activeAffinities(modIds) and renders an
//     SVG arc connecting the affinitied mods' orbital positions.
//   - In-play, when a die that carries an affinitied pair scores, the
//     scoring pipeline emits an `onDieAffinityFire` event that triggers
//     a brief gold modFx arc (see render/three/modFx/affinityArc.ts).

export type ModAffinityDef = {
  id: string;     // stable id, used in 'affinity:<id>' fire events
  a: string;
  b: string;
  name: string;
  flavor: string;
};

export const MOD_AFFINITIES: ModAffinityDef[] = [
  // Face-6 cluster.
  {
    id: 'royal_court',
    a: 'crown', b: 'mirror_pair',
    name: 'Royal Court',
    flavor: 'A king and his reflection. Both lift, both pay.',
  },
  {
    id: 'loaded_crown',
    a: 'loaded', b: 'crown',
    name: 'Loaded Crown',
    flavor: 'The fix is in. The throne knows.',
  },
  // Position pair (first / last).
  {
    id: 'opening_closing',
    a: 'vanguard', b: 'capstone',
    name: 'Opening / Closing',
    flavor: 'The first note pays. The last note pays louder.',
  },
  // Edge sharpening.
  {
    id: 'whetstone',
    a: 'sharpened', b: 'keystone',
    name: 'Whetstone',
    flavor: 'A hone for the peak die. Both edges paid.',
  },
  // Brittle protection.
  {
    id: 'inscribed_glass',
    a: 'brittle', b: 'engraved',
    name: 'Inscribed Glass',
    flavor: 'Brittle, but never bust.',
  },
  // Snake / fang lore.
  {
    id: 'serpents_eye',
    a: 'snake_eyes', b: 'pyre_mark',
    name: "Serpent's Eye",
    flavor: 'The fang strikes the ember.',
  },
  // Chain pair.
  {
    id: 'concord',
    a: 'conduit', b: 'crescendo',
    name: 'Concord',
    flavor: 'Each die feeds the next. Each note builds.',
  },
  // Shard alchemy.
  {
    id: 'mintwork',
    a: 'gilded', b: 'refinery',
    name: 'Mintwork',
    flavor: 'Coin makes coin.',
  },
  // Gambler's lane.
  {
    id: 'gamblers_pact',
    a: 'risk', b: 'high_roller',
    name: "Gambler's Pact",
    flavor: 'Bet the high. Pay on the high.',
  },
  // Growing-with-the-run pair (scaling die-mods).
  {
    id: 'long_memory',
    a: 'tally_mark', b: 'veteran',
    name: 'Long Memory',
    flavor: 'The die remembers. The die keeps score.',
  },
  // Galaxy-aware combo readers.
  {
    id: 'starwatcher',
    a: 'astrolabe', b: 'telescope',
    name: 'Starwatcher',
    flavor: 'The chart finds the chart.',
  },
  // Pulsing legendaries.
  {
    id: 'standing_wave',
    a: 'resonance', b: 'echo',
    name: 'Standing Wave',
    flavor: 'The first ring never settles. It feeds the second.',
  },
];

export function lookupAffinity(id: string): ModAffinityDef | undefined {
  return MOD_AFFINITIES.find((p) => p.id === id);
}

// Returns the affinity pairs active on a single die given its attached
// mod ids. Order-independent. A die with mods [a, b, c] can carry
// multiple affinities — every pair where both halves are present
// shows up.
export function activeAffinitiesOnDie(modIds: ReadonlyArray<string>): ModAffinityDef[] {
  if (modIds.length < 2) return [];
  const set = new Set(modIds);
  return MOD_AFFINITIES.filter((p) => set.has(p.a) && set.has(p.b));
}

// Given an affinity pair and an ordered mod array on a die, returns
// the two slot indices that hold each half. Used by the renderer to
// position the link arc between satellite/rim locations.
export function affinitySlotIndices(
  pair: ModAffinityDef,
  modIds: ReadonlyArray<string>,
): [number, number] | null {
  const aIdx = modIds.indexOf(pair.a);
  const bIdx = modIds.indexOf(pair.b);
  if (aIdx < 0 || bIdx < 0) return null;
  return [aIdx, bIdx];
}
