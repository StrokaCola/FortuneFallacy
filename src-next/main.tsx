import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { bus } from './events/bus';
import { dispatch } from './actions/dispatch';
import { store, setStateRaw } from './state/store';
import { applySavedToInitial, startPersistence } from './state/persistence';
import { startDiscoveryBridge } from './state/discoveryBridge';
import { startAudioBridge, ensureAudioAfterGesture, audioEngine, sfxBank } from './audio/audioBridge';
import { startHapticsBridge } from './app/haptics/hapticsBridge';
import { sfxInit } from './audio/sfx';
import { startScalingSfxListener } from './audio/listeners/scalingSfx';
import { installButtonJuice } from './app/hud/buttonJuice';
import { startLeaderboard } from './online/leaderboard';
import { startFrameBudgetWatcher, installPerfBodyClass } from './app/perf/perfMode';
import { ensureRoundBundle } from './app/perf/roundBundle';
import { startAchievementListener } from './core/achievements/listener';
import { startConstellationUnlockListener } from './core/constellations/listener';
import { startDiceLandShake } from './app/visual/diceLandShake';
import { applyColorblindClass } from './app/visual/colorblind';
import { installStage } from './render/stage';
import './styles/index.css';

installStage();

// The dice canvas .active class still flips with the screen so the
// CSS layer paints correctly the moment the round bundle resolves.
const threeCanvas = document.getElementById('three-next');
if (threeCanvas instanceof HTMLCanvasElement) {
  store.subscribe((s, prev) => {
    if (s.ui.screen !== prev.ui.screen) {
      threeCanvas.classList.toggle('active', s.ui.screen === 'round');
    }
  });
  threeCanvas.classList.toggle('active', store.getState().ui.screen === 'round');
}

setStateRaw((s) => applySavedToInitial(s));

const portal = window.Portal?.readPortalParams();
if (portal?.fromPortal) {
  setStateRaw((s) => ({
    ...s,
    meta: { ...s.meta, playerName: portal.username },
    // If a run is in progress, route directly to Hub; otherwise still skip Title to Hub.
    ui: { ...s.ui, screen: 'hub' },
  }));
}

// Kick off the round-time bundle (Three.js + Rapier + Dice3D + sim
// runner) in the background. Non-blocking - the shell renders
// immediately while the chunks stream in. Round.tsx gates the Roll
// button on readiness via useRoundBundleReady().
void ensureRoundBundle();
startAudioBridge();
startHapticsBridge();
startDiscoveryBridge();
startPersistence();
installButtonJuice();
startLeaderboard();
startFrameBudgetWatcher();
installPerfBodyClass();
startAchievementListener();
startConstellationUnlockListener();
startScalingSfxListener();
startDiceLandShake();
applyColorblindClass();
ensureAudioAfterGesture();

const sfxUnlockEvents = ['pointerdown', 'touchend', 'click', 'keydown'] as const;
const sfxGestureHandler = () => {
  void sfxInit();
  for (const e of sfxUnlockEvents) document.removeEventListener(e, sfxGestureHandler);
};
for (const e of sfxUnlockEvents) document.addEventListener(e, sfxGestureHandler);

if (import.meta.env.DEV) {
  (window as unknown as { __ff: unknown }).__ff = { store, dispatch, audio: audioEngine, sfx: { bank: sfxBank } };
  void Promise.all([
    import('./devtools/inspector/overrides'),
    import('./devtools/inspector/applyOverrides'),
    import('./devtools/inspector/picker'),
    import('./devtools/inspector/spawnRecorder'),
  ]).then(([overrides, applier, picker, recorder]) => {
    overrides.loadOverridesFromStorage();
    overrides.installOverridePersistence();
    applier.installOverrideApplier();
    picker.installPicker();
    recorder.installSpawnRecorder();
  });
}

if (import.meta.env.DEV) {
  bus.onAny((key, payload) => {
    // eslint-disable-next-line no-console
    console.log(`[bus] ${String(key)}`, payload);
  });
}

const host = document.getElementById('next-root');
if (!host) throw new Error('#next-root missing');
createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Dismiss the boot splash. React has rendered; wait one frame so
// the first paint includes our shell, then hold the splash long
// enough for its polyline + stars animation (~1100ms) to actually
// finish on slow loads before triggering the CSS opacity transition.
// Wave T — the hold + extended fade lets the Title polyline draw in
// underneath the still-visible boot splash, so the eye reads the
// constellation as a single continuous element bridging boot→Title
// rather than two separate flashes. After the fade settles, remove
// the splash DOM entirely so it can't intercept pointer events on
// slow machines.
const BOOT_MIN_HOLD_MS = 1100; // matches boot-draw + star-pop tail
const BOOT_FADE_MS = 820;      // matches CSS transition in index.html
const bootStart = performance.now();
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const elapsed = performance.now() - bootStart;
    const remaining = Math.max(0, BOOT_MIN_HOLD_MS - elapsed);
    window.setTimeout(() => {
      document.body.removeAttribute('data-boot');
      window.setTimeout(() => {
        const splash = document.getElementById('boot-splash-inline');
        if (splash) splash.remove();
      }, BOOT_FADE_MS + 60);
    }, remaining);
  });
});
