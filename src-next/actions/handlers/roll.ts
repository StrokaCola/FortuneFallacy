import type { ActionHandler } from './types';
import { runRollPipelineUpToSim, runRollPipelineAfterSim } from '../../core/pipeline/runRollPipeline';
import { clearBlind, bustBlind } from '../../core/round/transitions';
import { hasDebuff } from '../../core/round/debuffs';
import { lookupRune } from '../../core/runes';

export const rollHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'ROLL_REQUESTED': {
      const ctx = runRollPipelineUpToSim(s);
      return {
        state: { ...s, round: { ...s.round, handInProgress: true } },
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
      const baseCtx = runRollPipelineUpToSim(s);
      const fakeResult = {
        finalFaces: s.round.dice.map((d) => d.face),
        restPositions: s.round.dice.map(() => ({ x: 0, y: 0, z: 0 })),
        settleMs: s.round.dice.map(() => 0),
        peakVelocity: 0,
        collisionCount: 0,
        bounceHeights: s.round.dice.map(() => 0),
      };
      const final = runRollPipelineAfterSim(baseCtx, fakeResult);
      let shardBonus = 0;
      for (const runes of s.round.diceRunes) {
        for (const id of runes) {
          const def = lookupRune(id);
          if (def?.shardsBonus) shardBonus += def.shardsBonus;
        }
      }
      const newScore = s.round.score + final.total;
      const newHandsLeft = Math.max(0, s.round.handsLeft - 1);
      const baseState = {
        ...s,
        run: shardBonus > 0 ? { ...s.run, shards: s.run.shards + shardBonus } : s.run,
        round: {
          ...s.round,
          score: newScore,
          handsLeft: newHandsLeft,
          rerollsLeft: 2,
          chainLen: final.chain?.len ?? s.round.chainLen,
          chainTier: final.chain?.tier ?? s.round.chainTier,
          dice: s.round.dice.map((d) => ({ ...d, locked: false })),
        },
      };
      const baseEvents = [...final.events];

      if (s.round.active && newScore >= s.round.target && s.round.target > 0) {
        const cleared = clearBlind(baseState);
        return { state: cleared.state, events: [...baseEvents, ...cleared.events] };
      }
      if (s.round.active && newHandsLeft === 0 && newScore < s.round.target) {
        const busted = bustBlind(baseState);
        return { state: busted.state, events: [...baseEvents, ...busted.events] };
      }
      return { state: baseState, events: baseEvents };
    }
    default:
      return { state: s, events: [] };
  }
};
