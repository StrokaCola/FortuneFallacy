// Maps "spawning" events to the approximate stage coords where their
// visual effect lands. Mirrors the spawn math in Particles.tsx and the
// toast components. Acceptable drift — this is a dev tool, so when the
// underlying spawn moves, update this map too.
//
// Returns null when the event isn't tracked (the heatmap will skip it).

import { getStageSize } from '../../render/stage';
import type { GameEventMap } from '../../events/types';

export type SpawnHit = { x: number; y: number };

export const SPAWN_EVENT_KEYS = [
  'onComboDetected',
  'onUpgradeTriggered',
  'onScoreBeat',
  'onAchievementUnlocked',
  'onSellTrigger',
  'onBlindCleared',
  'onBossRevealed',
  'onHotStreak',
  'onModFired',
  'onDustEarned',
] as const satisfies readonly (keyof GameEventMap)[];

export type SpawnEventKey = (typeof SPAWN_EVENT_KEYS)[number];

export function isSpawnEvent(k: keyof GameEventMap): k is SpawnEventKey {
  return (SPAWN_EVENT_KEYS as readonly string[]).includes(k as string);
}

export function locateSpawn(
  key: keyof GameEventMap,
  payload: unknown,
): SpawnHit | null {
  const { w, h } = getStageSize();
  switch (key) {
    case 'onComboDetected':
      return { x: w / 2, y: h / 2 - 80 };
    case 'onUpgradeTriggered':
      return { x: w / 2, y: h * 0.5 };
    case 'onScoreBeat': {
      const beat = (payload as { beat?: { kind: string; dieIdx?: number } }).beat;
      if (!beat) return { x: w / 2, y: h / 2 };
      if (beat.kind === 'mult-slam') return { x: w / 2, y: h / 2 };
      if (beat.kind === 'die-tick' && typeof beat.dieIdx === 'number') {
        return { x: w * (0.2 + 0.15 * beat.dieIdx), y: h * 0.65 };
      }
      if (beat.kind === 'boom' || beat.kind === 'cross-target') {
        return { x: w / 2, y: h / 2 };
      }
      return { x: w / 2, y: h * 0.6 };
    }
    case 'onAchievementUnlocked':
      return { x: w - 180, y: 80 };
    case 'onSellTrigger':
      return { x: w / 2, y: h * 0.4 };
    case 'onBlindCleared':
    case 'onBossRevealed':
    case 'onHotStreak':
      return { x: w / 2, y: h / 2 };
    case 'onModFired': {
      const dieIdx = (payload as { dieIdx?: number }).dieIdx ?? 0;
      return { x: w * (0.2 + 0.15 * dieIdx), y: h * 0.65 };
    }
    case 'onDustEarned':
      return { x: w / 2, y: h - 80 };
    default:
      return null;
  }
}
