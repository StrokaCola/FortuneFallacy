import { useRef } from 'react';
import { useStore } from '../../state/store';
import { selectScore, selectTarget, selectPingCount, selectChainLen } from '../../state/selectors';
import { useEvent } from '../../events/react/useEvent';

export function ScorePanel() {
  const score  = useStore(selectScore);
  const target = useStore(selectTarget);
  const pings  = useStore(selectPingCount);
  const chainLen = useStore(selectChainLen);
  const flashRef = useRef<HTMLDivElement>(null);

  useEvent('onScoreCalculated', () => {
    const el = flashRef.current;
    if (!el) return;
    el.classList.remove('animate-pulse');
    void el.offsetWidth;
    el.classList.add('animate-pulse');
  });

  return (
    <div className="absolute top-4 left-4 px-4 py-3 rounded-xl bg-cosmos-800/80
                    backdrop-blur ring-1 ring-cosmos-300/30 text-cosmos-50
                    pointer-events-auto">
      <div ref={flashRef} className="text-3xl font-display font-bold tabular-nums">{score}</div>
      <div className="text-sm opacity-70">/ {target || '—'}</div>
      <div className="text-xs mt-1 font-mono text-astral">
        chain: {chainLen} {chainLen > 1 && <span className="text-gold">×{(1 + 0.25 * (chainLen - 1)).toFixed(2)}</span>}
      </div>
      <div className="text-[10px] opacity-50 mt-1 font-mono">pings: {pings}</div>
    </div>
  );
}
