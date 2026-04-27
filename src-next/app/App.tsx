import { DebugPanel } from '../devtools/DebugPanel';
import { EventLogger } from '../devtools/EventLogger';
import { BossReveal } from './hud/BossReveal';
import { Particles } from './hud/Particles';
import { useStore } from '../state/store';
import { selectScreen, selectIsBoss } from '../state/selectors';
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

export function App() {
  useMotion();
  const screen = useStore(selectScreen);
  const isBoss = useStore(selectIsBoss);

  const theme: ThemeKey =
    screen === 'shop' || screen === 'forge' ? 'sandstorm' :
    isBoss && screen === 'round' ? 'voidlit' :
    'voidlit';

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <CosmosBackground theme={theme} density={1} nebula drift />

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
        <Particles />
      </div>

      {import.meta.env.DEV && (
        <>
          <DebugPanel />
          <EventLogger />
        </>
      )}
    </div>
  );
}
