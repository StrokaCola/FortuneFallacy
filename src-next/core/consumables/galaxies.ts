import type { GameState } from '../../state/store';
import type { GameEventEmission } from '../../events/types';
import type { ConsumableDef } from './index';

// Per-level chip and mult bonuses for each combo. Mirrors Balatro's planet
// curve, scaled to FortuneFallacy's smaller base values. These add to the
// combo's base chips/mult inside Phase.EVALUATION (see core/phases/evaluation.ts)
// — they apply BEFORE catalyst multipliers so catalysts that gate on
// combo (e.g. Stratifier on Full House) compound on the leveled base.
//
// Keep the table sorted by combo tier ascending so the UI's hand-levels
// panel can iterate in display order without re-sorting.
export const GALAXY_BONUS: Record<string, { chips: number; mult: number }> = {
  chance:      { chips: 10, mult: 1 },
  one_pair:    { chips: 15, mult: 1 },
  two_pair:    { chips: 20, mult: 1 },
  three_kind:  { chips: 20, mult: 2 },
  sm_straight: { chips: 30, mult: 2 },
  full_house:  { chips: 25, mult: 2 },
  lg_straight: { chips: 35, mult: 3 },
  four_kind:   { chips: 30, mult: 3 },
  five_kind:   { chips: 40, mult: 4 },
};

// All combos that galaxy levels apply to. Used by Quasar (universal) and
// for safe iteration when building/migrating run state.
export const GALAXY_COMBO_IDS: string[] = Object.keys(GALAXY_BONUS);

type GalaxyMeta = {
  id: string;
  name: string;
  icon: string;
  comboId: string;
  // Flavor text for the codex. Rendered below the mechanical description.
  flavor?: string;
};

const GALAXY_META: GalaxyMeta[] = [
  { id: 'galaxy_milky_way',  name: 'Milky Way',     icon: '✦', comboId: 'chance',      flavor: 'A scattered hand still rides home.' },
  { id: 'galaxy_cartwheel',  name: 'Cartwheel',     icon: '◎', comboId: 'one_pair',    flavor: 'Two faces, one rotation.' },
  { id: 'galaxy_cigar',      name: 'Cigar',         icon: '⬭', comboId: 'two_pair',    flavor: 'Twin lobes burning slow.' },
  { id: 'galaxy_whirlpool',  name: 'Whirlpool',     icon: '◉', comboId: 'three_kind',  flavor: 'The third confirms the spiral.' },
  { id: 'galaxy_pinwheel',   name: 'Pinwheel',      icon: '✺', comboId: 'sm_straight', flavor: 'Four arms, one axis.' },
  { id: 'galaxy_sombrero',   name: 'Sombrero',      icon: '◓', comboId: 'full_house',  flavor: 'Three plus two, brim and crown.' },
  { id: 'galaxy_bodes',      name: "Bode's Galaxy", icon: '✹', comboId: 'lg_straight', flavor: 'A clean line through the dark.' },
  { id: 'galaxy_triangulum', name: 'Triangulum',    icon: '▲', comboId: 'four_kind',   flavor: 'Four corners, all the same star.' },
  { id: 'galaxy_andromeda',  name: 'Andromeda',     icon: '✪', comboId: 'five_kind',   flavor: 'Every face the same. Every face you.' },
];

function bumpCombo(s: GameState, comboId: string, by: number): GameState {
  const cur = s.run.comboLevels?.[comboId] ?? 0;
  return {
    ...s,
    run: {
      ...s.run,
      comboLevels: { ...s.run.comboLevels, [comboId]: cur + by },
    },
  };
}

function comboNameForDescription(comboId: string): string {
  switch (comboId) {
    case 'chance': return 'Chance';
    case 'one_pair': return 'One Pair';
    case 'two_pair': return 'Two Pair';
    case 'three_kind': return 'Three of a Kind';
    case 'sm_straight': return 'Small Straight';
    case 'full_house': return 'Full House';
    case 'lg_straight': return 'Large Straight';
    case 'four_kind': return 'Four of a Kind';
    case 'five_kind': return 'Five of a Kind';
    default: return comboId;
  }
}

const COMBO_GALAXIES: ConsumableDef[] = GALAXY_META.map((meta) => {
  const bonus = GALAXY_BONUS[meta.comboId]!;
  return {
    id: meta.id,
    type: 'galaxy',
    name: meta.name,
    icon: meta.icon,
    description: `Lvl up ${comboNameForDescription(meta.comboId)}: +${bonus.chips} pips, +${bonus.mult} mult.`,
    requiresTarget: false,
    comboId: meta.comboId,
    levels: 1,
    apply: (s) => {
      const next = bumpCombo(s, meta.comboId, 1);
      const events: GameEventEmission[] = [
        {
          type: 'onGalaxyUsed',
          payload: {
            galaxyId: meta.id,
            combo: meta.comboId,
            levelsAdded: { [meta.comboId]: 1 },
          },
        },
      ];
      return { state: next, events };
    },
  } satisfies ConsumableDef;
});

