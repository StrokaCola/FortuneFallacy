import type { ActionHandler } from './types';
import { runRollPipelineUpToSim, runRollPipelineAfterSim } from '../../core/pipeline/runRollPipeline';
import { clearBlind, bustBlind } from '../../core/round/transitions';
import { hasDebuff } from '../../core/round/debuffs';
import { lookupMod } from '../../core/mods';
import { shardSinkActive } from '../../core/upgrades/catalysts/shardSink';

export const rollHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'ROLL_REQUESTED': {
      const isFirstRoll = !s.round.firstRollDone;
      const dice = isFirstRoll
        ? s.round.dice.map((d) => ({ ...d, locked: false }))
        : s.round.dice;
      const workingState = {
        ...s,
        round: { ...s.round, dice, firstRollDone: true, handInProgress: true },
      };
      const ctx = runRollPipelineUpToSim(workingState);
      return {
        state: workingState,
        events: [
          {
            type: 'onRollStart',
            payload: { dice, lockedMask: dice.map((d) => d.locked) },
          },
          ...(ctx.simRequest
            ? [{ type: 'onSimulationStart' as const, payload: { request: ctx.simRequest } }]
            : []),
        ],
      };
    }
    case 'REROLL_REQUESTED': {
      if (s.round.rerollsLeft <= 0) return { state: s, events: [] };
      if (hasDebuff(s, 'no_rerolls')) return { state: s, events: [] };
      const ctx = runRollPipelineUpToSim(s);
      return {
        state: { ...s, round: { ...s.round, handInProgress: true, rerollsLeft: s.round.rerollsLeft - 1 } },
        events: [
          {
            type: 'onRollStart',
            payload: { dice: s.round.dice, lockedMask: s.round.dice.map((d) => d.locked) },
          },
          ...(ctx.simRequest
            ? [{ type: 'onSimulationStart' as const, payload: { request: ctx.simRequest } }]
            : []),
        ],
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
      const primed = shardSinkActive(s);
      const shardsAfter = primed ? s.run.shards - 1 : s.run.shards;
      const workingState = {
        ...s,
        run: { ...s.run, shards: shardsAfter },
        round: { ...s.round, shardSinkPrimedThisHand: primed },
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
      for (const mods of workingState.round.diceMods) {
        for (const id of mods) {
          const def = lookupMod(id);
          if (def?.shardsBonus) shardBonus += def.shardsBonus;
        }
      }
      const newScore = workingState.round.score + final.total;
      const newHandsLeft = Math.max(0, workingState.round.handsLeft - 1);
      const baseState = {
        ...workingState,
        run: {
          ...workingState.run,
          shards: shardBonus > 0 ? workingState.run.shards + shardBonus : workingState.run.shards,
          handsPlayed: workingState.run.handsPlayed + 1,
        },
        round: {
          ...workingState.round,
          handsLeft: newHandsLeft,
          rerollsLeft: 2,
          scoring: true,
          firstHandPlayed: true,
          pendingScoreDelta: final.total,
          chainLen: final.chain?.len ?? workingState.round.chainLen,
          chainTier: final.chain?.tier ?? workingState.round.chainTier,
          shardSinkPrimedThisHand: false,
          lastScoringCtx: {
            combo: final.combo ?? null,
            chips: final.chips ?? 0,
            mult: final.mult ?? 1,
            chain: { mult: final.chain?.mult ?? 1 },
            total: final.total ?? 0,
            events: final.events
              .filter((e) => e.type === 'onUpgradeTriggered')
              .map((e) => ({ type: e.type, payload: e.payload as { id: string; phase: number; deltaChips: number; deltaMult: number } })),
            state: { round: { dice: workingState.round.dice } },
          },
        },
      };
      const baseEvents = [...final.events];

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
