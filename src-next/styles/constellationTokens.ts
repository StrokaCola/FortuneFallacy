// Constellation tint tokens — the per-run accent colors surfaced on the
// TopBar Astrolabe, the Round action-bar arrows, and the
// ConstellationSelect cards.
//
// Previously inline hex codes in `data/constellations.ts` that happened
// to match Tailwind palette defaults. Lifting them here so the
// constellation palette is a *named system* rather than scattered hex
// literals:
//
//   - Searchable by token name.
//   - One file to touch for a palette refresh.
//   - Matching CSS custom properties in `styles/index.css` (`--constellation-<id>`)
//     keep CSS-side consumers aligned without re-importing.
//
// Reserved colors avoided per `data/constellations.ts` (kept as-is):
//   #f5c451 (gold)    — "TARGET BEAT" stamp
//   #ff7847 (orange)  — multiplier tier 0
//   #cc88ff (magenta) — multiplier tier 1 / generic beat tint
//   #e2334a (crimson) — boss debuff (overrides constellation accent)
//
// Each tint sits above ~50% luminance so it reads on the cosmos-950
// backdrop.

export const CONSTELLATION_TINT = {
  // Lyra reuses the cosmos accent "vector" already defined in index.css
  // — the only constellation that's natively part of the base palette.
  lyra:        '#7be3ff', // cosmos "vector" cyan
  // The remaining seven are intentionally outside the cosmos- ramp so
  // constellation identity reads as *distinct* from the chrome. Hue
  // selection prioritises CVD-safe separability + ~50%+ luminance.
  mensa:       '#c084fc', // violet
  triumvirate: '#fbbf24', // amber
  argo:        '#34d399', // emerald
  fibonacci:   '#fb7185', // rose
  eclipse:     '#e5e7eb', // pale neutral
  polyhedra:   '#60a5fa', // blue
  ophiuchus:   '#a78bfa', // violet (paired by hue with mensa)
} as const;

export type ConstellationId = keyof typeof CONSTELLATION_TINT;

/** Returns the named tint for a constellation id, falling back to Lyra's. */
export function constellationTint(id: string): string {
  return CONSTELLATION_TINT[id as ConstellationId] ?? CONSTELLATION_TINT.lyra;
}
