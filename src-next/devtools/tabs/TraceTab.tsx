import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import type { GameEventMap } from '../../events/types';
import type { DevTab } from './index';

type TraceEntry = {
  id: number;
  ts: number;
  key: keyof GameEventMap;
  payload: unknown;
};

const CAP = 100;

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function TraceTabView() {
  const bufRef = useRef<TraceEntry[]>([]);
  const idRef = useRef(0);
  const pausedRef = useRef(false);
  const [, force] = useState(0);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const off = bus.onAny((key, payload) => {
      if (pausedRef.current) return;
      const buf = bufRef.current;
      buf.push({ id: ++idRef.current, ts: Date.now(), key, payload });
      if (buf.length > CAP) buf.splice(0, buf.length - CAP);
      force((n) => n + 1);
    });
    return off;
  }, []);

  const clear = () => {
    bufRef.current = [];
    setExpanded(null);
    force((n) => n + 1);
  };

  const f = filter.trim().toLowerCase();
  const visible = f === ''
    ? bufRef.current
    : bufRef.current.filter((e) => String(e.key).toLowerCase().includes(f));

  return (
    <div className="space-y-2">
      <div className="flex gap-1 items-center">
        <input
          className="px-1 bg-cosmos-900 flex-1"
          placeholder="filter (substring on event key)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          onClick={() => setPaused((p) => !p)}
          className={`px-2 py-1 rounded ${paused ? 'bg-amber-700' : 'bg-cosmos-700 hover:bg-cosmos-600'}`}
        >
          {paused ? 'resume' : 'pause'}
        </button>
        <button
          onClick={clear}
          className="px-2 py-1 bg-cosmos-800 hover:bg-cosmos-700 rounded"
        >
          clear
        </button>
      </div>

      <div className="text-[10px] text-cosmos-300">
        {bufRef.current.length}/{CAP} events
        {f && ` — ${visible.length} match`}
      </div>

      {visible.length === 0 ? (
        <div className="text-cosmos-300 text-[11px]">no events captured</div>
      ) : (
        <div className="space-y-0.5 max-h-[40vh] overflow-auto">
          {visible.slice().reverse().map((e) => (
            <div key={e.id} className="text-[11px]">
              <button
                onClick={() => setExpanded((id) => (id === e.id ? null : e.id))}
                className="w-full text-left px-1 py-0.5 hover:bg-cosmos-800 rounded flex gap-2"
              >
                <span className="text-cosmos-300">{fmtTime(e.ts)}</span>
                <span className="font-bold">{String(e.key)}</span>
              </button>
              {expanded === e.id && (
                <pre className="ml-4 px-2 py-1 bg-cosmos-900 rounded whitespace-pre-wrap break-all text-[10px]">
                  {JSON.stringify(e.payload, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const traceTab: DevTab = {
  id: 'trace',
  label: 'trace',
  render: () => <TraceTabView />,
};
