// Seeded RNG + seed encoding for run determinism.
//
// Every random decision inside a run flows through a `(seed, scope)`
// pair so two players entering the same seed get the same boss, shop,
// catalyst editions, etc. The scope string discriminates between
// concurrent rollers ('boss:ante2', 'shop:goal=4:roll=0') so they
// don't collide on the same seed.
//
// The PRNG is mulberry32 — small, fast, period 2^32, good enough for
// game RNG (we're not doing crypto). Scope strings hash to a 32-bit
// int via cyrb32 and XOR into the seed to derive the PRNG's initial
// state. Same seed + same scope = same sequence, every time.

// 32-bit string hash. Derived from cyrb53; trimmed to a single 32-bit
// output since the seed is 32-bit anyway. Stable across runs.
function hash32(s: string): number {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

// Mulberry32 PRNG. Returns a function that yields the next float in
// [0, 1) on each call. Initial state must be a 32-bit unsigned int.
function mulberry32(state: number): () => number {
  let s = state >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a deterministic RNG for the given (seed, scope) pair. Drop-in
 * replacement for `Math.random` — pass the returned function anywhere
 * a `() => number` is expected.
 */
export function makeSeedRng(seed: number, scope: string): () => number {
  return mulberry32((seed >>> 0) ^ hash32(scope));
}

/** Convenience: deterministic int in [0, max). */
export function seededInt(rng: () => number, max: number): number {
  return Math.floor(rng() * max);
}

/** Convenience: deterministic pick from a non-empty array. */
export function seededPick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[seededInt(rng, arr.length)]!;
}

// ─── Seed encoding ────────────────────────────────────────────
// Crockford base32: no I/L/O/U to avoid handwriting / display
// ambiguity. 32-bit seed → 7 chars (35 bits encoded; the top 3 are
// always zero for a 32-bit value). Formatted XXXX-XXX so a player
// can read it out loud without mangling.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function encodeSeed(seed: number): string {
  const n = seed >>> 0;
  const chars: string[] = [];
  let remaining = n;
  for (let i = 0; i < 7; i++) {
    chars.unshift(ALPHABET[remaining & 31]!);
    // Math.floor needed for the high chunks: 32-bit unsigned doesn't
    // overflow until i=6, but >>> 5 truncates → use Math.floor / 32.
    remaining = Math.floor(remaining / 32);
  }
  const s = chars.join('');
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export function decodeSeed(input: string): number | null {
  // Normalize: uppercase, map confusable chars to their Crockford
  // equivalents, strip everything that isn't [0-9A-Z]. Trailing
  // length must be exactly 7.
  const normalized = input
    .toUpperCase()
    .replace(/I/g, '1')
    .replace(/L/g, '1')
    .replace(/O/g, '0')
    .replace(/U/g, 'V')
    .replace(/[^0-9A-Z]/g, '');
  if (normalized.length !== 7) return null;
  let n = 0;
  for (const ch of normalized) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) return null;
    n = n * 32 + idx;
  }
  // A valid 32-bit seed must fit in 32 bits — anything larger is a
  // typo / out-of-domain input.
  if (n > 0xFFFFFFFF) return null;
  return n >>> 0;
}
