// First-run onboarding registry. Each entry maps a coachmark id to:
//   - the screen it appears on
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
  | 'scaling_mod_first';

export type CoachmarkSide = 'above' | 'below';

export interface CoachmarkDef {
  id: CoachmarkId;
  screen: Screen;
  anchor: string; // data-coach="..." selector value
  side: CoachmarkSide;
  text: string;
  requires?: (s: GameState) => boolean;
}

export const COACHMARKS: CoachmarkDef[] = [
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
  {
    id: 'shop_offers',
    screen: 'shop',
    anchor: 'shop-offers',
    side: 'above',
    text: 'Spend shards on catalysts and mods. They alter how your dice score for the rest of the run.',
  },
  {
    id: 'hub_blinds',
    screen: 'hub',
    anchor: 'hub-blinds',
    side: 'above',
    text: 'Pick the next blind. Skip for a tag bonus. Bosses bring debuffs — plan accordingly.',
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
    requires: (s) => s.run.diceMods.some((row) =>
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
      })
    ),
  },
];

export function pickActiveCoachmark(
  s: GameState,
): CoachmarkDef | null {
  const onb = s.meta.onboarding ?? { seen: [], dismissed: false };
  if (onb.dismissed) return null;
  for (const c of COACHMARKS) {
    if (c.screen !== s.ui.screen) continue;
    if (onb.seen.includes(c.id)) continue;
    if (c.requires && !c.requires(s)) continue;
    return c;
  }
  return null;
}
