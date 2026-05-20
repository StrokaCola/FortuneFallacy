import type { ConsumableDef } from './index';

// Maneuvers — tactical hand-shaping consumables. Flavor is orbital/aerospace
// (course corrections, telemetry, burns) so the category sits inside the
// cosmos theme without leaning on mysticism. Each maneuver targets either
// the active dice tray (a single die) or the round budget (hands/rerolls).
//
// Naming convention: short, two-word flight-control verbs. Icons are pulled
// from Unicode arrows and astronomical glyphs already present in the rest
// of the consumable tray, so the renderer doesn't need new sprites.

const COMPLEMENT: Record<number, number> = { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1 };

export const MANEUVERS: ConsumableDef[] = [
  {
    id: 'course_correction',
    type: 'maneuver',
    name: 'Course Correction',
    icon: '↺',
    description: 'Re-roll all unlocked dice. Does not consume a reroll.',
    requiresTarget: false,
    // Void Mode affix tags. Maneuvers are the tactical sibling of galaxies;
    // most reshape the round budget (extra hands, rerolls), so `timing` +
    // `utility` are the natural matches.
    rarity: 'rare',
    archetypeTags: ['timing', 'utility'],
    apply: (s) => {
      // Resample faces uniformly per-die based on its die spec range.
      // We use Math.random here intentionally — the player chose to spend
      // the consumable so non-deterministic feel matches the fiction.
      const dice = s.round.dice.map((d) => {
        if (d.locked) return d;
        // Best-effort range: assume 6-sided when face range is unknown to us
        // here. Specialised constellations cap to their face palette via the
        // simulation pipeline anyway; a plain 1..6 reseed is fine for a
        // mid-hand consumable.
        const face = 1 + Math.floor(Math.random() * 6);
        return { ...d, face };
      });
      return {
        state: { ...s, round: { ...s.round, dice, firstRollDone: true } },
        events: [],
      };
    },
  },
  {
    id: 'burn_pass',
    type: 'maneuver',
    name: 'Burn Pass',
    icon: '⤬',
    description: 'Flip one die to its complement face (1↔6, 2↔5, 3↔4).',
    requiresTarget: true,
    targetType: 'die',
    rarity: 'uncommon',
    archetypeTags: ['face', 'utility'],
    apply: (s, [idx]) => {
      if (idx == null || !s.round.dice[idx]) return { state: s, events: [] };
      const dice = s.round.dice.map((d, i) => {
        if (i !== idx) return d;
        const next = COMPLEMENT[d.face] ?? d.face;
        return { ...d, face: next };
      });
      return { state: { ...s, round: { ...s.round, dice } }, events: [] };
    },
  },
  {
    id: 'sync_up',
    type: 'maneuver',
    name: 'Sync Up',
    icon: '⇉',
    description: 'Copy the highest-face die onto one of your dice.',
    requiresTarget: true,
    targetType: 'die',
    rarity: 'uncommon',
    archetypeTags: ['combo', 'face'],
    apply: (s, [idx]) => {
      if (idx == null || !s.round.dice[idx]) return { state: s, events: [] };
      const highest = s.round.dice.reduce((m, d) => Math.max(m, d.face), 0);
      const dice = s.round.dice.map((d, i) => (i === idx ? { ...d, face: highest } : d));
      return { state: { ...s, round: { ...s.round, dice } }, events: [] };
    },
  },
  {
    id: 'thrust_boost',
    type: 'maneuver',
    name: 'Thrust Boost',
    icon: '⤴',
    description: '+1 hand this trial.',
    requiresTarget: false,
    apply: (s) => ({
      state: {
        ...s,
        round: {
          ...s.round,
          handsLeft: s.round.handsLeft + 1,
          handsMax: s.round.handsMax + 1,
        },
      },
      events: [],
    }),
  },
  {
    id: 'recoil_vent',
    type: 'maneuver',
    name: 'Recoil Vent',
    icon: '↻↻',
    description: '+2 rerolls this hand.',
    requiresTarget: false,
    apply: (s) => ({
      state: { ...s, round: { ...s.round, rerollsLeft: s.round.rerollsLeft + 2 } },
      events: [],
    }),
  },
  {
    id: 'rendezvous',
    type: 'maneuver',
    name: 'Rendezvous',
    icon: '⇌',
    description: 'Swap the faces of two dice.',
    requiresTarget: true,
    targetType: 'die',
    // Note: ConsumableTray currently arms a single-die select. To swap two,
    // the targets array can grow to length 2. We pick a sensible fallback
    // when the second target isn't supplied: swap with the next die index.
    apply: (s, targets) => {
      const a = targets[0];
      if (a == null || !s.round.dice[a]) return { state: s, events: [] };
      const b = targets[1] ?? (a + 1) % s.round.dice.length;
      const aFace = s.round.dice[a]!.face;
      const bFace = s.round.dice[b]?.face ?? aFace;
      const dice = s.round.dice.map((d, i) => {
        if (i === a) return { ...d, face: bFace };
        if (i === b) return { ...d, face: aFace };
        return d;
      });
      return { state: { ...s, round: { ...s.round, dice } }, events: [] };
    },
  },
];
