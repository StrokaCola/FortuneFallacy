// Constellations are run-style choices made on the title flow. Each one
// declares its own dice set plus a small set of rule overrides; the engine
// resolves everything via `core/run/diceContext.ts`.
//
// Adding a constellation: append a new entry with a unique `id`, supply its
// dice spec, write rules into `rules`, then verify the registry order is the
// order shown in the picker grid.

import type { DieFace, DiceSpec } from './dice';
import {
  d4Plain, d6Plain, d8Plain, d10Plain, d12Plain, d20Plain, dN,
} from './dice';

// 'captain_crew' (Argo): score = max(faces) × (1 + perCat × catalysts) + sum(others).
// The highest die ("captain") rides the catalyst multiplier; the rest ("crew")
// add flat chips. No combo lookup.
export type ScoringMode = 'combo' | 'captain_crew';

export type ConstellationModifiers = {
  startingShards?: number;
  comboCountBonus?: number;       // raise count thresholds (Mensa)
  straightLenBonus?: number;      // shift straight thresholds (Triumvirate -2 / Mensa +1)
  chainCap?: number;              // override chain cap (default 4)
  chainStep?: number;             // override chain step (default 0.25)
  chainNeverBreaks?: boolean;
  baseChipsMult?: number;         // multiply combo base chips (Eclipse 0.25)
  baseMultMult?: number;          // multiply combo base mult (Eclipse 0.25)
  scoringMode?: ScoringMode;
  forgeDisabled?: boolean;
  modsDisabled?: boolean;
  catalystSlotBonus?: number;     // Argo
  faceMultiplierPerCatalyst?: number; // Argo: 1.0 → score = face × (1 + 1.0 × catN)
};

export type Constellation = {
  id: string;
  name: string;
  flavor: string;
  rules: string[];
  // Identity tint used as the run-wide accent color (TopBar Astrolabe,
  // Round action-bar arrows). Avoid the four
  // semantically reserved colors that already mean something:
  //   #f5c451 (gold)    — target crossed / "TARGET BEAT" stamp
  //   #ff7847 (orange)  — multiplier tier 0
  //   #cc88ff (magenta) — multiplier tier 1 / generic beat tint
  //   #e2334a (crimson) — boss debuff (overrides constellation accent)
  // Keep above ~50% luminance so the color reads on the dark backdrop.
  color: string;
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
    color: '#7be3ff',
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
    color: '#c084fc',
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
    color: '#fbbf24',
    dice: [d12Plain(), d12Plain(), d12Plain()],
    modifiers: { straightLenBonus: -2 },
    glyph: [{ x: 25, y: 50 }, { x: 50, y: 30 }, { x: 75, y: 50 }],
  },
  {
    id: 'argo',
    name: 'Argo, the Vessel',
    flavor: 'Three d20: a captain and her crew.',
    rules: [
      'Three d20 dice',
      'Combos disabled — score = captain × (1 + 1.0 × catalysts) + crew',
      'Captain = highest face this hand; crew = the others',
      'Forge & mods disabled, +2 catalyst slots',
      'Start with Captain’s Wage (face ≥ 10 → +5 chips)',
    ],
    color: '#34d399',
    dice: [d20Plain(), d20Plain(), d20Plain()],
    startingCatalysts: ['captains_wage'],
    modifiers: {
      scoringMode: 'captain_crew',
      // 2026-05-08 audit: perCat 0.75 → 1.0 restored a competitive captain
      // multiplier (0% → 21% A1 clear in the full-run sim). Follow-up pass:
      // seed `captains_wage` so the catalyst-dependent design has a floor on
      // hand 1 — captain mult opens at 2.0 instead of 1.0, and the +5/scoring
      // face ≥ 10 trigger gives an early-ante chips floor. Slot bonus stays +2.
      faceMultiplierPerCatalyst: 1.0,
      forgeDisabled: true,
      modsDisabled: true,
      catalystSlotBonus: 2,
    },
    glyph: [{ x: 30, y: 38 }, { x: 50, y: 60 }, { x: 70, y: 38 }],
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
    color: '#fb7185',
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
      'Combos easy to land but base chips & mult ×0.5',
      'Still leans on mods to clear later antes.',
    ],
    color: '#e5e7eb',
    dice: Array.from({ length: 5 }, () => dN([...ECLIPSE_FACES], { label: '0/1' })),
    modifiers: { baseChipsMult: 0.5, baseMultMult: 0.5 },
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
    color: '#60a5fa',
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
      'Base chips & mult ×0.5 (WILD-driven combos hit hard already)',
    ],
    color: '#a78bfa',
    dice: Array.from({ length: 5 }, () => dN([...OPHIUCHUS_FACES], { label: 'd5+★' })),
    // chainCap: 4 was Ophiuchus's punishment but matches the new default
    // (post-2026-05-07 audit) — removed as identity. Constellation may want a
    // fresh drawback to maintain its high-risk identity; flagged in audit.
    modifiers: { baseChipsMult: 0.5, baseMultMult: 0.5 },
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
