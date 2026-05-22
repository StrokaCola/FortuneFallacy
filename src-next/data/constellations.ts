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
import { CONSTELLATION_TINT } from '../styles/constellationTokens';

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
  baseChipsMult?: number;         // multiply combo base chips (Eclipse / Ophiuchus 0.5)
  baseMultMult?: number;          // multiply combo base mult (Eclipse / Ophiuchus 0.5)
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
    color: CONSTELLATION_TINT.lyra,
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
    color: CONSTELLATION_TINT.mensa,
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
    color: CONSTELLATION_TINT.triumvirate,
    dice: [d12Plain(), d12Plain(), d12Plain()],
    // 2026-05-12 QA pass: baseChipsMult 1.3 added. Sim flagged Triumvirate
    // at 24% A4 (vs Lyra 82%); the "three colossal d12, big numbers"
    // identity needed actual chip uplift to back the flavor.
    //
    // 2026-05-21 multi-role pass: 1.3 chips alone left Triumvirate at
    // 51% A4 (-31pp vs Lyra). Tried chainCap=6 first (cap-hit-rate had
    // been 45% — looked like the cap was ceilinging the constellation)
    // but lifting the cap moved A4 zero percentage points: the chain
    // wasn't bottlenecked, the constellation just lacked raw scoring
    // throughput from only 3 dice. Settled on stacked chip + mult
    // multipliers: 1.4 chips × 1.2 mult lands A4 at 62%. -20pp vs Lyra,
    // inside the 25pp parity band; no outlier flag.
    modifiers: { straightLenBonus: -2, baseChipsMult: 1.4, baseMultMult: 1.2 },
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
    color: CONSTELLATION_TINT.argo,
    dice: [d20Plain(), d20Plain(), d20Plain()],
    startingCatalysts: ['captains_wage'],
    modifiers: {
      scoringMode: 'captain_crew',
      // 2026-05-12 QA pass: perCat 1.0 → 1.25 to close the Argo A4 gap
      // (sim flagged Argo at 12% A4 vs Lyra 82%). Slot bonus stays +2.
      // Combined with the seeded Captain's Wage from 2026-05-08, captain
      // multiplier now opens at 2.25 on hand 1 and climbs faster as the
      // run builds catalysts.
      faceMultiplierPerCatalyst: 1.25,
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
    color: CONSTELLATION_TINT.fibonacci,
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
    color: CONSTELLATION_TINT.eclipse,
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
    color: CONSTELLATION_TINT.polyhedra,
    dice: [d4Plain(), d6Plain(), d8Plain(), d10Plain(), d12Plain()],
    // 2026-05-12 QA pass: baseChipsMult 1.25 + straightLenBonus -1
    // added. Sim originally flagged Polyhedra at 22% A4. Pure chip
    // boost barely moved the dial (30 → 32%) because the constellation's
    // bottleneck is combo TIER — heterogeneous dice rarely produce
    // 3+ of a kind. Dropping the small-straight requirement to a
    // run of 3 (was 4) lets a d4+d6+d8 line score as a real combo
    // and pushes A4 clear past 50%. Matches the "different dice, each
    // tells a story" flavor: the variety should reward you.
    modifiers: { baseChipsMult: 1.25, straightLenBonus: -1 },
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
    color: CONSTELLATION_TINT.ophiuchus,
    dice: Array.from({ length: 5 }, () => dN([...OPHIUCHUS_FACES], { label: 'd5+★' })),
    // 2026-05-12 QA pass: chainStep dropped 0.25 → 0.15 to replace the
    // identity penalty Ophiuchus lost when the chain cap was unified to 4
    // for everyone (chainCap: 4 used to be Ophiuchus-only).
    //
    // 2026-05-21 multi-role pass: reverted chainStep back to 0.25 (the
    // universal default). The 0.15 value over-corrected: balance.fullrun
    // sweep at 200 runs/cell showed A4 Spark clear at 49% (0.15) → 60%
    // (0.20) → 68% (0.25) → 73% (0.30). Ophiuchus already pays a double
    // identity tax via baseChipsMult=0.5 AND baseMultMult=0.5; a third
    // chainStep nerf made the constellation the weakest in the pool by
    // -33pp vs Lyra. With chainStep at the universal 0.25, Ophiuchus sits
    // at 68% A4 (-14pp vs Lyra), inside the 25pp parity band. The
    // wildcard upside still pays — it just isn't punished three times.
    modifiers: { baseChipsMult: 0.5, baseMultMult: 0.5, chainStep: 0.25 },
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
