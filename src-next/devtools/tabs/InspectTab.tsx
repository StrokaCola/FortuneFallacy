import { useEffect, useState } from 'react';
import {
  listInspectables,
  subscribeRegistry,
  clearAutoRegistry,
  type Inspectable,
} from '../inspector/elementRegistry';
import { useInspectorState, setInspector } from '../inspector/store';
import type { DevTab } from './index';

function InspectTabView() {
  const [, force] = useState(0);
  useEffect(() => subscribeRegistry(() => force((n) => n + 1)), []);

  const pickerArmed = useInspectorState((s) => s.pickerArmed);
  const selectedId = useInspectorState((s) => s.selectedId);
  const hoverId = useInspectorState((s) => s.hoverId);
  const [filter, setFilter] = useState('');

  const items = listInspectables();
  const f = filter.trim().toLowerCase();
  const visible = f === ''
    ? items
    : items.filter((i) => i.id.toLowerCase().includes(f) || i.meta.label.toLowerCase().includes(f));

  visible.sort((a, b) => {
    if (a.source !== b.source) return a.source === 'explicit' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-1 items-center">
        <button
          onClick={() => setInspector({ pickerArmed: !pickerArmed, hoverId: null })}
          className={`px-2 py-1 rounded ${pickerArmed ? 'bg-amber-700' : 'bg-cosmos-700 hover:bg-cosmos-600'}`}
        >
          {pickerArmed ? 'picking… (esc to cancel)' : 'pick element'}
        </button>
        <button
          onClick={() => setInspector({ selectedId: null })}
          className="px-2 py-1 bg-cosmos-800 hover:bg-cosmos-700 rounded"
          disabled={!selectedId}
        >
          deselect
        </button>
        <button
          onClick={clearAutoRegistry}
          className="px-2 py-1 bg-cosmos-800 hover:bg-cosmos-700 rounded"
          title="forget auto-discovered entries"
        >
          purge auto
        </button>
      </div>

      <input
        className="px-1 bg-cosmos-900 w-full"
        placeholder="filter by id or label"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="text-[10px] text-cosmos-300">
        {items.length} inspectables · selected: <span className="text-cosmos-50">{selectedId ?? '—'}</span>
        {hoverId && hoverId !== selectedId && <> · hover: {hoverId}</>}
      </div>

      {visible.length === 0 ? (
        <div className="text-cosmos-300 text-[11px]">none registered. enable picker and hover anything.</div>
      ) : (
        <div className="space-y-0.5 max-h-[40vh] overflow-auto">
          {visible.map((i) => (
            <Row key={i.id} item={i} selected={i.id === selectedId} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ item, selected }: { item: Inspectable; selected: boolean }) {
  return (
    <button
      onClick={() => setInspector({ selectedId: item.id })}
      className={`w-full text-left px-1 py-0.5 rounded flex gap-2 text-[11px] ${selected ? 'bg-amber-900/60' : 'hover:bg-cosmos-800'}`}
    >
      <span className="text-cosmos-300 w-12">{item.source === 'explicit' ? 'tag' : 'auto'}</span>
      <span className="font-bold flex-1 truncate">{item.meta.label}</span>
      <span className="text-cosmos-300 truncate max-w-[180px]">{item.id}</span>
    </button>
  );
}

export const inspectTab: DevTab = {
  id: 'inspect',
  label: 'inspect',
  render: () => <InspectTabView />,
};
