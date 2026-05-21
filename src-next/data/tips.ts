// Tip-of-the-Day pool. Surfaced as a subtle line on the Title screen
// to nudge players toward systems they may not have discovered yet.
// Selection is deterministic per UTC day (same tip for all players on
// the same date) — gives the "tip of the day" feel without needing a
// server, and discoveries spread organically when players share notes.
//
// Voice: short (≤ ~90 chars), cosmic-indifference register where it
// fits, gambling-table register otherwise. Each tip is a complete
// sentence the player could read once and remember. No exclamation
// marks; no "Pro tip:" preambles.

export const TIPS: readonly string[] = [
  // Core loop
  'Locked dice keep their face when you reroll. Use your locks early.',
  'Chance always scores — five pips and a multiplier of one. The floor is never zero.',
  'A bad roll is rarely a busted hand. Catalysts pay off the worst faces, too.',

  // Catalysts
  'Catalysts with a counter in the corner grow as you play. They keep their stacks until you bust.',
  'The first shop of every ante leans toward a single build archetype. Read the offers as a kit, not three picks.',
  'Edition stamps (foil, holographic, polychrome) multiply a catalyst — and they cost more for a reason.',
  'Two catalysts can share a Resonance. Owning both quietly unlocks a bonus that the Codex remembers.',

  // Mods
  'Mods attach to specific dice in the Forge. The dice that carry them ride those mods every time they roll.',
  'A scaling mod survives blind boundaries. Its counter is the run\'s memory of the dice you trusted most.',

  // Combos
  'Climbing the combo tier across consecutive hands raises the chain multiplier. Dropping a tier ends the climb.',
  'The chain multiplier caps at four hands per blind. You\'ll feel the cap before you read it.',

  // Blind structure
  'Skip Bounty hands you a reward to avoid a blind. Boss blinds can\'t be skipped — pick your detours earlier.',
  'Voidstorms preview their effect on the Hub card before you commit. Read the chip; the storm is honest.',
  'A boss\'s Second Wind fires mid-blind. Watch your hands-left counter — the rule will change before the last hand.',

  // Constellations
  'Lyra is the classic five-string sky. The other seven constellations rewrite a rule of the table.',
  'Constellations unlock when you meet their predicate, not by spending. The Codex hints at each.',

  // Meta-progression
  'Cosmic Dust earned on a bust is your investment in the next run. The Astral Forge spends it for permanent edges.',
  'Daily Challenge ignores your Astral Perks. The leaderboard there is your skill, not your loadout.',
  'Stake names are a fire ladder: Spark, Ember, Pyre, Beacon, Nova, Supernova. Each rung raises the targets.',

  // UX / accessibility
  'Long-press any element on the HUD to pin its tooltip. Settings → Long-press hold makes the gesture easier.',
  'Settings has a Performance Mode toggle. Auto is the default — it drops quality only when the device asks for help.',
  'Sound captions surface every audio event as text. Settings → Sound captions for the deaf/HoH-friendly path.',

  // Easter eggs / discoverability
  'Some hands close on a famous number. Be precise about it.',
  'Three sevens still mean something at a slot machine.',
  'The first three dice of a brand-new run sometimes spell a constant.',
  'Two names that read the same forward and back tie a knot at the start of every blind.',
  // Void-mode hints — cryptic, never naming the portal directly.
  'Stare at the corner of the title long enough and the corner stares back.',
  'Below the lattice of stars there is a hole the stars do not cross.',
  'The dice are rolled. The table sometimes is too.',
  'Something at the edge of the table is not looking at the dice.',
  'A name you have not chosen waits for you somewhere past the curtain.',

  // Fiction nudges
  'The gambler\'s fallacy says the next roll knows the last. The dice do not.',
  'Pluto, Ceres, Triton, Phobos, Callisto, Eris, Charon, Sedna — eight cold names for eight cold blinds.',
  'Every Postmortem records the catalyst that carried you. The numbers remember what the run forgot.',
  'Winning a run is not the loop. Choosing the next run is.',
] as const;

/**
 * Returns today's tip. Selection is deterministic per UTC day — the
 * same date hashes to the same tip for everyone, with no server
 * coordination required.
 */
export function getTipOfTheDay(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();
  // FNV-1a 32-bit over the UTC date string — same hash style the daily
  // challenge uses, so the tip rotates in lockstep with the daily seed.
  const date = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < date.length; i++) {
    h ^= date.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const idx = (h >>> 0) % TIPS.length;
  return TIPS[idx]!;
}
