import { useState } from 'react';
import { getFlags, setFlag, type DevFlags } from '../flags';
import type { DevTab } from './index';

const HIDDEN: Array<keyof DevFlags> = ['devConsoleTab'];

function FlagsTabView() {
  const [, force] = useState(0);
  const flags = getFlags();
  const update = <K extends keyof DevFlags>(k: K, v: DevFlags[K]) => {
    setFlag(k, v);
    force((n) => n + 1);
  };

  const keys = (Object.keys(flags) as (keyof DevFlags)[]).filter(
    (k) => !HIDDEN.includes(k),
  );

  return (
    <div className="space-y-1">
      {keys.map((k) => {
        const v = flags[k];
        if (typeof v === 'boolean') {
          return (
            <label key={k} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={v}
                onChange={(e) => update(k, e.target.checked as never)}
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
              value={(v as number | null) ?? ''}
              onChange={(e) =>
                update(
                  k,
                  (e.target.value === '' ? null : Number(e.target.value)) as never,
                )
              }
            />
          </div>
        );
      })}
    </div>
  );
}

export const flagsTab: DevTab = {
  id: 'flags',
  label: 'flags',
  render: () => <FlagsTabView />,
};
