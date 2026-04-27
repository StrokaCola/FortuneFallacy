type Style = 'celestial' | 'obsidian' | 'ivory' | 'ember' | 'glass';

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.25, 0.25], [0.75, 0.75]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.25, 0.22], [0.75, 0.22], [0.25, 0.5], [0.75, 0.5], [0.25, 0.78], [0.75, 0.78]],
};

const DIE_STYLES: Record<Style, { bg: string; border: string; pip: string; accent: string; glow: string }> = {
  celestial: {
    bg: 'radial-gradient(circle at 30% 25%, #2e1d6b, #0f0925 80%)',
    border: '1px solid rgba(187, 168, 255, 0.4)',
    pip: '#dcd4ff', accent: '#7be3ff',
    glow: '0 0 18px rgba(149,119,255,0.4), inset 0 0 10px rgba(123,227,255,0.15)',
  },
  obsidian: {
    bg: 'linear-gradient(135deg, #1a0f2e, #07051a)',
    border: '1px solid rgba(245, 196, 81, 0.35)',
    pip: '#f5c451', accent: '#f5c451',
    glow: '0 0 18px rgba(245,196,81,0.25), inset 0 0 10px rgba(255,255,255,0.04)',
  },
  ivory: {
    bg: 'linear-gradient(135deg, #f5efe0, #d6c9aa)',
    border: '1px solid rgba(28,18,69,0.25)',
    pip: '#1c1245', accent: '#5c39c4',
    glow: '0 6px 18px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.6)',
  },
  ember: {
    bg: 'linear-gradient(135deg, #ff8a5e 0%, #c93a18 100%)',
    border: '1px solid rgba(255,231,200,0.5)',
    pip: '#fff7e8', accent: '#ffe9c8',
    glow: '0 0 22px rgba(255,120,71,0.5), inset 0 0 12px rgba(255,255,255,0.15)',
  },
  glass: {
    bg: 'linear-gradient(135deg, rgba(123,227,255,0.18), rgba(149,119,255,0.10))',
    border: '1px solid rgba(123,227,255,0.55)',
    pip: '#f3f0ff', accent: '#7be3ff',
    glow: '0 0 24px rgba(123,227,255,0.4), inset 0 0 14px rgba(123,227,255,0.2)',
  },
};

const FACE_ROT: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  6: 'rotateY(180deg)',
  2: 'rotateY(-90deg)',
  5: 'rotateY(90deg)',
  3: 'rotateX(-90deg)',
  4: 'rotateX(90deg)',
};

export type DieRune = { icon: string; name: string; color: string };

export function Die3DCSS({
  face = 1,
  size = 88,
  style = 'celestial',
  locked = false,
  scoring = false,
  runes = [],
  onClick,
  label,
  dim,
}: {
  face?: number; size?: number; style?: Style; locked?: boolean; scoring?: boolean;
  runes?: DieRune[]; onClick?: () => void; label?: string; dim?: boolean;
}) {
  const s = DIE_STYLES[style];
  const half = size / 2;
  const FACE_DEFS = [
    { id: 'front',  pips: 1, t: `translateZ(${half}px)` },
    { id: 'back',   pips: 6, t: `rotateY(180deg) translateZ(${half}px)` },
    { id: 'right',  pips: 2, t: `rotateY(90deg) translateZ(${half}px)` },
    { id: 'left',   pips: 5, t: `rotateY(-90deg) translateZ(${half}px)` },
    { id: 'top',    pips: 3, t: `rotateX(90deg) translateZ(${half}px)` },
    { id: 'bottom', pips: 4, t: `rotateX(-90deg) translateZ(${half}px)` },
  ];
  const rot = FACE_ROT[Math.max(1, Math.min(6, face))] ?? FACE_ROT[1]!;

  return (
    <div
      onClick={onClick}
      className={`die3d-wrap idle ${locked ? 'locked' : ''} ${scoring ? 'scoring' : ''}`}
      style={{
        width: size, height: size,
        cursor: onClick ? 'pointer' : 'default',
        opacity: dim ? 0.45 : 1,
      }}>
      <div className="die3d" style={{ width: size, height: size, ['--face-rot' as never]: rot, transform: rot } as never}>
        {FACE_DEFS.map((f) => {
          const pips = PIPS[f.pips] ?? [];
          return (
            <div
              key={f.id}
              className="die3d-face"
              style={{
                width: size, height: size,
                transform: f.t,
                background: s.bg,
                border: s.border,
                boxShadow: `inset 0 0 14px rgba(0,0,0,0.35), ${s.glow}`,
              }}>
              <svg viewBox="0 0 100 100" width={size - 12} height={size - 12} style={{ position: 'absolute' }}>
                {pips.map(([x, y], i) => (
                  <g key={i}>
                    <circle cx={x * 100} cy={y * 100} r="7.5" fill="rgba(0,0,0,0.55)" />
                    <circle cx={x * 100} cy={y * 100} r="6.2" fill={s.pip}
                      style={{ filter: `drop-shadow(0 0 4px ${s.accent}80)` }} />
                    <circle cx={x * 100 - 1.5} cy={y * 100 - 1.8} r="1.6" fill="rgba(255,255,255,0.55)" />
                  </g>
                ))}
              </svg>
            </div>
          );
        })}
      </div>
      <div className="die3d-shadow" />
      {runes.length > 0 && (
        <div style={{ position: 'absolute', top: -6, right: -6, display: 'flex', gap: 2, zIndex: 2 }}>
          {runes.slice(0, 2).map((r, i) => (
            <div
              key={i}
              title={r.name}
              style={{
                width: 22, height: 22, borderRadius: 6,
                background: 'rgba(15,9,37,0.92)',
                border: `1px solid ${r.color}`,
                color: r.color,
                display: 'grid', placeItems: 'center',
                fontSize: 12,
                boxShadow: `0 0 8px ${r.color}80`,
              }}>
              {r.icon}
            </div>
          ))}
        </div>
      )}
      {locked && (
        <div style={{
          position: 'absolute', bottom: -22, left: '50%', transform: 'translateX(-50%)',
          fontSize: 9, color: '#7be3ff', letterSpacing: '0.2em',
          fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>◆ locked</div>
      )}
      {label && (
        <div style={{
          position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)',
          fontSize: 10, color: '#bba8ff', fontFamily: 'JetBrains Mono, monospace',
        }}>{label}</div>
      )}
    </div>
  );
}
