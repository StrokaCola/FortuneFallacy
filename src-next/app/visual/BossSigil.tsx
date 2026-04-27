import { useEffect, useRef, useState } from 'react';
import type { BossBlind } from '../../data/blinds';

export function BossSigil({
  boss, size = 64, drawIn = false, drawDurationMs = 1200, rotate = false, glow = true,
}: {
  boss: BossBlind;
  size?: number;
  drawIn?: boolean;
  drawDurationMs?: number;
  rotate?: boolean;
  glow?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!drawIn || !ref.current) return;
    const paths = ref.current.querySelectorAll('path');
    const perPath = drawDurationMs / Math.max(1, paths.length);
    paths.forEach((p, i) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
      p.style.transition = `stroke-dashoffset ${perPath}ms linear ${i * perPath}ms`;
      void p.getBoundingClientRect();
      requestAnimationFrame(() => { p.style.strokeDashoffset = '0'; });
    });
  }, [drawIn, drawDurationMs, mounted]);

  const filter = glow ? `drop-shadow(0 0 ${Math.max(4, size / 8)}px ${boss.color})` : 'none';

  return (
    <svg
      ref={ref}
      viewBox={boss.sigil.viewBox}
      width={size}
      height={size}
      style={{
        filter,
        animation: rotate ? 'orbit 12s linear infinite' : 'none',
        overflow: 'visible',
      }}>
      {boss.sigil.paths.map((d, i) => (
        <path key={i} d={d}
          stroke={boss.color}
          strokeWidth={size > 80 ? 1.2 : 1.6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round" />
      ))}
    </svg>
  );
}
