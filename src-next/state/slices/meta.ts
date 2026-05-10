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

// All constellations are seeded as unlocked while the gameplay-side
// unlock-grant logic is still TBD. Codex tabs already render a `???`
// locked state for any id not present here, so flipping this to a smaller
// list (or `[]`) re-enables locking without further code changes.
export const SEEDED_UNLOCKS: string[] = [
  'lyra',
  'mensa',
  'triumvirate',
  'argo',
  'fibonacci',
  'eclipse',
  'polyhedra',
  'ophiuchus',
];

// Galaxy consumables ship as Codex-discovered from day one. They only
// appear in Galaxy Packs (Celestial / Stellar / Galactic) — never in
// the everyday consumable shop pool — so the discovery loop that works
// for catalysts/mods/vouchers (each item is offered before it's bought)
// never naturally fires for galaxies. Pre-seeding their IDs keeps the
// codex honest: the player can browse the full Galaxy Pack contents
// from the moment they install the game.
//
// Imported from the runtime registry so adding a new galaxy to
// GALAXIES automatically extends this list — no second authorship site.
import { GALAXIES } from '../../core/consumables/galaxies';
export const SEEDED_DISCOVERED_CONSUMABLES: string[] = GALAXIES.map((g) => g.id);

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
});
