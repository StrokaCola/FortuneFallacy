// First-run onboarding registry. Each entry maps a coachmark id to:
//   - the screen(s) it appears on
//   - the DOM `data-coach` anchor it points at
//   - the copy and (optional) arrow direction
//   - an optional `requires` predicate that gates display on round/run state
//
// CoachmarkController picks the first entry on the current screen whose
// `requires` is satisfied AND whose id is not in meta.onboarding.seen.
// Order in this array is the show order — keep the most-fundamental
// coachmarks first.
//
// Add new coachmarks here; no other file needs changes (other than the
// `data-coach` attribute on the anchor element, if it doesn't already exist).
//
// 2026-05-14 expansion (per the studio review's Player Experience dept):
// 12 new contextual hints that surface FortuneFallacy-specific systems
// (voidstorms, boss debuffs, editions, vouchers, consumables, mods,
// chain mult, resonances, dust, astral perks, skip bounty,
// constellation choice). Tripled the coachmark count from 6 → 18 so
// the unique mechanics get explained the first time the player meets
// them, instead of hoping they tooltip-dive.

import type { Screen } from '../../state/slices/ui';
import type { GameState } from '../../state/store';
import { SCALING_CATALYST_IDS } from '../../data/catalysts';
import { lookupMod } from '../../core/mods';

export type CoachmarkId =
  | 'round_roll'
  | 'round_lock'
  | 'shop_offers'
  | 'hub_blinds'
  // 2026-05-11 scaling pack onboarding. Fires the first time the player
  // owns a catalyst or mod from the scaling family, so the counter
  // mechanic surfaces without tooltip-diving. Anchored to the
  // CatalystStrip / Forge respectively.
  | 'scaling_catalyst_first'
  | 'scaling_mod_first'
  // 2026-05-14 expansion — the 12 FortuneFallacy-specific hints.
  | 'constellation_select'
  | 'first_voidstorm'
  | 'first_chain'
  | 'first_edition'
  | 'first_voucher'
  | 'first_consumable'
  | 'first_mod'
  | 'first_resonance'
  | 'first_boss_debuff'
  | 'first_skip_bounty'
  | 'first_dust_earned'
  | 'astral_forge_first'
  // 2026-05-19 — gap-fillers for players who decline the guided tour.
  // Each covers a mechanic the scripted tour teaches but the prior 18
  // didn't surface organically. See app/onboarding/tutorial/.
  | 'free_reroll_first'
  | 'free_play_hand_first'
  | 'shop_reroll_first'
  | 'shop_continue_first';

export type CoachmarkSide = 'above' | 'below';

export interface CoachmarkDef {
  id: CoachmarkId;
  // Single screen or any-of-these screens. Lets a coachmark fire on
  // both the win and fail postmortem variants without duplicating
  // the entry.
  screen: Screen | readonly Screen[];
  anchor: string; // data-coach="..." selector value
  side: CoachmarkSide;
  text: string;
  requires?: (s: GameState) => boolean;
}

// Tiny helper: lookups for "is this catalyst id a scaling catalyst?",
// "does this mod have a per-stack tally field?", etc. Pulled out so
// the predicates below stay readable.
function ownsAnyEdition(s: GameState): boolean {
  const editions = s.run.catalystEditions ?? {};
  return Object.keys(editions).length > 0;
}

function ownsAnyMod(s: GameState): boolean {
  return s.run.diceMods.some((row) => row.length > 0);
}

function ownsAnyScalingMod(s: GameState): boolean {
  return s.run.diceMods.some((row) =>
    row.some((id) => {
      const def = lookupMod(id);
      return !!(
        def?.tallyChipPerStack ||
        def?.cadenceMultPerStack ||
        def?.veteranMultPerStack ||
        def?.gluttonChipPerStack ||
        def?.dormantAwakenAt != null ||
        def?.ballastChipPerStack ||
        def?.pyreChipPerStack
      );
    }),
  );
}

