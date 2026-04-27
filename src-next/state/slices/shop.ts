import type { ShopOffer } from '../../events/types';

export type ShopSlice = {
  open: boolean;
  offers: ShopOffer[];
  rerollCost: number;
};

export const initialShopSlice = (): ShopSlice => ({
  open: false,
  offers: [],
  rerollCost: 5,
});
