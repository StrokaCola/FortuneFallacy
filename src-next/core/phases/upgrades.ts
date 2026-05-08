import { getByPhase } from '../upgrades/registry';
import { Phase, type PhaseFn, type PipelineCtx } from '../pipeline/types';
import { hasDebuff } from '../round/debuffs';
import { applyDieModStep } from '../mods/applyDieModStep';
import { editionBonus } from '../upgrades/editions';
import { applyResonances } from '../upgrades/resonance';

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

  // Resonance: hand-authored pair bonuses fire once per hand AFTER the
  // catalysts and mods have all contributed. Skipped under the same
  // catalysts-blocked debuff that gates the main loop, since resonances
  // are themselves catalyst-derived effects.
  if (!catalystsBlocked) {
    next = applyResonances(next);
  }

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
    const step = applyDieModStep(
      {
        face, dieIdx: i, pos, totalScoring: scoringDice.length, scoringFaces, titheBudget,
        comboId, comboTier, ante, handsLeft, comboLevelOnPlayed,
        modsOnThisDie: mods.length,
      },
      mods,
      editions,
    );
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
  const step = applyDieModStep(
    {
      face, dieIdx: lastIdx, pos: lastPos, totalScoring: scoringDice.length,
      scoringFaces: scoringDice.map((i) => faces[i]!),
      titheBudget: 0, // Encore never re-charges tithe.
    },
    mods,
  );
  if (step.dChips === 0 && step.dMult === 0 && step.dMultMul === 1) return ctx;
  let mult = ctx.mult + step.dMult;
  if (step.dMultMul !== 1) mult *= step.dMultMul;
  return {
    ...ctx,
    chips: ctx.chips + step.dChips,
    mult,
    events: [
      ...ctx.events,
      {
        type: 'onUpgradeTriggered',
        payload: { id: 'encore', phase: Phase.UPGRADES, deltaChips: step.dChips, deltaMult: mult - ctx.mult },
      },
    ],
  };
};
