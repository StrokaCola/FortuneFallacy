import { useEffect, useState } from 'react';
import { bus } from '../events/bus';
import type { GameEventMap } from '../events/types';

type Entry = { t: number; key: keyof GameEventMap; payload: unknown };

const RING_SIZE = 200;

export function EventLogger() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [paused, setPaused]   = useState(false);
  const [filter, setFilter]   = useState('');

  useEffect(() => {
    if (paused) return;
    return bus.onAny((key, payload) => {
      setEntries((prev) => {
        const next = prev.length >= RING_SIZE ? prev.slice(1) : prev.slice();
        next.push({ t: performance.now(), key, payload });
        return next;
      });
    });
  }, [paused]);

  const visible = filter
    ? entries.filter((e) => String(e.key).toLowerCase().includes(filter.toLowerCase()))
    : entries;

  return (
    <div className="absolute right-2 bottom-2 w-[420px] max-h-[260px] flex flex-col
                    bg-cosmos-900/90 ring-1 ring-cosmos-300/30 rounded-lg
                    text-xs font-mono text-cosmos-50 backdrop-blur">
      <div className="flex gap-2 p-2 border-b border-cosmos-300/20 items-center">
        <span className="font-bold">events</span>
        <input
          className="flex-1 px-2 py-1 bg-cosmos-800 rounded outline-none"
          placeholder="filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          onClick={() => setPaused((p) => !p)}
          className="px-2 py-1 bg-cosmos-700 hover:bg-cosmos-600 rounded">
          {paused ? 'resume' : 'pause'}
        </button>
        <button
          onClick={() => setEntries([])}
          className="px-2 py-1 bg-cosmos-700 hover:bg-cosmos-600 rounded">
          clear
        </button>
      </div>
      <div className="overflow-auto flex-1 p-2 space-y-1">
        {visible.slice().reverse().map((e, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-cosmos-300/70">{(e.t / 1000).toFixed(2)}s</span>
            <span className="text-astral">{String(e.key)}</span>
            <span className="text-cosmos-100/60 truncate">{JSON.stringify(e.payload)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
