// Blind & Ante definitions. Phase 4.

export const BLIND_DEFS = [
  { index: 0, name: 'Small Blind', targetMult: 1.0, isBoss: false, skippable: true,  skipReward: 3 },
  { index: 1, name: 'Big Blind',   targetMult: 1.5, isBoss: false, skippable: true,  skipReward: 5 },
  { index: 2, name: 'Boss Blind',  targetMult: 2.0, isBoss: true,  skippable: false, skipReward: 0 },
];

// Per-ante base chip targets (before blind multiplier).
// Ante 1 matches the original GOAL_TARGETS[0..2]. Antes 2-4 scale up.
export const ANTE_BASE_TARGETS = [
  [300,   800,   2000  ], // Ante 1
  [2000,  5000,  11000 ], // Ante 2
  [11000, 20000, 35000 ], // Ante 3
  [35000, 50000, 100000], // Ante 4
];

// Boss Blind roster. Each has a debuff list keyed on `src/systems/blinds.js`.
export const BOSS_BLINDS = [
  {
    id: 'the_serpent',
    name: 'The Serpent',
    icon: '🐍',
    color: '#44bb66',
    description: 'All 1s stay 1s — rune face-transforms on face-1 dice are ignored.',
    debuffs: ['no_rune_transforms_on_ones'],
  },
  {
    id: 'the_fool',
    name: 'The Fool',
    icon: '🃏',
    color: '#ffaa44',
    description: 'Hand size capped to 4 dice this blind.',
    debuffs: ['hand_size_cap_4'],
  },
  {
    id: 'the_tower',
    name: 'The Tower',
    icon: '🏰',
    color: '#aa6644',
    description: 'No rerolls allowed this blind.',
    debuffs: ['no_rerolls'],
  },
  {
    id: 'the_devil',
    name: 'The Devil',
    icon: '👹',
    color: '#cc2244',
    description: 'Locked dice unlock automatically after each roll.',
    debuffs: ['auto_unlock_after_roll'],
  },
  {
    id: 'the_high_priestess',
    name: 'The High Priestess',
    icon: '⚜',
    color: '#aa66ff',
    description: 'Oracles do not apply this blind. Rune effects still work.',
    debuffs: ['disable_oracles'],
  },
];

export function lookupBossBlind(id) {
  return BOSS_BLINDS.find(b => b.id === id) || null;
}

// Skip Tags — one-shot bonuses granted by skipping Small/Big blinds.
// Kept small for MVP; extendable.
export const SKIP_TAGS = [
  { id: 'voucher_tag',  name: 'Voucher Tag',  description: 'Next shop contains a free Voucher.' },
  { id: 'extra_hand',   name: 'Ethereal Tag', description: 'Start the next blind with +1 hand.' },
  { id: 'extra_reroll', name: 'Orbital Tag',  description: 'Start the next blind with +1 reroll.' },
  { id: 'shard_tag',    name: 'Gold Tag',     description: 'Gain +5 shards immediately.' },
];

// Pull a random skip-tag (later the UI can let the player choose from 2).
export function rollRandomSkipTag() {
  return SKIP_TAGS[Math.floor(Math.random() * SKIP_TAGS.length)];
}

// Shuffle boss-blind IDs into a fresh pool for a new run or ante.
export function shuffleBossBlindPool() {
  const ids = BOSS_BLINDS.map(b => b.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

// Compute the chip target for the currently active (ante, blind) pair.
// Endless mode: scales past Ante 4 exponentially.
export function targetForBlind(ante, blindIndex, endless = false) {
  const baseRow = ANTE_BASE_TARGETS[Math.min(ante, ANTE_BASE_TARGETS.length) - 1];
  let base = baseRow[blindIndex];
  if (endless && ante > ANTE_BASE_TARGETS.length) {
    // Exponential tail once past the designed antes
    const surplus = ante - ANTE_BASE_TARGETS.length;
    base = ANTE_BASE_TARGETS[ANTE_BASE_TARGETS.length - 1][blindIndex]
         * Math.pow(2.1, surplus);
  }
  const mult = BLIND_DEFS[blindIndex].targetMult;
  return Math.ceil(base * mult);
}

export function getBlindDef(blindIndex) {
  return BLIND_DEFS[blindIndex];
}
