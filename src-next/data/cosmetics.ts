// Cosmetic Dust Shop — pure-cosmetic unlocks bought with Cosmic Dust at
// the Astral Forge. Each cosmetic flips a flag in meta.cosmeticsUnlocked
// that downstream renderers can read to switch a palette / particle
// variant / sigil glyph. Mechanics are intentionally NOT touched — these
// are skin slots so the long-tail-dust grind has a sink once every
// Astral Perk has been bought.
//
// Catalog is intentionally small for the first ship (4 entries). Each is
// hand-priced against the 25–250 dust spread on ASTRAL_PERKS so the
// cosmetic chase mirrors the perk ladder without dominating the
// per-run dust curve.

export type CosmeticKind =
  // Constellation accent re-tint — overrides the run's default
  // constellation color. Display-only.
  | 'constellation_skin'
  // Boss sigil palette — swaps the boss accent for a curated alternate
  // (e.g. aurora-pastel). Affects every boss reveal.
  | 'sigil_palette'
  // Particle hue cycle on scoring VFX — applies a fixed offset to the
  // ScoringVFX color picker.
  | 'particle_palette';

export type CosmeticDef = {
  id: string;
  name: string;
  description: string;
  flavor: string;
  cost: number;
  kind: CosmeticKind;
  // Implementation hint — the renderer uses this to know which color /
  // palette to swap in. Plain string for the first ship; will expand
  // into a structured payload when more variants land.
  payload: string;
};

export const COSMETICS: CosmeticDef[] = [
  {
    id: 'skin_lyra_aurora',
    name: 'Aurora Lyra',
    description: 'Recolors the Lyra constellation with a deep-aurora cyan-green.',
    flavor: 'Strings tuned to a colder wind.',
    cost: 80,
    kind: 'constellation_skin',
    payload: 'lyra:#4ff7c8',
  },
  {
    id: 'skin_argo_ember',
    name: 'Ember Argo',
    description: 'Argo, the Vessel — recolored ember-red for the late watch.',
    flavor: 'A ship lit by the fire it carries.',
    cost: 120,
    kind: 'constellation_skin',
    payload: 'argo:#ff6347',
  },
  {
    id: 'palette_aurora_sigils',
    name: 'Aurora Sigils',
    description: 'Boss sigils render in a curated aurora palette.',
    flavor: 'The same threat, painted in softer light.',
    cost: 200,
    kind: 'sigil_palette',
    payload: 'aurora',
  },
  {
    id: 'particles_solar_flare',
    name: 'Solar Flare Particles',
    description: 'Scoring VFX particles shift toward a warm solar palette.',
    flavor: 'The cosmos picks up a tan.',
    cost: 160,
    kind: 'particle_palette',
    payload: 'solar',
  },
];

export function lookupCosmetic(id: string): CosmeticDef | undefined {
  return COSMETICS.find((c) => c.id === id);
}
