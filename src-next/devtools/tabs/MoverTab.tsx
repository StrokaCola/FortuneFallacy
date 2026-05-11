import { useEffect, useState } from 'react';
import { getInspectableById } from '../inspector/elementRegistry';
import { transformSnippetFor } from '../inspector/applyOverrides';
import {
  clearAllOverrides,
  clearOverride,
  DEFAULT_OVERRIDE,
  setInspector,
  setOverride,
  useInspectorState,
} from '../inspector/store';
import type { DevTab } from './index';

function MoverTabView() {
  const selectedId = useInspectorState((s) => s.selectedId);
  const moveArmed = useInspectorState((s) => s.moveArmed);
  const overrides = useInspectorState((s) => s.overrides);
  const o = (selectedId ? overrides[selectedId] : undefined) ?? DEFAULT_OVERRIDE;
  const ins = selectedId ? getInspectableById(selectedId) : null;
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(t);
  }, [copied]);

  const overrideCount = Object.keys(overrides).length;

  if (!selectedId) {
    return (
      <div className="space-y-2">
        <div className="text-cosmos-300 text-[11px]">
          select an element in the inspect tab first.
        </div>
        {overrideCount > 0 && (
          <button
            onClick={() => clearAllOverrides()}
            className="px-2 py-1 bg-rose-800 hover:bg-rose-700 rounded text-[11px]"
          >
            clear all {overrideCount} stored override(s)
          </button>
        )}
      </div>
    );
  }

  const set = (patch: Partial<typeof o>) => setOverride(selectedId, patch);
  const snippet = transformSnippetFor(selectedId);

  const copy = async () => {
    if (!snippet) return;
    const text = `style={{ transform: '${snippet}' }}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Fallback: dump to console.
      console.log('[inspector] snippet:', text);
      setCopied(true);
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-[11px]">
        <div className="font-bold truncate">{ins?.meta.label ?? selectedId}</div>
        <div className="text-cosmos-300 truncate">{selectedId}</div>
      </div>

      <label className="flex items-center gap-2 text-[11px]">
        <input
          type="checkbox"
          checked={moveArmed}
          onChange={(e) => setInspector({ moveArmed: e.target.checked })}
        />
        <span>drag-to-move (drag the gold outline)</span>
      </label>

      <Slider label="dx" value={o.dx} min={-400} max={400} step={1} onChange={(v) => set({ dx: v })} />
      <Slider label="dy" value={o.dy} min={-400} max={400} step={1} onChange={(v) => set({ dy: v })} />
      <Slider label="scale" value={o.scale} min={0.2} max={3} step={0.01} onChange={(v) => set({ scale: v })} />
      <Slider label="rotate" value={o.rotate} min={-180} max={180} step={1} onChange={(v) => set({ rotate: v })} />

      <div className="flex gap-1">
        <button
          onClick={() => clearOverride(selectedId)}
          className="px-2 py-1 bg-cosmos-800 hover:bg-cosmos-700 rounded text-[11px]"
          disabled={!snippet}
        >
          reset
        </button>
        <button
          onClick={copy}
          className="px-2 py-1 bg-cosmos-700 hover:bg-cosmos-600 rounded text-[11px]"
          disabled={!snippet}
        >
          {copied ? 'copied' : 'copy snippet'}
        </button>
      </div>

      <pre className="px-2 py-1 bg-cosmos-900 rounded whitespace-pre-wrap break-all text-[10px]">
        {snippet ? `style={{ transform: '${snippet}' }}` : '// no override applied'}
      </pre>

      {overrideCount > 1 && (
        <button
          onClick={() => clearAllOverrides()}
          className="px-2 py-1 bg-rose-800 hover:bg-rose-700 rounded text-[11px] w-full"
        >
          clear all {overrideCount} stored overrides
        </button>
      )}
    </div>
  );
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const { label, value, min, max, step, onChange } = props;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-12 text-cosmos-300">{label}</span>
      <input
        type="range"
        className="flex-1"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <input
        type="number"
        className="w-16 px-1 bg-cosmos-900"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </div>
  );
}

export const moverTab: DevTab = {
  id: 'mover',
  label: 'mover',
  render: () => <MoverTabView />,
};
