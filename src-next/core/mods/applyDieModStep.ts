import { lookupMod, type ModDef } from './index';

export type DieModEvent =
  | { type: 'upgrade'; modId: string; dieIdx: number; dChips: number; dMult: number }
  | { type: 'fired'; modId: string; dieIdx: number; faceValue: number };

export type DieModStepResult = {
  dChips: number;
  dMult: number;
  // Multiplicative ×mult applied to the die's accumulated dMult AFTER additive
  // sweeps. Crown-style mods land here. Identity = 1.
  dMultMul: number;
  events: DieModEvent[];
  // Number of shards consumed by Tithe on this die (deducted from the
  // round.tithePrimedThisHand budget by the caller).
  titheCost: number;
};

type StepCtx = {
  face: number;
  dieIdx: number;
  pos: number;
  totalScoring: number;
  // All face values in the held/scoring set, used for Mirror Pair lookup.
  scoringFaces: number[];
  // Remaining tithe budget AT THE START of this die's evaluation. Tithe will
  // self-skip if budget hits 0 mid-die (each Tithe instance costs 1).
  titheBudget: number;
};

/**
 * Compute one scoring die's mod contributions. Pure function: no state read,
 * no event emission to a global bus — the caller folds {dChips, dMult,
 * dMultMul, events} into the pipeline ctx.
 *
 * Resonance handling: if the die has a `resonate` mod alongside another mod,
 * the OTHER mod's chips/mult deltas are doubled. Resonance never doubles
 * shards (handled in roll.ts, not here) or face remaps (already happened in
 * postRollModifiers).
 *
 * Crown handling: any mod with `crownMult` set, when its `crownFace`
 * (default 6) matches the die's face, contributes a multiplicative bump
 * applied AFTER all additive contributions on this die.
 */
export function applyDieModStep(stepCtx: StepCtx, modIds: string[]): DieModStepResult {
  const { face, dieIdx, pos, totalScoring, scoringFaces } = stepCtx;
  const defs: { id: string; def: ModDef }[] = [];
  for (const id of modIds) {
    const def = lookupMod(id);
    if (def) defs.push({ id, def });
  }
  const hasResonance = defs.some((d) => d.def.resonate);

  let dChips = 0;
  let dMult = 0;
  let dMultMul = 1;
  let titheCost = 0;
  const events: DieModEvent[] = [];

  for (const { id, def } of defs) {
    const isResonance = !!def.resonate;
    // Resonance itself contributes nothing on its own row.
    if (isResonance) continue;

    let modChips = 0;
    let modMult = 0;

    if (def.scoreBonus) modChips += def.scoreBonus;
    if (def.multBonus) modMult += def.multBonus;
    if (def.snakeEyes && face === 1) modMult += def.snakeEyes;
    if (def.highFaceMult && (face === 5 || face === 6)) modMult += def.highFaceMult;
    if (def.chipPerPip) modChips += def.chipPerPip * face;
    if (def.evenFaceMult && face % 2 === 0) modMult += def.evenFaceMult;
    if (def.pairBonus) {
      const matches = scoringFaces.filter((f) => f === face).length - 1;
      if (matches > 0) modMult += def.pairBonus * matches;
    }
    if (def.firstBonus && pos === 0) modChips += def.firstBonus;
    if (def.lastBonus && pos === totalScoring - 1) modChips += def.lastBonus;
    if (def.chainMult && pos > 0) modMult += def.chainMult * pos;
    if (def.chainMultPost && pos < totalScoring - 1) {
      modMult += def.chainMultPost * (totalScoring - 1 - pos);
    }
    // Tithe: gated by per-hand shard budget. One shard per die per Tithe mod.
    if ((def.titheChips || def.titheMult) && stepCtx.titheBudget - titheCost > 0) {
      titheCost += 1;
      if (def.titheChips) modChips += def.titheChips;
      if (def.titheMult) modMult += def.titheMult;
    }

    // Resonance amplifies the additive chips/mult of THIS mod a second time
    // (only when paired with a resonance mod on the same die).
    if (hasResonance) {
      modChips *= 2;
      modMult *= 2;
    }

    // Crown: collect multiplicative; apply to the die's accumulated mult at end.
    if (def.crownMult && face === (def.crownFace ?? 6)) {
      dMultMul *= def.crownMult;
    }

    if (modChips !== 0 || modMult !== 0) {
      events.push({ type: 'upgrade', modId: id, dieIdx, dChips: modChips, dMult: modMult });
      events.push({ type: 'fired', modId: id, dieIdx, faceValue: face });
      dChips += modChips;
      dMult += modMult;
    } else if (def.crownMult && face === (def.crownFace ?? 6)) {
      // Crown fired — emit the visual even though the additive sweep is empty.
      events.push({ type: 'fired', modId: id, dieIdx, faceValue: face });
    }
  }

  return { dChips, dMult, dMultMul, events, titheCost };
}
