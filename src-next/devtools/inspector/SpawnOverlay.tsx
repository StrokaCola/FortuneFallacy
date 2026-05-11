import { useEffect, useRef } from 'react';
import { getInspectorState, subscribeInspector, type SpawnLogEntry } from './store';

// Visualises recent spawn events as fading colour dots. Mounted once
// near the DevConsole. Reads spawnLog on a RAF tick; when the overlay
// is off, the loop short-circuits cheaply.
const FADE_MS = 5000;
const PALETTE: Record<string, string> = {
  onComboDetected: '#7be3ff',
  onUpgradeTriggered: '#9577ff',
  onScoreBeat: '#f5c451',
  onAchievementUnlocked: '#5be8a4',
  onSellTrigger: '#ff8edc',
  onBlindCleared: '#dcd4ff',
  onBossRevealed: '#ff4d6d',
  onHotStreak: '#ff7847',
  onModFired: '#ffe98a',
  onDustEarned: '#dcd4ff',
};

export function SpawnOverlay() {
  const ref = useRef<HTMLCanvasElement>(null);

  // Repaint on RAF whenever overlay is on. Lightweight enough that we
  // can also repaint on every state change without throttling.
  useEffect(() => {
    let frame = 0;
    function tick() {
      frame = requestAnimationFrame(tick);
      const s = getInspectorState();
      const canvas = ref.current;
      if (!canvas) return;
      if (!s.effectsOverlayOn) {
        if (canvas.style.display !== 'none') canvas.style.display = 'none';
        return;
      }
      if (canvas.style.display !== 'block') canvas.style.display = 'block';
      drawOverlay(canvas, s.spawnLog);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Force the RAF tick to wake on state change (resize log clear etc.).
  useEffect(() => subscribeInspector(() => { /* RAF reads live state */ }), []);

  return (
    <canvas
      ref={ref}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9998,
        display: 'none',
      }}
      aria-hidden
    />
  );
}

function drawOverlay(canvas: HTMLCanvasElement, log: SpawnLogEntry[]): void {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const now = Date.now();
  for (const e of log) {
    const age = now - e.ts;
    if (age > FADE_MS) continue;
    const alpha = 1 - age / FADE_MS;
    const color = PALETTE[e.key] ?? '#ffffff';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0c0a16';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = Math.min(1, alpha + 0.2);
    ctx.fillStyle = color;
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(e.key, e.x + 12, e.y + 4);
  }
  ctx.globalAlpha = 1;
}
