import { bus } from '../events/bus';
import { dispatch } from '../actions/dispatch';
import { mulberry32 } from '../core/rng';
import { store } from '../state/store';
import { hasDebuff } from '../core/round/debuffs';
import { runRapierSim, ensureRapier } from './rapierSim';
import { begin as perfBegin } from '../devtools/perf';
import type { SimulationRequest, SimulationResult } from '../events/types';

const SETTLE_MS = 450;
// Upper bound on how long we'll wait for a single roll's simulation to
// resolve before we synthesize a fallback ROLL_SETTLED ourselves. Rapier
// settles well under 2.5s in worst case; 3.5s leaves comfortable headroom
// while staying below the "is it broken?" threshold a player would feel.
const WATCHDOG_MS = 3500;

function buildFallbackResult(req: SimulationRequest): SimulationResult {
  const faces = [...(req.predeterminedFaces ?? [])];
  return {
    finalFaces: faces,
    restPositions: faces.map(() => ({ x: 0, y: 0, z: 0 })),
    settleMs: faces.map(() => 0),
    peakVelocity: 0,
    collisionCount: 0,
    collisionPairs: [],
    bounceHeights: faces.map(() => 0),
  };
}

export function startSimRunner(): () => void {
  void ensureRapier();
  return bus.on('onSimulationStart', ({ request }) => {
    const end = perfBegin('runSimulation');
    let settled = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    const finish = (result: SimulationResult): void => {
      if (settled) return;
      settled = true;
      if (watchdog != null) clearTimeout(watchdog);
      end();
      dispatch({ type: 'ROLL_SETTLED', result });
    };
    watchdog = window.setTimeout(() => {
      if (settled) return;
      console.warn('[simRunner] watchdog tripped — synthesizing fallback ROLL_SETTLED');
      finish(buildFallbackResult(request));
    }, WATCHDOG_MS);
    runSim(request)
      .then(finish)
      .catch((err) => {
        console.error('[simRunner] runSim threw', err);
        finish(buildFallbackResult(request));
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
    // Synthesize a plausible pair list for the headless path. With <2 dice
    // there's no second body to collide with, so emit nothing.
    const collisionPairs: Array<[number, number]> = [];
    if (diceCount >= 2) {
      for (let k = 0; k < collisionCount; k++) {
        const a = rng.int(0, diceCount - 1);
        let b = rng.int(0, diceCount - 1);
        if (b === a) b = (a + 1) % diceCount;
        collisionPairs.push([a, b]);
      }
    }

    setTimeout(
      () =>
        resolve({
          finalFaces,
          restPositions: finalFaces.map(() => ({ x: 0, y: 0, z: 0 })),
          settleMs,
          peakVelocity,
          collisionCount,
          collisionPairs,
          bounceHeights,
        }),
      SETTLE_MS,
    );
  });
}
