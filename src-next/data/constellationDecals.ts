// Constellation-specific face decals for the etched mods.
//
// 2026-05-11 Forge overhaul · Phase 2.2
//
// Each etched mod (Engraved, Astrolabe, Wildcard, Tally Mark, Crown,
// Snake Eyes) projects a small SVG path onto every face of the die.
// The path is per-constellation so a Lyra die etched with Astrolabe
// looks visibly different from an Argo die etched with Astrolabe.
//
// Entry shape: a single <path d="..."> string in a 64×64 viewBox.
// Lookup falls back to a pan-cosmic default if a (constellation, mod)
// pair isn't authored — so we can ship the table incomplete and fill
// it in as new constellations land.
//
// Motif vocabularies (locked from the plan):
//   Lyra        plucked strings, harp arcs, note dots
//   Mensa       grid lines, crossed bars, rectangular table shapes
//   Argo        sail curves, anchors, wave lines
//   Triumvirate equilateral triangles, threes, triskele
//   Fibonacci   logarithmic spirals, nested arcs, golden rectangle
//   Eclipse     crescents, overlapping rings, partial occlusions
//   Polyhedra   faceted polygons, angular shards
//   Ophiuchus   snaking curves, scales, fang marks
//
// Authoring conventions: paths are designed to read at 8–14% opacity
// on a face that already has a pip/digit lens, so they don't compete
// with the score-readable face value. Use stroke-based paths over
// fill so chamfer corners don't clip them.

export type DecalDef = {
  // The 'd' attribute of a single <path>. Stroked only — no fill.
  d: string;
  // ViewBox the path is authored in. Default 64×64.
  viewBox?: string;
  // Stroke width inside the viewBox. Default 1.5.
  strokeWidth?: number;
};

// The five etched-mod ids we author decals for. Other mods may opt in
// later by adding their id here and authoring the constellation map.
export const ETCHED_MOD_IDS = [
  'engraved',
  'astrolabe',
  'wildcard',
  'tally_mark',
  'crown',
  'snake_eyes',
] as const;
export type EtchedModId = typeof ETCHED_MOD_IDS[number];

// Pan-cosmic defaults — used when (constellation, mod) isn't authored.
// Designed to read as "decorated" rather than blank. Each one is a
// distinct rune so different etched mods stay visually distinct even
// without constellation-specific authoring.
const DEFAULT_DECALS: Record<EtchedModId, DecalDef> = {
  // A simple etched rune — three nested arcs.
  engraved: {
    d: 'M 20 32 Q 32 12 44 32 M 22 36 Q 32 20 42 36 M 24 40 Q 32 28 40 40',
    strokeWidth: 1.4,
  },
  // A star-chart sigil: three points + connecting strokes.
  astrolabe: {
    d: 'M 32 16 L 32 24 M 20 32 L 28 32 M 36 32 L 44 32 M 32 40 L 32 48 ' +
       'M 28 28 L 36 36 M 36 28 L 28 36',
    strokeWidth: 1.2,
  },
  // A swirling question mark — Wildcard.
  wildcard: {
    d: 'M 24 22 Q 32 14 40 22 Q 40 30 32 32 L 32 40 M 32 46 L 32 47',
    strokeWidth: 1.6,
  },
  // A static tally mark — four vertical lines + one diagonal slash. The
  // count visibility lives in the DiceStackStrip, not this decal.
  tally_mark: {
    d: 'M 24 22 L 24 42 M 28 22 L 28 42 M 32 22 L 32 42 M 36 22 L 36 42 M 22 30 L 38 38',
    strokeWidth: 1.4,
  },
  // A small crown silhouette — three peaks + base.
  crown: {
    d: 'M 20 40 L 20 28 L 26 34 L 32 22 L 38 34 L 44 28 L 44 40 Z',
    strokeWidth: 1.4,
  },
  // Two paired dots in a serpent's-eye arrangement.
  snake_eyes: {
    d: 'M 24 28 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 ' +
       'M 40 28 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 ' +
       'M 20 38 Q 32 44 44 38',
    strokeWidth: 1.4,
  },
};

