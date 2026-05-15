import { useState, useEffect, useRef } from 'react';
import { dispatch } from '../../actions/dispatch';
import * as audioSettings from '../../audio/audioSettings';
import { ScreenHeader } from '../visual/AstralPrimitives';
import { getMotionPref, setMotionPref, subscribeMotionPref, type MotionPref } from '../hooks/useMotion';
import { getHapticsPref, setHapticsPref, subscribeHapticsPref, type HapticsPref } from '../haptics/haptics';
import { getColorblindPref, setColorblindPref, subscribeColorblind } from '../visual/colorblind';
import {
  getOrientationOverride, setOrientationOverride, subscribeOrientationOverride,
  getLongPressPref, setLongPressPref, subscribeLongPressPref, type LongPressPref,
} from '../a11y/inputPrefs';
import {
  getPerfMode, setPerfMode, subscribePerfMode, type PerfMode,
} from '../perf/perfMode';
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

function useHapticsPrefState(): HapticsPref {
  const [p, setP] = useState<HapticsPref>(getHapticsPref());
  useEffect(() => subscribeHapticsPref(() => setP(getHapticsPref())), []);
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
        className="ff-range"
        type="range" min={0} max={1} step={0.01} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${label} volume`}
        style={{ width: '100%' }}
      />
    </label>
  );
}

// Colorblind preset toggle. v1 ships a single high-contrast preset
// safe across the three common CVDs (deuteranopia / protanopia /
// tritanopia) plus shape redundancy on rarity badges. Per-CVD
// presets can layer on later.
function ColorblindToggle() {
  const [pref, setPref] = useState(getColorblindPref());
  useEffect(() => subscribeColorblind(() => setPref(getColorblindPref())), []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.28em', color: '#bba8ff' }}>colorblind palette</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label="Colorblind palette preference">
        {[
          { id: 'off', label: 'Default', hint: 'Original hue-driven palette' },
          { id: 'high_contrast', label: 'High contrast', hint: 'High-luminance palette + shape redundancy on rarity badges' },
        ].map((o) => {
          const active = pref === o.id;
          return (
            <button key={o.id}
              type="button" role="radio" aria-checked={active}
              title={o.hint}
              className="btn btn-ghost mat-interactive tap"
              onClick={() => setColorblindPref(o.id as 'off' | 'high_contrast')}
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

// Sound captions toggle — accessibility for deaf/HoH players. Local
// state mirrors localStorage via subscribe so the radio reflects the
// stored value immediately on mount.
function CaptionsToggle() {
  const [enabled, setEnabled] = useState(audioSettings.getCaptionsEnabled());
  useEffect(() => audioSettings.subscribeCaptions(() => setEnabled(audioSettings.getCaptionsEnabled())), []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.28em', color: '#bba8ff' }}>sound captions</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label="Sound captions preference">
        {[
          { id: 'on',  label: 'On',  hint: 'Floating text labels for every gameplay sound', val: true },
          { id: 'off', label: 'Off', hint: 'No captions', val: false },
        ].map((o) => {
          const active = enabled === o.val;
          return (
            <button key={o.id}
              type="button" role="radio" aria-checked={active}
              title={o.hint}
              className="btn btn-ghost mat-interactive tap"
              onClick={() => audioSettings.setCaptionsEnabled(o.val)}
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

function HapticsToggle({ pref }: { pref: HapticsPref }) {
  const opts: { id: HapticsPref; label: string; hint: string }[] = [
    { id: 'on',  label: 'On',  hint: 'Always buzz on key moments' },
    { id: 'os',  label: 'Match system', hint: 'Buzz unless Reduce Motion is on' },
    { id: 'off', label: 'Off', hint: 'No vibration' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.28em', color: '#bba8ff' }}>haptics</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label="Haptics preference">
        {opts.map((o) => {
          const active = pref === o.id;
          return (
            <button key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={o.hint}
              className="btn btn-ghost mat-interactive tap"
              onClick={() => setHapticsPref(o.id)}
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

// Motor a11y: replace the phone-landscape rotate-prompt wall with an
// override toggle so players who can only hold their device fixed can play.
function OrientationOverrideToggle() {
  const [on, setOn] = useState(getOrientationOverride);
  useEffect(() => subscribeOrientationOverride(() => setOn(getOrientationOverride())), []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.28em', color: '#bba8ff' }}>allow landscape on phone</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label="Allow phone-landscape preference">
        {[
          { id: 'off', label: 'Default', hint: 'Show rotate prompt when a phone is held landscape', val: false },
          { id: 'on',  label: 'Allow',   hint: 'Skip the rotate prompt — useful for mounted devices and motor-accessibility cases', val: true  },
        ].map((o) => {
          const active = on === o.val;
          return (
            <button key={o.id}
              type="button" role="radio" aria-checked={active}
              title={o.hint}
              className="btn btn-ghost mat-interactive tap"
              onClick={() => setOrientationOverride(o.val)}
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

// Motor a11y: shorten the tooltip hold duration for players with tremors,
// arthritis, or limited dexterity. Three presets: standard / quick / instant.
function LongPressToggle() {
  const [pref, setPref] = useState<LongPressPref>(getLongPressPref);
  useEffect(() => subscribeLongPressPref(() => setPref(getLongPressPref())), []);
  const opts: { id: LongPressPref; label: string; hint: string }[] = [
    { id: 'standard', label: 'Standard', hint: '450 ms hold to pin a tooltip (default)' },
    { id: 'quick',    label: 'Quick',    hint: '200 ms hold — easier on tremors / arthritis' },
    { id: 'instant',  label: 'Instant',  hint: '60 ms — almost any tap pins the tooltip' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.28em', color: '#bba8ff' }}>long-press hold</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label="Long-press hold duration preference">
        {opts.map((o) => {
          const active = pref === o.id;
          return (
            <button key={o.id}
              type="button" role="radio" aria-checked={active}
              title={o.hint}
              className="btn btn-ghost mat-interactive tap"
              onClick={() => setLongPressPref(o.id)}
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

// Performance Mode: governs the renderer quality tier. 'auto' (default)
// uses a low-end heuristic + a live frame-budget watcher; 'on' forces
// degraded; 'off' forces full quality. DPR / antialias changes take
// effect on next page reload; nebula framerate updates live.
function PerfModeToggle() {
  const [pref, setPref] = useState<PerfMode>(getPerfMode);
  useEffect(() => subscribePerfMode(() => setPref(getPerfMode())), []);
  const opts: { id: PerfMode; label: string; hint: string }[] = [
    { id: 'off',  label: 'Full',    hint: 'Full quality (PBR, antialias, 30fps backdrop). Best look.' },
    { id: 'auto', label: 'Auto',    hint: 'Adapts to device + live frame budget. Default. (Recommended)' },
    { id: 'on',   label: 'Performance', hint: 'Lower DPR + no AA + softer shadows + drops cosmos halos, stardust drift, edition animations. Reload to fully apply DPR/AA.' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.28em', color: '#bba8ff' }}>performance mode</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label="Performance mode preference">
        {opts.map((o) => {
          const active = pref === o.id;
          return (
            <button key={o.id}
              type="button" role="radio" aria-checked={active}
              title={o.hint}
              className="btn btn-ghost mat-interactive tap"
              onClick={() => setPerfMode(o.id)}
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
  const hapticsPref = useHapticsPrefState();
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
      <div className="panel-strong ff-panel-settle" style={{
        width: 'min(460px, 100%)', padding: 'clamp(20px, 3vw, 32px)', position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 22,
        maxHeight: 'calc(100% - 32px)', overflowY: 'auto',
      }}>
        <span className="flourish-corner tl" />
        <span className="flourish-corner tr" />
        <span className="flourish-corner bl" />
        <span className="flourish-corner br" />

        <ScreenHeader title="Settings" subtitle="◇ preferences ◇" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Slider label="master volume" value={audio.master} onChange={audioSettings.setMaster} />
          <Slider label="music"          value={audio.music}  onChange={audioSettings.setMusic}  />
          <Slider label="sfx"            value={audio.sfx}    onChange={audioSettings.setSfx}    />
        </div>

        <div style={{ height: 1, background: 'rgba(149,119,255,0.2)' }} />

        <MotionToggle pref={pref} />

        <HapticsToggle pref={hapticsPref} />

        <CaptionsToggle />

        <ColorblindToggle />

        <OrientationOverrideToggle />

        <LongPressToggle />

        <PerfModeToggle />

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
