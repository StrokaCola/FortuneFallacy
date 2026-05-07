import { useState, useEffect, useRef } from 'react';
import { dispatch } from '../../actions/dispatch';
import * as audioSettings from '../../audio/audioSettings';
import { getMotionPref, setMotionPref, subscribeMotionPref, type MotionPref } from '../hooks/useMotion';
import { sfxPlay } from '../../audio/sfx';
import { useFocusTrap } from '../hud/useFocusTrap';

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
        aria-label={`${label} volume`}
        style={{ accentColor: '#7be3ff', width: '100%' }}
      />
    </label>
  );
}

function MotionToggle({ pref }: { pref: MotionPref }) {
  const opts: { id: MotionPref; label: string; hint: string }[] = [
    { id: 'allow', label: 'Full',    hint: 'Always animate' },
    { id: 'os',    label: 'Match system', hint: 'Use OS Reduce Motion preference' },
    { id: 'reduce', label: 'Reduced', hint: 'Minimise motion in-app' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.28em', color: '#bba8ff' }}>motion</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label="Motion preference">
        {opts.map((o) => {
          const active = pref === o.id;
          return (
            <button key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={o.hint}
              className="btn btn-ghost mat-interactive tap"
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
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        pointerEvents: 'auto',
        padding: 16,
        animation: 'fadein 400ms ease-out both',
      }}>
      <div className="panel-strong" style={{
        width: 'min(460px, 100%)', padding: 'clamp(20px, 3vw, 32px)', position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 22,
        maxHeight: 'calc(100% - 32px)', overflowY: 'auto',
      }}>
        <span className="flourish-corner tl" />
        <span className="flourish-corner tr" />
        <span className="flourish-corner bl" />
        <span className="flourish-corner br" />

        <div style={{ textAlign: 'center' }}>
          <div className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.5em', color: '#bba8ff' }}>
            ◇ preferences ◇
          </div>
          <div className="f-display" style={{ fontSize: 'clamp(22px, 6vw, 32px)', color: '#f3f0ff', marginTop: 6 }}>
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

        <div style={{ height: 1, background: 'rgba(149,119,255,0.2)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.28em', color: '#bba8ff' }}>tutorial</span>
          <button
            type="button"
            className="btn btn-ghost mat-interactive tap"
            onClick={() => {
              dispatch({ type: 'RESET_ONBOARDING' });
              sfxPlay('uiClick');
            }}
            style={{ fontSize: 11, padding: '8px 14px' }}
          >
            Replay tutorial
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-ghost mat-interactive tap"
            onClick={() => {
              audioSettings.setMaster(1);
              audioSettings.setMusic(1);
              audioSettings.setSfx(1);
              setMotionPref('os');
              sfxPlay('uiClick');
            }}
            style={{ fontSize: 11, padding: '8px 14px' }}
          >
            Restore defaults
          </button>
          <button
            type="button"
            className="btn btn-primary mat-interactive tap"
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}
          >
            ← Done
          </button>
        </div>
      </div>
    </div>
  );
}
