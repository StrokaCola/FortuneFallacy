import { useMemo, useState } from 'react';
import { clearSpawnLog, setInspector, useInspectorState } from '../inspector/store';
import { SPAWN_EVENT_KEYS } from '../inspector/spawnLocator';
import type { DevTab } from './index';

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function EffectsTabView() {
  const overlayOn = useInspectorState((s) => s.effectsOverlayOn);
  const log = useInspectorState((s) => s.spawnLog);
  const [filters, setFilters] = useState<Set<string>>(new Set(SPAWN_EVENT_KEYS));

  const toggle = (k: string) => {
    setFilters((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const visible = useMemo(
    () => log.filter((e) => filters.has(e.key)).slice().reverse(),
    [log, filters],
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-1 items-center">
        <label className="flex items-center gap-1 text-[11px]">
          <input
            type="checkbox"
            checked={overlayOn}
            onChange={(e) => setInspector({ effectsOverlayOn: e.target.checked })}
          />
          <span>show heatmap overlay</span>
        </label>
        <button
          onClick={clearSpawnLog}
          className="ml-auto px-2 py-0.5 bg-cosmos-800 hover:bg-cosmos-700 rounded text-[10px]"
        >
          clear
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {SPAWN_EVENT_KEYS.map((k) => (
          <label key={k} className="flex items-center gap-1 text-[10px] px-1 py-0.5 bg-cosmos-800/60 rounded">
            <input
              type="checkbox"
              checked={filters.has(k)}
              onChange={() => toggle(k)}
            />
            <span>{k}</span>
          </label>
        ))}
      </div>

      <div className="text-[10px] text-cosmos-300">
        {visible.length}/{log.length} spawns shown
      </div>

      {visible.length === 0 ? (
        <div className="text-cosmos-300 text-[11px]">no spawns captured. emit one from the emit tab.</div>
      ) : (
        <div className="space-y-0.5 max-h-[40vh] overflow-auto">
          {visible.map((e) => (
            <div key={e.id} className="text-[11px] flex gap-2 px-1 py-0.5 hover:bg-cosmos-800 rounded">
              <span className="text-cosmos-300">{fmtTime(e.ts)}</span>
              <span className="font-bold flex-1 truncate">{e.key}</span>
              <span className="text-cosmos-300">{Math.round(e.x)},{Math.round(e.y)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const effectsTab: DevTab = {
  id: 'effects',
  label: 'effects',
  render: () => <EffectsTabView />,
};
