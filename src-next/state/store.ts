import { createStore } from 'zustand/vanilla';
import { useSyncExternalStore } from 'react';
import { initialRunSlice, type RunSlice } from './slices/run';
import { initialRoundSlice, type RoundSlice } from './slices/round';
import { initialShopSlice, type ShopSlice } from './slices/shop';
import { initialMetaSlice, type MetaSlice } from './slices/meta';
import { initialUiSlice, type UiSlice } from './slices/ui';

export type GameState = {
  run: RunSlice;
  round: RoundSlice;
  shop: ShopSlice;
  meta: MetaSlice;
  ui: UiSlice;
  pingCount: number;
};

const initialState = (): GameState => ({
  run:   initialRunSlice(),
  round: initialRoundSlice(),
  shop:  initialShopSlice(),
  meta:  initialMetaSlice(),
  ui:    initialUiSlice(),
  pingCount: 0,
});

export const store = createStore<GameState>(() => initialState());

export const getState = (): GameState => store.getState();
export const setStateRaw = (next: GameState | ((s: GameState) => GameState)): void => {
  store.setState(typeof next === 'function' ? (next as (s: GameState) => GameState)(store.getState()) : next, true);
};

export function useStore<T>(selector: (s: GameState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

export function resetStore(): void {
  setStateRaw(initialState());
}