export const COACHMARKS: CoachmarkDef[] = [
  // ── Constellation choice (fires on the very first run, before round_roll) ─
  {
    id: 'constellation_select',
    screen: 'constellation_select',
    anchor: 'constellation-grid',
    side: 'above',
    text: 'Pick a sky. Each constellation rewrites a rule of the table — Mensa adds dice, Argo changes scoring, Eclipse zeros faces. You can swap on the next run.',
  },

  // ── Round-screen fundamentals (existing) ────────────────────────────
  {
    id: 'round_roll',
    screen: 'round',
    anchor: 'roll-btn',
    side: 'above',
    text: 'Tap Roll to throw the dice. You have a few hands per blind — beat the target before they run out.',
  },
  {
    id: 'round_lock',
    screen: 'round',
    anchor: 'dice-tray',
    side: 'above',
    // Fires only after the first roll has resolved, so the player can
    // see actual dice values when reading this hint.
    text: 'Tap any die to lock its face. Locked dice keep their value when you re-roll.',
    requires: (s) => s.round.firstRollDone,
  },

  // ── Round-screen, FortuneFallacy-specific systems ───────────────────
  {
    id: 'first_voidstorm',
    screen: 'round',
    anchor: 'voidstorm-badge',
    side: 'below',
    text: 'A voidstorm is in effect this blind — a tilt the cosmos applies to every hand. Read the chip; the storm is honest.',
    requires: (s) => s.round.voidstormId != null,
  },
  {
    id: 'first_chain',
    screen: 'round',
    anchor: 'dice-tray',
    side: 'above',
    text: 'You just chained a hand-tier — climbing the same-or-higher tier across consecutive hands raises a chain multiplier. Drop a tier and the chain resets.',
    requires: (s) => s.round.chainLen >= 2,
  },
  {
    id: 'first_edition',
    screen: 'round',
    anchor: 'catalyst-strip',
    side: 'below',
    text: 'A catalyst with an edition stamp pays more — foil adds chips, holographic adds mult, polychrome adds 50% of its own contribution, void costs zero slots.',
    requires: ownsAnyEdition,
  },
  {
    id: 'first_voucher',
    screen: 'round',
    anchor: 'voucher-strip',
    side: 'below',
    text: 'Vouchers are run-wide buys — extra slots, lower prices, more rerolls. They persist until the run ends; sell to roll back.',
    requires: (s) => s.run.vouchers.length >= 1,
  },
  {
    id: 'first_consumable',
    screen: 'round',
    anchor: 'consumable-tray',
    side: 'above',
    text: 'Consumables are single-use. Galaxies level up a hand type permanently for the run; spectrals are one-shot powerups.',
    requires: (s) => s.run.consumables.length >= 1,
  },
  {
    id: 'first_mod',
    screen: 'round',
    anchor: 'dice-tray',
    side: 'above',
    text: 'A mod is now attached to one of your dice. It fires every time that die is part of a scoring hand. Manage attachments in the Forge between blinds.',
    requires: ownsAnyMod,
  },
  {
    id: 'first_resonance',
    screen: 'round',
    anchor: 'catalyst-strip',
    side: 'below',
    text: 'A resonance just fired — two of your catalysts share a hand-authored synergy. Discovered pairs land in the Codex; they pay extra every time both fire together.',
    requires: (s) => (s.meta.discovered.resonances ?? []).length >= 1,
  },
  {
    id: 'first_boss_debuff',
    screen: 'round',
    anchor: 'boss-badge',
    side: 'below',
    text: 'Boss debuffs change the rules for this trial only — they lift when you clear. Some bosses have a Phase 2 that fires mid-blind: watch the banner.',
    requires: (s) => s.round.isBoss,
  },

  // ── Hub: skip bounty ────────────────────────────────────────────────
  {
    id: 'hub_blinds',
    screen: 'hub',
    anchor: 'hub-blinds',
    side: 'above',
    text: 'Pick the next blind. Skip for a tag bonus. Bosses bring debuffs — plan accordingly.',
  },
  {
    id: 'first_skip_bounty',
    screen: 'hub',
    anchor: 'skip-button',
    side: 'above',
    text: 'Skipping a non-boss trial earns a skip bounty — shards, a consumable, or a catalyst — instead of letting you score. Boss trials can\'t be skipped.',
  },

  // ── Shop ────────────────────────────────────────────────────────────
  // 2026-05-18 P3: text rewritten to explicitly bridge the hub→shop
  // transition. Pre-audit copy assumed the player knew they'd arrived
  // at a new screen; new copy names the screen + the loop ("clear a
  // trial → shop opens → spend shards → next trial").
  {
    id: 'shop_offers',
    screen: 'shop',
    anchor: 'shop-offers',
    side: 'above',
    text: 'Trial cleared — welcome to the shop. Spend shards on catalysts, mods, and consumables. They reshape how your dice score for the rest of the run. Hit Continue to head into the next trial.',
  },

  // ── Scaling-pack onboarding (2026-05-11) ────────────────────────────
  {
    id: 'scaling_catalyst_first',
    screen: 'round',
    anchor: 'catalyst-strip',
    side: 'below',
    text: 'This catalyst grows as you play. Watch the corner counter — every matching combo bakes a permanent bonus into the card.',
    requires: (s) => s.run.catalysts.some((id) => SCALING_CATALYST_IDS.has(id)),
  },
  {
    id: 'scaling_mod_first',
    screen: 'forge',
    anchor: 'scaling-mod-chip',
    side: 'above',
    text: 'This mod stacks per-die. The chip on the right shows what it has accrued so far — and it survives across blinds.',
    requires: ownsAnyScalingMod,
  },

  // ── Postmortem: dust earned (fires on first win OR first bust that grants dust) ─
  {
    id: 'first_dust_earned',
    // Both win and fail screens render the Postmortem with the dust
    // stat, and the player will hit one before the other. Multi-screen
    // entry so whichever they see first carries the hint.
    screen: ['fail', 'win'],
    anchor: 'dust-stat',
    side: 'below',
    text: 'Cosmic Dust persists across runs. Spend it in the Astral Forge to unlock perks that stack on every future run.',
    requires: (s) => (s.run.runStats?.dustEarned ?? 0) > 0,
  },

  // ── Astral Forge ────────────────────────────────────────────────────
  {
    id: 'astral_forge_first',
    screen: 'astral_forge',
    anchor: 'perk-grid',
    side: 'above',
    text: 'Astral perks are permanent edges that apply to every future run. Spend dust to unlock; the effects compound as you stack more.',
  },
  // ── 2026-05-19 gap-fillers (after the 18 organic hints) ─────────────
  // These cover mechanics the scripted guided tour teaches but the
  // existing entries don't. Filed at the tail so they only surface
  // when no higher-priority coachmark is eligible — i.e. once the
  // player has dismissed the more specific hints, or they don't apply
  // to the current state.
  {
    id: 'free_reroll_first',
    screen: 'round',
    anchor: 'reroll-btn',
    side: 'above',
    text: 'Reroll the unlocked dice. Locked dice keep their face — chase the combo you want, then play the hand.',
    requires: (s) => s.round.firstRollDone && s.round.rerollsLeft >= 1 && s.run.handsPlayed === 0,
  },
  {
    id: 'free_play_hand_first',
    screen: 'round',
    anchor: 'play-hand-btn',
    side: 'above',
    text: 'Tap Play Hand to lock in the score. Catalysts and mods fire on every scored hand.',
    requires: (s) => s.round.firstRollDone && s.run.handsPlayed === 0 && !s.round.scoring,
  },
  {
    id: 'shop_reroll_first',
    screen: 'shop',
    anchor: 'shop-reroll',
    side: 'above',
    text: 'Reroll the shop for new offers. Costs creep up each time you spin within the same shop — save it for runs that need the lift.',
    requires: (s) => (s.run.shopSeq ?? 0) >= 1,
  },
  {
    id: 'shop_continue_first',
    screen: 'shop',
    anchor: 'next-trial-btn',
    side: 'above',
    text: 'When you\'re ready, tap Next Trial. Nothing in the shop is required — you can move on with shards in pocket.',
  },
];

export function pickActiveCoachmark(
  s: GameState,
): CoachmarkDef | null {
  const onb = s.meta.onboarding ?? { seen: [], dismissed: false };
  if (onb.dismissed) return null;
  // Guided tour owns the screen while active — coachmarks would
  // visually fight the tutorial bubble and steal the teaching beat.
  // The 18+ organic hints resume the moment the tour ends.
  if (s.tutorial?.active) return null;
  // The opt-in modal also owns the screen — suppress hub_blinds /
  // constellation_select etc. while the player is making the
  // tutorial-yes-or-no decision.
  if (s.tutorial?.optInPending) return null;
  const screen = s.ui.screen;
  for (const c of COACHMARKS) {
    const matches = Array.isArray(c.screen)
      ? c.screen.includes(screen)
      : c.screen === screen;
    if (!matches) continue;
    if (onb.seen.includes(c.id)) continue;
    if (c.requires && !c.requires(s)) continue;
    return c;
  }
  return null;
}
