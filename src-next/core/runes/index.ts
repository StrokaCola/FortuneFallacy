export type RuneDef = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  scoreBonus?: number;
  multBonus?: number;
  shardsBonus?: number;
  faceRemap?: { from: number; to: number };
  highFaceMult?: number;
  snakeEyes?: number;
  scoreMin?: number;
};

export const RUNES: RuneDef[] = [
  { id: 'amplify',   name: 'Amplify',   icon: '⬆', desc: '+2 chips per scoring die', scoreBonus: 2 },
  { id: 'sharpened', name: 'Sharpened', icon: '▲', desc: '+1 mult per scoring die', multBonus: 1 },
  { id: 'gilded',    name: 'Gilded',    icon: '◆', desc: '+1 shard on score', shardsBonus: 1 },
  { id: 'loaded',    name: 'Loaded',    icon: '⚔', desc: '1s count as 6', faceRemap: { from: 1, to: 6 } },
  { id: 'snake_cult', name: 'Snake Cult', icon: '①', desc: '+2 mult if face is 1', snakeEyes: 2 },
  { id: 'high_roller', name: 'High Roller', icon: '🎯', desc: '+1 mult if face is 5 or 6', highFaceMult: 1 },
  { id: 'blessed',   name: 'Blessed',   icon: '✦', desc: 'Scores at least 4', scoreMin: 4 },
];

export const MAX_RUNE_SLOTS = 2;

export function lookupRune(id: string): RuneDef | undefined {
  return RUNES.find((r) => r.id === id);
}

export function applyFaceRemaps(faces: number[], diceRunes: string[][]): number[] {
  return faces.map((face, i) => {
    const runes = diceRunes[i] ?? [];
    let f = face;
    for (const id of runes) {
      const def = lookupRune(id);
      if (def?.faceRemap && f === def.faceRemap.from) f = def.faceRemap.to;
    }
    const minRune = runes.map(lookupRune).find((d) => d?.scoreMin != null);
    if (minRune?.scoreMin != null && f < minRune.scoreMin) f = minRune.scoreMin;
    return f;
  });
}
