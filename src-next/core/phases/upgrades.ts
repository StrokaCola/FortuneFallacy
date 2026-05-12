import { getByPhase } from '../upgrades/registry';
import { Phase, type PhaseFn, type PipelineCtx } from '../pipeline/types';
import { hasDebuff } from '../round/debuffs';
import { applyDieModStep } from '../mods/applyDieModStep';
import { editionBonus } from '../upgrades/editions';
import { applyResonances } from '../upgrades/resonance';
import { applyVoidstorm } from '../round/voidstorms';
import { applyRetriggers } from '../upgrades/catalysts/retriggers';
import { activeAffinitiesOnDie } from '../../data/modAffinities';

const ALWAYS_ACTIVE = new Set<string>();

export const upgrades: PhaseFn = (ctx) => {
  let next = ctx;

  const isFirstHand = !ctx.state.round.firstHandPlayed;
  const catalystsBlocked =
    hasDebuff(ctx.state, 'disable_catalysts') ||
    (isFirstHand && hasDebuff(ctx.state, 'disable_catalysts_first_hand'));

  if (!catalystsBlocked) {
    const owned = new Set(ctx.state.run.catalysts);
    const editions = ctx.state.run.catalystEditions ?? {};
    for (const u of getByPhase(Phase.UPGRADES)) {
      if (!ALWAYS_ACTIVE.has(u.id) && !owned.has(u.id)) continue;
      const before = next;
      next = u.apply(next);
      // Apply edition bonus immediately after the catalyst's own apply, so
      // the bonus rides any later catalyst multipliers. Only fires when
      // the catalyst actually moved chips/mult — gated catalysts that
      // returned ctx unchanged contribute nothing.
      const ed = editions[u.id];
      if (!ed) continue;
      const dChips = next.chips - before.chips;
      const dMult  = next.mult  - before.mult;
      if (dChips === 0 && dMult === 0) continue;
      const { bonusChips, bonusMult } = editionBonus(ed, dChips, dMult);
      if (bonusChips === 0 && bonusMult === 0) continue;
      next = {
        ...next,
        chips: next.chips + bonusChips,
        mult: next.mult + bonusMult,
        events: [
          ...next.events,
          {
            type: 'onUpgradeTriggered',
            payload: {
              id: `edition:${ed}@${u.id}`,
              phase: Phase.UPGRADES,
              deltaChips: bonusChips,
              deltaMult: bonusMult,
            },
          },
        ],
      };
    }
  }

  next = applyModScoring(next);

  // Encore: re-fire the LAST scoring die's mods once more (chips/mult only).
  // Implemented here (not as a registered Upgrade) because it has to re-run
  // the per-die mod loop AFTER applyModScoring has already finished.
  if (next.state.run.catalysts.includes('encore') && !catalystsBlocked) {
    next = applyEncore(next);
  }

  // Retrigger pack (Polaris, Refrain, Mirror Edge, Curtain Call, Stutter,
  // Cardinal Compass, Echo Chamber, Mirrored Hand easter egg). Same shape
  // as Encore — re-fire per-die mods after the main mod sweep. Recursion
  // Lens (the meta-retrigger) is handled inside applyRetriggers.
  if (!catalystsBlocked) {
    next = applyRetriggers(next);
  }

  // Resonance: hand-authored pair bonuses fire once per hand AFTER the
  // catalysts and mods have all contributed. Skipped under the same
  // catalysts-blocked debuff that gates the main loop, since resonances
  // are themselves catalyst-derived effects.
  if (!catalystsBlocked) {
    next = applyResonances(next);
  }

  // Voidstorm: per-blind chip/mult tilt. NOT skipped under
  // catalysts-blocked — voidstorms are world-state, not catalyst-derived,
  // so a Callisto debuff doesn't suppress them.
  next = applyVoidstorm(next);

  return next;
};

