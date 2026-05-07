import { useEffect, useState } from 'react';
import { getSnapshot, reset, type PerfSnapshot } from '../perf';
import { _viewCount } from '../../render/three/sharedRenderer';
import type { DevTab } from './index';

function fmt(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function persistenceBlobKb(): number {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('ff_next_')) continue;
      const val = localStorage.getItem(key);
      if (val) total += val.length;
    }
    return total / 1024;
  } catch {
    return 0;
  }
}

function PerfTabView() {
  const [snap, setSnap] = useState<PerfSnapshot>(getSnapshot());
  const [blobKb, setBlobKb] = useState(persistenceBlobKb());

  useEffect(() => {
    const id = window.setInterval(() => {
      setSnap(getSnapshot());
      setBlobKb(persistenceBlobKb());
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  const metricNames = Object.keys(snap.metrics).sort();
  const fps50 = snap.fps.p50;
  const fps95 = snap.fps.p95; // 95th percentile of FPS computed from p95 frameMs (i.e. WORST 5% of frames inverted)

  return (
    <div className="space-y-2 text-[11px]">
      <div className="space-y-1">
        <div className="font-bold">render</div>
        <div className="grid grid-cols-2 gap-x-3">
          <div>fps mean</div><div className="text-right">{fmt(snap.fps.mean)}</div>
          <div>fps p50</div><div className="text-right">{fmt(fps50)}</div>
          <div>fps p95-worst</div><div className="text-right">{fmt(fps95)}</div>
          <div>frame ms p50</div><div className="text-right">{fmt(snap.frameMs.p50, 2)}</div>
          <div>frame ms p95</div><div className="text-right">{fmt(snap.frameMs.p95, 2)}</div>
          <div>frame ms p99</div><div className="text-right">{fmt(snap.frameMs.p99, 2)}</div>
          <div>{'jank (>50ms)'}</div><div className="text-right">{snap.jank}</div>
          <div>three views</div><div className="text-right">{_viewCount()}</div>
          <div>frames sampled</div><div className="text-right">{snap.frameMs.count}</div>
        </div>
      </div>

      <div className="space-y-1 pt-2 border-t border-cosmos-300/20">
        <div className="font-bold">storage</div>
        <div className="grid grid-cols-2 gap-x-3">
          <div>persistence blob</div><div className="text-right">{fmt(blobKb, 1)} kb</div>
        </div>
      </div>

      <div className="space-y-1 pt-2 border-t border-cosmos-300/20">
        <div className="font-bold">measures</div>
        {metricNames.length === 0 ? (
          <div className="text-cosmos-300">no measures captured yet</div>
        ) : (
          <div className="grid grid-cols-5 gap-x-2 gap-y-0.5">
            <div className="font-bold">name</div>
            <div className="text-right font-bold">p50</div>
            <div className="text-right font-bold">p95</div>
            <div className="text-right font-bold">mean</div>
            <div className="text-right font-bold">n</div>
            {metricNames.map((m) => {
              const s = snap.metrics[m]!;
              return (
                <div key={m} className="contents">
                  <div className="truncate">{m}</div>
                  <div className="text-right">{fmt(s.p50, 2)}</div>
                  <div className="text-right">{fmt(s.p95, 2)}</div>
                  <div className="text-right">{fmt(s.mean, 2)}</div>
                  <div className="text-right">{s.count}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-cosmos-300/20">
        <button
          onClick={() => { reset(); setSnap(getSnapshot()); }}
          className="px-2 py-1 bg-cosmos-800 hover:bg-cosmos-700 rounded"
        >
          reset
        </button>
      </div>
    </div>
  );
}

export const perfTab: DevTab = {
  id: 'perf',
  label: 'perf',
  render: () => <PerfTabView />,
};
