type Pt = { x: number; y: number };

export function ConstellationLines({
  points,
  color = '#7be3ff',
  show = true,
}: { points: Pt[]; color?: string; show?: boolean }) {
  if (!show || points.length < 2) return null;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x;
    const dy = points[i]!.y - points[i - 1]!.y;
    len += Math.hypot(dx, dy);
  }
  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
      width="100%"
      height="100%">
      <defs>
        <filter id="cglow">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      <path d={path} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" opacity="0.25" filter="url(#cglow)" />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len}
        style={{ animation: `constellation-draw 900ms cubic-bezier(.3,.7,.4,1) forwards`, ['--len' as string]: len } as never}
      />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="#fff" />
          <circle cx={p.x} cy={p.y} r="8" fill="none" stroke={color} strokeWidth="0.5" opacity="0.7" />
        </g>
      ))}
    </svg>
  );
}
