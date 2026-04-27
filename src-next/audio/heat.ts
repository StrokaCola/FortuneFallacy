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

export type TensionInputs = {
  score: number;
  target: number;
  handsLeft: number;
  handsTotal: number;
  scoring: boolean;
};

export function selectTension(i: TensionInputs): number {
  if (i.scoring) return 1;
  if (i.target <= 0) return 0;
  const gap = Math.max(0, (i.target - i.score) / i.target);
  const handsRatio = i.handsTotal > 0 ? i.handsLeft / i.handsTotal : 1;
  // pace_factor: 1 when hands plentiful, 2.2 when on last hand
  const pace = 1 + (1 - handsRatio) * 1.2;
  return Math.max(0, Math.min(1, gap * pace));
}