const applyModScoring: PhaseFn = (ctx) => {
  const faces = ctx.sim?.finalFaces ?? [];
  const diceMods = ctx.state.run.diceMods;
  const fallbackOrder = faces.map((_, i) => i);
  const order = ctx.state.round.scoringOrder ?? fallbackOrder;
  // Filter to valid indices in case scoringOrder references stale dice.
  const scoringDice = order.filter((idx) => idx >= 0 && idx < faces.length);
  const scoringFaces = scoringDice.map((i) => faces[i]!);
  // 2026-05-11 scaling die-mod stack accrual: pull in (or default) the
  // parallel per-slot stacks. Mutated below as scaling mods fire.
  const diceModStacksIn = ctx.state.run.diceModStacks ?? diceMods.map((row) => row.map(() => 0));
  // Pad rows if a save predates the field for a particular die.
  const diceModStacks = diceMods.map((row, i) => {
    const cur = diceModStacksIn[i] ?? [];
    if (cur.length === row.length) return [...cur];
    const padded = [...cur];
    while (padded.length < row.length) padded.push(0);
    return padded;
  });
  let stacksMutated = false;

  let chips = ctx.chips;
  let mult = ctx.mult;
  const events = [...ctx.events];
  let titheBudget = ctx.state.round.tithePrimedThisHand ?? 0;
  // Phase 5b — context fields read by combo/ante/galaxy aware mods. Pulled
  // out of ctx once so the per-die loop stays tight. comboLevelOnPlayed is
  // 0 when no combo (chance hand at lvl 0) or comboLevels missing.
  const comboId = ctx.combo?.id;
  const comboTier = ctx.combo?.tier;
  const ante = ctx.state.run.ante;
  const handsLeft = ctx.state.round.handsLeft;
  const comboLevelOnPlayed = comboId
    ? (ctx.state.run.comboLevels?.[comboId] ?? 0)
    : 0;

  // Phase 5c — per-die mod editions stored in the parallel array. May
  // be undefined on legacy state; default to an empty array so the
  // applyDieModStep call sees nulls (= no edition).
  const diceModEditions = ctx.state.run.diceModEditions ?? [];
  // Gilding Press (catalyst): fires the FIRST mod on each die a second
  // time for chips only. Tithe budget isn't re-charged on the second
  // pass (the die already paid its shard cost) and mult contributions
  // from the second pass are discarded — only chips ride.
  const gildingPressOwned = ctx.state.run.catalysts.includes('gilding_press');

  for (let pos = 0; pos < scoringDice.length; pos++) {
    const i = scoringDice[pos]!;
    const face = faces[i]!;
    const mods = diceMods[i] ?? [];
    const editions = diceModEditions[i] ?? [];
    const slotStacks = diceModStacks[i] ?? [];
    const dieWasLocked = ctx.state.round.dice[i]?.locked ?? false;
    // Phase 3.3 — affinity fire. If THIS die carries an affinitied pair
    // of mods, emit a synthetic 'affinity:<pairId>@<dieIdx>' event so
    // the renderer can fire a gold celebration halo on this die during
    // its score-tick. Free of pipeline cost — purely a notification.
    for (const aff of activeAffinitiesOnDie(mods)) {
      events.push({
        type: 'onUpgradeTriggered',
        payload: {
          id: `affinity:${aff.id}@${i}`,
          phase: Phase.UPGRADES,
          deltaChips: 0,
          deltaMult: 0,
        },
      });
    }
    const step = applyDieModStep(
      {
        face, dieIdx: i, pos, totalScoring: scoringDice.length, scoringFaces, titheBudget,
        comboId, comboTier, ante, handsLeft, comboLevelOnPlayed,
        modsOnThisDie: mods.length,
        slotStacks,
        dieWasLocked,
      },
      mods,
      editions,
    );
    if (step.stackDeltas) {
      const row = diceModStacks[i];
      if (row) {
        for (let j = 0; j < step.stackDeltas.length; j++) {
          const d = step.stackDeltas[j] ?? 0;
          if (d !== 0) {
            row[j] = (row[j] ?? 0) + d;
            stacksMutated = true;
          }
        }
      }
    }
    titheBudget -= step.titheCost;
    chips += step.dChips;
    mult += step.dMult;
    const multAfterAdditive = mult;
    if (step.dMultMul !== 1) mult *= step.dMultMul;
    // Gilding Press: re-run JUST the first mod (chips-only) and add to
    // the running chips total. Skips silently when the die has no mods.
    if (gildingPressOwned && mods.length > 0) {
      const firstModEcho = applyDieModStep(
        {
          face, dieIdx: i, pos, totalScoring: scoringDice.length, scoringFaces,
          titheBudget: 0, // never re-charge tithe on the echo pass
          comboId, comboTier, ante, handsLeft, comboLevelOnPlayed,
          modsOnThisDie: mods.length,
        },
        [mods[0]!],
        [editions[0] ?? null],
      );
      if (firstModEcho.dChips !== 0) {
        chips += firstModEcho.dChips;
        events.push({
          type: 'onUpgradeTriggered',
          payload: {
            id: `gilding_press@${i}`,
            phase: Phase.UPGRADES,
            deltaChips: firstModEcho.dChips,
            deltaMult: 0,
          },
        });
      }
    }
    for (const ev of step.events) {
      if (ev.type === 'upgrade') {
        events.push({
          type: 'onUpgradeTriggered',
          payload: { id: `mod:${ev.modId}@${ev.dieIdx}`, phase: Phase.UPGRADES, deltaChips: ev.dChips, deltaMult: ev.dMult },
        });
      } else {
        events.push({
          type: 'onModFired',
          payload: { dieIdx: ev.dieIdx, modId: ev.modId, faceValue: ev.faceValue },
        });
      }
    }
    // Crown mods apply multiplicatively but emit no additive deltaMult. Emit a
    // synthetic event so the animation can reconstruct the full mult progression.
    if (step.dMultMul !== 1) {
      events.push({
        type: 'onUpgradeTriggered',
        payload: { id: `mod:crownMul@${i}`, phase: Phase.UPGRADES, deltaChips: 0, deltaMult: mult - multAfterAdditive },
      });
    }
  }
  // Fold mutated scaling-mod stacks back into ctx.state.run so the next
  // pipeline pass + post-hand persistence sees the new values.
  if (stacksMutated) {
    return {
      ...ctx,
      chips, mult, events,
      state: {
        ...ctx.state,
        run: { ...ctx.state.run, diceModStacks },
      },
    };
  }
  return { ...ctx, chips, mult, events };
};

