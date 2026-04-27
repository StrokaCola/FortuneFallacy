const ARC = 39;
const TICKS = 11;

export function TrayBase() {
  return (
    <div
      style={{
        // Anchored to canvas vertical center (the centered #three-next stage),
        // shifted down so curve sits beneath the rendered dice row.
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -28px)',
        width: 960,
        height: 220,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <svg width="960" height="220" viewBox="0 0 960 220" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="ff-trayGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(149,119,255,0)" />
            <stop offset="60%" stopColor="rgba(149,119,255,0.18)" />
            <stop offset="100%" stopColor="rgba(28,18,69,0.5)" />
          </linearGradient>
        </defs>
        <path
          d={`M 40 100 Q 480 ${100 + ARC * 2 + 60} 920 100 L 920 200 L 40 200 Z`}
          fill="url(#ff-trayGrad)"
          stroke="rgba(149,119,255,0.4)"
          strokeWidth="1.2"
        />
        {Array.from({ length: TICKS }).map((_, i) => {
          const dy = Math.abs((i - 5) / 5) * ARC * 2;
          return (
            <line
              key={i}
              x1={40 + i * 88}
              y1={100 + dy}
              x2={40 + i * 88}
              y2={106 + dy}
              stroke="rgba(187,168,255,0.5)"
              strokeWidth="0.8"
            />
          );
        })}
      </svg>
    </div>
  );
}
