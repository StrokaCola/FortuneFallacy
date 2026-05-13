import type { ShopOffer } from '../../events/types';

// When a pack is purchased it opens an overlay flow. While `pendingPack`
// is non-null the shop UI is blocked by the pack picker — buying or
// rerolling is disabled until the player picks or skips. Picks immediately
// apply the chosen galaxy (no inventory cost) — see actions/handlers/shop.ts.
export type PendingPack = {
  kind: string;            // celestial | stellar | galactic
  galaxyIds: string[];     // 2-4 galaxy ids rolled at open time
  picksLeft: number;       // remaining picks before the pack closes
  pickedSoFar: string[];   // ids the player has already picked
  // Snapshot of meta.unlocks AT THE MOMENT the pack opened. The PackOverlay
  // uses this to render galaxies the player hasn't seen before as `???`
  // for the discovery beat — even though `openPack` immediately writes the
  // ids into meta.unlocks (so the codex is up-to-date), the snapshot
  // preserves "did the player know this when they cracked the pack?"
  unlockedAtOpen: string[];
};

// Pillar G (Skip-Reward Variety) — when the player skips a non-boss
// blind, they get to choose ONE of 3 bounty options instead of
// receiving a flat shard payout. The pending state lives on shop
// because the modal mounts alongside PackOverlay and shares the same
// "blocking decision" semantics.
export type SkipBountyOption =
  | { kind: 'shards'; amount: number; label: string }
  | { kind: 'consumable'; consumableId: string; label: string }
  | { kind: 'catalyst'; catalystId: string; label: string }
  | { kind: 'pack'; packKind: string; label: string };

export type PendingSkipBounty = {
  options: SkipBountyOption[];
  // Stake the skipped trial so the modal can label it ("Trial 2 bounty").
  blindIdx: number;
};

export type ShopSlice = {
  open: boolean;
  offers: ShopOffer[];
  rerollCost: number;
  pendingPack: PendingPack | null;
  // Set by skipBlind() when the player skips a non-boss trial. Cleared
  // by RESOLVE_SKIP_BOUNTY when the player picks an option. While set,
  // the SkipBountyModal blocks input (same shape as pendingPack).
  pendingSkipBounty: PendingSkipBounty | null;
};

export const initialShopSlice = (): ShopSlice => ({
  open: false,
  offers: [],
  rerollCost: 5,
  pendingPack: null,
  pendingSkipBounty: null,
});
