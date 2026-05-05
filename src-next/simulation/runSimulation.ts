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
  const merged = rapierResult
    ? mergeWithLocks(rapierResult, prevFaces, lockedMask)
    : await runSeededSim(req, prevFaces, lockedMask);
  return { ...merged, cameraShake: deriveCameraShake(merged) };
}

// Map physics intensity to a world-unit camera offset amplitude. Tuned for
// the orthographic camera at ortho=7.5 — caps near 0.55 so shake reads as
// "impact" without breaking dice readability.
function deriveCameraShake(r: SimulationResult): number {
  const v = Math.max(0, (r.peakVelocity - 3)) / 12; // 0 at v=3, 1 at v=15
  const c = Math.min(1, r.collisionCount / 40);
  return Math.min(0.55, v * 0.42 + c * 0.13);
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
    const rng = mulberry32(req.seed >>> 0);
    const state = store.getState();
    // Dice count tracks the round's actual dice array (constellation-driven),
    // capped by the hand-size debuff for boss blinds that constrain the hand.
    const baseCount = Math.max(prevFaces.length, state.round.dice.length, 1);
    const cap = hasDebuff(state, 'hand_size_cap_4') ? 4 : baseCount;
    const diceCount = Math.min(cap, baseCount);

    // Faces come from the predetermined sequence built in initSimulation;
    // the pipeline RNG already accounted for locks, but we still respect
    // lockedMask defensively in case of a stale request.
    const targets = req.predeterminedFaces ?? [];
    const finalFaces: number[] = [];
    for (let i = 0; i < diceCount; i++) {
      const target = targets[i];
      if (lockedMask[i]) {
        finalFaces.push(prevFaces[i] ?? target ?? 1);
      } else if (target != null) {
        finalFaces.push(target);
      } else {
        finalFaces.push(prevFaces[i] ?? 1);
      }
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
