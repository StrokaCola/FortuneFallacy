import { useState } from 'react';
import { useStore, type GameState } from '../state/store';
import { dispatch } from '../actions/dispatch';
import { getFlags, setFlag, type DevFlags } from './flags';

const stateSelector = (s: GameState) => s;

export function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab]   = useState<'state' | 'flags' | 'actions'>('state');
  const state = useStore(stateSelector);
  const flags = getFlags();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute top-2 right-2 px-3 py-1 bg-cosmos-800/80 ring-1 ring-cosmos-300/30
                   rounded text-xs font-mono text-cosmos-50 hover:bg-cosmos-700/80">
        debug
      </button>
    );
  }

  return (
    <div className="absolute top-2 right-2 w-[360px] max-h-[60vh] flex flex-col
                    bg-cosmos-900/95 ring-1 ring-cosmos-300/30 rounded-lg
                    text-xs font-mono text-cosmos-50 backdrop-blur">
      <div className="flex gap-2 p-2 border-b border-cosmos-300/20 items-center">
        <span className="font-bold flex-1">debug</span>
        <button onClick={() => setOpen(false)} className="px-2 py-1 bg-cosmos-700 rounded">×</button>
      </div>
      <div className="flex border-b border-cosmos-300/20">
        {(['state', 'flags', 'actions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1 ${tab === t ? 'bg-cosmos-700' : 'hover:bg-cosmos-800'}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="overflow-auto p-2 flex-1">
        {tab === 'state' && (
          <pre className="whitespace-pre-wrap break-all text-[11px]">
            {JSON.stringify(state, null, 2)}
          </pre>
        )}
        {tab === 'flags' && (
          <div className="space-y-1">
            {(Object.keys(flags) as (keyof DevFlags)[]).map((k) => {
              const v = flags[k];
              if (typeof v === 'boolean') {
                return (
                  <label key={k} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={v}
                      onChange={(e) => setFlag(k, e.target.checked as never)}
                    />
                    <span>{k}</span>
                  </label>
                );
              }
              return (
                <div key={k} className="flex gap-2 items-center">
                  <span>{k}</span>
                  <input
                    className="px-1 bg-cosmos-800 flex-1"
                    value={v ?? ''}
                    onChange={(e) =>
                      setFlag(k, (e.target.value === '' ? null : Number(e.target.value)) as never)
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
        {tab === 'actions' && (
          <div className="space-y-1">
            <button
              onClick={() => dispatch({ type: 'PING', msg: 'manual' })}
              className="w-full px-2 py-1 bg-cosmos-700 hover:bg-cosmos-600 rounded text-left">
              dispatch PING
            </button>
            <button
              onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}
              className="w-full px-2 py-1 bg-cosmos-700 hover:bg-cosmos-600 rounded text-left">
              dispatch TOGGLE_PAUSE
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'round' })}
              className="w-full px-2 py-1 bg-cosmos-700 hover:bg-cosmos-600 rounded text-left">
              SET_SCREEN round
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
