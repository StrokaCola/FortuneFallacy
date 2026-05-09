import type { ActionHandler } from './types';
import { runRollPipelineUpToSim, runRollPipelineAfterSim } from '../../core/pipeline/runRollPipeline';
import { clearBlind, bustBlind } from '../../core/round/transitions';
import { hasDebuff } from '../../core/round/debuffs';
import { rerollsPerHand } from '../../core/run/stakeContext';
import { lookupMod } from '../../core/mods';
import { shardSinkActive } from '../../core/upgrades/catalysts/shardSink';
import { recursiveSinkActive } from '../../core/upgrades/catalysts/recursiveSink';
import { grantStipend } from '../../core/upgrades/catalysts/stipend';
import { updateComboStreaks } from '../../core/round/comboStreak';
import type { GameEventEmission } from '../../events/types';
import { catalystIdFromEvent, resonanceIdFromEvent } from '../../core/upgrades/eventId';
import { lookupResonance } from '../../data/resonances';
import { adaptScoringContext } from '../../core/scoring/adapter';
import type { RunSlice, PeakHandSnapshot } from '../../state/slices/run';

export const rollHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'ROLL_REQUESTED': {
      const isFirstRoll = !s.round.firstRollDone;
      const dice = isFirstRoll
        ? s.round.dice.map((d) => ({ ...d, locked: false }))
        : s.round.dice;
      const workingState = {
        ...s,
        run: { ...s.run, rollCounter: (s.run.rollCounter ?? 0) + 1 },
        round: {
          ...s.round,
          dice,
          firstRollDone: true,
          handInProgress: true,
          scoringOrder: dice.flatMap((d, i) => (d.locked ? [i] : [])),
          // Crescendo Run: every roll without a new lock pushes the counter
          // up by one. Reset by TOGGLE_LOCK (when locking, see dice.ts).
          rollsWithoutLock: (s.round.rollsWithoutLock ?? 0) + 1,
        },
      };
      const ctx = runRollPipelineUpToSim(workingState);
      const events: GameEventEmission[] = [
        {
          type: 'onRollStart',
          payload: { dice, lockedMask: dice.map((d) => d.locked) },
        },
        ...(ctx.simRequest
          ? [{ type: 'onSimulationStart' as const, payload: { request: ctx.simRequest } }]
          : []),
      ];
      return { state: workingState, events };
    }
    case 'REROLL_REQUESTED': {
      if (s.round.rerollsLeft <= 0) return { state: s, events: [] };
      if (hasDebuff(s, 'no_rerolls')) return { state: s, events: [] };
      const advanced = { ...s, run: { ...s.run, rollCounter: (s.run.rollCounter ?? 0) + 1 } };
      const ctx = runRollPipelineUpToSim(advanced);
      const events: GameEventEmission[] = [
        {
          type: 'onRollStart',
          payload: { dice: advanced.round.dice, lockedMask: advanced.round.dice.map((d) => d.locked) },
        },
        ...(ctx.simRequest
          ? [{ type: 'onSimulationStart' as const, payload: { request: ctx.simRequest } }]
          : []),
      ];
      return {
        state: {
          ...advanced,
          round: {
            ...advanced.round,
            handInProgress: true,
            rerollsLeft: advanced.round.rerollsLeft - 1,
            rollsWithoutLock: (advanced.round.rollsWithoutLock ?? 0) + 1,
          },
        },
        events,
      };
    }
    case 'ROLL_SETTLED': {
      const autoUnlock = hasDebuff(s, 'auto_unlock_after_roll');
      const dice = a.result.finalFaces.map((face, id) => ({
        id,
        face,
        locked: autoUnlock ? false : s.round.dice[id]?.locked ?? false,
      }));
      return {
        state: { ...s, round: { ...s.round, handInProgress: false, dice } },
        events: [
          { type: 'onSimulationEnd', payload: { result: a.result } },
          {
            type: 'onRollEnd',
            payload: {
              faces: a.result.finalFaces,
              metrics: { chaos: 0, impact: 0, settle: 0, sync: 1 },
            },
          },
        ],
      };
    }
    case 'SCORE_HAND': {
      // Stipend grants its +1 shard BEFORE shard_sink/tithe prime so the new
      // shard is available to spend this hand.
      const stateAfterStipend = grantStipend(s);
      const primed = shardSinkActive(stateAfterStipend);
      const shardsAfterSink = primed ? stateAfterStipend.run.shards - 1 : stateAfterStipend.run.shards;
      // Recursive Sink: needs shard_sink active AND ≥1 more shard available.
      const recPrimed =
        primed &&
        recursiveSinkActive(stateAfterStipend) &&
        shardsAfterSink >= 1;
      const shardsAfterRecSink = recPrimed ? shardsAfterSink - 1 : shardsAfterSink;
      // Tithe budget: 1 shard per scoring die that carries Tithe, capped at
      // shards remaining after shard_sink + recursive_sink draws. Computed
      // once before the pipeline so each Tithe instance can self-skip when
      // budget hits 0.
      const scoringIdxs = stateAfterStipend.round.scoringOrder ?? stateAfterStipend.round.dice.map((_, i) => i);
      const titheInstances = scoringIdxs.reduce((n, idx) => {
        const mods = stateAfterStipend.run.diceMods[idx] ?? [];
        return n + mods.filter((id) => {
          const def = lookupMod(id);
          return !!(def?.titheChips || def?.titheMult);
        }).length;
      }, 0);
      const titheBudget = Math.min(titheInstances, shardsAfterRecSink);
      const shardsAfterTithe = shardsAfterRecSink - titheBudget;
      const workingState = {
        ...stateAfterStipend,
        run: { ...stateAfterStipend.run, shards: shardsAfterTithe },
        round: {
          ...stateAfterStipend.round,
          shardSinkPrimedThisHand: primed,
          recursiveSinkPrimedThisHand: recPrimed,
          tithePrimedThisHand: titheBudget,
        },
      };
      const baseCtx = runRollPipelineUpToSim(workingState);
      const fakeResult = {
        finalFaces: workingState.round.dice.map((d) => d.face),
        restPositions: workingState.round.dice.map(() => ({ x: 0, y: 0, z: 0 })),
        settleMs: workingState.round.dice.map(() => 0),
        peakVelocity: 0,
        collisionCount: 0,
        bounceHeights: workingState.round.dice.map(() => 0),
      };
      const final = runRollPipelineAfterSim(baseCtx, fakeResult);
      let shardBonus = 0;
      const modFiredEvents: GameEventEmission[] = [];
      const finalFaces = fakeResult.finalFaces;
      // Refinery (Phase 5b): mods that grant shards conditionally on the
      // played combo id. Gated by `refineryComboIds`; ignored when the
      // pipeline didn't surface a combo (degenerate hand).
      const playedComboId = final.combo?.id;
      workingState.run.diceMods.forEach((mods, dieIdx) => {
        for (const id of mods) {
          const def = lookupMod(id);
          if (def?.shardsBonus) {
            shardBonus += def.shardsBonus;
            modFiredEvents.push({
              type: 'onModFired',
              payload: { dieIdx, modId: id, faceValue: finalFaces[dieIdx] ?? 0 },
            });
          }
          if (def?.refineryShards && playedComboId && def.refineryComboIds?.includes(playedComboId)) {
            shardBonus += def.refineryShards;
            modFiredEvents.push({
              type: 'onModFired',
              payload: { dieIdx, modId: id, faceValue: finalFaces[dieIdx] ?? 0 },
            });
          }
        }
      });
      const newScore = workingState.round.score + final.total;
      const newHandsLeft = Math.max(0, workingState.round.handsLeft - 1);
      const streakUpdates = updateComboStreaks(
        workingState.run,
        final.combo ? { id: final.combo.id, tier: final.combo.tier } : null,
      );
      // Build the SequenceInput once — it's used both as the live
      // animation feed (via scoreSequenceController) AND, when this
      // is a new peak hand, as the snapshot stored in runStats so
      // the postmortem can replay it visually.
      const sequenceInputForThisHand = adaptScoringContext({
        combo: final.combo ?? null,
        chips: final.chips ?? 0,
        mult: final.mult ?? 1,
        chain: { mult: final.chain?.mult ?? 1 },
        total: final.total ?? 0,
        events: final.events
          .filter((e) => e.type === 'onUpgradeTriggered')
          .map((e) => ({ type: e.type, payload: e.payload as { id: string; phase: number; deltaChips: number; deltaMult: number } })),
        state: { round: { dice: workingState.round.dice, scoringOrder: workingState.round.scoringOrder } },
      });
      const newRunStats = updateRunStats(
        workingState.run.runStats,
        final.events,
        final.total,
        final.combo?.id ?? null,
        sequenceInputForThisHand,
      );
      // Hot Streak: a hand is "hot" when it scores above its fair share
      // (target × 2/3 — twice what a single hand would need to clear in
      // 3 hands). Resets to 0 on any miss. Three in a row triggers the
      // celebration banner; sticky once fired so the banner doesn't
      // re-emit on the 4th and 5th hots.
      const target = workingState.round.target;
      const isHotHand = target > 0 && final.total >= (target * 2 / 3);
      const hotHandsInRow = isHotHand
        ? (workingState.round.hotHandsInRow ?? 0) + 1
        : 0;
      const hotStreakFiredThisBlind = workingState.round.hotStreakFiredThisBlind ?? false;
      const shouldFireHotStreak = hotHandsInRow >= 3 && !hotStreakFiredThisBlind;
      const baseState = {
        ...workingState,
        run: {
          ...workingState.run,
          ...streakUpdates,
          shards: shardBonus > 0 ? workingState.run.shards + shardBonus : workingState.run.shards,
          handsPlayed: workingState.run.handsPlayed + 1,
          runStats: newRunStats,
        },
        round: {
          ...workingState.round,
          handsLeft: newHandsLeft,
          rerollsLeft: rerollsPerHand(workingState),
          scoring: true,
          firstHandPlayed: true,
          pendingScoreDelta: final.total,
          chainLen: final.chain?.len ?? workingState.round.chainLen,
          chainTier: final.chain?.tier ?? workingState.round.chainTier,
          shardSinkPrimedThisHand: false,
          recursiveSinkPrimedThisHand: false,
          tithePrimedThisHand: 0,
          hotHandsInRow,
          hotStreakFiredThisBlind: hotStreakFiredThisBlind || shouldFireHotStreak,
          lastScoringCtx: {
            combo: final.combo ?? null,
            chips: final.chips ?? 0,
            mult: final.mult ?? 1,
            chain: { mult: final.chain?.mult ?? 1 },
            total: final.total ?? 0,
            events: final.events
              .filter((e) => e.type === 'onUpgradeTriggered')
              .map((e) => ({ type: e.type, payload: e.payload as { id: string; phase: number; deltaChips: number; deltaMult: number } })),
            state: { round: { dice: workingState.round.dice, scoringOrder: workingState.round.scoringOrder } },
          },
        },
      };
      const baseEvents = [...final.events, ...modFiredEvents];
      if (shouldFireHotStreak) {
        baseEvents.push({
          type: 'onHotStreak',
          payload: { length: hotHandsInRow },
        });
      }

      let pendingRoundEnd: 'clear' | 'bust' | null = null;
      if (workingState.round.active && newScore >= workingState.round.target && workingState.round.target > 0) {
        pendingRoundEnd = 'clear';
      } else if (workingState.round.active && newHandsLeft === 0 && newScore < workingState.round.target) {
        pendingRoundEnd = 'bust';
      }
      const stateWithPending = pendingRoundEnd
        ? { ...baseState, round: { ...baseState.round, pendingRoundEnd } }
        : baseState;
      return { state: stateWithPending, events: baseEvents };
    }
    case 'END_SCORING': {
      if (!s.round.scoring) return { state: s, events: [] };
      const finalScore = s.round.score + (s.round.pendingScoreDelta ?? 0);
      const cleared = {
        ...s,
        round: {
          ...s.round,
          score: finalScore,
          scoring: false,
          pendingRoundEnd: null,
          pendingScoreDelta: null,
        },
      };
      if (s.round.pendingRoundEnd === 'clear') {
        const result = clearBlind(cleared);
        return result;
      }
      if (s.round.pendingRoundEnd === 'bust') {
        const result = bustBlind(cleared);
        return result;
      }
      return {
        state: {
          ...cleared,
          round: {
            ...cleared.round,
            dice: cleared.round.dice.map((d) => ({ ...d, locked: true })),
            firstRollDone: false,
          },
        },
        events: [],
      };
    }
    default:
      return { state: s, events: [] };
  }
};

