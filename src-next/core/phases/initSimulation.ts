import type { PhaseFn } from '../pipeline/types';
import { getDiceSpec } from '../run/diceContext';
import { spatialIdxForValue } from '../../data/dice';
import { lookupMod, type BanishResolverInput } from '../mods';

// WILD sentinel value used over the wire as a numeric face. The pipeline
// substitutes this back to the symbolic 'WILD' during evaluation.
export const WILD_SENTINEL = -1;

// Resolve a die's full banish set: union of static `banishFaces` and the
// dynamic `banishFaceResolver` output, filtered to entries that actually
// exist in the die's universe. The universe-filter prevents banishing a
// face that can never roll anyway (e.g. banishing 6 on a d4) from
// counting against the degenerate-pool guard.
function resolveBanishForDie(
  modIds: ReadonlyArray<string>,
  input: BanishResolverInput,
): Set<number> {
  const universe = new Set<number>(input.faceUniverse);
  const banished = new Set<number>();
  for (const id of modIds) {
    const def = lookupMod(id);
    if (!def) continue;
    if (def.banishFaces) {
      for (const f of def.banishFaces) if (universe.has(f)) banished.add(f);
    }
    if (def.banishFaceResolver) {
      const dynamic = def.banishFaceResolver(input);
      for (const f of dynamic) if (universe.has(f)) banished.add(f);
    }
  }
  return banished;
}

export const initSimulation: PhaseFn = (ctx) => {
  const dice = ctx.state.round.dice;
  const spec = getDiceSpec(ctx.state);
  const diceToRoll = dice
    .map((d, i) => (d.locked ? -1 : i))
    .filter((i) => i >= 0);

  // Banish-face support — per-die face universes (filtered to numeric
  // values, since WILD is a sentinel that can be banished but isn't a
  // "face value" in the literal sense for the universe check) computed
  // up front so the retry loop and the resolver both see the same shape.
  const diceFaceUniverses: number[][] = spec.map((s) => {
    if (!s) return [];
    const out: number[] = [];
    for (const f of s.faces) {
      if (typeof f === 'number') out.push(f);
      else if (f === 'WILD') out.push(WILD_SENTINEL);
      // BLANK contributes 0 — included so a banish on face 0 lands.
      else out.push(0);
    }
    return out;
  });
  // Pre-collect each die's banish set once per phase invocation. Dynamic
  // resolvers read prevHandFaces / currentDieFaces; the latter starts
  // empty and is filled as dice are rolled in order so Mirror Banish sees
  // earlier dice in the same roll.
  const currentDieFaces: number[] = dice.map(() => 0);
  const prevHandFaces: number[] = ctx.state.round.prevHandFaces ?? [];
  const banishSetForDie = (dieIdx: number): Set<number> => {
    const modIds = ctx.state.run.diceMods[dieIdx] ?? [];
    if (modIds.length === 0) return new Set();
    return resolveBanishForDie(modIds, {
      dieIdx,
      faceUniverse: diceFaceUniverses[dieIdx] ?? [],
      prevHandFaces,
      currentDieFaces,
      rng: () => ctx.rng.next(),
    });
  };

  // For each die we produce two parallel arrays:
  //   predeterminedFaces — the rolled VALUE that the game stores on the die
  //     (this is what the HUD reads).
  //   predeterminedFaceIdx — the 1-based SPATIAL face index that physics
  //     should orient up. For d6 with `faces:[1..6]` they match, but for
  //     Fibonacci [1,1,2,3,5,8] / Eclipse [0,0,0,1,1,1] / Ophiuchus the
  //     value diverges from the spatial index, and we need the spatial
  //     index for `faceCorrection` to land the correct face up.
  const predeterminedFaces: number[] = [];
  const predeterminedFaceIdx: number[] = [];
  // Track banish substitutions per die so the visual layer can replay
  // pop-up animations and SCORE_HAND can update the per-die trigger
  // counter for Pyre Pact's milestone payoff.
  const banishSubstitutions: number[] = dice.map(() => 0);
  dice.forEach((d, i) => {
    const dieSpec = spec[i];
    if (d.locked) {
      predeterminedFaces.push(d.face);
      currentDieFaces[i] = d.face;
      // For a locked die, find the first spatial face that matches the
      // current value. With duplicate values (e.g. Fibonacci's two 1s) this
      // arbitrarily picks the first occurrence — fine because the die isn't
      // physically re-simulated, so the choice never produces a visible snap.
      const idx = dieSpec ? spatialIdxForValue(dieSpec.faces, d.face) : d.face;
      predeterminedFaceIdx.push(idx);
      return;
    }
    if (!dieSpec || dieSpec.faces.length === 0) {
      const fallback = ctx.rng.int(1, 6);
      predeterminedFaces.push(fallback);
      predeterminedFaceIdx.push(fallback);
      currentDieFaces[i] = fallback;
      return;
    }
    // Banish-face: first pick a candidate index unrestricted (this is
    // the "initial roll" the die would have had without banish mods).
    // If the candidate value is banished, pick instead from the FILTERED
    // pool — face indices whose values aren't in the banish set. The
    // filter approach (vs. cap-N retry) is deterministic and handles
    // legendary mods like Voidlock that banish almost the entire
    // universe. Degenerate guard: if the filtered pool is empty (banish
    // covers every face) we keep the initial pick — banish silently
    // declines rather than locking the pipeline.
    const banishSet = banishSetForDie(i);
    let idx = ctx.rng.int(0, dieSpec.faces.length - 1);
    let face = dieSpec.faces[idx]!;
    const valueOf = (f: typeof face): number =>
      typeof f === 'number' ? f : f === 'WILD' ? WILD_SENTINEL : 0;
    if (banishSet.size > 0 && banishSet.has(valueOf(face))) {
      const allowed: number[] = [];
      for (let k = 0; k < dieSpec.faces.length; k++) {
        if (!banishSet.has(valueOf(dieSpec.faces[k]!))) allowed.push(k);
      }
      if (allowed.length > 0) {
        // Mark a substitution — the banish "fired" on this die. Down-
        // stream visual gets exactly one pop-up moment, regardless of
        // how many faces were banished.
        banishSubstitutions[i] = 1;
        idx = allowed[ctx.rng.int(0, allowed.length - 1)]!;
        face = dieSpec.faces[idx]!;
      }
      // else: degenerate — every face banished. Keep the initial pick;
      // banishSubstitutions stays 0 so no false pop-up triggers.
    }
    let valueForDie: number;
    if (typeof face === 'number') {
      valueForDie = face;
      predeterminedFaces.push(face);
    } else if (face === 'WILD') {
      valueForDie = WILD_SENTINEL;
      predeterminedFaces.push(WILD_SENTINEL);
    } else {
      valueForDie = 0;
      predeterminedFaces.push(0); // BLANK
    }
    currentDieFaces[i] = valueForDie;
    predeterminedFaceIdx.push(idx + 1);
  });
  // Per-die shape from the constellation's dice spec. Falls back to 'd6'
  // for any unspecified entry so legacy callers / tests stay valid.
  const diceShapes = dice.map((_, i) => spec[i]?.shape ?? 'd6');

  return {
    ...ctx,
    simRequest: {
      diceToRoll,
      seed: ctx.rng.seed,
      predeterminedFaces,
      predeterminedFaceIdx,
      diceShapes,
      banishSubstitutions,
    },
  };
};

