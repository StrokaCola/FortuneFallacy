// Shared rarity styling tokens. Single source of truth for the four
// surfaces that render upgrades (Shop card, CatalystStrip, ConsumableTray,
// Codex). Keeps the legendary-aura class wiring + the radial-gradient halo
// math from drifting between sites.

// 2026-05-19 — added 'mythic' tier above legendary for the unlock-gated
// 20-shard chase cards. Mythic re-uses the legendary aura class for now;
// follow-up polish can introduce a distinct CSS class once the visual
// language is settled.
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic';

export const RARITY_COLORS: Record<Rarity, string> = {
  common:    '#7be3ff', // vector
  uncommon:  '#cc88ff', // cosmos-300
  rare:      '#f5c451', // gold
  legendary: '#ff7847', // ember
  mythic:    '#ff3ad1', // mythic magenta — distinct from legendary ember
};

export function rarityColor(r: Rarity | null | undefined, fallback = '#7be3ff'): string {
  return r ? RARITY_COLORS[r] : fallback;
}

// Outer radial-glow opacity per rarity. Legendary returns 0 because it
// uses the .legendary-aura pulsing class instead — stacking both produces
// a double-glow that blows out the card edge. Mythic follows the same
// pattern: visual driven by the aura class, not the halo math.
export function rarityGlowOpacity(r: Rarity | null | undefined): number {
  if (!r) return 0;
  if (r === 'mythic') return 0;
  if (r === 'legendary') return 0;
  if (r === 'rare') return 0.55;
  if (r === 'uncommon') return 0.32;
  return 0.18;
}

// Frame stroke width. Higher rarities get a slightly thicker outline so
// they read as "more important" even when the color tone is similar.
export function rarityStrokeWidth(r: Rarity | null | undefined): number {
  if (!r) return 1;
  if (r === 'mythic') return 3;
  if (r === 'legendary') return 2.5;
  if (r === 'rare') return 2;
  if (r === 'uncommon') return 1.5;
  return 1;
}

// CSS class to add to the kind-frame wrapper for the per-rarity ambient
// flourish. Each tier carries a distinct atmosphere on top of the color
// hierarchy:
//   common    → none (clean single ring, reads as "honest")
//   uncommon  → soft pulsing inner haze (rarity-uncommon-aura)
//   rare      → slow-rotating twin concentric ring (rarity-rare-aura)
//   legendary → existing pulsing aura + ember flourishes (legendary-aura)
//   mythic    → re-uses legendary-aura for v1; distinct mythic-aura CSS
//               is a polish follow-up.
// Empty string when no flourish, so callers can unconditionally append it.
export function rarityClassName(r: Rarity | null | undefined): string {
  if (r === 'mythic') return 'legendary-aura';
  if (r === 'legendary') return 'legendary-aura';
  if (r === 'rare') return 'rarity-rare-aura';
  if (r === 'uncommon') return 'rarity-uncommon-aura';
  return '';
}
