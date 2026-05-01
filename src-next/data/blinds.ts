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

export type SigilGroupClass =
  | 'orbit-main'
  | 'orbit-aux'
  | 'body-core'
  | 'satellite'
  | 'mark';

export type SigilGroup = {
  class: SigilGroupClass;
  paths: string[];
  strokeWidth?: number;   // default 1.5
  opacity?: number;       // default 1
  dashed?: boolean;       // applies stroke-dasharray "2 4"
  filled?: boolean;       // when true: fill=boss.color, stroke=none
};

export type BossBlind = {
  id: string;
  name: string;
  iconGlyph: { viewBox: string; paths: string[] };
  color: string;
  description: string;
  debuffs: string[];
  sigil: { viewBox: string; groups: SigilGroup[] };
};

export const BOSS_BLINDS: BossBlind[] = [
  {
    id: 'pluto', name: 'Pluto', color: '#44bb66',
    description: 'Demoted. 1s refuse to transform.', debuffs: ['no_mod_transforms_on_ones'],
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 7 12 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0',
      'M 17 12 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0',
      'M 11 12 L 17 12',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'orbit-main', paths: ['M 32 50 L 68 50'] },
        { class: 'body-core',  paths: ['M 21 50 a 11 11 0 1 0 22 0 a 11 11 0 1 0 -22 0'] },
        { class: 'satellite',  paths: ['M 62 50 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0'] },
        { class: 'mark', opacity: 0.7, paths: [
          'M 64 44 L 60 40',
          'M 72 44 L 76 40',
          'M 64 56 L 60 60',
          'M 72 56 L 76 60',
        ]},
        { class: 'mark', filled: true, paths: ['M 29.5 50 a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0'] },
      ],
    },
  },
  {
    id: 'ceres', name: 'Ceres', color: '#ffaa44',
    description: 'Belt-bound. Hand capped at 4.', debuffs: ['hand_size_cap_4'],
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 12 12 m -2 0 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0',
      'M 21 12 a 1 1 0 1 0 2 0 a 1 1 0 1 0 -2 0',
      'M 12 3 a 1 1 0 1 0 2 0 a 1 1 0 1 0 -2 0',
      'M 1 12 a 1 1 0 1 0 2 0 a 1 1 0 1 0 -2 0',
      'M 12 21 a 1 1 0 1 0 2 0 a 1 1 0 1 0 -2 0',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'orbit-aux', dashed: true, opacity: 0.5, paths: [
          'M 50 12 a 38 38 0 1 0 0 76 a 38 38 0 1 0 0 -76',
        ]},
        { class: 'body-core', filled: true, paths: ['M 45 50 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0'] },
        { class: 'satellite', filled: true, paths: ['M 85 50 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0'] },
        { class: 'mark', filled: true, paths: [
          'M 47 12 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
          'M 9 50 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
          'M 47 88 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
        ]},
      ],
    },
  },
  {
    id: 'triton', name: 'Triton', color: '#aa6644',
    description: 'Single flyby. No rerolls.', debuffs: ['no_rerolls'],
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 12 4 A 8 8 0 0 0 4 12',
      'M 4 12 A 8 8 0 0 0 12 20',
      'M 12 20 A 8 8 0 0 0 20 12',
      'M 20 12 L 17 9',
      'M 20 12 L 17 15',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'orbit-main', paths: [
          'M 50 14 A 36 36 0 0 0 14 50',
          'M 14 50 A 36 36 0 0 0 50 86',
          'M 50 86 A 36 36 0 0 0 86 50',
        ]},
        { class: 'body-core', paths: ['M 41 50 a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0'] },
        { class: 'body-core', filled: true, paths: ['M 46.5 50 a 3.5 3.5 0 1 0 7 0 a 3.5 3.5 0 1 0 -7 0'] },
        { class: 'mark', strokeWidth: 2, paths: [
          'M 86 50 L 80 44',
          'M 86 50 L 80 56',
        ]},
      ],
    },
  },
  {
    id: 'phobos', name: 'Phobos', color: '#cc2244',
    description: 'Orbit decays. Locks release on roll.', debuffs: ['auto_unlock_after_roll'],
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 12 4 a 8 8 0 1 1 -0.01 0',
      'M 12 8 a 4 4 0 1 1 -0.01 0',
      'M 20 12 L 23 9',
      'M 20 12 L 23 15',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'orbit-main', opacity: 0.85, paths: [
          'M 50 18 a 32 32 0 1 1 -0.01 0',
          'M 50 24 a 26 26 0 1 1 -0.01 0',
          'M 50 30 a 20 20 0 1 1 -0.01 0',
        ]},
        { class: 'body-core', paths: ['M 39 50 a 11 11 0 1 0 22 0 a 11 11 0 1 0 -22 0'] },
        { class: 'body-core', filled: true, paths: ['M 47 50 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0'] },
        { class: 'mark', strokeWidth: 2, paths: [
          'M 82 50 L 88 44',
          'M 82 50 L 88 56',
        ]},
      ],
    },
  },
  {
    id: 'callisto', name: 'Callisto', color: '#aa66ff',
    description: 'Cratered silence. Catalysts inert.', debuffs: ['disable_catalysts'],
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 12 4 a 8 8 0 1 0 0.01 0',
      'M 8 9 a 1.5 1.5 0 1 0 3 0 a 1.5 1.5 0 1 0 -3 0',
      'M 14 13 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'body-core', paths: ['M 18 50 a 32 32 0 1 0 64 0 a 32 32 0 1 0 -64 0'] },
        { class: 'mark', opacity: 0.7, strokeWidth: 1, paths: [
          'M 33 40 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0',
          'M 59 36 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
          'M 50 62 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0',
          'M 31 62 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
          'M 65.5 58 a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0',
        ]},
        { class: 'mark', strokeWidth: 2, opacity: 0.85, paths: ['M 42 48 L 58 52'] },
      ],
    },
  },
  {
    id: 'eris', name: 'Eris', color: '#ff7847',
    description: 'Catalysts inert on first hand.', debuffs: ['disable_catalysts_first_hand'],
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 3 14 A 11 6 -25 1 0 21 10',
      'M 12 12 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'orbit-main', paths: ['M 50 14 A 38 22 -25 1 0 86 60'] },
        { class: 'orbit-aux', dashed: true, opacity: 0.4, paths: ['M 86 60 A 38 22 -25 0 0 50 14'] },
        { class: 'body-core', filled: true, paths: ['M 45 50 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0'] },
        { class: 'satellite', filled: true, paths: ['M 83.5 60 a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0'] },
        { class: 'mark', strokeWidth: 2, paths: [
          'M 46 10 L 54 18',
          'M 54 10 L 46 18',
        ]},
      ],
    },
  },
  {
    id: 'sedna', name: 'Sedna', color: '#4477cc',
    description: 'Mod slots capped at 1.', debuffs: ['mod_slots_capped_1'],
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 12 12 m -10 -2 a 10 4 -15 1 0 20 4 a 10 4 -15 1 0 -20 -4',
      'M 12 12 a 1.5 1.5 0 1 0 3 0 a 1.5 1.5 0 1 0 -3 0',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'orbit-main', paths: [
          'M 8 50 a 42 14 -15 1 0 84 0 a 42 14 -15 1 0 -84 0',
        ]},
        { class: 'body-core', filled: true, paths: ['M 46 50 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0'] },
        { class: 'satellite', filled: true, paths: ['M 84 40 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0'] },
        { class: 'mark', strokeWidth: 2.5, paths: ['M 20 50 L 80 50'] },
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
