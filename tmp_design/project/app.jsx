// App: router + tweaks panel + background.

const { useState: appUseState, useEffect: appUseEffect } = React;

function App() {
  const [tweaks, setTweak] = useTweaks(window.__TWEAK_DEFAULTS);

  const screens = {
    title: TitleScreen,
    round: RoundScreen,
    hub:   HubScreen,
    shop:  ShopScreen,
    forge: ForgeScreen,
    boss:  BossRevealScreen,
  };
  const Screen = screens[tweaks.screen] ?? RoundScreen;

  return (
    <>
      {/* background layers */}
      <CosmosBackground
        theme={tweaks.theme}
        density={tweaks.starDensity}
        nebula={tweaks.nebula}
        drift={tweaks.parallax}
      />

      {/* current screen */}
      <Screen tweaks={tweaks} />

      {/* tab strip — always-visible mini-nav */}
      <ScreenTabs current={tweaks.screen} onChange={(s) => setTweak('screen', s)} />

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection title="Screen">
          <TweakSelect label="Active Screen" value={tweaks.screen}
            onChange={(v) => setTweak('screen', v)}
            options={[
              { value: 'title', label: 'Title' },
              { value: 'round', label: 'Round (gameplay)' },
              { value: 'hub',   label: 'Hub (blind select)' },
              { value: 'shop',  label: 'Bazaar (shop)' },
              { value: 'forge', label: 'Forge' },
              { value: 'boss',  label: 'Boss Reveal' },
            ]}
          />
        </TweakSection>

        <TweakSection title="Cosmic Backdrop">
          <TweakRadio label="Theme" value={tweaks.theme}
            onChange={(v) => setTweak('theme', v)}
            options={[
              { value: 'midnight', label: 'Midnight' },
              { value: 'voidlit',  label: 'Voidlit' },
              { value: 'sandstorm',label: 'Sandstorm' },
              { value: 'abyssal',  label: 'Abyssal' },
            ]}
          />
          <TweakSlider label="Star Density" value={tweaks.starDensity}
            onChange={(v) => setTweak('starDensity', v)} min={0.2} max={3} step={0.1} />
          <TweakToggle label="Nebula Glow" value={tweaks.nebula}
            onChange={(v) => setTweak('nebula', v)} />
          <TweakToggle label="Parallax Drift" value={tweaks.parallax}
            onChange={(v) => setTweak('parallax', v)} />
        </TweakSection>

        <TweakSection title="Dice & Tray">
          <TweakRadio label="Die Style" value={tweaks.dieStyle}
            onChange={(v) => setTweak('dieStyle', v)}
            options={[
              { value: 'celestial', label: 'Celestial' },
              { value: 'obsidian',  label: 'Obsidian' },
              { value: 'glass',     label: 'Glass' },
              { value: 'ember',     label: 'Ember' },
              { value: 'ivory',     label: 'Ivory' },
            ]}
          />
          <TweakSlider label="Die Size" value={tweaks.dieSize}
            onChange={(v) => setTweak('dieSize', v)} min={56} max={120} step={2} />
          <TweakSlider label="Tray Curve" value={tweaks.trayCurve}
            onChange={(v) => setTweak('trayCurve', v)} min={0} max={3} step={0.1} />
        </TweakSection>

        <TweakSection title="Scoring">
          <TweakSelect label="Combo Showcase" value={tweaks.comboTier}
            onChange={(v) => setTweak('comboTier', v)}
            options={[
              { value: 'five_kind',   label: 'Five of a Kind' },
              { value: 'four_kind',   label: 'Four of a Kind' },
              { value: 'lg_straight', label: 'Large Straight' },
              { value: 'full_house',  label: 'Full House' },
              { value: 'sm_straight', label: 'Small Straight' },
              { value: 'three_kind',  label: 'Three of a Kind' },
              { value: 'two_pair',    label: 'Two Pair' },
              { value: 'one_pair',    label: 'One Pair' },
              { value: 'chance',      label: 'Chance' },
            ]}
          />
          <TweakToggle label="Constellation Lines" value={tweaks.constellationLines}
            onChange={(v) => setTweak('constellationLines', v)} />
          <TweakToggle label="Scoring FX" value={tweaks.scoringFx}
            onChange={(v) => setTweak('scoringFx', v)} />
        </TweakSection>

        <TweakSection title="Visual System">
          <TweakRadio label="Accent" value={tweaks.primaryAccent}
            onChange={(v) => setTweak('primaryAccent', v)}
            options={[
              { value: 'astral', label: 'Astral' },
              { value: 'ember',  label: 'Ember' },
              { value: 'gold',   label: 'Gold' },
              { value: 'violet', label: 'Violet' },
            ]}
          />
          <TweakToggle label="Inline Hints" value={tweaks.showInlineHelp}
            onChange={(v) => setTweak('showInlineHelp', v)} />
        </TweakSection>

        <TweakSection title="Run State">
          <TweakSlider label="Ante Level" value={tweaks.anteLevel}
            onChange={(v) => setTweak('anteLevel', v)} min={1} max={4} step={1} />
          <TweakSlider label="Shards" value={tweaks.shardsCount}
            onChange={(v) => setTweak('shardsCount', v)} min={0} max={50} step={1} />
          <TweakSelect label="Boss Blind (preview)" value={tweaks.boss}
            onChange={(v) => setTweak('boss', v)}
            options={BOSSES.map(b => ({ value: b.id, label: b.name }))}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

function ScreenTabs({ current, onChange }) {
  const tabs = [
    { id: 'title', label: 'Title' },
    { id: 'hub',   label: 'Hub' },
    { id: 'boss',  label: 'Boss' },
    { id: 'round', label: 'Round' },
    { id: 'shop',  label: 'Bazaar' },
    { id: 'forge', label: 'Forge' },
  ];
  return (
    <div style={{
      position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%) translateY(-50px)',
      pointerEvents: 'none', zIndex: 1, opacity: 0,
    }}>
      {/* hidden — TopBar already shows blind name. Keep empty for now. */}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('stage'));
root.render(<App />);
