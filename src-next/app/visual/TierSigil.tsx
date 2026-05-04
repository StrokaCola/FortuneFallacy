import type { SigilGroup, TierSigilDef } from '../../data/blinds';
import { TIER_SIGILS } from '../../data/blinds';

type Props = {
  tier: number;
  size?: number;
  animate?: 'none' | 'idle';
  glow?: boolean;
};

export function TierSigil({ tier, size = 96, animate = 'idle', glow = true }: Props) {
  const def = TIER_SIGILS[tier];
  if (!def) return null;
  const idle = animate === 'idle';
  const className = ['boss-sigil', idle && 'boss-sigil--idle-on'].filter(Boolean).join(' ');
  const filter = glow ? `drop-shadow(0 0 ${Math.max(4, size / 8)}px ${def.color})` : 'none';

  return (
    <svg
      className={className}
      viewBox={def.viewBox}
      width={size}
      height={size}
      style={{
        ['--boss-color' as string]: def.color,
        filter,
        overflow: 'visible',
      } as React.CSSProperties}
      role="img"
      aria-hidden="true">
      {def.groups.map((group, i) => (
        <SigilGroupG key={i} group={group} color={def.color} />
      ))}
    </svg>
  );
}

function SigilGroupG({ group, color }: { group: SigilGroup; color: string }) {
  const stroke = group.filled ? 'none' : color;
  const fill = group.filled ? color : 'none';
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
          strokeWidth={group.strokeWidth ?? 1.5}
          strokeDasharray={group.dashed ? '2 4' : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}

export type { TierSigilDef };
