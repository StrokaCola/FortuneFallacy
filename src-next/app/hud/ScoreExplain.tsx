import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { useEvent } from '../../events/react/useEvent';
import {
  buildExplanation, formatDelta, formatNumber,
  type LastScoringCtx, type Explanation,
} from './scoreExplainData';
import { Z } from './zLayers';

const LABEL_COLOR = '#bba8ff';
const CHIPS_COLOR = '#7be3ff';
const MULT_COLOR  = '#ff7847';
const CHAIN_COLOR = '#f5c451';

export function ScoreExplain() {
  const lastCtx = useStore((s) => s.round.lastScoringCtx);
  const firstHandPlayed = useStore((s) => s.round.firstHandPlayed);
  const [open, setOpen] = useState(false);

  // When a fresh hand starts scoring, collapse so the player sees the live
  // animation. They can re-open after the new score lands.
  useEvent('onScoreCalculated', () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!firstHandPlayed || !lastCtx) return null;

  return (
    <>
      <button
        className="btn btn-ghost mat-interactive tap"
        onClick={() => setOpen(true)}
        style={{
          position: 'absolute', bottom: 22, left: 22, zIndex: Z.hudControl,
          pointerEvents: 'auto', fontSize: 11, padding: '6px 12px',
        }}
        aria-label="Show breakdown of last scored hand"
        title="Why did I score that?"
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: LABEL_COLOR }}>ⓘ</span>
          Why?
        </span>
      </button>
      {open && <BreakdownModal lastCtx={lastCtx} onClose={() => setOpen(false)} />}
    </>
  );
}

function BreakdownModal({ lastCtx, onClose }: { lastCtx: LastScoringCtx; onClose: () => void }) {
  const exp = buildExplanation(lastCtx);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Score breakdown"
      style={{
        position: 'absolute', inset: 0, zIndex: Z.modal,
        background: 'rgba(7,5,26,0.78)',
        display: 'grid', placeItems: 'center',
        animation: 'fadein 180ms ease-out',
        pointerEvents: 'auto',
      }}
    >
      <div
        className="panel-strong"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 540, maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 64px)',
          padding: 24,
          display: 'flex', flexDirection: 'column', gap: 16,
          overflow: 'hidden',
        }}
      >
        <Header exp={exp} onClose={onClose} />
        <Rows exp={exp} />
        <FinalMath exp={exp} />
      </div>
    </div>
  );
}

function Header({ exp, onClose }: { exp: Explanation; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <div className="f-mono uc" style={{
          fontSize: 9, letterSpacing: '0.4em', color: LABEL_COLOR, marginBottom: 4,
        }}>
          ◇ score breakdown ◇
        </div>
        {exp.combo ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span className="f-display" style={{ fontSize: 22, color: '#f3f0ff' }}>{exp.combo.name}</span>
            <span className="f-mono num" style={{ fontSize: 12, color: CHIPS_COLOR }}>
              base +{exp.combo.baseChips} chips
            </span>
            <span style={{ width: 1, height: 12, background: 'rgba(149,119,255,0.4)' }} />
            <span className="f-mono num" style={{ fontSize: 12, color: MULT_COLOR }}>
              base ×{exp.combo.baseMult} mult
            </span>
          </div>
        ) : (
          <div className="f-display" style={{ fontSize: 22, color: '#f3f0ff' }}>No combo</div>
        )}
      </div>
      <button
        className="btn btn-ghost mat-interactive tap"
        onClick={onClose}
        aria-label="Close breakdown"
        style={{ fontSize: 14, padding: '4px 10px' }}
      >
        ✕
      </button>
    </div>
  );
}

function Rows({ exp }: { exp: Explanation }) {
  if (exp.rows.length === 0) {
    return (
      <div className="panel" style={{ padding: '16px 18px' }}>
        <div className="f-mono" style={{ fontSize: 12, color: LABEL_COLOR, opacity: 0.7 }}>
          No mods or catalysts fired this hand. Score is the combo's base value × chain.
        </div>
      </div>
    );
  }
  return (
    <div
      className="panel"
      style={{
        padding: '8px 0',
        display: 'flex', flexDirection: 'column',
        overflow: 'auto', maxHeight: 320,
      }}
    >
      {exp.rows.map((r) => (
        <div
          key={r.key}
          style={{
            display: 'grid',
            gridTemplateColumns: '28px 1fr auto auto',
            alignItems: 'center', gap: 10,
            padding: '8px 16px',
          }}
        >
          <div
            aria-hidden
            style={{
              fontSize: 18, color: r.color, textAlign: 'center',
              textShadow: `0 0 10px ${r.color}66`,
            }}
          >
            {r.icon}
          </div>
          <div>
            <div className="f-display" style={{ fontSize: 14, color: '#f3f0ff' }}>{r.label}</div>
            <div className="f-mono uc" style={{
              fontSize: 9, letterSpacing: '0.18em', color: LABEL_COLOR, opacity: 0.7,
            }}>
              {r.source} · {r.detail}
            </div>
          </div>
          <div className="f-mono num" style={{
            fontSize: 13, color: r.chipsDelta !== 0 ? CHIPS_COLOR : 'transparent',
            minWidth: 56, textAlign: 'right',
          }}>
            {r.chipsDelta !== 0 ? `${formatDelta(r.chipsDelta)} chips` : '—'}
          </div>
          <div className="f-mono num" style={{
            fontSize: 13, color: r.multDelta !== 0 ? MULT_COLOR : 'transparent',
            minWidth: 64, textAlign: 'right',
          }}>
            {r.multDelta !== 0 ? `${formatDelta(r.multDelta)} mult` : '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

function FinalMath({ exp }: { exp: Explanation }) {
  const showChain = Math.abs(exp.chainMult - 1) > 1e-6;
  return (
    <div
      className="panel"
      style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div className="f-mono uc" style={{
        fontSize: 9, letterSpacing: '0.3em', color: LABEL_COLOR,
      }}>
        ◈ final math
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <Token value={formatNumber(exp.totalChips)} label="chips" color={CHIPS_COLOR} />
        <Op>×</Op>
        <Token value={formatNumber(exp.totalMult)} label="mult" color={MULT_COLOR} />
        {showChain && (
          <>
            <Op>×</Op>
            <Token value={formatNumber(exp.chainMult)} label="chain" color={CHAIN_COLOR} />
          </>
        )}
        <Op>=</Op>
        <span className="f-display num" style={{
          fontSize: 28, color: '#f3f0ff', fontWeight: 700,
          textShadow: '0 0 18px rgba(243,240,255,0.45)',
        }}>
          {formatNumber(exp.total)}
        </span>
      </div>
    </div>
  );
}

function Token({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <span className="f-display num" style={{
        fontSize: 22, color, lineHeight: 1, textShadow: `0 0 12px ${color}55`,
      }}>{value}</span>
      <span className="f-mono uc" style={{
        fontSize: 9, letterSpacing: '0.18em', color: LABEL_COLOR, opacity: 0.7, marginTop: 2,
      }}>{label}</span>
    </span>
  );
}

function Op({ children }: { children: string }) {
  return (
    <span className="f-display" style={{ fontSize: 22, color: LABEL_COLOR, opacity: 0.7 }}>
      {children}
    </span>
  );
}