// Per-hand telemetry roll-up. Walks the pipeline's events for the just-
// scored hand and attributes each catalyst's chip contribution to its
// owner via the catalyst-id prefix rules. Pure mod fires (`mod:*`) are
// filtered out by catalystIdFromEvent → the postmortem credits only
// catalysts. Returns a fresh runStats with the new totals merged in.
//
// Edition stamps and catalyst-driven mod re-fires (gilding_press@N,
// encore) collapse onto the owning catalyst — a Stratifier with foil
// edition shows ONE bar in the postmortem, not two.
function updateRunStats(
  prev: RunSlice['runStats'],
  events: GameEventEmission[],
  handTotal: number,
  comboId: string | null,
  // The current hand's SequenceInput. When the hand sets a new peak,
  // this captures into runStats.peakHandSnapshot for the postmortem
  // replay. Optional so older test paths can omit it without crashing.
  sequenceInput?: PeakHandSnapshot,
): RunSlice['runStats'] {
  // Defensive: persistence has a default but a freshly-cloned state from
  // tests may pass undefined. Treat missing as a zero-baseline stat block.
  const base: RunSlice['runStats'] = prev ?? {
    peakHand: 0, peakCombo: null, catalystChips: {}, dustEarned: 0, catalystFires: {}, peakHandSnapshot: null,
  };
  const isNewPeak = handTotal > base.peakHand;
  const peakHand = Math.max(base.peakHand, handTotal);
  const peakCombo = isNewPeak ? comboId : base.peakCombo;
  // Replace the snapshot only when we just set a new peak. Keeps the
  // postmortem's "play your peak hand" promise honest — it's always
  // the BEST hand of the run, not the most recent one.
  const peakHandSnapshot = isNewPeak && sequenceInput
    ? sequenceInput
    : (base.peakHandSnapshot ?? null);
  const catalystChips: Record<string, number> = { ...base.catalystChips };
  const catalystFires: Record<string, number> = { ...(base.catalystFires ?? {}) };
  for (const ev of events) {
    if (ev.type !== 'onUpgradeTriggered') continue;
    const dChips = ev.payload.deltaChips ?? 0;

    // Resonance events split contribution evenly between both halves of
    // the pair. This way each catalyst's bar in the postmortem reflects
    // both its own fires AND its share of the synergies it enabled —
    // exactly the storytelling beat we want ("Conductor and Encore each
    // carried this build").
    const resonanceId = resonanceIdFromEvent(ev.payload.id);
    if (resonanceId) {
      const pair = lookupResonance(resonanceId);
      if (!pair) continue;
      // Resonance fires count toward BOTH halves' fire counters since
      // the pair effect requires both halves to be present. Awakening
      // a catalyst via consistent resonance use is a real player
      // strategy — counting both sides reflects that.
      catalystFires[pair.a] = (catalystFires[pair.a] ?? 0) + 1;
      catalystFires[pair.b] = (catalystFires[pair.b] ?? 0) + 1;
      if (dChips !== 0) {
        const halfChips = dChips / 2;
        catalystChips[pair.a] = (catalystChips[pair.a] ?? 0) + halfChips;
        catalystChips[pair.b] = (catalystChips[pair.b] ?? 0) + halfChips;
      }
      continue;
    }

    const id = catalystIdFromEvent(ev.payload.id);
    if (!id) continue;
    catalystFires[id] = (catalystFires[id] ?? 0) + 1;
    if (dChips !== 0) {
      catalystChips[id] = (catalystChips[id] ?? 0) + dChips;
    }
  }
  return {
    peakHand,
    peakCombo,
    catalystChips,
    catalystFires,
    dustEarned: base.dustEarned ?? 0,
    peakHandSnapshot,
  };
}
