import { bus } from '../events/bus';
import { dispatch } from '../actions/dispatch';
import { mulberry32 } from '../core/rng';
import { store } from '../state/store';
import { hasDebuff } from '../core/round/debuffs';
import { runRapierSim, ensureRapier } from './rapierSim';
import type { SimulationRequest, SimulationResult } from '../events/types';

const SETTLE_MS = 600;

export function startSimRunner(): () => void {
  void ensureRapier();
  return bus.on('onSimulationStart', ({ request }) => {
    runSim(request).then((result) => {
      dispatch({ type: 'ROLL_SETTLED', result });
    });
  });
}

async function runSim(req: SimulationRequest): Promise<SimulationResult> {
  const state = store.getState();
  const prevFaces = state.round.dice.map((d) => d.face);
  const lockedMask = state.round.dice.map((d) => d.locked);

  const rapierResult = await runRapierSim(req, prevFaces);
  if (rapierResult) {
    return mergeWithLocks(rapierResult, prevFaces, lockedMask);
  }
  return runSeededSim(req, prevFaces, lockedMask);
}

function mergeWithLocks(
  result: SimulationResult,
  prevFaces: number[],
  lockedMask: boolean[],
): SimulationResult {
  const finalFaces = result.finalFaces.map((f, i) =>
    lockedMask[i] ? prevFaces[i] ?? f : f,
  );
  return { ...result, finalFaces };
}

function runSeededSim(
  req: SimulationRequest,
  prevFaces: number[],
  lockedMask: boolean[],
): Promise<SimulationResult> {
  return new Promise((resolve) => {
    const rng = mulberry32(req.seed ^ Date.now());
    const state = store.getState();
    const cap = hasDebuff(state, 'hand_size_cap_4') ? 4 : 5;
    const diceCount = Math.min(cap, Math.max(prevFaces.length, 5));

    const finalFaces: number[] = [];
    for (let i = 0; i < diceCount; i++) {
      const rolling = req.diceToRoll.includes(i) || prevFaces[i] == null;
      finalFaces.push(rolling && !lockedMask[i] ? rng.int(1, 6) : prevFaces[i] ?? 1);
    }
    const settleMs = finalFaces.map(() => SETTLE_MS + rng.int(-80, 120));
    const bounceHeights = finalFaces.map(() => 1 + rng.next() * 2);
    const peakVelocity = 6 + rng.next() * 6;
    const collisionCount = rng.int(4, 24);

    setTimeout(
      () =>
        resolve({
          finalFaces,
          restPositions: finalFaces.map(() => ({ x: 0, y: 0, z: 0 })),
          settleMs,
          peakVelocity,
          collisionCount,
          bounceHeights,
        }),
      SETTLE_MS,
    );
  });
}
