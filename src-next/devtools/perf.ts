// Lightweight performance sampler — dev-only. Provides:
//   - `mark(name)` / `measure(name, startMark)` — wraps performance API,
//     accumulates rolling samples per metric for the PerfTab readout.
//   - `tick()` — call once per RAF for FPS sampling.
//   - `getSnapshot()` — read the current rolling stats (FPS p50/p95/p99 +
//     metric histograms).
//
// The sampler is safe to call in production: it short-circuits to no-op when
// `performance` is unavailable. The PerfTab is the only consumer of
// `getSnapshot`, and it lives behind the DevConsole so production users never
// see the cost.

const FRAME_RING_SIZE = 240; // ~4 seconds at 60 fps
const METRIC_RING_SIZE = 100;
const JANK_THRESHOLD_MS = 50;

type MetricRing = { samples: number[]; pos: number; count: number };

function makeRing(size: number): MetricRing {
  return { samples: new Array<number>(size).fill(0), pos: 0, count: 0 };
}

function pushRing(ring: MetricRing, value: number): void {
  ring.samples[ring.pos] = value;
  ring.pos = (ring.pos + 1) % ring.samples.length;
  if (ring.count < ring.samples.length) ring.count++;
}

function ringStats(ring: MetricRing): { p50: number; p95: number; p99: number; mean: number; count: number } {
  if (ring.count === 0) return { p50: 0, p95: 0, p99: 0, mean: 0, count: 0 };
  const arr = ring.samples.slice(0, ring.count).slice().sort((a, b) => a - b);
  const sum = arr.reduce((a, b) => a + b, 0);
  const at = (q: number) => arr[Math.min(arr.length - 1, Math.floor(arr.length * q))]!;
  return { p50: at(0.5), p95: at(0.95), p99: at(0.99), mean: sum / arr.length, count: ring.count };
}

const frames = makeRing(FRAME_RING_SIZE);
const metrics = new Map<string, MetricRing>();
let lastFrameTime = 0;
let jankCount = 0;
let counter = 0;

function getMetric(name: string): MetricRing {
  let ring = metrics.get(name);
  if (!ring) { ring = makeRing(METRIC_RING_SIZE); metrics.set(name, ring); }
  return ring;
}

const hasPerf = typeof performance !== 'undefined';

export function tick(): void {
  if (!hasPerf) return;
  const now = performance.now();
  if (lastFrameTime !== 0) {
    const dt = now - lastFrameTime;
    pushRing(frames, dt);
    if (dt > JANK_THRESHOLD_MS) jankCount++;
  }
  lastFrameTime = now;
}

/** Begin a named measurement. Returns an end function that records the duration. */
export function begin(name: string): () => void {
  if (!hasPerf) return () => undefined;
  const startMark = `ff:${name}:${++counter}:start`;
  performance.mark(startMark);
  return () => {
    const endMark = `ff:${name}:${counter}:end`;
    performance.mark(endMark);
    try {
      performance.measure(`ff:${name}`, startMark, endMark);
    } catch {
      // Mark may have been cleared; ignore.
    }
    // Read back the duration of the measure we just created and record it.
    const entries = performance.getEntriesByName(`ff:${name}`, 'measure');
    const last = entries[entries.length - 1];
    if (last) pushRing(getMetric(name), last.duration);
    // Clean up so the buffer doesn't grow unbounded.
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    if (entries.length > 50) performance.clearMeasures(`ff:${name}`);
  };
}

/** Record a precomputed duration without using performance.mark (for cheap call sites). */
export function record(name: string, durationMs: number): void {
  pushRing(getMetric(name), durationMs);
}

export type PerfSnapshot = {
  fps: { p50: number; p95: number; p99: number; mean: number };
  frameMs: { p50: number; p95: number; p99: number; mean: number; count: number };
  jank: number;
  metrics: Record<string, { p50: number; p95: number; p99: number; mean: number; count: number }>;
};

export function getSnapshot(): PerfSnapshot {
  const f = ringStats(frames);
  // FPS = 1000 / frameMs. Convert by inverting the percentiles (note: the
  // p95 of frame time corresponds to the p5 of fps, not p95 — we report it
  // labeled as "frame ms" instead of trying to invert).
  const safeFps = (ms: number) => (ms > 0 ? 1000 / ms : 0);
  const out: PerfSnapshot['metrics'] = {};
  for (const [name, ring] of metrics) out[name] = ringStats(ring);
  return {
    fps: {
      p50: safeFps(f.p50),
      p95: safeFps(f.p95),
      p99: safeFps(f.p99),
      mean: safeFps(f.mean),
    },
    frameMs: f,
    jank: jankCount,
    metrics: out,
  };
}

export function reset(): void {
  frames.count = 0;
  frames.pos = 0;
  jankCount = 0;
  metrics.clear();
  lastFrameTime = 0;
}

// Expose to window for ad-hoc inspection alongside `window.__ff`.
if (typeof window !== 'undefined') {
  const w = window as unknown as { __ff?: Record<string, unknown> };
  w.__ff = w.__ff ?? {};
  w.__ff.perf = { getSnapshot, reset, begin, record };
}
