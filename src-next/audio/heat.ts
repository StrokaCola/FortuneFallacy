export type AudioMemory = {
  heat: number;
  combo: number;
  stability: number;
};

const KEY = 'ff_next_audio';

export function deltaToHeat(scoreDelta: number, target: number): number {
  if (target <= 0 || scoreDelta <= 0) return 0;
  const ratio = scoreDelta / target;
  return Math.min(0.8, Math.log10(1 + ratio * 9));
}

export function multiplierToCombo(mult: number): number {
  if (mult <= 1) return 0;
  return Math.min(1, Math.log2(mult + 1) / 4.5);
}

export function tierToCombo(tier: number): number {
  // tier 0 (chance) → 0, tier 1 (one_pair) → 0.18, tier 8 (five_kind) → 1
  return Math.min(1, tier / 8);
}

export function smoothstep(x: number, edge0: number, edge1: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function saveMemory(s: AudioMemory): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}

export function loadMemory(): AudioMemory | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as AudioMemory;
    return {
      heat: (m.heat ?? 0) * 0.5,
      combo: (m.combo ?? 0) * 0.5,
      stability: (m.stability ?? 0.5) * 0.5,
    };
  } catch {
    return null;
  }
}
