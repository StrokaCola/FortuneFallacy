import { useEffect, useState } from 'react';
import { Z } from './zLayers';

// Diagnostic overlay surfaced via the URL flag `?debug=1`. Lets the
// user screenshot the relevant runtime state (canvas dimensions, HUD
// vars, dice count, frame counter) so a remote helper can diagnose
// rendering issues without needing browser DevTools on a phone.
function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).has('debug');
  } catch {
    return false;
  }
}

export function RoundDebugOverlay() {
  const [enabled] = useState(isDebugEnabled);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const loop = () => {
      setTick((t) => t + 1);
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [enabled]);

  if (!enabled) return null;

  const canvas = typeof document !== 'undefined' ? document.getElementById('three-next') as HTMLCanvasElement | null : null;
  const rect = canvas?.getBoundingClientRect();
  const css = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const hudTop = css?.getPropertyValue('--hud-top-h').trim() ?? '?';
  const hudBot = css?.getPropertyValue('--hud-bottom-h').trim() ?? '?';
  const stageW = css?.getPropertyValue('--stage-w').trim() ?? '?';
  const stageH = css?.getPropertyValue('--stage-h').trim() ?? '?';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d3 = (typeof window !== 'undefined' ? (window as any).__dice3d : null);
  const diceCount: number | string = d3?.dice?.length ?? '?';
  const bufW: number | string = canvas?.width ?? '?';
  const bufH: number | string = canvas?.height ?? '?';
  const active: string = canvas?.classList.contains('active') ? 'yes' : 'no';
  const display: string = canvas ? getComputedStyle(canvas).display : '?';

  const lines = [
    `frame ${tick}`,
    `viewport ${typeof window !== 'undefined' ? window.innerWidth : '?'}×${typeof window !== 'undefined' ? window.innerHeight : '?'}`,
    `stage ${stageW}×${stageH}`,
    `--hud-top-h ${hudTop}`,
    `--hud-bottom-h ${hudBot}`,
    `canvas rect ${rect ? Math.round(rect.width) : '?'}×${rect ? Math.round(rect.height) : '?'}`,
    `canvas top ${rect ? Math.round(rect.top) : '?'} left ${rect ? Math.round(rect.left) : '?'}`,
    `canvas display ${display} active ${active}`,
    `canvas buffer ${bufW}×${bufH}`,
    `dice count ${diceCount}`,
    `DPR ${typeof window !== 'undefined' ? window.devicePixelRatio : '?'}`,
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        zIndex: Z.overlay,
        background: 'rgba(0, 0, 0, 0.85)',
        color: '#7be3ff',
        font: '11px/1.35 ui-monospace, Menlo, monospace',
        padding: '8px 10px',
        borderRadius: 6,
        border: '1px solid rgba(123, 227, 255, 0.4)',
        pointerEvents: 'none',
        maxWidth: 'calc(100vw - 16px)',
        whiteSpace: 'pre',
      }}
    >
      {lines.join('\n')}
    </div>
  );
}
