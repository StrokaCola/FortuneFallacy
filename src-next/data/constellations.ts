// Constellations are run-style choices made on the title flow. Each one
// declares its own dice set plus a small set of rule overrides; the engine
// resolves everything via `core/run/diceContext.ts`.
//
// Adding a constellation: append a new entry with a unique `id`, supply its
// dice spec, write rules into `rules`, then verify the registry order is the
// order shown in the picker grid.

import type { DieFace, DiceSpec } from './dice';
import {
  d4Plain, d6Plain, d8Plain, d10Plain, d12Plain, d100Plain, dN,
} from './dice';

export type ScoringMode = 'combo' | 'face_x_catalysts';

export type ConstellationModifiers = {
  startingShards?: number;
  comboCountBonus?: number;       // raise count thresholds (Mensa)
  straightLenBonus?: number;      // shift straight thresholds (Triumvirate -2 / Mensa +1)
  chainCap?: number;              // override chain cap (default 8)
  chainStep?: number;             // override chain step (default 0.25)
  chainNeverBreaks?: boolean;
  baseChipsMult?: number;         // multiply combo base chips (Eclipse 0.25)
  baseMultMult?: number;          // multiply combo base mult (Eclipse 0.25)
  scoringMode?: ScoringMode;
  forgeDisabled?: boolean;
  modsDisabled?: boolean;
  catalystSlotBonus?: number;     // Argo
  faceMultiplierPerCatalyst?: number; // Argo: 0.5 → score = face × (1 + 0.5 × catN)
};

export type Constellation = {
  id: string;
  name: string;
  flavor: string;
  rules: string[];
  dice: DiceSpec;
  startingCatalysts?: string[];
  startingMods?: string[];
  modifiers?: ConstellationModifiers;
  // Glyph: simple normalised points used by the picker card. x,y in 0..100.
  glyph: { x: number; y: number }[];
};

export const DEFAULT_CONSTELLATION_ID = 'lyra';

const FIBONACCI_FACES: DieFace[] = [1, 1, 2, 3, 5, 8];
const ECLIPSE_FACES:   DieFace[] = [0, 0, 0, 1, 1, 1];
const OPHIUCHUS_FACES: DieFace[] = [1, 2, 3, 4, 5, 'WILD'];

export const CONSTELLATIONS: Constellation[] = [
  {
    id: 'lyra',
    name: 'Lyra, the Lyre',
    flavor: 'The classic five-string sky.',
    rules: ['Five standard d6 dice', 'No rule changes'],
    dice: Array.from({ length: 5 }, () => d6Plain()),
    glyph: [{ x: 15, y: 50 }, { x: 35, y: 30 }, { x: 50, y: 60 }, { x: 70, y: 35 }, { x: 88, y: 55 }],
  },
  {
    id: 'mensa',
    name: 'Mensa, the Many',
    flavor: 'Seven dice. More fortune, more fallacy.',
    rules: [
      'Seven standard d6 dice',
      'Match thresholds raised: Five-of-a-Kind needs 6 matching, Four needs 5',
      'Straight thresholds raised by 1',
    ],
    dice: Array.from({ length: 7 }, () => d6Plain()),
    modifiers: { comboCountBonus: 1, straightLenBonus: 1 },
    glyph: [
      { x: 12, y: 40 }, { x: 25, y: 60 }, { x: 38, y: 35 }, { x: 50, y: 55 },
      { x: 62, y: 35 }, { x: 75, y: 60 }, { x: 88, y: 40 },
    ],
  },
  {
    id: 'triumvirate',
    name: 'Triumvirate, the Three Pillars',
    flavor: 'Three colossal d12. Few hands, big numbers.',
    rules: [
      'Three d12 dice',
      'Four/Five-of-a-Kind impossible',
      'Straight thresholds drop by 2 (Small=2, Large=3)',
    ],
    dice: [d12Plain(), d12Plain(), d12Plain()],
    modifiers: { straightLenBonus: -2 },
    glyph: [{ x: 25, y: 50 }, { x: 50, y: 30 }, { x: 75, y: 50 }],
  },
  {
    id: 'argo',
    name: 'Argo, the Vessel',
    flavor: 'A single d100. No combos. Just multipliers.',
    rules: [
      'One d100 die',
      'Combos disabled — score = face × (1 + 0.5 × catalysts)',
      'Forge & mods disabled, +2 catalyst slots',
    ],
    dice: [d100Plain()],
    modifiers: {
      scoringMode: 'face_x_catalysts',
      faceMultiplierPerCatalyst: 0.5,
      forgeDisabled: true,
      modsDisabled: true,
      catalystSlotBonus: 2,
    },
    glyph: [{ x: 50, y: 45 }],
  },
  {
    id: 'fibonacci',
    name: 'Fibonacci, the Spiral',
    flavor: 'Faces 1·1·2·3·5·8 — pairs come easy, eights come rich.',
    rules: [
      'Five dice with faces [1, 1, 2, 3, 5, 8]',
      'Two 1s on every die — pairs trivialise',
      'Face 8 carries most of the chips',
    ],
    dice: Array.from({ length: 5 }, () => dN([...FIBONACCI_FACES], { label: 'fib' })),
    glyph: [
      { x: 20, y: 60 }, { x: 30, y: 40 }, { x: 45, y: 30 },
      { x: 65, y: 35 }, { x: 85, y: 55 },
    ],
  },
  {
    id: 'eclipse',
    name: 'Eclipse, the Binary',
    flavor: 'Half blanks, half ones. Mods carry the run.',
    rules: [
      'Five dice with faces [0,0,0,1,1,1]',
      'Combos easy to land but base chips & mult ×0.25',
      'You will need mods.',
    ],
    dice: Array.from({ length: 5 }, () => dN([...ECLIPSE_FACES], { label: '0/1' })),
    modifiers: { baseChipsMult: 0.25, baseMultMult: 0.25 },
    glyph: [
      { x: 18, y: 50 }, { x: 36, y: 50 }, { x: 54, y: 50 },
      { x: 72, y: 50 }, { x: 90, y: 50 },
    ],
  },
  {
    id: 'polyhedra',
    name: 'Polyhedra, the Five Solids',
    flavor: 'One of each: d4, d6, d8, d10, d12.',
    rules: [
      'Heterogeneous — every die is different',
      'Some dice cannot reach high faces — plan accordingly',
      'Match logic unchanged; straight detection adapts',
    ],
    dice: [d4Plain(), d6Plain(), d8Plain(), d10Plain(), d12Plain()],
    glyph: [
      { x: 15, y: 65 }, { x: 33, y: 35 }, { x: 50, y: 60 },
      { x: 70, y: 30 }, { x: 88, y: 55 },
    ],
  },
  {
    id: 'ophiuchus',
    name: 'Ophiuchus, the Hidden Sign',
    flavor: 'Five dice, each with a wildcard face.',
    rules: [
      'Five dice with faces [1,2,3,4,5,WILD]',
      'WILD becomes whatever value maximises your combo at score time',
      'Chain cap reduced to 4',
    ],
    dice: Array.from({ length: 5 }, () => dN([...OPHIUCHUS_FACES], { label: 'd5+★' })),
    modifiers: { chainCap: 4 },
    glyph: [
      { x: 20, y: 55 }, { x: 38, y: 35 }, { x: 50, y: 60 },
      { x: 65, y: 35 }, { x: 85, y: 55 },
    ],
  },
];

export function lookupConstellation(id: string | undefined): Constellation {
  if (!id) return CONSTELLATIONS[0]!;
  return CONSTELLATIONS.find((c) => c.id === id) ?? CONSTELLATIONS[0]!;
}
