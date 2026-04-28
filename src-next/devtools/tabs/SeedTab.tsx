import { useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { getFlags, setFlag } from '../flags';
import { listSeeds, saveSeed, deleteSeed, type SeedEntry } from '../seeds';
import type { DevTab } from './index';

function SeedTabView() {
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);
  const seeds = listSeeds();
  const active = getFlags().fixedSeed;
  const customActive = active !== null && !seeds.some((s) => s.seed === active);

  const apply = (entry: SeedEntry) => {
    setFlag('fixedSeed', entry.seed);
    dispatch({ type: 'NEW_RUN' });
    refresh();
  };

  const clear = () => {
    setFlag('fixedSeed', null);
    refresh();
  };

  const capture = () => {
    const name = prompt('Snapshot name?');
    if (!name) return;
    const seed = active !== null
      ? active
      : Math.floor(Math.random() * 2 ** 31);
    const note = prompt('Note (optional)?') || undefined;
    saveSeed({ name, seed, note });
    refresh();
  };

  const remove = (name: string) => {
    deleteSeed(name);
    refresh();
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button
          onClick={capture}
          className="px-2 py-1 bg-cosmos-700 hover:bg-cosmos-600 rounded"
        >
          capture current
        </button>
        <button
          onClick={clear}
          className="px-2 py-1 bg-cosmos-800 hover:bg-cosmos-700 rounded"
        >
          clear seed
        </button>
      </div>

      {customActive && (
        <div className="text-amber-200 text-[11px]">
          custom seed active in flags.fixedSeed: {active}
        </div>
      )}

      {seeds.length === 0 ? (
        <div className="text-cosmos-300 text-[11px]">no seeds saved</div>
      ) : (
        <div className="space-y-1">
          {seeds.map((s) => (
            <div
              key={s.name}
              className="flex items-center gap-2 p-1 bg-cosmos-800/60 rounded"
            >
              <span className="font-bold flex-1 truncate">
                {s.name}
                {s.seed === active && (
                  <span className="ml-1 text-emerald-300">(active)</span>
                )}
              </span>
              <span className="text-cosmos-300 text-[11px]">{s.seed}</span>
              <button
                onClick={() => apply(s)}
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
  );
}

export const seedTab: DevTab = {
  id: 'seed',
  label: 'seed',
  render: () => <SeedTabView />,
};
