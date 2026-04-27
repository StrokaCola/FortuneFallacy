import { useEffect } from 'react';
import { DebugPanel } from '../devtools/DebugPanel';
import { BossReveal } from './hud/BossReveal';
import { ArrivalToast } from './hud/ArrivalToast';
import { Particles } from './hud/Particles';
import { useStore } from '../state/store';
import { selectScreen, selectIsBoss, selectTensionFromState } from '../state/selectors';
import { Title } from './screens/Title';
import { Hub }   from './screens/Hub';
import { Round } from './screens/Round';
import { Shop }  from './screens/Shop';
import { Win }   from './screens/Win';
import { Forge } from './screens/Forge';
import { Scores } from './screens/Scores';
import { CosmosBackground, type ThemeKey } from './visual/CosmosBackground';
import { useMotion } from './hooks/useMotion';
import { ScreenTransition } from './visual/ScreenTransition';
import { audioEngine, ensureAudioAfterGesture } from '../audio/AudioEngine';
import { screenMusic, type ScreenId } from '../audio/ScreenMusic';

export function App() {
  useMotion();
  const screen = useStore(selectScreen);
  const isBoss = useStore(selectIsBoss);
  const tension = useStore(selectTensionFromState);

  useEffect(() => {
    ensureAudioAfterGesture();
  }, []);

  useEffect(() => {
    const isRound = screen === 'round';
    audioEngine.setActive(isRound);
    if (isRound) {
      screenMusic.stop();
      return;
    }
    if (screen === 'title' || screen === 'hub' || screen === 'shop' || screen === 'forge' || screen === 'win' || screen === 'scores') {
      // win/scores reuse hub track to avoid silence on those rare screens.
      const target: ScreenId = (screen === 'win' || screen === 'scores') ? 'hub' : screen;
      screenMusic.start(target);
    }
  }, [screen, isBoss]);

  const theme: ThemeKey =
    screen === 'shop' || screen === 'forge' ? 'sandstorm' :
    isBoss && screen === 'round' ? 'voidlit' :
    'voidlit';

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <CosmosBackground theme={theme} density={1} nebula drift tension={tension} />

      <div className="absolute inset-0 pointer-events-none">
        <ScreenTransition screenKey={screen}>
          {screen === 'title'  && <Title />}
          {screen === 'hub'    && <Hub />}
          {screen === 'round'  && <Round />}
          {screen === 'shop'   && <Shop />}
          {screen === 'forge'  && <Forge />}
          {screen === 'win'    && <Win />}
          {screen === 'scores' && <Scores />}
        </ScreenTransition>
        <BossReveal />
        <ArrivalToast />
        <Particles />
      </div>

      {import.meta.env.DEV && <DebugPanel />}
    </div>
  );
}
