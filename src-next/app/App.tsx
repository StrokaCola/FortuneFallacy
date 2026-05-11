import { useEffect } from 'react';
import { DevConsole } from '../devtools/DevConsole';
import { BoundsOverlay } from '../devtools/inspector/BoundsOverlay';
import { SpawnOverlay } from '../devtools/inspector/SpawnOverlay';
import { useScoreSequenceController } from './hud/scoreSequenceController';
import { BossReveal } from './hud/BossReveal';
import { ArrivalToast } from './hud/ArrivalToast';
import { AchievementToast } from './hud/AchievementToast';
import { WhisperToast } from './hud/WhisperToast';
import { ForgeAttachRitual } from './hud/ForgeAttachRitual';
import { DailyLoginComet } from './hud/DailyLoginComet';
import { SoundCaptions } from './hud/SoundCaptions';
import { AuditEvent } from './hud/AuditEvent';
import { SellTriggerToast } from './hud/SellTriggerToast';
import { Particles } from './hud/Particles';
import { OrientationGate } from './hud/OrientationGate';
import { PauseMenu } from './hud/PauseMenu';
import { PackOverlay } from './screens/PackOverlay';
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
import { Forge } from './screens/Forge';
import { Scores } from './screens/Scores';
import { NameEntry } from './screens/NameEntry';
import { Settings } from './screens/Settings';
import { Codex } from './screens/Codex';
import { ChallengeSelect } from './screens/ChallengeSelect';
import { AstralForge } from './screens/AstralForge';
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
    if (screen === 'title' || screen === 'nameentry' || screen === 'constellation_select' || screen === 'hub' || screen === 'shop' || screen === 'forge' || screen === 'win' || screen === 'scores' || screen === 'astral_forge') {
      // win/scores reuse hub track; constellation_select, nameentry, astral_forge reuse title track.
      const target: ScreenId =
        (screen === 'win' || screen === 'scores') ? 'hub'
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
            {screen === 'forge'  && <Forge />}
            {screen === 'win'    && <Win />}
            {screen === 'fail'   && <Fail />}
            {screen === 'scores' && <Scores />}
            {screen === 'settings' && <Settings />}
            {screen === 'codex' && <Codex />}
            {screen === 'challenges' && <ChallengeSelect />}
            {screen === 'astral_forge' && <AstralForge />}
          </ScreenTransition>
          <BossReveal />
          <ArrivalToast />
          <AchievementToast />
          <WhisperToast />
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
        <CoachmarkController />
        {import.meta.env.DEV && <DevConsole />}
        {import.meta.env.DEV && <BoundsOverlay />}
        {import.meta.env.DEV && <SpawnOverlay />}
      </div>
    </DiagnosticOverlay>
  );
}
