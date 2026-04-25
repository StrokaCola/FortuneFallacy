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

// ─── Tier colours (shared between oracles, runes, consumables, vouchers) ─
export const TIER_COLORS = {
  common:    '#b8a874',
  uncommon:  '#88b0d4',
  rare:      '#cc88ff',
  legendary: '#ff8844',
};

// ─── Combo tier colour palette ───────────────────────────────────────────
export const COMBO_COLORS = [
  '#b8a874', // Chance
  '#88b0d4', // Pair
  '#88d498', // Two Pair
  '#cc88ff', // Three of a Kind
  '#44aadd', // Small Straight
  '#ff8844', // Full House
  '#ffaa44', // Large Straight
  '#ff4466', // Four of a Kind
  '#ffff00', // Five of a Kind
];
