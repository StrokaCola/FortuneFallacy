import { useMemo, useState } from 'react';
import { useStore, setStateRaw, type GameState } from '../../state/store';
import { setIn } from '../setIn';
import type { DevTab } from './index';

const stateSelector = (s: GameState) => s;
const TOP_SLICES: Array<keyof GameState> = ['run', 'round', 'shop', 'meta', 'ui'];

function StateTabView() {
  const state = useStore(stateSelector);
  const [collapsed, setCollapsed] = useState(false);
  const [path, setPath] = useState('');
  const [valueRaw, setValueRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const view = useMemo(() => {
    if (!collapsed) return state;
    const summary: Record<string, string> = {};
    for (const k of TOP_SLICES) {
      const slice = state[k] as Record<string, unknown> | undefined;
      summary[k] = slice && typeof slice === 'object'
        ? `{${Object.keys(slice).length} keys}`
        : String(slice);
    }
    summary.pingCount = String(state.pingCount);
    return summary;
  }, [state, collapsed]);

  const apply = () => {
    setError(null);
    setOkMsg(null);
    if (!path.trim()) {
      setError('path is empty');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(valueRaw);
    } catch (e) {
      setError(`invalid JSON: ${(e as Error).message}`);
      return;
    }
    try {
      setStateRaw((s) => setIn(s, path.trim(), parsed));
      setOkMsg(`set ${path} = ${valueRaw}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1 p-2 bg-cosmos-800/60 rounded">
        <div className="flex gap-1">
          <input
            className="px-1 bg-cosmos-900 flex-1"
            placeholder="path (e.g. run.bank)"
            value={path}
            onChange={(e) => setPath(e.target.value)}
          />
          <input
            className="px-1 bg-cosmos-900 flex-1"
            placeholder='value (JSON, e.g. 9999 or "x" or true)'
            value={valueRaw}
            onChange={(e) => setValueRaw(e.target.value)}
          />
          <button
            onClick={apply}
            className="px-2 bg-cosmos-700 hover:bg-cosmos-600 rounded"
          >
            apply
          </button>
        </div>
        {error && <div className="text-red-300 text-[11px]">error: {error}</div>}
        {okMsg && <div className="text-emerald-300 text-[11px]">{okMsg}</div>}
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={collapsed}
            onChange={(e) => setCollapsed(e.target.checked)}
          />
          <span>collapse slices</span>
        </label>
      </div>

      <pre className="whitespace-pre-wrap break-all text-[11px]">
        {JSON.stringify(view, null, 2)}
      </pre>
    </div>
  );
}

export const stateTab: DevTab = {
  id: 'state',
  label: 'state',
  render: () => <StateTabView />,
};
