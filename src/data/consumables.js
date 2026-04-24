// Consumable card definitions — Tarot + Spectral. Phase 5.
//
// Each consumable has:
//   id, type ('tarot' | 'spectral'), name, icon, color, tier, cost,
//   description,
//   requiresTarget, targetType ('die' | 'die_rune_slot' | 'oracle' | null),
//   apply(ctx, targets) -> mutates store via ctx helpers or returns a
//                          pending-flag patch.
//
// `ctx` is supplied by src/systems/consumables.js and exposes:
//   ctx.setDieFace(index, face)
//   ctx.addRuneToDie(index, slot, rune)
//   ctx.setPendingFlag(flag, value)
//   ctx.addShards(n)
//   ctx.duplicateOracle(sourceIndex)
//   ctx.handsLeft() -> number
//   ctx.setHandsLeft(n)
//   ctx.rerollAllDice(bestOfN)
//   ctx.destroyDice(count)
//   ctx.convertAllDice(face)
//
// Keeping apply() abstract makes it easy to unit-test the data, and avoids
// coupling consumable definitions to main.js internals.

export const CONSUMABLE_TYPES = {
  tarot:    { label: 'Tarot',    color: '#cc88ff' },
  spectral: { label: 'Spectral', color: '#88ffcc' },
};

export const ALL_CONSUMABLES = [
  // ─── Tarot ────────────────────────────────────────────────────────────
  {
    id: 'the_moon',
    type: 'tarot',
    name: 'The Moon',
    icon: '☽',
    color: '#aaccff',
    tier: 'common',
    cost: 4,
    description: 'Set any one die to face 6.',
    requiresTarget: true,
    targetType: 'die',
    apply(ctx, targets) { ctx.setDieFace(targets[0], 6); },
  },
  {
    id: 'the_star',
    type: 'tarot',
    name: 'The Star',
    icon: '★',
    color: '#ffee88',
    tier: 'common',
    cost: 5,
    description: '+1 Mult to every oracle on the next hand.',
    requiresTarget: false,
    apply(ctx) { ctx.setPendingFlag('starActive', true); },
  },
  {
    id: 'the_fool',
    type: 'tarot',
    name: 'The Fool',
    icon: '🃏',
    color: '#ffaa44',
    tier: 'uncommon',
    cost: 6,
    description: 'Duplicate a random held oracle (if a slot is free).',
    requiresTarget: false,
    apply(ctx) { return ctx.duplicateOracle(); },
  },
  {
    id: 'the_magician',
    type: 'tarot',
    name: 'The Magician',
    icon: '🎩',
    color: '#cc88ff',
    tier: 'common',
    cost: 4,
    description: 'The next reroll is free.',
    requiresTarget: false,
    apply(ctx) { ctx.setPendingFlag('freeRerollPending', true); },
  },
  {
    id: 'the_hierophant',
    type: 'tarot',
    name: 'The Hierophant',
    icon: '⛪',
    color: '#88ddaa',
    tier: 'uncommon',
    cost: 5,
    description: 'All dice are locked for the next roll.',
    requiresTarget: false,
    apply(ctx) { ctx.setPendingFlag('lockAllNextRoll', true); },
  },
  {
    id: 'the_hermit',
    type: 'tarot',
    name: 'The Hermit',
    icon: '🕯',
    color: '#ddcc88',
    tier: 'uncommon',
    cost: 6,
    description: "Next hand's chips are doubled.",
    requiresTarget: false,
    apply(ctx) { ctx.setPendingFlag('doubleChipsPending', true); },
  },
  {
    id: 'the_chariot',
    type: 'tarot',
    name: 'The Chariot',
    icon: '⚔',
    color: '#ffcc44',
    tier: 'rare',
    cost: 8,
    description: 'Play one extra hand this blind.',
    requiresTarget: false,
    apply(ctx) { ctx.setHandsLeft(ctx.handsLeft() + 1); },
  },

  // ─── Spectral ─────────────────────────────────────────────────────────
  {
    id: 'ectoplasm',
    type: 'spectral',
    name: 'Ectoplasm',
    icon: '👻',
    color: '#88ffcc',
    tier: 'uncommon',
    cost: 6,
    description: 'Add a random rune to a die.',
    requiresTarget: true,
    targetType: 'die_rune_slot',
    apply(ctx, targets) {
      const rune = ctx.pickRandomRune();
      if (rune) ctx.addRuneToDie(targets[0], targets[1], rune);
    },
  },
  {
    id: 'aether',
    type: 'spectral',
    name: 'Aether',
    icon: '✦',
    color: '#ccaaff',
    tier: 'rare',
    cost: 8,
    description: 'Every die rolls twice — keep the higher face.',
    requiresTarget: false,
    apply(ctx) { ctx.rerollAllDice(2); },
  },
  {
    id: 'immolate',
    type: 'spectral',
    name: 'Immolate',
    icon: '🔥',
    color: '#ff6644',
    tier: 'rare',
    cost: 8,
    description: 'Destroy 2 random dice. Gain +12 shards.',
    requiresTarget: false,
    apply(ctx) { ctx.destroyDice(2); ctx.addShards(12); },
  },
  {
    id: 'sigil',
    type: 'spectral',
    name: 'Sigil',
    icon: '🜛',
    color: '#ccccff',
    tier: 'legendary',
    cost: 10,
    description: 'Convert all dice to the same random face.',
    requiresTarget: false,
    apply(ctx) {
      const face = 1 + Math.floor(Math.random() * 6);
      ctx.convertAllDice(face);
    },
  },
];

export function lookupConsumable(id) {
  return ALL_CONSUMABLES.find(c => c.id === id) || null;
}
