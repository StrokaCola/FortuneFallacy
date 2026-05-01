import type { BossBlind } from '../../data/blinds';

export function BossIcon({ boss, size = 16 }: { boss: BossBlind; size?: number }) {
  return (
    <svg
      viewBox={boss.iconGlyph.viewBox}
      width={size}
      height={size}
      style={{ overflow: 'visible' }}
      aria-label={boss.name}
      role="img">
      {boss.iconGlyph.paths.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke={boss.color}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
