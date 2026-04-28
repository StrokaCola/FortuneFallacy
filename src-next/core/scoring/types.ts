export type Beat =
  | { kind: 'cast-swell';   t: number }
  | { kind: 'die-tick';     t: number; dieIdx: number; face: number; chipDelta: number; runningTotal: number; pitchSemis: number }
  | { kind: 'combo-bonus';  t: number; comboLabel: string; chipDelta: number; runningTotal: number }
  | { kind: 'mult-slam';    t: number; label: string; multiplier: number; pitchSemis: number; ampScale: number }
  | { kind: 'cross-target'; t: number; runningTotal: number; target: number }
  | { kind: 'hold-breath';  t: number; durMs: number }
  | { kind: 'boom';         t: number; finalTotal: number; crossedTarget: boolean }
  | { kind: 'bail';         t: number; runningTotal: number; target: number };

export type SequenceTier = 'short' | 'mid' | 'full';

export type ScoreSequence = {
  beats: Beat[];
  tier: SequenceTier;
  totalDurMs: number;
};

export type SequenceInput = {
  faces: number[];
  comboLabel: string;
  comboBonus: number;
  mults: { label: string; value: number }[];
  finalTotal: number;
};

export type SequenceCtx = {
  target: number;
  isLastHand: boolean;
  maxRemaining: number;
  reducedMotion: boolean;
};
