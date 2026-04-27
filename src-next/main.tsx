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
import { startLeaderboard } from './online/leaderboard';
import { Dice3D } from './render/three/Dice3D';
import './styles/index.css';

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
startLeaderboard();
ensureAudioAfterGesture();

const sfxGestureHandler = () => {
  void sfxInit();
  document.removeEventListener('click', sfxGestureHandler);
  document.removeEventListener('keydown', sfxGestureHandler);
};
document.addEventListener('click', sfxGestureHandler);
document.addEventListener('keydown', sfxGestureHandler);

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
