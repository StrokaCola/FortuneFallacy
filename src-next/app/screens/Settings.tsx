import { useState, useEffect } from 'react';
import { dispatch } from '../../actions/dispatch';
import * as audioSettings from '../../audio/audioSettings';
import { getMotionPref, setMotionPref, subscribeMotionPref, type MotionPref } from '../hooks/useMotion';

function useAudio(): { master: number; music: number; sfx: number } {
  const [v, setV] = useState({
    master: audioSettings.getMaster(),
    music: audioSettings.getMusic(),
    sfx: audioSettings.getSfx(),
  });
  useEffect(() => audioSettings.subscribe(() => setV({
    master: audioSettings.getMaster(),
    music: audioSettings.getMusic(),
    sfx: audioSettings.getSfx(),
  })), []);
  return v;
}

function useMotionPrefState(): MotionPref {
  const [p, setP] = useState<MotionPref>(getMotionPref());
  useEffect(() => subscribeMotionPref(() => setP(getMotionPref())), []);
  return p;
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const pct = Math.round(value * 100);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.28em', color: '#bba8ff' }}>{label}</span>
        <span className="f-mono num" style={{ fontSize: 12, color: '#7be3ff' }}>{pct}</span>
      </span>
      <input
        type="range" min={0} max={1} step={0.01} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ accentColor: '#7be3ff', width: 320 }}
      />
    </label>
  );
}

function MotionToggle({ pref }: { pref: MotionPref }) {
  const opts: { id: MotionPref; label: string }[] = [
    { id: 'allow', label: 'Full' },
    { id: 'os', label: 'System' },
    { id: 'reduce', label: 'Reduced' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.28em', color: '#bba8ff' }}>motion</span>
      <div style={{ display: 'flex', gap: 8 }}>
        {opts.map((o) => {
          const active = pref === o.id;
          return (
            <button key={o.id}
              className="btn btn-ghost mat-interactive"
              onClick={() => setMotionPref(o.id)}
              style={{
                padding: '8px 14px', fontSize: 11,
                background: active ? 'rgba(123,227,255,0.18)' : undefined,
                boxShadow: active ? '0 0 0 1px rgba(123,227,255,0.65)' : undefined,
                color: active ? '#7be3ff' : '#dcd4ff',
              }}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Settings() {
  const audio = useAudio();
  const pref = useMotionPrefState();

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
      pointerEvents: 'auto',
      animation: 'fadein 400ms ease-out both',
    }}>
      <div className="panel-strong" style={{
        width: 460, padding: 32, position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 22,
      }}>
        <span className="flourish-corner tl" />
        <span className="flourish-corner tr" />
        <span className="flourish-corner bl" />
        <span className="flourish-corner br" />

        <div style={{ textAlign: 'center' }}>
          <div className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.5em', color: '#bba8ff' }}>
            ◇ preferences ◇
          </div>
          <div className="f-display" style={{ fontSize: 32, color: '#f3f0ff', marginTop: 6 }}>
            Settings
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Slider label="master volume" value={audio.master} onChange={audioSettings.setMaster} />
          <Slider label="music"          value={audio.music}  onChange={audioSettings.setMusic}  />
          <Slider label="sfx"            value={audio.sfx}    onChange={audioSettings.setSfx}    />
        </div>

        <div style={{ height: 1, background: 'rgba(149,119,255,0.2)' }} />

        <MotionToggle pref={pref} />

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
          <button
            className="btn btn-primary mat-interactive"
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}
          >
            ← Done
          </button>
        </div>
      </div>
    </div>
  );
}
