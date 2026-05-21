// src-next/voidmode/nameData.ts
// Static word pools and flavor fragments for the naming generator.
// All keyed by ASCII strings — no Unicode glyphs in source.

export const PREFIX_POOL: ReadonlyArray<string> = [
  'Cracked', 'Sundered', 'Eternal', 'Hollow', 'Twilit', 'Sealed',
  'Burning', 'Hungering', 'Whispering', 'Echoing', 'Frayed', 'Wandering',
  'Spectral', 'Murmuring', 'Bleak', 'Phasing', 'Knotted', 'Coiled',
  'Drowned', 'Misremembered',
];

export const SUFFIX_POOL: ReadonlyArray<string> = [
  'of the Void', 'of Echoes', 'of Hunger', 'of the Eclipse', 'of Memory',
  'of Sundering', 'of the Lacuna', 'of Static', 'of the Long Fall',
  'of the Last Roll', 'of Wrong Numbers', 'of the Returning Tide',
  'of Smoke', 'of the Tessellation', 'of the Late Hour', 'of Curfew',
  'of the Hollow Coin', 'of Misplaced Light', 'of the Ninth Door',
  'of the Quiet Throat',
];

// Mythic mid-name slot. Inserted between base name and suffix, hyphenated.
export const MID_POOL: ReadonlyArray<string> = [
  'That-Forgot-Its-Name',
  'Made-of-Borrowed-Hours',
  'Written-in-the-Wrong-Tense',
  'Spoken-Once-and-Then-Unsaid',
  'Counted-Backward-from-Zero',
];

// Tag-keyed flavor lines. Each line has tags that must overlap with the
// item's affix-flavor tags. Multi-tagged lines feel coherent across
// affix combos.
export interface FlavorLine {
  text: string;
  tags: ReadonlyArray<string>;
}

export const FLAVOR_POOL: ReadonlyArray<FlavorLine> = [
  { text: 'It hums in a key no one taught it.', tags: ['heat', 'memory'] },
  { text: 'The edges remember being more.', tags: ['decay'] },
  { text: 'You have held this before. You will not remember holding it.', tags: ['memory', 'void'] },
  { text: 'It does not cast a shadow. It casts an absence.', tags: ['void'] },
  { text: 'Cold to the touch even through gloves.', tags: ['decay', 'cold'] },
  { text: 'The numbers on it disagree with the numbers on it.', tags: ['paradox', 'void'] },
  { text: 'It will not stay still long enough to be read.', tags: ['flux'] },
  { text: 'A weight that suggests a heavier shape elsewhere.', tags: ['void', 'memory'] },
  { text: 'Whispers a name. Sometimes it is yours.', tags: ['whisper', 'memory'] },
  { text: 'It folds back into itself at the corners.', tags: ['paradox'] },
];

// Per-run alias pools. Two-word names: "Echo 17", "The Lacuna Cycle".
// Drawn from disjoint patterns so consecutive runs feel unrelated.
export const ALIAS_HEADS: ReadonlyArray<string> = [
  'Echo', 'Cycle', 'Lacuna', 'Tessellation', 'Curfew', 'Static',
  'Misfire', 'Returning Tide', 'Carcosa', 'Eclipse', 'Hollow Coin',
  'Quiet Throat', 'Ninth Door', 'Hungering Hour',
];
