import { useEffect } from 'react';
import { bus } from '../bus';
import type { GameEventMap } from '../types';

export function useEvent<K extends keyof GameEventMap>(
  key: K,
  fn: (payload: GameEventMap[K]) => void,
  deps: unknown[] = [],
): void {
  useEffect(() => bus.on(key, fn), [key, ...deps]);
}
