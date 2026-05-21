// src-next/app/hud/VoidHudBadge.tsx
// Top-right HUD badge shown during a void run. Surfaces the run's seed
// (hex), the deterministic run alias, and whether the seed is leaderboard-
// certified (Phase 8 will populate certified=true for the daily certified
// seed). Sits above the VoidOverlay (z-40) so it stays readable.

import React from 'react';

type Props = {
  seed: number;
  alias: string;
  certified: boolean;
};

export function VoidHudBadge({ seed, alias, certified }: Props) {
  const hex = (seed >>> 0).toString(16).padStart(8, '0');
  return (
    <div
      className="fixed top-2 right-2 z-40 text-xs font-mono text-violet-200/80
                 px-2 py-1 rounded bg-black/40 backdrop-blur-sm select-none"
      data-testid="void-hud-badge"
    >
      <span>seed: {hex}</span>
      <span className="mx-1">·</span>
      <span>{alias}</span>
      <span className="mx-1">·</span>
      {certified ? (
        <span className="text-emerald-300">Certified</span>
      ) : (
        <span className="text-amber-300">Uncertified — variance high</span>
      )}
    </div>
  );
}
