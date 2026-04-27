export type BlindDef = {
  index: number;
  name: string;
  targetMult: number;
  isBoss: boolean;
  skipReward: number;
};

export const BLIND_DEFS: BlindDef[] = [
  { index: 0, name: 'Small Blind', targetMult: 1.0, isBoss: false, skipReward: 3 },
  { index: 1, name: 'Big Blind',   targetMult: 1.5, isBoss: false, skipReward: 5 },
  { index: 2, name: 'Boss Blind',  targetMult: 2.0, isBoss: true,  skipReward: 0 },
];

export const ANTE_BASE_TARGETS: number[][] = [
  [300,   600,   1000 ],
  [1200,  2000,  3500 ],
  [4000,  6000,  10000],
  [12000, 16000, 30000],
];

export type BossBlind = {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  debuffs: string[];
  sigil: { viewBox: string; paths: string[] };
};

export const BOSS_BLINDS: BossBlind[] = [
  { id: 'the_serpent', name: 'The Serpent', icon: '🐍', color: '#44bb66',
    description: 'All 1s stay 1s.', debuffs: ['no_rune_transforms_on_ones'],
    sigil: {
      viewBox: '0 0 100 100',
      paths: [
        'M 20 20 Q 50 10 80 30 Q 90 60 60 70 Q 30 75 20 50 Q 25 30 50 30',
        'M 50 30 L 50 50',
        'M 35 80 L 65 80',
      ],
    },
  },
  { id: 'the_fool', name: 'The Fool', icon: '🃏', color: '#ffaa44',
    description: 'Hand size capped to 4.', debuffs: ['hand_size_cap_4'],
    sigil: {
      viewBox: '0 0 100 100',
      paths: [
        'M 50 10 L 90 80 L 10 80 Z',
        'M 50 30 L 50 65',
        'M 30 75 L 70 75',
      ],
    },
  },
  { id: 'the_tower', name: 'The Tower', icon: '🏰', color: '#aa6644',
    description: 'No rerolls.', debuffs: ['no_rerolls'],
    sigil: {
      viewBox: '0 0 100 100',
      paths: [
        'M 25 90 L 25 30 L 75 30 L 75 90',
        'M 35 30 L 35 90 M 50 30 L 50 90 M 65 30 L 65 90',
        'M 20 30 L 80 30 L 75 20 L 25 20 Z',
        'M 40 10 L 50 0 L 60 10 Z',
      ],
    },
  },
  { id: 'the_devil', name: 'The Devil', icon: '👹', color: '#cc2244',
    description: 'Locks unlock after roll.', debuffs: ['auto_unlock_after_roll'],
    sigil: {
      viewBox: '0 0 100 100',
      paths: [
        'M 50 8 L 90 78 L 10 78 Z',
        'M 50 92 L 10 22 L 90 22 Z',
        'M 50 35 L 50 65 M 35 50 L 65 50',
      ],
    },
  },
  { id: 'the_high_priestess', name: 'The High Priestess', icon: '⚜', color: '#aa66ff',
    description: 'Oracles disabled.', debuffs: ['disable_oracles'],
    sigil: {
      viewBox: '0 0 100 100',
      paths: [
        'M 50 10 a 40 40 0 1 0 0 80 a 40 40 0 1 0 0 -80',
        'M 30 50 a 20 20 0 1 0 40 0 a 20 20 0 1 0 -40 0',
        'M 50 22 L 50 78 M 22 50 L 78 50',
      ],
    },
  },
];

export function targetForBlind(ante: number, blindIndex: number): number {
  const row = ANTE_BASE_TARGETS[Math.min(ante, ANTE_BASE_TARGETS.length) - 1]!;
  const base = row[blindIndex]!;
  return Math.ceil(base * BLIND_DEFS[blindIndex]!.targetMult);
}

export function blindDefAt(idx: number): BlindDef {
  return BLIND_DEFS[idx]!;
}

export function pickBoss(rng: () => number): BossBlind {
  return BOSS_BLINDS[Math.floor(rng() * BOSS_BLINDS.length)]!;
}
