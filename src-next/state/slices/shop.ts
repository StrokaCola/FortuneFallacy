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
