// Score arithmetic guards. Late-game catalyst stacks multiply chips × mult ×
// chainMult and can approach Number.MAX_SAFE_INTEGER (~9.007e15) — once past
// that, integer scores become imprecise (gaps in representable values) and
// further multiplication can yield Infinity. The guards here clamp at a safe
// ceiling so the scoring path stays numerically well-behaved at the extreme
// end of the curve. The clamp ceiling sits well above any plausible target
// (Ante 4 Final Trial × Supernova × all stacking multipliers ≈ 5e13 in the
// fullrun simulator), so legitimate gameplay is never affected.

// Ceiling: floor(Number.MAX_SAFE_INTEGER / 2). Integer-valued so safeRound
// can return it without losing precision. Mid-run scores are 6-9 orders of
// magnitude below this — the ceiling exists for adversarial cases (broken
// catalyst combo, exploit, future scaling content).
export const SAFE_SCORE_CEILING = Math.floor(Number.MAX_SAFE_INTEGER / 2);

/** Multiply two finite numbers, clamping the result at the safe ceiling.
 * NaN inputs collapse to 0; ±Infinity collapses to ±SAFE_SCORE_CEILING. */
export function safeMul(a: number, b: number): number {
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    // ±Infinity input: preserve sign in the clamped result.
    const sign = Math.sign(a) * Math.sign(b);
    return sign >= 0 ? SAFE_SCORE_CEILING : -SAFE_SCORE_CEILING;
  }
  const product = a * b;
  if (Number.isNaN(product)) return 0;
  if (product > SAFE_SCORE_CEILING) return SAFE_SCORE_CEILING;
  if (product < -SAFE_SCORE_CEILING) return -SAFE_SCORE_CEILING;
  return product;
}

/** Round a score to an integer, clamping non-finite values into the safe range. */
export function safeRound(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n === Infinity || n > SAFE_SCORE_CEILING) return SAFE_SCORE_CEILING;
  if (n === -Infinity || n < -SAFE_SCORE_CEILING) return -SAFE_SCORE_CEILING;
  return Math.round(n);
}
