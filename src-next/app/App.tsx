import { useEffect, useState, lazy, Suspense } from 'react';
import { bus } from '../events/bus';
import { DevConsole } from '../devtools/DevConsole';
import { BoundsOverlay } from '../devtools/inspector/BoundsOverlay';
import { SpawnOverlay } from '../devtools/inspector/SpawnOverlay';
import { useScoreSequenceController } from './hud/scoreSequenceController';
import { BossReveal } from './hud/BossReveal';
import { BossPhaseBanner } from './hud/BossPhaseBanner';
import { ArrivalToast } from './hud/ArrivalToast';
import { AchievementToast } from './hud/AchievementToast';
import { DiscoveryFeed } from './hud/DiscoveryFeed';
import { VoucherToast } from './hud/VoucherToast';
import { WhisperToast } from './hud/WhisperToast';
import { EventFlash } from './hud/EventFlash';
import { ToastHost } from './hud/toastQueue';
import { ResonanceToast } from './hud/ResonanceToast';
import { SynergyBurstBanner } from './hud/SynergyBurstBanner';
import { FlyToCounter } from './hud/theater/FlyToCounter';
import { BeatTracer } from './hud/theater/BeatTracer';
import { ComboFlash } from './hud/theater/ComboFlash';
import { ComboSignature } from './hud/theater/ComboSignature';
import { ScoreMilestones } from './hud/theater/ScoreMilestones';
import { LockClickRipple } from './hud/LockClickRipple';
import { TheaterStage } from './hud/theater/TheaterStage';
import { CrescendoBanner } from './hud/theater/CrescendoBanner';
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
import { selectScreen, selectIsBoss, selectTensionFromState, selectScore, selectTarget } from '../state/selectors';
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
import { TutorialController } from './onboarding/tutorial/TutorialController';
import { TutorialOptInModal } from './onboarding/tutorial/TutorialOptInModal';
import { installLongPressTooltips } from './ui/longPressTip';
import { AfterglowOverlay } from './visual/AfterglowOverlay';
import { CosmosBackground, type ThemeKey } from './visual/CosmosBackground';
import { ScreenSilhouette } from './visual/ScreenSilhouette';
import { HorizonBackdrop } from './visual/HorizonBackdrop';
import { DiagnosticOverlay } from './visual/DiagnosticOverlay';
import { MythicSvgDefs } from './visual/MythicSvgDefs';
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
  // Wave T+1 (2026-05-19) reactive environment pass — track theater
  // phase so the cosmos background lifts tension during scoring
  // crescendo even outside boss-tension situations. The base tension
  // signal lives in selectTensionFromState (driven by round state +
  // boss); this overlay adds a transient scoring boost so the cosmos
  // visibly inhales during the sustained phase and holds at peak
  // during held-breath, then exhales on release.
  const [theaterPhaseBoost, setTheaterPhaseBoost] = useState(0);
  useEffect(() => {
    const off = bus.on('onTheaterPhase', ({ phase }) => {
      if (phase === 'sustained') setTheaterPhaseBoost(0.25);
      else if (phase === 'held-breath') setTheaterPhaseBoost(0.45);
      else if (phase === 'release') {
        // Brief exhale — drop in 600ms so background settles after
        // boom without a hard cut.
        const t = window.setTimeout(() => setTheaterPhaseBoost(0), 600);
        return () => clearTimeout(t);
      } else if (phase === 'ramping') setTheaterPhaseBoost(0);
    });
    return () => off();
  }, []);
  // Per-stake border tint — drives a body-level class that shifts
  // panel border colors so two players on different stakes see
  // visually distinct runs. Subtle: only changes the border-color
  // tokens, no full-screen overlay.
  const stakeId = useStore((s) => s.run.stakeId);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const classes = ['ff-stake-spark', 'ff-stake-ember', 'ff-stake-blackstar', 'ff-stake-voidlit', 'ff-stake-sandstorm'];
    for (const c of classes) document.body.classList.remove(c);
    if (stakeId) document.body.classList.add(`ff-stake-${stakeId}`);
    return () => {
      for (const c of classes) document.body.classList.remove(c);
    };
  }, [stakeId]);
  // Wave OO — body class for the active cosmos theme so panels +
  // chrome can pick up a warmth/cool tint that matches the backdrop
  // instead of every screen wearing the same violet panel-strong
  // gradient. CSS rules under `.ff-cosmos-sandstorm .panel` etc. pull
  // the tint without per-component prop threading.
  const themeForBody = (
    screen === 'shop' || screen === 'forge' ? 'sandstorm' :
    screen === 'scores' ? 'abyssal' :
    screen === 'title' || screen === 'nameentry' || screen === 'codex' ||
    screen === 'settings' || screen === 'constellation_select' || screen === 'astral_forge'
      ? 'midnight'
      : 'voidlit'
  );
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const classes = ['ff-cosmos-midnight', 'ff-cosmos-voidlit', 'ff-cosmos-sandstorm', 'ff-cosmos-abyssal'];
    for (const c of classes) document.body.classList.remove(c);
    document.body.classList.add(`ff-cosmos-${themeForBody}`);
    return () => {
      for (const c of classes) document.body.classList.remove(c);
    };
  }, [themeForBody]);
  // Score-progress drives the gold tint + halo aura on the cosmos
  // background — completely orthogonal to tension. >=1.0 = crossed
  // target; >=2.0 = doubled over. Clamped in CosmosBackground.
  const score = useStore(selectScore);
  const target = useStore(selectTarget);
  const progress = target > 0 ? score / target : 0;
  // Hub anticipation: when the player's current trial slot is the
  // boss, the cosmos creeps toward tension so the Hub doesn't feel
  // completely calm right before a boss fight.
  const hubBossPending = useStore((s) =>
    (s.run.goalIdx % 3) === 2 && screen === 'hub'
  );

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

  // Wave NN — cosmos theme per screen. The previous picker only swung
  // between voidlit (default) and sandstorm (shop / forge), leaving
  // the calm meta screens (Title / Codex / Settings / Scores) sharing
  // the boss-run backdrop. Each meta screen now picks the tint that
  // matches its emotional beat:
  //   midnight  — cool violet, contemplative (Title / NameEntry / Codex
  //               / Settings / Constellation Select / Astral Forge)
  //   abyssal   — deep cyan, archival depth (Scores)
  //   sandstorm — gold/ember, transactional (Shop / Forge)
  //   voidlit   — magenta/cyan, primary gameplay (Hub / Round / Event)
  const theme: ThemeKey =
    screen === 'shop' || screen === 'forge' ? 'sandstorm' :
    screen === 'scores' ? 'abyssal' :
    screen === 'title' || screen === 'nameentry' || screen === 'codex' ||
    screen === 'settings' || screen === 'constellation_select' || screen === 'astral_forge'
      ? 'midnight'
      : 'voidlit';

  // Per-screen cosmos reactivity. Without these overrides the
  // tension + progress signals would read stale Round state on every
  // other screen (a player who crossed target mid-Round then exits
  // to Hub would see the same gold halo there, which dilutes the
  // moment). Each non-Round screen picks values that match the
  // emotional beat:
  //   Round     — live signals (default)
  //   Hub       — 0.4 tension if the boss trial is current (anticipation);
  //               otherwise calm
  //   Win       — progress 1.5 (gold halo blazes, celebration)
  //   Fail      — tension 1.0 (full crimson dominates)
  //   everything else — 0 / 0 (calm)
  // Wave T+1 (2026-05-19) reactive environment — fold the theater
  // phase boost into the cosmos tension so the background visibly
  // inhales during scoring crescendo. Clamped to [0,1] so the
  // existing crimson-tint + drift-speed ramps stay within their
  // designed envelope.
  const cosmosTension = Math.min(1, (
    screen === 'round' ? tension + theaterPhaseBoost :
    screen === 'fail'  ? 1.0 :
    hubBossPending     ? 0.4 :
    0
  ));
  const cosmosProgress =
    screen === 'round' ? progress :
    screen === 'win'   ? 1.5 :
    0;

  return (
    <DiagnosticOverlay>
      <div className="relative w-full h-full overflow-hidden">
        <CosmosBackground theme={theme} density={1} nebula drift tension={cosmosTension} progress={cosmosProgress} />
        {/* 2026-05-18 revised painted backdrop — see HorizonBackdrop
            comments + public/brand/cosmos-horizon-backdrop.html. Now
            cosmos-first: 18% horizon + 82% sky, smaller architecture
            accents with glowing auras + orbital sparkles. Iframe owns
            its own RAF + ResizeObserver. ScreenSilhouette stays
            imported as a quick rollback fallback. */}
        <HorizonBackdrop screen={screen} />

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
          <VoucherToast />
          <WhisperToast />
          <EventFlash />
          {/* Centralised toast queue (see app/hud/toastQueue/). Migrated
              toasts push via `pushToast(...)`; this host renders the
              visible slots with priority + throttle + same-key
              merging. The other *Toast components above still own
              their own rendering; migrate them one at a time. */}
          <ToastHost />
          <ResonanceToast />
          <SynergyBurstBanner />
          <FlyToCounter />
          <BeatTracer />
          <ComboFlash />
          <ComboSignature />
          <ScoreMilestones />
          <LockClickRipple />
          <TheaterStage />
          <CrescendoBanner />
          {/* Wave T+1 (2026-05-19) UI/UX refinement — RunningHandRail
              dropped during scoring. Per-source attribution is already
              carried by FlyToCounter floaters that rise from the firing
              catalyst/die/resonance midpoint; the rail was a parallel
              voice saying the same thing one layer below the dice and
              competing with the eye-anchor on the played hand. */}
          <ForgeAttachRitual />
          <DailyLoginComet />
          <SoundCaptions />
          <AuditEvent />
          <SellTriggerToast />
          <DiscoveryFeed />
          <Particles />
        </div>

        <OrientationGate />
        <PauseMenu />
        {/* PackOverlay self-gates via useModalExit so it can fade
            out cleanly when pendingPack flips to null. Wrapping it
            in a conditional mount here would short-circuit the
            exit animation. */}
        <PackOverlay />
        <SkipBountyOverlay />
        <CoachmarkController />
        <TutorialController />
        <TutorialOptInModal />
        <AfterglowOverlay />
        {import.meta.env.DEV && <DevConsole />}
        {import.meta.env.DEV && <BoundsOverlay />}
        {import.meta.env.DEV && <SpawnOverlay />}
        {/* Global SVG filter defs for the Mythic frame's edge-warp
            displacement bursts. Mounted once at app root so any mythic
            card on screen can reference url(#myth-displace-a/b). */}
        <MythicSvgDefs />
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
