// Shared gameplay constants, mirrored from main.js.
// New modules (Phase 3+) import from here. main.js keeps its local
// declarations untouched to avoid a high-surgery refactor; Phase 9
// consolidates to a single source of truth.

// ─── Canvas ──────────────────────────────────────────────────────────────
export const W = 960;
export const H = 540;

// ─── Run structure ───────────────────────────────────────────────────────
export const GOAL_TARGETS     = [300, 800, 2000, 5000, 11000, 20000, 35000, 50000];
export const HANDS_PER_ROUND  = 3;
export const REROLLS_PER_HAND = 2;

// ─── Dice pool ───────────────────────────────────────────────────────────
export const DICE_COUNT     = 5;   // starting pool
export const MAX_HELD       = 5;   // max held/played per hand
export const MAX_DICE       = 10;  // pool cap
export const MAX_ORACLES    = 6;
export const MAX_RUNE_SLOTS = 2;

// ─── Layout ──────────────────────────────────────────────────────────────
export const LP = { x:8,   w:196, y:8, h:H-16 };
export const CP = { x:212, w:536, y:8, h:H-16 };
export const RP = { x:756, w:196, y:8, h:H-16 };

export const DICE_SIZE = 38;
export const DICE_GAP  = 22;
export const BOARD_H   = 340;

// ─── Physics ─────────────────────────────────────────────────────────────
export const PHYS_SCALE = 50;      // canvas px per physics unit

// ─── Identity palette ("Astrology Casino at the End of Time") ───────────
// Roles per UI/UX plan. Keep older keys (TIER_COLORS, COMBO_COLORS) for
// back-compat with main.js; PALETTE is the source-of-truth for new code.
export const PALETTE = {
  void:        '#07060B',
  feltDeep:    '#14202B',
  feltMid:     '#1E3142',
  bone:        '#ECDEC8',
  brass:       '#C9A24A',
  brassDim:    '#8B6914',
  astral:      '#8A5BFF',
  solar:       '#FF8A3C',
  crimson:     '#D33A4A',
  mint:        '#6FE3B5',
  slate:       '#5A6A7A',
};

// ─── Tier colours (shared between oracles, runes, consumables, vouchers) ─
export const TIER_COLORS = {
  common:    PALETTE.bone,
  uncommon:  '#88b0d4',
  rare:      PALETTE.astral,
  legendary: PALETTE.solar,
};

// ─── Combo tier colour palette ───────────────────────────────────────────
// Bone → Slate → Periwinkle → Mint → Astral → Brass → Solar → Crimson → Iridescent.
// Index 8 (Five of a Kind) is a sentinel — renderers should hue-cycle.
export const COMBO_COLORS = [
  PALETTE.bone,     // Chance
  PALETTE.slate,    // Pair
  '#88B0D4',        // Two Pair (periwinkle)
  PALETTE.mint,     // Three of a Kind
  PALETTE.astral,   // Small Straight
  PALETTE.brass,    // Full House
  PALETTE.solar,    // Large Straight
  PALETTE.crimson,  // Four of a Kind
  '#FFFFFF',        // Five of a Kind — iridescent sentinel
];

// ─── Dice modifier identity (visual-only metadata) ──────────────────────
// Renderers map by id. Stack cap = 2 visual + 1 status.
export const DICE_MODIFIERS = {
  bone:    { id:'bone',    label:'Bone',      tint:PALETTE.bone,    aura:null },
  flaming: { id:'flaming', label:'Flaming',   tint:PALETTE.solar,   aura:'fire' },
  cursed:  { id:'cursed',  label:'Cursed',    tint:PALETTE.astral,  aura:'smoke' },
  holo:    { id:'holo',    label:'Enchanted', tint:'#FFFFFF',       aura:'prism' },
  golden:  { id:'golden',  label:'Golden',    tint:PALETTE.brass,   aura:'gleam' },
  astral:  { id:'astral',  label:'Astral',    tint:PALETTE.astral,  aura:'stars' },
  bossed:  { id:'bossed',  label:'Cursed',    tint:PALETTE.crimson, aura:'chain' },
};
