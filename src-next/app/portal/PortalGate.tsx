import { useState } from 'react';
import { useStore } from '../../state/store';
import { sfxPlay } from '../../audio/sfx';

const RUNES = ['☽', '✦', '☉', '◆', '⚝', '⊕', '⌘', '⚝'];

export function PortalGate({
  size = 96,
  label = 'Travel',
  refUrl = null,
}: {
  size?: number;
  label?: string;
  refUrl?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  const playerName = useStore((s) => s.meta.playerName);

  const onClick = async () => {
    if (!window.Portal || busy) return;
    setBusy(true);
    sfxPlay('transitionWipe');
    try {
      const target = refUrl ? { url: refUrl, title: 'home' } : await window.Portal.pickPortalTarget();
      if (!target) { setBusy(false); return; }
      // Brief expand animation then send.
      setTimeout(() => {
        window.Portal!.sendPlayerThroughPortal(target.url, {
          username: playerName || 'Wanderer',
          color: '7be3ff',
          speed: 5,
        });
      }, 320);
    } catch (e) {
      console.warn('[portal] failed:', e);
      setBusy(false);
    }
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={busy}
      title={refUrl ? 'Return to previous game' : 'Travel to another game in the jam'}
      style={{
        position: 'relative',
        width: size, height: size,
        border: 'none', background: 'transparent',
        cursor: busy ? 'wait' : 'pointer',
        padding: 0,
        transform: busy ? 'scale(1.4)' : hover ? 'scale(1.06)' : 'scale(1)',
        opacity: busy ? 0.7 : 1,
        transition: 'transform 320ms ease, opacity 320ms ease',
      }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <radialGradient id={`pg-void-${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7be3ff" stopOpacity="0.5" />
            <stop offset="40%" stopColor="#2e1d6b" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#04020c" stopOpacity="1" />
          </radialGradient>
        </defs>
        {/* outer brass ring with rune orbit */}
        <g style={{ transformOrigin: '50% 50%', animation: 'orbit 24s linear infinite' }}>
          <circle cx="50" cy="50" r="46" fill="none" stroke="#d4a64c" strokeWidth="1.2" opacity={hover ? 0.85 : 0.6} />
          {RUNES.map((r, i) => {
            const a = (i / RUNES.length) * Math.PI * 2;
            const x = 50 + Math.cos(a) * 46;
            const y = 50 + Math.sin(a) * 46;
            return (
              <text key={i} x={x} y={y} fontSize="6" fill="#f5c451" textAnchor="middle" dominantBaseline="middle">
                {r}
              </text>
            );
          })}
        </g>
        {/* inner brass ring counter-orbit */}
        <g style={{ transformOrigin: '50% 50%', animation: 'orbit 16s linear infinite reverse' }}>
          <circle cx="50" cy="50" r="36" fill="none" stroke="#8a6720" strokeWidth="0.8" opacity={hover ? 0.7 : 0.5} strokeDasharray="2 2" />
        </g>
        {/* void center */}
        <circle cx="50" cy="50" r="30" fill={`url(#pg-void-${size})`} />
        {/* starfield inside void */}
        {Array.from({ length: 8 }).map((_, i) => {
          const x = 30 + Math.random() * 40;
          const y = 30 + Math.random() * 40;
          return <circle key={i} cx={x} cy={y} r="0.4" fill="#ffffff" opacity={0.4 + Math.random() * 0.6} />;
        })}
        {/* center glyph */}
        <text x="50" y="50" fontSize="14" fill="#7be3ff" textAnchor="middle" dominantBaseline="middle"
          style={{ filter: 'drop-shadow(0 0 4px #7be3ff)' }}>
          {refUrl ? '↩' : '↳'}
        </text>
      </svg>
      <div className="f-mono uc" style={{
        position: 'absolute', bottom: -16, left: '50%', transform: 'translateX(-50%)',
        fontSize: 8, letterSpacing: '0.28em', color: '#bba8ff', whiteSpace: 'nowrap',
      }}>
        {busy ? 'opening…' : label}
      </div>
    </button>
  );
}
