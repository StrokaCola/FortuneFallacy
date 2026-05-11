// Subscribes to the bus once and records spawn-y events into the
// inspector store. Independent of EffectsTab so capture continues
// while the dev console is closed (lets the heatmap show recent
// activity when you re-open it).

import { bus } from '../../events/bus';
import { isSpawnEvent, locateSpawn } from './spawnLocator';
import { pushSpawn } from './store';

let installed = false;
export function installSpawnRecorder(): void {
  if (installed) return;
  installed = true;
  bus.onAny((key, payload) => {
    if (!isSpawnEvent(key)) return;
    const hit = locateSpawn(key, payload);
    if (!hit) return;
    pushSpawn({ ts: Date.now(), key: String(key), x: hit.x, y: hit.y });
  });
}
