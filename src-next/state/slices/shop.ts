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

export type ShopSlice = {
  open: boolean;
  offers: ShopOffer[];
  rerollCost: number;
  pendingPack: PendingPack | null;
};

export const initialShopSlice = (): ShopSlice => ({
  open: false,
  offers: [],
  rerollCost: 5,
  pendingPack: null,
});
