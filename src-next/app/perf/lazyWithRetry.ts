// Wraps a React.lazy factory with one retry and a single auto-reload to
// recover from the most common deployed-SPA failure mode: a tab that
// loaded the previous index.html keeps a reference to a chunk filename
// (Vite content-hashes chunks like Forge-DF-d9Z1y.js) that no longer
// exists after a redeploy. The dynamic import then 404s and Suspense
// surfaces a `Failed to fetch dynamically imported module` error.
//
// Recovery strategy:
//   1. First failure  -> wait 400 ms and retry once (transient blip).
//   2. Second failure -> if we have NOT already reloaded for this key in
//      this tab, set a sessionStorage flag and reload. The fresh
//      index.html will reference current hashes and the next import
//      resolves.
//   3. If the flag is already set we reject normally so a genuinely
//      broken chunk does not reload-loop. The ErrorBoundary upstream
//      renders a manual-reload fallback in that case.
//
// `clearLazyReloadFlag(key)` is called from the lazy component's
// successful first mount so future stale-chunk events in the same tab
// are allowed to recover again.

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

type Factory<T extends ComponentType<unknown>> = () => Promise<{ default: T }>;

const RELOAD_FLAG_PREFIX = 'ff:lazyReload:';
const RETRY_DELAY_MS = 400;

function isChunkLoadError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message;
  return (
    m.includes('Failed to fetch dynamically imported module') ||
    m.includes('error loading dynamically imported module') ||
    m.includes('Importing a module script failed')
  );
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  key: string,
  factory: Factory<T>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (first) {
      if (!isChunkLoadError(first)) throw first;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      try {
        return await factory();
      } catch (second) {
        if (!isChunkLoadError(second)) throw second;
        const flag = `${RELOAD_FLAG_PREFIX}${key}`;
        try {
          if (sessionStorage.getItem(flag) !== '1') {
            sessionStorage.setItem(flag, '1');
            window.location.reload();
            // Suspend forever; the reload tears the tab down before
            // React can read this rejection.
            return await new Promise<{ default: T }>(() => {});
          }
        } catch {
          // sessionStorage unavailable (private mode / disabled) — fall
          // through and let the ErrorBoundary handle it.
        }
        throw second;
      }
    }
  });
}

export function clearLazyReloadFlag(key: string): void {
  try { sessionStorage.removeItem(`${RELOAD_FLAG_PREFIX}${key}`); } catch { /* noop */ }
}
