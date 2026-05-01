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

  const className = [
    'boss-sigil',
    idle && 'boss-sigil--idle-on',
    reveal && 'boss-sigil--reveal',
  ].filter(Boolean).join(' ');

  const filter = glow ? `drop-shadow(0 0 ${Math.max(4, size / 8)}px ${boss.color})` : 'none';

  return (
    <svg
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
