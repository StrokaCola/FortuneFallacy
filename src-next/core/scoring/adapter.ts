import type { SequenceInput } from './types';

type MinimalScoringCtx = {
  combo: { id: string; tier: number } | null;
  chips: number;
  mult: number;
  chain: { mult: number };
  total: number;
  events: Array<{ type: string; payload: { id: string; phase: number; deltaChips: number; deltaMult: number } }>;
  state: { round: { dice: Array<{ face: number }>; scoringOrder?: number[] } };
};

export function adaptScoringContext(ctx: MinimalScoringCtx): SequenceInput {
  // Held-only scoring: animate only the dice that actually scored, in
  // scoringOrder (left-to-right). Falls back to all dice in natural order
  // for back-compat when scoringOrder is absent (legacy ctxs / tests).
  const allDice = ctx.state.round.dice;
  const order = ctx.state.round.scoringOrder ?? allDice.map((_, i) => i);
  const faces = order
    .filter((idx) => idx >= 0 && idx < allDice.length)
    .map((idx) => allDice[idx]!.face);
  const faceSum = faces.reduce((a, b) => a + b, 0);
  const comboBonus = Math.max(0, ctx.chips - faceSum);
  const comboLabel = (ctx.combo?.id ?? 'CHANCE').toUpperCase();
  const patienceTriggered = (ctx.events ?? []).some(
    (e) => e.type === 'onUpgradeTriggered' && e.payload.id === 'patience_counter',
  );
  const mults: SequenceInput['mults'] = [];
  if (ctx.mult !== 1) {
    mults.push({
      label: 'mult',
      value: ctx.mult,
      tint: patienceTriggered ? 'magenta' : undefined,
    });
  }
  if (ctx.chain.mult !== 1) mults.push({ label: 'chain', value: ctx.chain.mult });
  return {
    faces,
    comboLabel,
    comboBonus,
    mults,
    finalTotal: ctx.total,
  };
}
