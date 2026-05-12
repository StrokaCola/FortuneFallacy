// Shared formatter for die-face numerals shown in the HUD.
//
// The simulation emits -1 to mean "wildcard" for dice whose face roster
// includes a star token (see FaceReadout.tsx for the original site). Anywhere
// the player sees a face value (FaceReadout, DieTip, etc.) should render the
// star glyph for that sentinel and the raw number otherwise.
export const WILD_SENTINEL = -1;

export function describeFace(f: number): string {
  if (f === WILD_SENTINEL) return '★';
  return String(f);
}
