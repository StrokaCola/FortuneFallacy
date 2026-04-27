// C# minor + pentatonic note tables, tier→note maps, per-trigger jitter,
// and a volume-memory helper that biases away from recent draws.

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const PENT_INTERVALS = [0, 2, 5, 7, 10]; // semitones above root for C#m pent
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10]; // C# natural minor
const ROOT_OCTAVES = [49, 61, 73, 85]; // C#3..C#6 MIDI

export const PENTATONIC_CSM_HZ: number[] = ROOT_OCTAVES.flatMap((root) =>
  PENT_INTERVALS.map((iv) => midiToHz(root + iv)),
);

export const MINOR_CSM_HZ: number[] = ROOT_OCTAVES.flatMap((root) =>
  MINOR_INTERVALS.map((iv) => midiToHz(root + iv)),
);

const TIER_LEN: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 5, 8: 5 };

export function tierToNotes(tier: number): number[] {
  const t = Math.max(1, Math.min(8, Math.round(tier)));
  const len = TIER_LEN[t]!;
  const startOctIdx = Math.min(2, Math.floor((t - 1) / 2));
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    out.push(pickPent(startOctIdx * 5 + i));
  }
  return out;
}

export function pickPent(idx: number): number {
  const i = ((idx % PENTATONIC_CSM_HZ.length) + PENTATONIC_CSM_HZ.length) % PENTATONIC_CSM_HZ.length;
  return PENTATONIC_CSM_HZ[i]!;
}

export function jitterCents(): number {
  return (Math.random() * 2 - 1) * 25;
}
export function jitterDb(): number {
  return (Math.random() * 2 - 1) * 1.5;
}
export function jitterMs(): number {
  return Math.random() * 12;
}

export function centsToRatio(cents: number): number {
  return Math.pow(2, cents / 1200);
}

export function makeVolumeMemory(): { next(centerDb: number, spreadDb: number): number } {
  const recent: number[] = [];
  return {
    next(centerDb: number, spreadDb: number): number {
      let pick = 0;
      for (let attempt = 0; attempt < 4; attempt++) {
        pick = centerDb + (Math.random() * 2 - 1) * spreadDb;
        if (recent.every((r) => Math.abs(r - pick) > 0.4)) break;
      }
      recent.push(pick);
      if (recent.length > 3) recent.shift();
      return pick;
    },
  };
}
