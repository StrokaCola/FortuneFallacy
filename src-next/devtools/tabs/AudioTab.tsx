import { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../../audio/AudioEngine';
import {
  deltaToHeat,
  multiplierToCombo,
  tierToCombo,
  smoothstep,
} from '../../audio/heat';
import type { DevTab } from './index';

function AudioTabView() {
  const [, force] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      force((n) => n + 1);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const s = audioEngine.getState();
  const master = audioEngine.getMaster();
  const progress = audioEngine.getProgress();
  const tension = audioEngine.getTension();

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-16">master</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={master}
            onChange={(e) => audioEngine.setMaster(Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-10 text-right">{master.toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-1 p-2 bg-cosmos-800/60 rounded">
        <div className="text-cosmos-300 text-[10px]">live state</div>
        <Readout label="mode" value={s.mode} />
        <BarRow label="heat" value={s.heat} />
        <BarRow label="combo" value={s.combo} />
        <BarRow label="stability" value={s.stability} />
        <BarRow label="fail" value={s.fail} />
        <BarRow label="progress" value={progress} />
        <BarRow label="tension" value={tension} />
      </div>

      <div className="space-y-1 p-2 bg-cosmos-800/60 rounded">
        <div className="text-cosmos-300 text-[10px]">layer mix (actual)</div>
        <BarRow label="base" value={s.actual.base} />
        <BarRow label="combo" value={s.actual.combo} />
        <BarRow label="peak" value={s.actual.peak} />
        <BarRow label="fail" value={s.actual.fail} />
      </div>

      <CurvePanel
        progress={progress}
        currentMult={Math.max(1, s.combo * 16)}
      />

      <div className="space-y-1 p-2 bg-cosmos-800/60 rounded">
        <div className="text-cosmos-300 text-[10px] mb-1">triggers</div>
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => audioEngine.bumpHeat(0.2)}
            className="px-2 py-1 bg-cosmos-700 hover:bg-cosmos-600 rounded"
          >
            +heat 0.2
          </button>
          <button
            onClick={() => audioEngine.bumpCombo(4)}
            className="px-2 py-1 bg-cosmos-700 hover:bg-cosmos-600 rounded"
          >
            +combo (mult=4)
          </button>
          <button
            onClick={() => audioEngine.triggerBigScore()}
            className="px-2 py-1 bg-cosmos-700 hover:bg-cosmos-600 rounded"
          >
            big score
          </button>
          <button
            onClick={() => audioEngine.enterFail()}
            className="px-2 py-1 bg-amber-700 hover:bg-amber-600 rounded"
          >
            enter fail
          </button>
          <button
            onClick={() => audioEngine.exitFail()}
            className="px-2 py-1 bg-cosmos-700 hover:bg-cosmos-600 rounded"
          >
            exit fail
          </button>
          <button
            onClick={() => {
              audioEngine.setMaster(master);
              localStorage.removeItem('ff_next_audio');
            }}
            className="px-2 py-1 bg-cosmos-800 hover:bg-cosmos-700 rounded"
          >
            clear audio memory
          </button>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex gap-2">
      <span className="w-20 text-cosmos-300">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function BarRow({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-16 text-cosmos-300">{label}</span>
      <div className="flex-1 h-2 bg-cosmos-900 rounded overflow-hidden">
        <div
          className="h-full bg-emerald-500/70"
          style={{ width: `${v * 100}%` }}
        />
      </div>
      <span className="w-10 text-right">{v.toFixed(3)}</span>
    </div>
  );
}

const W = 240;
const H = 80;

function plotPath(samples: number[]): string {
  const n = samples.length - 1;
  return samples
    .map((y, i) => `${i === 0 ? 'M' : 'L'}${(i / n) * W},${H - y * H}`)
    .join(' ');
}

function sample(fn: (x: number) => number, n = 64): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(fn(i / n));
  return out;
}

function CurvePanel({
  progress,
  currentMult,
}: {
  progress: number;
  currentMult: number;
}) {
  const layerCombo = sample((x) => smoothstep(x, 0.3, 0.6) * 0.85);
  const layerPeak = sample((x) => smoothstep(x, 0.7, 0.95) * 0.85);
  const baseCurve = sample((x) => 0.55 + 0.2 * x);
  const heatFromDelta = sample((x) => deltaToHeat(x, 1));
  const comboFromMult = sample((x) => multiplierToCombo(1 + x * 15));
  const tierCurve = sample((x) => tierToCombo(x * 8));

  const px = progress * W;
  const multX = ((currentMult - 1) / 15) * W;

  return (
    <div className="space-y-2 p-2 bg-cosmos-800/60 rounded">
      <div className="text-cosmos-300 text-[10px]">
        layer-mix vs progress (base/combo/peak)
      </div>
      <svg width={W} height={H} className="bg-cosmos-900 rounded">
        <path d={plotPath(baseCurve)} stroke="#86efac" fill="none" strokeWidth={1.2} />
        <path d={plotPath(layerCombo)} stroke="#fcd34d" fill="none" strokeWidth={1.2} />
        <path d={plotPath(layerPeak)} stroke="#f87171" fill="none" strokeWidth={1.2} />
        <line x1={px} x2={px} y1={0} y2={H} stroke="#fff" strokeOpacity={0.4} />
      </svg>
      <div className="text-[10px] text-cosmos-300">
        green=base · yellow=combo · red=peak · white line=current progress
      </div>

      <div className="text-cosmos-300 text-[10px] pt-2">heat / combo curves</div>
      <svg width={W} height={H} className="bg-cosmos-900 rounded">
        <path d={plotPath(heatFromDelta)} stroke="#60a5fa" fill="none" strokeWidth={1.2} />
        <path d={plotPath(comboFromMult)} stroke="#a78bfa" fill="none" strokeWidth={1.2} />
        <path d={plotPath(tierCurve)} stroke="#34d399" fill="none" strokeWidth={1.2} />
        <line x1={multX} x2={multX} y1={0} y2={H} stroke="#fff" strokeOpacity={0.4} />
      </svg>
      <div className="text-[10px] text-cosmos-300">
        blue=delta→heat (delta/target 0..1) · purple=mult→combo (mult 1..16) ·
        green=tier→combo (tier 0..8)
      </div>
    </div>
  );
}

export const audioTab: DevTab = {
  id: 'audio',
  label: 'audio',
  render: () => <AudioTabView />,
};
