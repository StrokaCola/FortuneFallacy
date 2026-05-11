import { useMemo, useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import type { Action } from '../../actions/types';
import { actionSamples, actionTypes } from '../inspector/actionSamples';
import type { DevTab } from './index';

function ActionsTabView() {
  const [filter, setFilter] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastFired, setLastFired] = useState<string | null>(null);

  const f = filter.trim().toLowerCase();
  const visible = useMemo(
    () => (f === '' ? actionTypes : actionTypes.filter((k) => k.toLowerCase().includes(f))),
    [f],
  );

  const getDraft = (k: Action['type']) =>
    drafts[k] ?? JSON.stringify(actionSamples[k], null, 2);

  const fire = (k: Action['type']) => {
    const text = getDraft(k);
    let parsed: Action;
    try {
      parsed = JSON.parse(text) as Action;
    } catch (e) {
      setErrors((m) => ({ ...m, [k]: `JSON parse: ${(e as Error).message}` }));
      return;
    }
    if (!parsed || typeof parsed !== 'object' || parsed.type !== k) {
      setErrors((m) => ({ ...m, [k]: `payload.type must be "${k}"` }));
      return;
    }
    setErrors((m) => { const c = { ...m }; delete c[k]; return c; });
    dispatch(parsed);
    setLastFired(k);
  };

  return (
    <div className="space-y-2">
      <input
        className="px-1 bg-cosmos-900 w-full"
        placeholder="filter actions (substring)"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="text-[10px] text-cosmos-300">
        {visible.length}/{actionTypes.length} actions
        {lastFired && <> · last fired: <span className="text-emerald-300">{lastFired}</span></>}
      </div>
      <div className="space-y-0.5 max-h-[50vh] overflow-auto">
        {visible.map((k) => {
          const expanded = expandedKey === k;
          return (
            <div key={k} className="text-[11px]">
              <div className="flex gap-1 items-center">
                <button
                  onClick={() => setExpandedKey((c) => (c === k ? null : k))}
                  className="flex-1 text-left px-1 py-0.5 hover:bg-cosmos-800 rounded font-bold truncate"
                >
                  {expanded ? '▾' : '▸'} {k}
                </button>
                <button
                  onClick={() => fire(k)}
                  className="px-2 py-0.5 bg-cosmos-700 hover:bg-cosmos-600 rounded text-[10px]"
                >
                  dispatch
                </button>
              </div>
              {expanded && (
                <div className="ml-3 space-y-1">
                  <textarea
                    className="w-full px-1 bg-cosmos-900 text-[10px] font-mono"
                    rows={Math.min(10, getDraft(k).split('\n').length + 1)}
                    value={getDraft(k)}
                    onChange={(e) =>
                      setDrafts((m) => ({ ...m, [k]: e.target.value }))
                    }
                  />
                  {errors[k] && (
                    <div className="text-red-300 text-[10px]">{errors[k]}</div>
                  )}
                  <button
                    onClick={() => setDrafts((m) => { const c = { ...m }; delete c[k]; return c; })}
                    className="px-2 py-0.5 bg-cosmos-800 hover:bg-cosmos-700 rounded text-[10px]"
                  >
                    reset payload
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const actionsTab: DevTab = {
  id: 'actions',
  label: 'actions',
  render: () => <ActionsTabView />,
};
