import type { SequenceInput } from './types';

type MinimalScoringCtx = {
  combo: { id: string; tier: number } | null;
  chips: number;
  mult: number;
  chain: { mult: number };
  total: number;
  state: { round: { dice: Array<{ face: number }> } };
};

export function adaptScoringContext(ctx: MinimalScoringCtx): SequenceInput {
  const faces = ctx.state.round.dice.map((d) => d.face);
  const faceSum = faces.reduce((a, b) => a + b, 0);
  const comboBonus = Math.max(0, ctx.chips - faceSum);
  const comboLabel = (ctx.combo?.id ?? 'CHANCE').toUpperCase();
  const mults: SequenceInput['mults'] = [];
  if (ctx.mult !== 1) mults.push({ label: 'mult', value: ctx.mult });
  if (ctx.chain.mult !== 1) mults.push({ label: 'chain', value: ctx.chain.mult });
  return {
    faces,
    comboLabel,
    comboBonus,
    mults,
    finalTotal: ctx.total,
  };
}