// Constellation-specific overrides. Each constellation gets motifs in
// its own visual idiom. Sparse — missing entries fall through to the
// pan-cosmic default above.
const CONSTELLATION_DECALS: Record<string, Partial<Record<EtchedModId, DecalDef>>> = {
  // ── Lyra — plucked strings, harp arcs, note dots ────────────────────
  lyra: {
    engraved: {
      d: 'M 18 24 Q 32 36 46 24 M 18 32 Q 32 44 46 32 M 18 40 Q 32 52 46 40 ' +
         'M 32 22 L 32 50',
      strokeWidth: 1.3,
    },
    astrolabe: {
      d: 'M 22 22 Q 32 18 42 22 L 42 44 Q 32 48 22 44 Z ' +
         'M 27 28 L 27 38 M 32 28 L 32 38 M 37 28 L 37 38',
      strokeWidth: 1.2,
    },
    wildcard: {
      d: 'M 20 32 Q 32 18 44 32 Q 32 46 20 32 Z M 32 28 L 32 36',
      strokeWidth: 1.5,
    },
    crown: {
      d: 'M 22 38 Q 28 18 32 28 Q 36 18 42 38 Z M 32 28 L 32 44',
      strokeWidth: 1.3,
    },
  },
  // ── Mensa — grid lines, crossed bars, rectangular table shapes ──────
  mensa: {
    engraved: {
      d: 'M 18 20 L 46 20 L 46 44 L 18 44 Z ' +
         'M 18 28 L 46 28 M 18 36 L 46 36 M 26 20 L 26 44 M 34 20 L 34 44 M 42 20 L 42 44',
      strokeWidth: 1.0,
    },
    astrolabe: {
      d: 'M 20 32 L 44 32 M 32 20 L 32 44 M 22 22 L 42 42 M 42 22 L 22 42 ' +
         'M 32 32 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
      strokeWidth: 1.1,
    },
    wildcard: {
      d: 'M 20 24 L 44 24 L 32 36 L 44 48 L 20 48 L 32 36 Z',
      strokeWidth: 1.3,
    },
    crown: {
      d: 'M 18 42 L 18 30 L 24 36 L 28 22 L 32 36 L 36 22 L 40 36 L 46 30 L 46 42 Z',
      strokeWidth: 1.2,
    },
    tally_mark: {
      d: 'M 22 22 L 22 42 M 26 22 L 26 42 M 30 22 L 30 42 M 34 22 L 34 42 M 38 22 L 38 42 ' +
         'M 20 32 L 42 32',
      strokeWidth: 1.2,
    },
  },
  // ── Argo — sail curves, anchors, wave lines ─────────────────────────
  argo: {
    engraved: {
      d: 'M 32 16 L 32 36 M 20 30 Q 32 20 44 30 ' + // mast + sail
         'M 20 44 Q 26 40 32 44 Q 38 40 44 44',     // waves
      strokeWidth: 1.4,
    },
    astrolabe: {
      d: 'M 32 18 L 32 46 M 18 32 L 46 32 ' +
         'M 32 32 m -10 0 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0 ' +
         'M 26 26 L 38 38 M 38 26 L 26 38',
      strokeWidth: 1.1,
    },
    wildcard: {
      d: 'M 28 18 L 36 18 L 36 30 L 44 38 L 36 38 L 36 44 L 28 44 L 28 38 L 20 38 L 28 30 Z',
      strokeWidth: 1.3,
    },
    crown: {
      d: 'M 22 40 Q 24 28 28 30 Q 30 18 36 30 Q 40 28 42 40 Z M 28 30 L 36 30',
      strokeWidth: 1.3,
    },
    snake_eyes: {
      d: 'M 22 28 Q 32 24 42 28 M 22 36 Q 32 40 42 36 ' +
         'M 28 32 m -2 0 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0 ' +
         'M 36 32 m -2 0 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0',
      strokeWidth: 1.2,
    },
  },
  // ── Triumvirate — equilateral triangles, threes, triskele ───────────
  triumvirate: {
    engraved: {
      d: 'M 32 18 L 44 40 L 20 40 Z ' +              // outer triangle
         'M 32 26 L 38 36 L 26 36 Z ' +              // inner triangle
         'M 32 30 L 32 36 M 28 33 L 36 33',
      strokeWidth: 1.2,
    },
    astrolabe: {
      d: 'M 32 16 L 44 36 L 20 36 Z ' +
         'M 32 24 m -2 0 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0 ' +
         'M 26 34 m -2 0 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0 ' +
         'M 38 34 m -2 0 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0',
      strokeWidth: 1.1,
    },
    wildcard: {
      // Triskele swirl — three arms radiating from center.
      d: 'M 32 32 m -10 0 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0 ' +
         'M 32 32 L 32 22 M 32 32 L 23 38 M 32 32 L 41 38',
      strokeWidth: 1.4,
    },
    crown: {
      d: 'M 32 18 L 44 42 L 20 42 Z M 32 28 L 32 38 M 28 35 L 36 35',
      strokeWidth: 1.3,
    },
  },
  // ── Fibonacci — spirals, nested arcs, golden rectangle ──────────────
  fibonacci: {
    engraved: {
      // Approximate log-spiral via three quadrant arcs of doubling radii.
      d: 'M 38 32 A 6 6 0 0 0 32 26 A 10 10 0 0 0 22 36 A 16 16 0 0 0 38 52',
      strokeWidth: 1.3,
    },
    astrolabe: {
      d: 'M 20 20 L 44 20 L 44 44 L 20 44 Z ' +
         'M 32 20 L 32 36 M 20 36 L 32 36 ' +
         'M 38 32 A 6 6 0 0 0 32 26',
      strokeWidth: 1.1,
    },
    wildcard: {
      d: 'M 32 32 A 4 4 0 0 1 36 36 A 8 8 0 0 1 28 44 A 14 14 0 0 1 18 30 A 20 20 0 0 1 38 16',
      strokeWidth: 1.4,
    },
    crown: {
      d: 'M 20 42 L 26 30 L 28 36 L 32 22 L 36 36 L 38 30 L 44 42 Z',
      strokeWidth: 1.2,
    },
  },
  // ── Eclipse — crescents, overlapping rings, partial occlusions ──────
  eclipse: {
    engraved: {
      d: 'M 32 32 m -12 0 a 12 12 0 1 0 24 0 a 12 12 0 1 0 -24 0 ' +
         'M 26 32 m -8 0 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0',
      strokeWidth: 1.1,
    },
    astrolabe: {
      d: 'M 32 32 m -12 0 a 12 12 0 1 0 24 0 a 12 12 0 1 0 -24 0 ' +
         'M 14 32 L 26 32 M 38 32 L 50 32 M 32 14 L 32 22 M 32 42 L 32 50',
      strokeWidth: 1.0,
    },
    wildcard: {
      // Crescent shape — outer circle minus inner offset circle.
      d: 'M 22 32 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0 M 26 32 a 8 8 0 1 1 16 0',
      strokeWidth: 1.3,
    },
    crown: {
      // Crown made of three crescents.
      d: 'M 22 38 a 4 4 0 1 1 8 0 a 4 4 0 1 1 8 0 a 4 4 0 1 1 8 0 M 22 38 L 42 38',
      strokeWidth: 1.2,
    },
  },
  // ── Polyhedra — faceted polygons, angular shards ───────────────────
  polyhedra: {
    engraved: {
      d: 'M 32 16 L 46 26 L 40 44 L 24 44 L 18 26 Z ' +              // pentagon
         'M 32 16 L 24 44 M 32 16 L 40 44 M 18 26 L 46 26',
      strokeWidth: 1.1,
    },
    astrolabe: {
      d: 'M 32 18 L 44 32 L 32 46 L 20 32 Z ' +
         'M 32 18 L 32 46 M 20 32 L 44 32',
      strokeWidth: 1.1,
    },
    wildcard: {
      d: 'M 24 20 L 40 20 L 44 32 L 40 44 L 24 44 L 20 32 Z ' +
         'M 24 20 L 40 44 M 40 20 L 24 44',
      strokeWidth: 1.2,
    },
    crown: {
      d: 'M 18 42 L 22 32 L 28 38 L 32 24 L 36 38 L 42 32 L 46 42 Z',
      strokeWidth: 1.2,
    },
  },
  // ── Ophiuchus — snaking curves, scales, fang marks ──────────────────
  ophiuchus: {
    engraved: {
      // Coiled S-curve.
      d: 'M 18 24 Q 26 20 32 28 Q 38 36 46 32 Q 38 28 32 36 Q 26 44 18 40',
      strokeWidth: 1.4,
    },
    astrolabe: {
      d: 'M 18 32 Q 32 18 46 32 Q 32 46 18 32 Z ' +
         'M 26 32 m -2 0 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0 ' +
         'M 38 32 m -2 0 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0',
      strokeWidth: 1.2,
    },
    wildcard: {
      // Snake's eye + fang.
      d: 'M 32 32 m -10 0 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0 ' +
         'M 32 32 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 ' +
         'M 28 42 L 32 50 L 36 42',
      strokeWidth: 1.3,
    },
    crown: {
      d: 'M 22 40 Q 22 26 32 30 Q 42 26 42 40 Z M 32 26 L 32 18 M 28 22 L 36 22',
      strokeWidth: 1.3,
    },
    snake_eyes: {
      d: 'M 22 28 Q 32 22 42 28 ' +
         'M 26 30 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 ' +
         'M 38 30 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 ' +
         'M 24 42 L 32 50 L 40 42',
      strokeWidth: 1.4,
    },
  },
};

export function getDecalForMod(constellationId: string, modId: string): DecalDef | null {
  if (!(ETCHED_MOD_IDS as readonly string[]).includes(modId)) return null;
  const perConstellation = CONSTELLATION_DECALS[constellationId];
  if (perConstellation && perConstellation[modId as EtchedModId]) {
    return perConstellation[modId as EtchedModId]!;
  }
  return DEFAULT_DECALS[modId as EtchedModId];
}