// Encore: re-fire the LAST scoring die's mods once more. Doesn't consume
// extra tithe budget (tithe already counted once during applyModScoring).
const applyEncore: PhaseFn = (ctx: PipelineCtx) => {
  const faces = ctx.sim?.finalFaces ?? [];
  const order = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
  const scoringDice = order.filter((idx) => idx >= 0 && idx < faces.length);
  if (scoringDice.length === 0) return ctx;
  const lastPos = scoringDice.length - 1;
  const lastIdx = scoringDice[lastPos]!;
  const face = faces[lastIdx]!;
  const mods = ctx.state.run.diceMods[lastIdx] ?? [];
  // Read the POST-applyModScoring stack values so curStack-gated mods see
  // the +1 already accrued from the primary fire (e.g. Dormant 0→1, then
  // Encore takes it 1→2).
  const slotStacks = ctx.state.run.diceModStacks?.[lastIdx] ?? [];
  const step = applyDieModStep(
    {
      face, dieIdx: lastIdx, pos: lastPos, totalScoring: scoringDice.length,
      scoringFaces: scoringDice.map((i) => faces[i]!),
      titheBudget: 0, // Encore never re-charges tithe.
      slotStacks,
    },
    mods,
  );
  const noChipMultDelta = step.dChips === 0 && step.dMult === 0 && step.dMultMul === 1;
  const noStackDelta = !step.stackDeltas || step.stackDeltas.every((d) => d === 0);
  if (noChipMultDelta && noStackDelta) return ctx;
  let mult = ctx.mult + step.dMult;
  if (step.dMultMul !== 1) mult *= step.dMultMul;
  let nextState = ctx.state;
  if (!noStackDelta && ctx.state.run.diceModStacks) {
    const nextStacks = ctx.state.run.diceModStacks.map((row) => row.slice());
    const targetRow = nextStacks[lastIdx];
    if (targetRow) {
      for (let j = 0; j < step.stackDeltas!.length; j++) {
        const d = step.stackDeltas![j] ?? 0;
        if (d !== 0) targetRow[j] = (targetRow[j] ?? 0) + d;
      }
    }
    nextState = { ...ctx.state, run: { ...ctx.state.run, diceModStacks: nextStacks } };
  }
  const events = noChipMultDelta
    ? ctx.events
    : [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered' as const,
          payload: { id: 'encore', phase: Phase.UPGRADES, deltaChips: step.dChips, deltaMult: mult - ctx.mult },
        },
      ];
  return {
    ...ctx,
    chips: ctx.chips + step.dChips,
    mult,
    events,
    state: nextState,
  };
};
