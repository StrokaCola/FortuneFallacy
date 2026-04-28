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
          // score deferred to END_SCORING via pendingScoreDelta — keeps TopBar at old value while sequence climbs
          handsLeft: newHandsLeft,
          rerollsLeft: 2,
          scoring: true,
          pendingScoreDelta: final.total,
          chainLen: final.chain?.len ?? s.round.chainLen,
          chainTier: final.chain?.tier ?? s.round.chainTier,
          dice: s.round.dice.map((d) => ({ ...d, locked: false })),
          lastScoringCtx: {
            combo: final.combo ?? null,
            chips: final.chips ?? 0,
            mult: final.mult ?? 1,
            chain: { mult: final.chain?.mult ?? 1 },
            total: final.total ?? 0,
            state: { round: { dice: s.round.dice } },
          },
        },
      };
      const baseEvents = [...final.events];

      let pendingRoundEnd: 'clear' | 'bust' | null = null;
      if (s.round.active && newScore >= s.round.target && s.round.target > 0) {
        pendingRoundEnd = 'clear';
      } else if (s.round.active && newHandsLeft === 0 && newScore < s.round.target) {
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
        state: cleared,
        events: [],
      };
    }
    default:
      return { state: s, events: [] };
  }
};
