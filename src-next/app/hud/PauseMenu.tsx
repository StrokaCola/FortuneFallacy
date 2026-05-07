import { useEffect, useRef, useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { PortalGate } from '../portal/PortalGate';
import * as audioSettings from '../../audio/audioSettings';
import { RunInfoPanel } from './RunInfoPanel';
import { Z } from './zLayers';
import { useFocusTrap } from './useFocusTrap';
import { useIsTightStage } from '../hooks/useIsCompactStage';

const selectPaused = (s: GameState) => s.ui.paused;
const selectRunActive = (s: GameState) =>
  s.run.goalIdx > 0 || s.round.score > 0 || s.run.catalysts.length > 0 || s.round.active;

type Sliders = { master: number; music: number; sfx: number };
type Tab = 'menu' | 'info';

function readSliders(): Sliders {
  return {
    master: audioSettings.getMaster(),
    music: audioSettings.getMusic(),
    sfx: audioSettings.getSfx(),
  };
}

export function PauseMenu() {
  const paused = useStore(selectPaused);
  const runActive = useStore(selectRunActive);
  const tight = useIsTightStage();
  const [sliders, setSliders] = useState<Sliders>(readSliders);
  const [tab, setTab] = useState<Tab>('menu');
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, paused);

  useEffect(() => {
    if (!paused) return;
    setSliders(readSliders());
    setTab('menu');
    const off = audioSettings.subscribe(() => setSliders(readSliders()));
    return () => off();
  }, [paused]);

  if (!paused) return null;

  const onResume = () => dispatch({ type: 'TOGGLE_PAUSE' });
  const onBackToTitle = () => {
    dispatch({ type: 'TOGGLE_PAUSE' });
    dispatch({ type: 'SET_SCREEN', screen: 'title' });
  };

  return (
    <div
      ref={dialogRef}
      style={{
        position: 'absolute', inset: 0, zIndex: Z.modalStrong,
        background: 'rgba(7,5,26,0.75)',
        display: 'grid', placeItems: 'center',
        animation: 'fadein 200ms ease-out',
        pointerEvents: 'auto',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Game paused"
    >
      <div
        className="panel-strong"
        style={{
          // Cap width to viewport on tight phones so the modal doesn't
          // touch the screen edges, and shrink padding/gap so the whole
          // dialog fits without overflowing the viewport bottom.
          width: tight
            ? `min(${tab === 'info' ? 460 : 380}px, calc(100vw - 24px))`
            : (tab === 'info' ? 520 : 440),
          padding: tight ? 14 : 24,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: tight ? 8 : 14,
          // 100dvh tracks the visible viewport (Chrome/Safari mobile address bar).
          maxHeight: tight ? 'calc(100dvh - 24px)' : '88dvh',
          // On phone landscape the slider rows + travel gate can still
          // overflow; let the modal scroll internally rather than the page.
          overflowY: 'auto',
        }}
      >
        <div className="f-display" style={{
          fontSize: tight ? 16 : 24,
          color: '#f5c451',
          letterSpacing: tight ? '0.3em' : '0.4em',
        }}>
          ◇ PAUSED ◇
        </div>

        {runActive && (
          <div style={{ display: 'flex', gap: 6 }}>
            <TabBtn active={tab === 'menu'} onClick={() => setTab('menu')}>Menu</TabBtn>
            <TabBtn active={tab === 'info'} onClick={() => setTab('info')}>Run Info</TabBtn>
          </div>
        )}

        {tab === 'menu' && (
          <>
            <button
              className="btn btn-primary mat-interactive tap"
              style={{ width: tight ? 180 : 220 }}
              onClick={onResume}
              data-autofocus
            >
              Resume
            </button>

            <div style={{ width: '100%', height: 1, background: 'rgba(149,119,255,0.2)', margin: tight ? '2px 0' : '4px 0' }} />

            <div className="f-mono uc" style={{
              fontSize: 10, letterSpacing: '0.3em', color: '#bba8ff',
            }}>
              ◈ AUDIO MIXER
            </div>

            <SliderRow label="Master" value={sliders.master} onChange={audioSettings.setMaster} />
            <SliderRow label="Music"  value={sliders.music}  onChange={audioSettings.setMusic} />
            <SliderRow label="Sfx"    value={sliders.sfx}    onChange={audioSettings.setSfx} />

            <div style={{ width: '100%', height: 1, background: 'rgba(149,119,255,0.2)', margin: '4px 0' }} />

            <div className="f-mono uc" style={{
              fontSize: 10, letterSpacing: '0.3em', color: '#bba8ff',
            }}>
              ◈ TRAVEL
            </div>

            <PortalGate size={tight ? 48 : 72} label="Travel" />

            <div style={{ width: '100%', height: 1, background: 'rgba(149,119,255,0.2)', margin: tight ? '2px 0' : '4px 0' }} />

            <button
              className="btn btn-ghost mat-interactive tap"
              style={{ width: tight ? 180 : 220 }}
              onClick={onBackToTitle}
            >
              ← Back to Title
            </button>
          </>
        )}

        {tab === 'info' && (
          <>
            <RunInfoPanel />
            <button
              className="btn btn-ghost mat-interactive tap"
              style={{ width: 180, marginTop: 6 }}
              onClick={onResume}
            >
              ↩ Back to game
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="f-mono uc tap"
      style={{
        background: active ? 'rgba(123,227,255,0.18)' : 'rgba(28,18,69,0.6)',
        border: `1px solid ${active ? '#7be3ffaa' : 'rgba(149,119,255,0.3)'}`,
        color: active ? '#7be3ff' : '#dcd4ff',
        fontSize: 10, letterSpacing: '0.28em',
        padding: '6px 14px', borderRadius: 6,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function SliderRow({ label, value, onChange }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{
      width: '100%', display: 'grid',
      gridTemplateColumns: '60px 1fr 40px',
      alignItems: 'center', gap: 10,
    }}>
      <span className="f-mono uc" style={{
        fontSize: 10, letterSpacing: '0.2em', color: '#bba8ff',
      }}>{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#7be3ff' }}
        aria-label={`${label} volume`}
      />
      <span className="f-mono num" style={{
        fontSize: 11, color: '#7be3ff', textAlign: 'right',
      }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}
