import { useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { getState, setStateRaw } from '../../state/store';
import {
  listSnapshots,
  saveSnapshot,
  deleteSnapshot,
  getSnapshot,
} from '../snapshots';
import type { Screen } from '../../state/slices/ui';
import type { DevTab } from './index';

const SCREENS: Screen[] = ['title', 'hub', 'round', 'shop', 'forge', 'scores', 'win'];

function ScreenTabView() {
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);
  const snaps = listSnapshots();

  const jump = (screen: Screen) => {
    dispatch({ type: 'SET_SCREEN', screen });
  };

  const save = () => {
    const name = prompt('Snapshot name?');
    if (!name) return;
    saveSnapshot(name, getState());
    refresh();
  };

  const apply = (name: string) => {
    const s = getSnapshot(name);
    if (!s) return;
    setStateRaw(s);
    refresh();
  };

  const remove = (name: string) => {
    deleteSnapshot(name);
    refresh();
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-cosmos-300 text-[11px] mb-1">jump to screen</div>
        <div className="flex flex-wrap gap-1">
          {SCREENS.map((s) => (
            <button
              key={s}
              onClick={() => jump(s)}
              className="px-2 py-1 bg-cosmos-700 hover:bg-cosmos-600 rounded"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center mb-1">
          <span className="text-cosmos-300 text-[11px] flex-1">snapshots</span>
          <button
            onClick={save}
            className="px-2 py-0.5 bg-cosmos-700 hover:bg-cosmos-600 rounded text-[11px]"
          >
            save current
          </button>
        </div>
        {snaps.length === 0 ? (
          <div className="text-cosmos-300 text-[11px]">no snapshots saved</div>
        ) : (
          <div className="space-y-1">
            {snaps.map((s) => (
              <div
                key={s.name}
                className="flex items-center gap-2 p-1 bg-cosmos-800/60 rounded"
              >
                <span className="flex-1 truncate">{s.name}</span>
                <button
                  onClick={() => apply(s.name)}
                  className="px-2 bg-cosmos-700 hover:bg-cosmos-600 rounded"
                >
                  apply
                </button>
                <button
                  onClick={() => remove(s.name)}
                  className="px-2 bg-cosmos-800 hover:bg-cosmos-700 rounded"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const screenTab: DevTab = {
  id: 'screen',
  label: 'screen',
  render: () => <ScreenTabView />,
};
