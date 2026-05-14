import { useEffect, lazy, Suspense } from 'react';
import { DevConsole } from '../devtools/DevConsole';
import { BoundsOverlay } from '../devtools/inspector/BoundsOverlay';
import { SpawnOverlay } from '../devtools/inspector/SpawnOverlay';
import { useScoreSequenceController } from './hud/scoreSequenceController';
import { BossReveal } from './hud/BossReveal';
import { BossPhaseBanner } from './hud/BossPhaseBanner';
import { ArrivalToast } from './hud/ArrivalToast';
import { AchievementToast } from './hud/AchievementToast';
import { WhisperToast } from './hud/WhisperToast';
import { ToastHost } from './hud/toastQueue';
import { ResonanceToast } from './hud/ResonanceToast';
import { ForgeAttachRitual } from './hud/ForgeAttachRitual';
import { DailyLoginComet } from './hud/DailyLoginComet';
import { SoundCaptions } from './hud/SoundCaptions';
import { AuditEvent } from './hud/AuditEvent';
import { SellTriggerToast } from './hud/SellTriggerToast';
import { Particles } from './hud/Particles';
import { OrientationGate } from './hud/OrientationGate';
import { PauseMenu } from './hud/PauseMenu';
import { PackOverlay } from './screens/PackOverlay';
import { SkipBountyOverlay } from './screens/SkipBountyOverlay';
import { useStore, store } from '../state/store';
import { selectScreen, selectIsBoss, selectTensionFromState, selectPendingPack, selectScore, selectTarget } from '../state/selectors';
import { dispatch } from '../actions/dispatch';
import { Title } from './screens/Title';
import { ConstellationSelect } from './screens/ConstellationSelect';
import { Hub }   from './screens/Hub';
import { Round } from './screens/Round';
import { Shop }  from './screens/Shop';
import { Win }   from './screens/Win';
import { Fail }  from './screens/Fail';
// Forge is the only screen that statically imports the Three.js DieView
// renderer. Lazy-load it so `three` (~580 KB raw / ~130 KB gz) stays out
// of the initial bundle - the screen is reachable from Hub, so users who
// never open the Forge never pay for it. See app/perf/roundBundle for
// the matching dynamic split on the round-time stack.
const Forge = lazy(() => import('./screens/Forge').then((m) => ({ default: m.Forge })));
import { Scores } from './screens/Scores';
import { NameEntry } from './screens/NameEntry';
import { Settings } from './screens/Settings';
import { Codex } from './screens/Codex';
import { ChallengeSelect } from './screens/ChallengeSelect';
import { AstralForge } from './screens/AstralForge';
import { EventScreen } from './screens/EventScreen';
import { CoachmarkController } from './onboarding/CoachmarkController';
import { installLongPressTooltips } from './ui/longPressTip';
import { CosmosBackground, type ThemeKey } from './visual/CosmosBackground';
import { DiagnosticOverlay } from './visual/DiagnosticOverlay';
import { useMotion } from './hooks/useMotion';
import { ScreenTransition } from './visual/ScreenTransition';
import { audioEngine, ensureAudioAfterGesture } from '../audio/AudioEngine';
import { screenMusic, type ScreenId } from '../audio/ScreenMusic';

