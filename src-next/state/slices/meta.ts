export type MetaSlice = {
  playerName: string;
  unlocks: string[];
  highScores: { name: string; score: number; date: number }[];
  // Highest cleared stake id per constellation. Indexes into data/stakes.ts STAKES.
  // A constellation present here with stake 'ember' means the player has cleared
  // Ember on that constellation and can now attempt Pyre.
  // Default empty → only Spark is unlocked (the first stake).
  stakeProgress: Record<string, string>;
  // Set of completed challenge ids. Persisted so the codex can render badges.
  challengeWins: string[];
  // Set of catalyst/mod/voucher/boss ids the player has encountered.
  // Used by the Codex to silhouette undiscovered entries.
  discovered: {
    catalysts: string[];
    mods: string[];
    vouchers: string[];
    bosses: string[];
    consumables: string[];
  };
  // 2026-05-11 easter egg discovery log. Each entry is a stable id from
  // EASTER_EGGS in data/easterEggs.ts. Persisted across runs so the codex
  // can show "FOUND" badges and reveal the hint text (vs the unknown
  // placeholder). Treat as append-only — never remove an entry.
  easterEggs?: string[];
  // Cosmic Dust: meta-currency awarded per blind clear / run end. Persists
  // across runs. Spent at the Astral Forge on permanent perks. See
  // data/astralPerks.ts and core/round/transitions.ts (award sites).
  cosmicDust: number;
  // Lifetime dust earned (never decremented on spend). Used for prestige
  // milestones in the Astral Forge.
  cosmicDustLifetime: number;
  // Ids of unlocked Astral Perks. Each perk is a one-time purchase that
  // applies a permanent passive effect to all future runs. See
  // core/run/applyAstralPerks.ts for the apply layer.
  astralPerks: string[];
  // First-run onboarding. `seen` is the list of coachmark ids the player
  // has dismissed; `dismissed` short-circuits all coachmarks (Skip All).
  // Settings exposes a "Replay tutorial" affordance that resets both fields.
  // See app/onboarding/coachmarks.ts for the registry.
  onboarding: {
    seen: string[];
    dismissed: boolean;
  };
  // Daily Challenge history. Keyed by 'YYYY-MM-DD' (UTC), so today's
  // entry tells the Title screen whether the daily has already been
  // attempted. Best score for the day overwrites previous attempts;
  // `cleared` flips true on the first successful win. See
  // online/dailyChallenge.ts and core/round/transitions.ts.
  dailyHistory: Record<string, {
    score: number;
    cleared: boolean;
    ante: number;
    constellation: string;
    stake: string;
    playedAt: number;
  }>;
  // Achievements ("Ascensions"). Each entry is the id of an unlocked
  // achievement; the data table lives in data/achievements.ts. The
  // listener in core/achievements/listener.ts subscribes to bus events
  // and dispatches UNLOCK_ACHIEVEMENT when a predicate fires. Already-
  // unlocked ids are deduped at dispatch time. Each unlock grants
  // cosmic dust per the table.
  achievements: {
    unlocked: string[];
    // Last unlock timestamp keyed by id — drives the Codex sort and
    // can support a "recently unlocked" surface in the future.
    unlockedAt: Record<string, number>;
  };
  // Daily login comet — last UTC date the player saw the daily-login
  // grant. When today's date is newer, the next visit fires the
  // celebration once and grants +5 cosmic dust. Pure retention loop;
  // 5 dust is nominal so the goal is the click, not the value.
  dailyLogin: {
    lastDate: string | null; // 'YYYY-MM-DD' UTC, null if never
  };
};

// Import maneuvers up-front so the seed lists below can both reference
// them. Galaxies + maneuvers both register their IDs across the
// `unlocks` (pack-overlay `???` gate) and `discovered.consumables`
// (codex unlock state) lists; defining them here keeps the seed
// authorship in one place.
import { MANEUVERS } from '../../core/consumables/maneuvers';

// All constellations are seeded as unlocked while the gameplay-side
// unlock-grant logic is still TBD. Codex tabs already render a `???`
// locked state for any id not present here, so flipping this to a smaller
// list (or `[]`) re-enables locking without further code changes.
//
// Maneuver IDs are appended so the PackOverlay (which reads from a
// snapshot of `meta.unlocks` at pack-open time) renders maneuvers with
// their real name + icon instead of `???`. Galaxy packs intentionally
// keep the discovery beat — maneuvers are the utilitarian tactical
// category and don't benefit from being hidden behind a reveal.
export const SEEDED_UNLOCKS: string[] = [
  'lyra',
  'mensa',
  'triumvirate',
  'argo',
  'fibonacci',
  'eclipse',
  'polyhedra',
  'ophiuchus',
  ...MANEUVERS.map((m) => m.id),
];

// Galaxy + maneuver consumables ship as Codex-discovered from day one.
// They only appear in their respective packs (Celestial / Stellar /
// Galactic for galaxies; Maneuver Packs for maneuvers) — never in
// the everyday consumable shop pool — so the discovery loop that works
// for catalysts/mods/vouchers (each item is offered before it's bought)
// never naturally fires for them. Pre-seeding their IDs keeps the
// codex honest: the player can browse the full pack contents
// from the moment they install the game.
//
// Imported from the runtime registries so adding a new galaxy or
// maneuver automatically extends this list — no second authorship site.
// (MANEUVERS is already imported above for SEEDED_UNLOCKS.)
import { GALAXIES } from '../../core/consumables/galaxies';
export const SEEDED_DISCOVERED_CONSUMABLES: string[] = [
  ...GALAXIES.map((g) => g.id),
  ...MANEUVERS.map((m) => m.id),
];

export const initialMetaSlice = (): MetaSlice => ({
  playerName: '',
  unlocks: [...SEEDED_UNLOCKS],
  highScores: [],
  stakeProgress: {},
  challengeWins: [],
  discovered: {
    catalysts: [],
    mods: [],
    vouchers: [],
    bosses: [],
    consumables: [...SEEDED_DISCOVERED_CONSUMABLES],
  },
  cosmicDust: 0,
  cosmicDustLifetime: 0,
  astralPerks: [],
  onboarding: { seen: [], dismissed: false },
  dailyHistory: {},
  achievements: { unlocked: [], unlockedAt: {} },
  dailyLogin: { lastDate: null },
  easterEggs: [],
});
