import { useEffect, useRef } from 'react';
import type { BossBlind, SigilGroup } from '../../data/blinds';

export type BossSigilAnimate = 'none' | 'idle' | 'reveal' | 'both';

type Props = {
  boss: BossBlind;
  size?: number;
  animate?: BossSigilAnimate;
  glow?: boolean;
};

export function BossSigil({
  boss,
  size = 96,
  animate = 'idle',
  glow = true,
}: Props) {
  const reveal = animate === 'reveal' || animate === 'both';
  const idle = animate === 'idle' || animate === 'both';
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!reveal || !svgRef.current) return;
    const reduced = document.documentElement.classList.contains('reduce-motion');
    if (reduced) return;
    const paths = svgRef.current.querySelectorAll<SVGPathElement>(
      '.boss-sigil__orbit-main path',
    );
    paths.forEach((p, i) => {
      // jsdom and other non-rendering environments lack getTotalLength
      if (typeof p.getTotalLength !== 'function') return;
      const len = p.getTotalLength();
      // Per-path stagger so the strokes draw in sequence rather than all at
      // once. Combined with the radial wipe in BossReveal this reads as the
      // boss being assembled out of the void.
      const delay = 100 + i * 90;
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
      p.style.transition = `stroke-dashoffset 540ms cubic-bezier(.4,0,.2,1) ${delay}ms`;
      void p.getBoundingClientRect();
      requestAnimationFrame(() => {
        p.style.strokeDashoffset = '0';
      });
    });
  }, [reveal, boss.id]);

  const className = [
    'boss-sigil',
    idle && 'boss-sigil--idle-on',
    reveal && 'boss-sigil--reveal',
  ].filter(Boolean).join(' ');

  const filter = glow ? `drop-shadow(0 0 ${Math.max(4, size / 8)}px ${boss.color})` : 'none';

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={boss.sigil.viewBox}
      width={size}
      height={size}
      style={{
        // CSS variable for keyframes / theming
        ['--boss-color' as string]: boss.color,
        filter,
        overflow: 'visible',
      } as React.CSSProperties}
      aria-label={boss.name}
      role="img">
      {boss.sigil.groups.map((group, i) => (
        <SigilGroupG key={i} group={group} bossColor={boss.color} />
      ))}
    </svg>
  );
}

function SigilGroupG({ group, bossColor }: { group: SigilGroup; bossColor: string }) {
  const stroke = group.filled ? 'none' : bossColor;
  const fill = group.filled ? bossColor : 'none';
  const strokeWidth = group.strokeWidth ?? 1.5;
  const strokeDasharray = group.dashed ? '2 4' : undefined;

  return (
    <g
      className={`boss-sigil__${group.class}`}
      style={{ opacity: group.opacity ?? 1 }}>
      {group.paths.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke={stroke}
          fill={fill}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}
