// Combo-containment predicate. Lets a catalyst fire when the detected
// hand "contains" the target combo, not only when it IS the target.
//
// Example: a Triplet Engine catalyst (Three of a Kind → ×1.75 mult)
// previously only fired when `ctx.combo?.id === 'three_kind'`. With
// containment, it ALSO fires on Four of a Kind, Five of a Kind, and
// Full House — because those hands all include a three-of-a-kind
// inside them.
//
// Containment matrix (read row = "the hand I detected", column = "the
// target the catalyst keys off of"; ✓ means the catalyst fires):
//
//                  target →
//   detected ↓    chance  1p  2p  3oak  smS  FH  lgS  4oak  5oak
//   chance         ✓
//   one_pair       ✓      ✓
//   two_pair       ✓      ✓   ✓
//   three_kind     ✓      ✓        ✓
//   sm_straight    ✓                    ✓
//   full_house     ✓      ✓   ✓   ✓        ✓
//   lg_straight    ✓                    ✓        ✓
//   four_kind      ✓      ✓        ✓                 ✓
//   five_kind      ✓      ✓        ✓                 ✓     ✓
//
// Notes on edge cases:
//   - Five of a Kind does NOT contain Four of a Kind via the "needs a
//     5th non-matching die" reading some rule-sets use; in this game
//     5oak has 5 identical faces which trivially satisfies "4 of one
//     value." So 5oak contains 4oak. (And 5oak's 4 identical faces
//     also satisfy 3oak and 1pair.)
//   - Four of a Kind does NOT contain Two Pair: XXXX has only one
//     value with ≥2 occurrences. Two Pair requires two DISTINCT values
//     each with ≥2.
//   - Five of a Kind does NOT contain Two Pair for the same reason.
//   - Full House DOES contain Two Pair: XXX YY has two distinct values
//     (X and Y) each appearing ≥2 times.
//   - Straights do NOT contain n-of-a-kind hands (the run is distinct
//     values by definition).
//   - Chance is the no-pattern fallback; EVERY hand technically passes
//     the chance predicate. Catalysts keyed on chance (Cold Hand,
//     Chance Doctrine) check it explicitly via this helper too — they
//     fire on every hand once containment is opted-in.

// Hand-authored containment table. Keyed by detected combo id, the
// value is the set of target combo ids that the detected hand also
// satisfies. Lookups are O(1).
const CONTAINS: Record<string, Set<string>> = {
  chance:      new Set(['chance']),
  one_pair:    new Set(['chance', 'one_pair']),
  two_pair:    new Set(['chance', 'one_pair', 'two_pair']),
  three_kind:  new Set(['chance', 'one_pair', 'three_kind']),
  sm_straight: new Set(['chance', 'sm_straight']),
  full_house:  new Set(['chance', 'one_pair', 'two_pair', 'three_kind', 'full_house']),
  lg_straight: new Set(['chance', 'sm_straight', 'lg_straight']),
  four_kind:   new Set(['chance', 'one_pair', 'three_kind', 'four_kind']),
  five_kind:   new Set(['chance', 'one_pair', 'three_kind', 'four_kind', 'five_kind']),
};

/**
 * Returns true when the detected hand contains (or is) the target
 * combo. Replaces direct `ctx.combo?.id === target` checks in
 * catalyst apply functions when the catalyst should ALSO fire on
 * higher-tier hands that include the target as a substructure.
 *
 * Pass `null` / `undefined` as `detectedId` to safely return false
 * (the pipeline guarantees combo is set by EVALUATION phase, but
 * defensive callers may want the null-safe version).
 */
export function comboContains(detectedId: string | null | undefined, target: string): boolean {
  if (!detectedId) return false;
  const set = CONTAINS[detectedId];
  if (!set) return false;
  return set.has(target);
}

/**
 * Counts how many copies of the target combo's "substructure" are
 * embedded in the detected hand. Useful for catalysts that want to
 * scale by depth instead of binary fire/no-fire.
 *
 *   one_pair within four_kind  → 1 (the 4oak has one pair-set)
 *   one_pair within five_kind  → 1 (still one set, just bigger)
 *   one_pair within two_pair   → 2 (two pair-sets, one per pair)
 *   one_pair within full_house → 2 (the trio's embedded pair + the pair itself)
 *
 * Returns 0 when there's no containment, 1 for binary contains, 2+ for
 * multi-set containment. Catalysts that want simple yes/no should use
 * `comboContains()`; catalysts that want to scale should use this.
 */
export function comboContainsCount(detectedId: string | null | undefined, target: string): number {
  if (!comboContains(detectedId, target)) return 0;
  // Multi-set cases — small hand-authored table. Most pairings are 1.
  if (target === 'one_pair') {
    if (detectedId === 'two_pair') return 2;
    if (detectedId === 'full_house') return 2;
  }
  return 1;
}
