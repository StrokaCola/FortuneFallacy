import { lookupMod, type ModDef } from './index';
import type { ModEdition } from '../../state/slices/run';
import { modEditionBonus } from '../upgrades/editions';

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
  // Per-slot stack delta for the 2026-05-11 scaling die-mods. Parallel to the
  // input `modIds` array. The caller (applyModScoring) folds these into
  // run.diceModStacks. `null` when no scaling mod fired this step.
  stackDeltas?: number[] | null;
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
  // Optional run/round context — Phase 5b mods read these for combo/ante
  // gating and galaxy-level scaling. Older callers can omit these without
  // breaking existing mods (all gates self-skip when fields are absent).
  comboId?: string;
  comboTier?: number;
  ante?: number;
  handsLeft?: number;
  // Galaxy levels for the played combo. The mod looks up its combo via
  // comboId; passing the slice (rather than the full record) keeps the
  // step ctx flat.
  comboLevelOnPlayed?: number;
  // Mod count on this die — Polarize-style mods read this without us needing
  // to thread the full diceMods array.
  modsOnThisDie?: number;
  // Per-slot stack counts for the scaling die-mods. Length matches modIds.
  // Default: a slot-aligned zero array. Used by tally_mark, cadence, glutton,
  // dormant, ballast, pyre_mark, veteran.
  slotStacks?: number[];
  // True iff this die was LOCKED at the moment we entered scoring. Used by
  // ballast to gate its accumulator. The caller (applyModScoring) reads
  // ctx.state.round.dice[dieIdx].locked.
  dieWasLocked?: boolean;
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
export function applyDieModStep(
  stepCtx: StepCtx,
  modIds: string[],
  editions?: ReadonlyArray<ModEdition | null>,
): DieModStepResult {
  const { face, dieIdx, pos, totalScoring, scoringFaces } = stepCtx;
  const defs: { id: string; def: ModDef; edition: ModEdition | null }[] = [];
  for (let i = 0; i < modIds.length; i++) {
    const id = modIds[i]!;
    const def = lookupMod(id);
    if (def) defs.push({ id, def, edition: editions?.[i] ?? null });
  }
  const hasResonance = defs.some((d) => d.def.resonate);

  let dChips = 0;
  let dMult = 0;
  let dMultMul = 1;
  let titheCost = 0;
  const events: DieModEvent[] = [];
  // Per-slot stack deltas — one entry per mod id even if it's not a scaling
  // mod (0 in that case). Mirror the modIds array order so the caller can
  // index by slot. Created lazily to avoid allocations when no scaling mod
  // is attached on this die.
  let stackDeltas: number[] | null = null;
  const ensureStackDeltas = (): number[] => {
    if (!stackDeltas) stackDeltas = new Array(defs.length).fill(0);
    return stackDeltas;
  };
  const stacksIn = stepCtx.slotStacks ?? [];
  // Echo mod: tracks the previous mod's contribution on this die so an
  // Echo slot copies it. "Previous" = the most recent NON-Echo mod that
  // emitted any contribution. Updated at the end of each iteration.
  let prevContrib: { chips: number; mult: number; multMul: number } | null = null;

  for (const { id, def, edition } of defs) {
    const isResonance = !!def.resonate;
    // Resonance itself contributes nothing on its own row.
    if (isResonance) continue;
    // Echo: short-circuit. Re-uses the prior mod's chips/mult/multMul
    // as this slot's contribution. No double-tithe; the prior mod paid.
    if (def.echo) {
      if (!prevContrib) {
        // Echo with nothing to copy → silent no-op.
        continue;
      }
      const echoChips = prevContrib.chips;
      const echoMult = prevContrib.mult;
      const echoMultMul = prevContrib.multMul;
      // Apply edition to the echoed contribution if Echo itself is editioned.
      let modChips = echoChips;
      let modMult = echoMult;
      if (edition && (modChips !== 0 || modMult !== 0 || echoMultMul !== 1)) {
        const eb = modEditionBonus(edition, modChips, modMult);
        modChips += eb.bonusChips;
        modMult += eb.bonusMult;
      }
      dMultMul *= echoMultMul;
      if (modChips !== 0 || modMult !== 0) {
        events.push({ type: 'upgrade', modId: id, dieIdx, dChips: modChips, dMult: modMult });
        events.push({ type: 'fired', modId: id, dieIdx, faceValue: face });
        dChips += modChips;
        dMult += modMult;
      } else if (echoMultMul !== 1) {
        events.push({ type: 'fired', modId: id, dieIdx, faceValue: face });
      }
      // Update prevContrib so a chain of echoes works (each repeats the
      // ORIGINAL contribution that started the chain — the value was
      // already preserved across the loop).
      continue;
    }

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
    // Phase 5b — combo / round / ante / galaxy aware fields. Each gate is
    // independent so multiple fields on the same mod are additive (none of
    // the new mods set more than one, but the design allows it).
    if (def.pairedFaceChips) {
      // "Part of a combo set": this die's face appears 2+ times in scoringFaces.
      const matches = scoringFaces.filter((f) => f === face).length;
      if (matches >= 2) modChips += def.pairedFaceChips;
    }
    // Keystone/Singularity contribute to dMultMul (same channel as Crown).
    // Tracked via `localMultMul` so we can fire a "fired" event even when
    // the additive sweep is empty, mirroring the crown path below.
    let localMultMul = 1;
    if (def.keystoneMult) {
      const maxFace = scoringFaces.length > 0 ? Math.max(...scoringFaces) : 0;
      if (face === maxFace && scoringFaces.filter((f) => f === maxFace).length === 1) {
        localMultMul *= def.keystoneMult;
      }
    }
    if (def.chipsPerComboLevel && stepCtx.comboLevelOnPlayed) {
      modChips += def.chipsPerComboLevel * stepCtx.comboLevelOnPlayed;
    }
    if (def.chipsPerHandLeft && stepCtx.handsLeft != null) {
      modChips += def.chipsPerHandLeft * Math.max(0, stepCtx.handsLeft);
    }
    if (def.riskHighMult && face === 6) modMult += def.riskHighMult;
    if (def.riskLowMult && face === 1) modMult -= def.riskLowMult;
    if (def.singularityAnte != null && def.singularityMult && stepCtx.ante != null) {
      if (stepCtx.ante >= def.singularityAnte) {
        localMultMul *= def.singularityMult;
      }
    }
    if (def.polarizeMult && stepCtx.modsOnThisDie != null) {
      const min = def.polarizeMinSlots ?? 3;
      if (stepCtx.modsOnThisDie >= min) {
        localMultMul *= def.polarizeMult;
      }
    }
    if (def.telescopeMult && pos === 0 && (stepCtx.comboLevelOnPlayed ?? 0) > 0) {
      localMultMul *= def.telescopeMult;
    }
    // Refinery emits no chips/mult — its only effect is shard accrual,
    // which the caller (upgrades.ts) doesn't currently fold here. We mark
    // the fire so the HUD shows the trigger; the shard credit is handled
    // by roll.ts when it sweeps post-score shard sources.
    void def.refineryComboIds;
    void def.refineryShards;
    // Tithe: gated by per-hand shard budget. One shard per die per Tithe mod.
    if ((def.titheChips || def.titheMult) && stepCtx.titheBudget - titheCost > 0) {
      titheCost += 1;
      if (def.titheChips) modChips += def.titheChips;
      if (def.titheMult) modMult += def.titheMult;
    }
    // ─── Scaling die-mods (2026-05-11) ─────────────────────────────────
    // Per-slot stack lives in run.diceModStacks (parallel to diceMods);
    // stepCtx.slotStacks is the row for this die. slotIdxSafe locates this
    // mod's slot via id (defs is built in modIds order, so direct scan).
    const slotIdxSafe = defs.findIndex((d) => d.id === id);
    const curStack = stacksIn[slotIdxSafe] ?? 0;
    if (def.tallyChipPerStack) {
      modChips += def.tallyChipPerStack * curStack;
      ensureStackDeltas()[slotIdxSafe] = 1;
    }
    if (def.cadenceMultPerStack) {
      modMult += def.cadenceMultPerStack * curStack;
      ensureStackDeltas()[slotIdxSafe] = 1;
    }
    if (def.veteranMultPerStack) {
      // Veteran's stack accrues per-blind in transitions.clearBlind, not here.
      modMult += def.veteranMultPerStack * curStack;
    }
    if (def.gluttonChipPerStack) {
      modChips += def.gluttonChipPerStack * curStack;
      if (face === 6) ensureStackDeltas()[slotIdxSafe] = 1;
    }
    if (def.dormantAwakenAt != null && def.dormantMultAfter) {
      if (curStack >= def.dormantAwakenAt) modMult += def.dormantMultAfter;
      if (curStack < def.dormantAwakenAt) ensureStackDeltas()[slotIdxSafe] = 1;
    }
    if (def.ballastChipPerStack) {
      modChips += def.ballastChipPerStack * curStack;
      if (stepCtx.dieWasLocked) ensureStackDeltas()[slotIdxSafe] = 1;
    }
    if (def.pyreChipPerStack) {
      modChips += def.pyreChipPerStack * curStack;
      if (face === 1) ensureStackDeltas()[slotIdxSafe] = 1;
    }

    // Resonance amplifies the additive chips/mult of THIS mod a second time
    // (only when paired with a resonance mod on the same die).
    if (hasResonance) {
      modChips *= 2;
      modMult *= 2;
    }

    // Crown: collect multiplicative; apply to the die's accumulated mult at end.
    if (def.crownMult && face === (def.crownFace ?? 6)) {
      localMultMul *= def.crownMult;
    }

    // Mod editions: apply bonus when the mod fired (had any non-trivial
    // contribution this step). Foil/holo are flat per-fire; poly scales
    // with the mod's own contribution. Mod editions are smaller than
    // catalyst editions (mods fire many times per hand).
    if (edition && (modChips !== 0 || modMult !== 0 || localMultMul !== 1)) {
      const eb = modEditionBonus(edition, modChips, modMult);
      modChips += eb.bonusChips;
      modMult += eb.bonusMult;
    }

    // Commit this mod's contributions to the die-level accumulators.
    dMultMul *= localMultMul;
    if (modChips !== 0 || modMult !== 0) {
      events.push({ type: 'upgrade', modId: id, dieIdx, dChips: modChips, dMult: modMult });
      events.push({ type: 'fired', modId: id, dieIdx, faceValue: face });
      dChips += modChips;
      dMult += modMult;
    } else if (localMultMul !== 1) {
      // Multiplicative-only mods (Crown, Keystone, Singularity) — emit
      // the fire so the HUD/animation can attribute the bump even though
      // the additive sweep is empty.
      events.push({ type: 'fired', modId: id, dieIdx, faceValue: face });
    }
    // Snapshot for the next slot's potential Echo. Only update when
    // SOMETHING fired — gated mods that returned 0 don't poison Echo.
    if (modChips !== 0 || modMult !== 0 || localMultMul !== 1) {
      prevContrib = { chips: modChips, mult: modMult, multMul: localMultMul };
    }
  }

  return { dChips, dMult, dMultMul, events, titheCost, stackDeltas };
}
