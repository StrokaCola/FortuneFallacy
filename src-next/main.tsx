import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { bus } from './events/bus';
import { startSimRunner } from './simulation/runSimulation';
import { dispatch } from './actions/dispatch';
import { store, setStateRaw } from './state/store';
import { applySavedToInitial, startPersistence } from './state/persistence';
import { startAudioBridge, ensureAudioAfterGesture, audioEngine, sfxBank } from './audio/audioBridge';
import { sfxInit } from './audio/sfx';
import { installButtonJuice } from './app/hud/buttonJuice';
import { startLeaderboard } from './online/leaderboard';
import { Dice3D } from './render/three/Dice3D';
import { installStage } from './render/stage';
import { initNebula, setNebulaScreen, flashNebula } from './render/bg/nebula';
import './styles/index.css';

installStage();

// Procedural WebGL nebula backdrop. Skipped under reduce-motion (which prefers
// the cheap static CosmosBackground gradient) or if WebGL init fails.
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const bgCanvas = document.getElementById('bg-next');
if (bgCanvas instanceof HTMLCanvasElement && !prefersReducedMotion) {
  try {
    if (initNebula(bgCanvas)) {
      document.documentElement.classList.add('nebula-on');
      setNebulaScreen(store.getState().ui.screen);
      store.subscribe((s, prev) => {
        if (s.ui.screen !== prev.ui.screen) setNebulaScreen(s.ui.screen);
      });
      bus.on('onScoreBeat', ({ beat }) => {
        // Only flash on the punctuating beats — die-tick is too frequent.
        if (beat.kind === 'mult-slam') flashNebula(0.45);
        else if (beat.kind === 'cross-target') flashNebula(0.7);
        else if (beat.kind === 'boom') flashNebula(beat.crossedTarget ? 0.95 : 0.55);
      });
      bus.on('onBlindCleared', () => flashNebula(0.7));
      bus.on('onBossRevealed', () => flashNebula(1.0));
    }
  } catch (e) {
    console.warn('[nebula] init failed; falling back to CosmosBackground:', e);
  }
}

const threeCanvas = document.getElementById('three-next');
if (threeCanvas instanceof HTMLCanvasElement) {
  try {
    const d3 = new Dice3D(threeCanvas);
    (window as unknown as { __dice3d: Dice3D }).__dice3d = d3;
  } catch (e) {
    console.error('[Dice3D] init failed:', e);
  }
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

startSimRunner();
startAudioBridge();
startPersistence();
installButtonJuice();
startLeaderboard();
ensureAudioAfterGesture();

const sfxUnlockEvents = ['pointerdown', 'touchend', 'click', 'keydown'] as const;
const sfxGestureHandler = () => {
  void sfxInit();
  for (const e of sfxUnlockEvents) document.removeEventListener(e, sfxGestureHandler);
};
for (const e of sfxUnlockEvents) document.addEventListener(e, sfxGestureHandler);

if (import.meta.env.DEV) {
  (window as unknown as { __ff: unknown }).__ff = { store, dispatch, audio: audioEngine, sfx: { bank: sfxBank } };
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
