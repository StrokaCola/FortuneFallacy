import { useEffect, useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { PortalGate } from '../portal/PortalGate';
import * as audioSettings from '../../audio/audioSettings';

const selectPaused = (s: GameState) => s.ui.paused;

type Sliders = { master: number; music: number; sfx: number };

function readSliders(): Sliders {
  return {
    master: audioSettings.getMaster(),
    music: audioSettings.getMusic(),
    sfx: audioSettings.getSfx(),
  };
}

export function PauseMenu() {
  const paused = useStore(selectPaused);
  const [sliders, setSliders] = useState<Sliders>(readSliders);

  useEffect(() => {
    if (!paused) return;
    setSliders(readSliders());
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
      style={{
        position: 'absolute', inset: 0, zIndex: 50,
        background: 'rgba(7,5,26,0.75)',
        display: 'grid', placeItems: 'center',
        animation: 'fadein 200ms ease-out',
        pointerEvents: 'auto',
      }}
    >
      <div
        className="panel-strong"
        style={{
          width: 440, padding: 28,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
        }}
      >
        <div className="f-display" style={{
          fontSize: 28, color: '#f5c451', letterSpacing: '0.4em',
        }}>
          ◇ PAUSED ◇
        </div>

        <button
          className="btn btn-primary mat-interactive"
          style={{ width: 220 }}
          onClick={onResume}
        >
          Resume
        </button>

        <div style={{ width: '100%', height: 1, background: 'rgba(149,119,255,0.2)', margin: '8px 0' }} />

        <div className="f-mono uc" style={{
          fontSize: 10, letterSpacing: '0.3em', color: '#bba8ff',
        }}>
          ◈ AUDIO MIXER
        </div>

        <SliderRow label="Master" value={sliders.master} onChange={audioSettings.setMaster} />
        <SliderRow label="Music"  value={sliders.music}  onChange={audioSettings.setMusic} />
        <SliderRow label="Sfx"    value={sliders.sfx}    onChange={audioSettings.setSfx} />

        <div style={{ width: '100%', height: 1, background: 'rgba(149,119,255,0.2)', margin: '8px 0' }} />

        <div className="f-mono uc" style={{
          fontSize: 10, letterSpacing: '0.3em', color: '#bba8ff',
        }}>
          ◈ TRAVEL
        </div>

        <PortalGate size={72} label="Travel" />

        <div style={{ width: '100%', height: 1, background: 'rgba(149,119,255,0.2)', margin: '8px 0' }} />

        <button
          className="btn btn-ghost mat-interactive"
          style={{ width: 220 }}
          onClick={onBackToTitle}
        >
          ← Back to Title
        </button>
      </div>
    </div>
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
