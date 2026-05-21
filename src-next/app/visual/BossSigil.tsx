import { useEffect, useRef } from 'react';
import type { BossBlind, SigilGroup } from '../../data/blinds';
import { generateProceduralSigil } from '../../voidmode/proceduralSigil';

export type BossSigilAnimate = 'none' | 'idle' | 'reveal' | 'both';

type Props = {
  boss: BossBlind;
  size?: number;
  animate?: BossSigilAnimate;
  glow?: boolean;
  // Void Mode — when provided, the hand-authored sigil groups are
  // OVERRIDDEN by a procedurally-generated closed-shape silhouette
  // seeded by this value. All other visual treatment (color, glow,
  // animations, frame) is preserved. Outside void mode, callers
  // omit this prop and the catalog sigil renders unchanged.
  proceduralSeed?: number;
};

export function BossSigil({
  boss,
  size = 96,
  animate = 'idle',
  glow = true,
  proceduralSeed,
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
    paths.forEach((p) => {
      // jsdom and other non-rendering environments lack getTotalLength
      if (typeof p.getTotalLength !== 'function') return;
      const len = p.getTotalLength();
      // Initial: fully invisible (offset == dasharray length)
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
      p.style.transition = 'stroke-dashoffset 600ms cubic-bezier(.4,0,.2,1) 100ms';
      // Force layout flush so transition picks up the change
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

  // Void Mode override — when a procedural seed is supplied, replace the
  // catalog groups with a single procgen silhouette group. Stamped with
  // the `orbit-main` class so the reveal stroke-draw effect (which
  // targets `.boss-sigil__orbit-main path`) still fires.
  const proceduralGroups: SigilGroup[] | null =
    proceduralSeed != null
      ? [
          {
            class: 'orbit-main',
            paths: [generateProceduralSigil(proceduralSeed).pathD],
          },
        ]
      : null;
  const groups = proceduralGroups ?? boss.sigil.groups;
  // Procgen paths are authored in a 0..100 viewBox; keep the catalog
  // viewBox otherwise so hand-authored sigils render unchanged.
  const viewBox = proceduralGroups ? '0 0 100 100' : boss.sigil.viewBox;

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={viewBox}
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
      {groups.map((group, i) => (
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
