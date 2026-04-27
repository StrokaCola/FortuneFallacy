import type { GameState } from '../../state/store';
import type { GameEventEmission } from '../../events/types';

export type ConsumableDef = {
  id: string;
  type: 'tarot' | 'spectral';
  name: string;
  icon: string;
  description: string;
  requiresTarget: boolean;
  targetType?: 'die' | 'oracle';
  apply: (s: GameState, targets: number[]) => { state: GameState; events: GameEventEmission[] };
};

export const CONSUMABLES: ConsumableDef[] = [
  {
    id: 'the_moon',
    type: 'tarot',
    name: 'The Moon',
    icon: '☽',
    description: 'Set one die to face 6.',
    requiresTarget: true,
    targetType: 'die',
    apply: (s, [idx]) => {
      if (idx == null || !s.round.dice[idx]) return { state: s, events: [] };
      const dice = s.round.dice.map((d, i) => (i === idx ? { ...d, face: 6 } : d));
      return { state: { ...s, round: { ...s.round, dice } }, events: [] };
    },
  },
  {
    id: 'the_sun',
    type: 'tarot',
    name: 'The Sun',
    icon: '☀',
    description: 'Set one die to face 1.',
    requiresTarget: true,
    targetType: 'die',
    apply: (s, [idx]) => {
      if (idx == null || !s.round.dice[idx]) return { state: s, events: [] };
      const dice = s.round.dice.map((d, i) => (i === idx ? { ...d, face: 1 } : d));
      return { state: { ...s, round: { ...s.round, dice } }, events: [] };
    },
  },
  {
    id: 'shard_strike',
    type: 'spectral',
    name: 'Shard Strike',
    icon: '◇',
    description: '+5 shards.',
    requiresTarget: false,
    apply: (s) => ({
      state: { ...s, run: { ...s.run, shards: s.run.shards + 5 } },
      events: [],
    }),
  },
  {
    id: 'the_world',
    type: 'spectral',
    name: 'The World',
    icon: '◈',
    description: '+1 hand.',
    requiresTarget: false,
    apply: (s) => ({
      state: { ...s, round: { ...s.round, handsLeft: s.round.handsLeft + 1 } },
      events: [],
    }),
  },
];

export function lookupConsumable(id: string): ConsumableDef | undefined {
  return CONSUMABLES.find((c) => c.id === id);
}
