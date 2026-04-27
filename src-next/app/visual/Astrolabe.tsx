export function Astrolabe({
  size = 120,
  score = 0,
  target = 0,
  accent = '#7be3ff',
}: { size?: number; score?: number; target?: number; accent?: string }) {
  const pct = target > 0 ? Math.min(1, score / target) : 0;
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g style={{ transformOrigin: 'center', animation: 'orbit 80s linear infinite' }}>
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * Math.PI * 2;
            const x1 = size / 2 + Math.cos(a) * (r + 2);
            const y1 = size / 2 + Math.sin(a) * (r + 2);
            const x2 = size / 2 + Math.cos(a) * (r + 6);
            const y2 = size / 2 + Math.sin(a) * (r + 6);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={i % 6 === 0 ? accent : 'rgba(149,119,255,0.5)'}
                strokeWidth={i % 6 === 0 ? 1.4 : 0.8}
              />
            );
          })}
        </g>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(149,119,255,0.25)" strokeWidth="1.5" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={accent}
          strokeWidth="2.5"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 6px ${accent})`, transition: 'stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1)' }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r * 0.55}
          stroke="rgba(149,119,255,0.3)"
          strokeWidth="0.8"
          fill="none"
          strokeDasharray="2 4"
        />
      </svg>
    </div>
  );
}