const QUASAR: ConsumableDef = {
  id: 'galaxy_quasar',
  type: 'galaxy',
  name: 'Quasar',
  icon: '✸',
  description: 'Lvl up every combo by 1.',
  requiresTarget: false,
  comboId: 'all',
  levels: 1,
  apply: (s) => {
    let next = s;
    const levelsAdded: Record<string, number> = {};
    for (const id of GALAXY_COMBO_IDS) {
      next = bumpCombo(next, id, 1);
      levelsAdded[id] = 1;
    }
    return {
      state: next,
      events: [
        {
          type: 'onGalaxyUsed',
          payload: { galaxyId: 'galaxy_quasar', combo: 'all', levelsAdded },
        },
      ],
    };
  },
};

export const GALAXIES: ConsumableDef[] = [...COMBO_GALAXIES, QUASAR];

// All galaxy ids that can roll inside a pack. Quasar is included with a low
// weight so it shows up rarely. Combo galaxies share equal weight; rarer
// hands (Five of a Kind, Large Straight) are weighted slightly LOWER inside
// packs to match Balatro's planet rarity — they're still ultra-valuable but
// players shouldn't fall into Andromeda decks by accident.
const GALAXY_PACK_WEIGHTS: Record<string, number> = {
  galaxy_milky_way:  10,
  galaxy_cartwheel:  10,
  galaxy_cigar:      10,
  galaxy_whirlpool:  10,
  galaxy_pinwheel:    9,
  galaxy_sombrero:    9,
  galaxy_bodes:       7,
  galaxy_triangulum:  7,
  galaxy_andromeda:   5,
  galaxy_quasar:      1,
};

export type PackKind = 'celestial' | 'stellar' | 'galactic' | 'maneuver';

export type PackDef = {
  kind: PackKind;
  name: string;
  price: number;
  showCount: number;
  pickCount: number;
  // Quasar weight override: Galactic Pack triples the Quasar chance to make
  // it the "splashy" pack of the three. Other kinds use the base weights.
  quasarWeightMultiplier?: number;
};

export const PACK_DEFS: PackDef[] = [
  { kind: 'celestial', name: 'Celestial Pack', price: 4, showCount: 2, pickCount: 1 },
  { kind: 'stellar',   name: 'Stellar Pack',   price: 6, showCount: 3, pickCount: 1 },
  { kind: 'galactic',  name: 'Galactic Pack',  price: 8, showCount: 4, pickCount: 2, quasarWeightMultiplier: 3 },
  // Maneuver Pack rolls from the orbital-maneuver pool (course corrections,
  // burns, sync-ups). Skews toward immediate hand-shaping rather than
  // permanent levels — the tactical sibling of galaxy packs.
  { kind: 'maneuver',  name: 'Maneuver Pack', price: 5, showCount: 3, pickCount: 1 },
];

// Roll N distinct maneuver ids uniformly. Maneuvers are flat-tiered for now
// (no rarity weights) so a uniform draw keeps the pack feeling like a clean
// tactical pick. Pure helper, takes RNG so tests can seed.
export function rollManeuverContents(showCount: number, rng: () => number): string[] {
  const pool = MANEUVER_IDS_FOR_PACK.slice();
  const picks: string[] = [];
  for (let i = 0; i < showCount && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    picks.push(pool[idx]!);
    pool.splice(idx, 1);
  }
  return picks;
}

// Authored separately so the pack pool can deliberately omit any maneuver
// that's tagged as shop-only or boss-reward-only later.
const MANEUVER_IDS_FOR_PACK = [
  'course_correction',
  'burn_pass',
  'sync_up',
  'thrust_boost',
  'recoil_vent',
  'rendezvous',
];

export function lookupPack(kind: string): PackDef | undefined {
  return PACK_DEFS.find((p) => p.kind === kind);
}

// Roll N distinct galaxy ids from the weighted pool. `quasarMult` scales
// the Quasar weight (1 by default; Galactic uses 3). Pure function — caller
// supplies a random source so it can be seeded in tests.
export function rollPackContents(
  showCount: number,
  rng: () => number,
  quasarMult = 1,
): string[] {
  const pool: { id: string; weight: number }[] = Object.entries(GALAXY_PACK_WEIGHTS).map(([id, w]) => ({
    id,
    weight: id === 'galaxy_quasar' ? w * quasarMult : w,
  }));
  const picks: string[] = [];
  for (let i = 0; i < showCount; i++) {
    const remaining = pool.filter((p) => !picks.includes(p.id));
    if (remaining.length === 0) break;
    const totalWeight = remaining.reduce((s, p) => s + p.weight, 0);
    let roll = rng() * totalWeight;
    for (const p of remaining) {
      roll -= p.weight;
      if (roll <= 0) {
        picks.push(p.id);
        break;
      }
    }
  }
  return picks;
}
