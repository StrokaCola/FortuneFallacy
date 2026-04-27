export type SeededRng = {
  seed: number;
  next: () => number;
  int: (lo: number, hi: number) => number;
  pick: <T>(arr: readonly T[]) => T;
};

export function mulberry32(seed: number): SeededRng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = <T>(arr: readonly T[]): T => arr[int(0, arr.length - 1)]!;
  return { get seed() { return seed; }, next, int, pick } as SeededRng;
}
