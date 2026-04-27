import { useMemo } from 'react';

export type ThemeKey = 'midnight' | 'voidlit' | 'sandstorm' | 'abyssal';

const THEMES: Record<ThemeKey, {
  bgFar: string; bgMid: string; bgNear: string;
  nebulaA: string; nebulaB: string; nebulaC: string;
  star: string; accent: string;
}> = {
  midnight: { bgFar: '#07051a', bgMid: '#0f0925', bgNear: '#1c1245',
    nebulaA: 'rgba(118, 71, 245, 0.35)', nebulaB: 'rgba(123, 227, 255, 0.18)', nebulaC: 'rgba(255, 120, 71, 0.12)',
    star: '#dcd4ff', accent: '#7be3ff' },
  voidlit: { bgFar: '#020108', bgMid: '#04031a', bgNear: '#0a0830',
    nebulaA: 'rgba(255, 71, 168, 0.22)', nebulaB: 'rgba(123, 227, 255, 0.20)', nebulaC: 'rgba(245, 196, 81, 0.10)',
    star: '#ffe7fb', accent: '#ff7adf' },
  sandstorm: { bgFar: '#1a0a05', bgMid: '#2c1408', bgNear: '#3d1d10',
    nebulaA: 'rgba(255, 138, 71, 0.30)', nebulaB: 'rgba(245, 196, 81, 0.22)', nebulaC: 'rgba(226, 51, 74, 0.14)',
    star: '#ffe9c8', accent: '#f5c451' },
  abyssal: { bgFar: '#02080d', bgMid: '#04141d', bgNear: '#072330',
    nebulaA: 'rgba(123, 227, 255, 0.32)', nebulaB: 'rgba(71, 245, 173, 0.18)', nebulaC: 'rgba(149, 119, 255, 0.12)',
    star: '#dff7ff', accent: '#7be3ff' },
};

function Starfield({ density = 1, theme = 'voidlit', drift = true, tension = 0 }: { density?: number; theme?: ThemeKey; drift?: boolean; tension?: number }) {
  const t = THEMES[theme];
  // Speed up drift with tension: tension=0 → 1×, tension=1 → 1.4×
  const driftMul = 1 + 0.4 * tension;
  const layers = useMemo(() => {
    const make = (count: number, sizeMin: number, sizeMax: number, dist: number) => {
      const stars = [];
      for (let i = 0; i < count * density; i++) {
        stars.push({
          x: Math.random() * 100,
          y: Math.random() * 100,
          r: sizeMin + Math.random() * (sizeMax - sizeMin),
          o: 0.3 + Math.random() * 0.7,
          d: 1 + Math.random() * 4,
          c: Math.random() < 0.06 ? '#7be3ff' : Math.random() < 0.07 ? '#f5c451' : t.star,
        });
      }
      return { stars, dist };
    };
    return [make(60, 0.5, 1.2, 0.3), make(40, 0.8, 1.8, 0.6), make(18, 1.4, 2.6, 1.0)];
  }, [density, theme, t.star]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {layers.map((layer, li) => (
        <svg key={li}
          width="100%" height="100%"
          viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
          style={{
            position: 'absolute', inset: 0,
            animation: drift ? `drift ${(180 / layer.dist) / driftMul}s linear infinite alternate` : 'none',
            opacity: 0.5 + layer.dist * 0.4,
          }}>
          {layer.stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.15} fill={s.c} opacity={s.o}
              style={{ animation: `twinkle ${2 + s.d}s ${s.d}s ease-in-out infinite` }} />
          ))}
        </svg>
      ))}
    </div>
  );
}

function Nebula({ theme = 'voidlit', intensity = 1 }: { theme?: ThemeKey; intensity?: number }) {
  const t = THEMES[theme];
  if (intensity <= 0) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: intensity }}>
      <div style={{ position: 'absolute', left: '-10%', top: '-15%', width: '70%', height: '70%',
        background: `radial-gradient(circle, ${t.nebulaA} 0%, transparent 65%)`, filter: 'blur(20px)' }} />
      <div style={{ position: 'absolute', right: '-15%', top: '20%', width: '70%', height: '80%',
        background: `radial-gradient(circle, ${t.nebulaB} 0%, transparent 60%)`, filter: 'blur(28px)' }} />
      <div style={{ position: 'absolute', left: '20%', bottom: '-20%', width: '70%', height: '60%',
        background: `radial-gradient(circle, ${t.nebulaC} 0%, transparent 60%)`, filter: 'blur(24px)' }} />
    </div>
  );
}

export function CosmosBackground({
  theme = 'voidlit',
  density = 1,
  nebula = true,
  drift = true,
  tension = 0,
}: { theme?: ThemeKey; density?: number; nebula?: boolean; drift?: boolean; tension?: number }) {
  const t = THEMES[theme];
  const tensionClamped = Math.max(0, Math.min(1, tension));
  // Crimson tint fades in from 0 starting at tension=0.3, reaching opacity 0.25 at tension=1.
  const crimsonOpacity = tensionClamped < 0.3 ? 0 : (tensionClamped - 0.3) * (0.25 / 0.7);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      background: `radial-gradient(ellipse at 50% 35%, ${t.bgNear} 0%, ${t.bgMid} 45%, ${t.bgFar} 100%)`,
    }}>
      <Nebula theme={theme} intensity={nebula ? 1 : 0.3} />
      <Starfield density={density} theme={theme} drift={drift} tension={tensionClamped} />
      {crimsonOpacity > 0 && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(226,51,74,1) 100%)',
          opacity: crimsonOpacity,
          mixBlendMode: 'multiply',
          transition: 'opacity 600ms ease',
        }} />
      )}
    </div>
  );
}