export function App() {
  useMotion();
  useScoreSequenceController();
  const screen = useStore(selectScreen);
  const isBoss = useStore(selectIsBoss);
  const tension = useStore(selectTensionFromState);
  const pendingPack = useStore(selectPendingPack);
  // Score-progress drives the gold tint + halo aura on the cosmos
  // background — completely orthogonal to tension. >=1.0 = crossed
  // target; >=2.0 = doubled over. Clamped in CosmosBackground.
  const score = useStore(selectScore);
  const target = useStore(selectTarget);
  const progress = target > 0 ? score / target : 0;

  useEffect(() => {
    ensureAudioAfterGesture();
  }, []);

  useEffect(() => {
    const handle = installLongPressTooltips();
    return () => handle.dispose();
  }, []);

  useEffect(() => {
    const isRound = screen === 'round';
    audioEngine.setActive(isRound);
    if (isRound) {
      screenMusic.stop();
      return;
    }
    if (screen === 'title' || screen === 'nameentry' || screen === 'constellation_select' || screen === 'hub' || screen === 'shop' || screen === 'forge' || screen === 'win' || screen === 'scores' || screen === 'astral_forge' || screen === 'event') {
      // win/scores reuse hub track; constellation_select, nameentry, astral_forge reuse title track;
      // event reuses hub track (it's a peaceful Hub-adjacent screen).
      const target: ScreenId =
        (screen === 'win' || screen === 'scores' || screen === 'event') ? 'hub'
        : (screen === 'constellation_select' || screen === 'nameentry' || screen === 'astral_forge') ? 'title'
        : screen;
      screenMusic.start(target);
    }
  }, [screen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const cur = store.getState().ui.screen;
      if (cur === 'round' || cur === 'hub' || cur === 'shop' || cur === 'forge') {
        dispatch({ type: 'TOGGLE_PAUSE' });
        return;
      }
      // Meta screens — Escape returns to Title. Title itself ignores Escape
      // because there is no parent screen.
      if (cur === 'codex' || cur === 'challenges' || cur === 'scores' || cur === 'settings' || cur === 'astral_forge') {
        dispatch({ type: 'SET_SCREEN', screen: 'title' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    let lastPaused: boolean | null = null;
    const unsub = store.subscribe((s) => {
      if (s.ui.paused === lastPaused) return;
      lastPaused = s.ui.paused;
      if (s.ui.paused) {
        audioEngine.pause();
        screenMusic.pause();
      } else {
        audioEngine.resume();
        screenMusic.resume();
      }
    });
    return () => unsub();
  }, []);

  const theme: ThemeKey =
    screen === 'shop' || screen === 'forge' ? 'sandstorm' :
    isBoss && screen === 'round' ? 'voidlit' :
    'voidlit';

  return (
    <DiagnosticOverlay>
      <div className="relative w-full h-full overflow-hidden">
        <CosmosBackground theme={theme} density={1} nebula drift tension={tension} progress={progress} />

        <div className="absolute inset-0 pointer-events-none">
          <ScreenTransition screenKey={screen}>
            {screen === 'title'  && <Title />}
            {screen === 'nameentry' && <NameEntry />}
            {screen === 'constellation_select' && <ConstellationSelect />}
            {screen === 'hub'    && <Hub />}
            {screen === 'round'  && <Round />}
            {screen === 'shop'   && <Shop />}
            {screen === 'forge'  && (
              <Suspense fallback={<ForgeLoading />}>
                <Forge />
              </Suspense>
            )}
            {screen === 'win'    && <Win />}
            {screen === 'fail'   && <Fail />}
            {screen === 'scores' && <Scores />}
            {screen === 'settings' && <Settings />}
            {screen === 'codex' && <Codex />}
            {screen === 'challenges' && <ChallengeSelect />}
            {screen === 'astral_forge' && <AstralForge />}
            {screen === 'event' && <EventScreen />}
          </ScreenTransition>
          <BossReveal />
          <BossPhaseBanner />
          <ArrivalToast />
          <AchievementToast />
          <WhisperToast />
          {/* Centralised toast queue (see app/hud/toastQueue/). Migrated
              toasts push via `pushToast(...)`; this host renders the
              visible slots with priority + throttle + same-key
              merging. The other *Toast components above still own
              their own rendering; migrate them one at a time. */}
          <ToastHost />
          <ResonanceToast />
          <ForgeAttachRitual />
          <DailyLoginComet />
          <SoundCaptions />
          <AuditEvent />
          <SellTriggerToast />
          <Particles />
        </div>

        <OrientationGate />
        <PauseMenu />
        {pendingPack && <PackOverlay />}
        <SkipBountyOverlay />
        <CoachmarkController />
        {import.meta.env.DEV && <DevConsole />}
        {import.meta.env.DEV && <BoundsOverlay />}
        {import.meta.env.DEV && <SpawnOverlay />}
      </div>
    </DiagnosticOverlay>
  );
}

// Suspense fallback for the lazy-loaded Forge screen.
// Was a single line of grey text — replaced with a branded loading
// vignette so the ~580 KB three.js bundle doesn't show up as dead
// air on the first Forge visit. Rays rotate slowly + an ember glow
// pulses; both inherit the cosmos accent so the loader reads as
// part of the forge aesthetic rather than a generic spinner.
function ForgeLoading() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'grid', placeItems: 'center',
      pointerEvents: 'none',
    }}>
      <style>{`
        @keyframes forge-rays-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes forge-ember-pulse {
          0%, 100% { opacity: 0.35; transform: scale(0.85); }
          50%      { opacity: 0.75; transform: scale(1.05); }
        }
      `}</style>
      <div style={{
        position: 'relative',
        width: 140, height: 140,
        display: 'grid', placeItems: 'center',
      }}>
        {/* Rotating cyan ray ring — the forge "warming" up. */}
        <svg
          width={140}
          height={140}
          viewBox="0 0 140 140"
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            animation: 'forge-rays-spin 8s linear infinite',
          }}
        >
          <g stroke="#7be3ff" strokeLinecap="round" opacity="0.7">
            {Array.from({ length: 12 }, (_, i) => {
              const ang = (i / 12) * Math.PI * 2;
              const r1 = 48;
              const r2 = 62;
              const x1 = 70 + Math.cos(ang) * r1;
              const y1 = 70 + Math.sin(ang) * r1;
              const x2 = 70 + Math.cos(ang) * r2;
              const y2 = 70 + Math.sin(ang) * r2;
              return (
                <line
                  key={i}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  strokeWidth={i % 3 === 0 ? 1.8 : 0.8}
                  opacity={i % 3 === 0 ? 1 : 0.45}
                />
              );
            })}
          </g>
          <circle cx="70" cy="70" r="40" fill="none" stroke="#7be3ff" strokeWidth="0.6" opacity="0.4" strokeDasharray="2 3" />
        </svg>
        {/* Ember glow at the center — slow breath. */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'radial-gradient(circle, #f5c451aa, #ff7847cc 60%, transparent 100%)',
          boxShadow: '0 0 32px #ff784788, 0 0 64px #ff784744',
          animation: 'forge-ember-pulse 2200ms ease-in-out infinite',
        }} />
      </div>
      <div className="f-mono uc" style={{
        marginTop: 18,
        color: '#bba8ff', letterSpacing: '0.4em', fontSize: 11,
        opacity: 0.85,
      }}>
        the forge stirs…
      </div>
    </div>
  );
}
