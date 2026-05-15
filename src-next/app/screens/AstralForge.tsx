// AstralForge — meta-progression hub. Players spend Cosmic Dust earned
// across runs to unlock permanent passive perks that apply to all future
// runs. Each perk is a one-time purchase. Catalog lives in
// data/astralPerks.ts; effects resolve through core/run/applyAstralPerks.ts.

import { useStore } from '../../state/store';
import { dispatch } from '../../actions/dispatch';
import { ScreenHeader, ScreenWatermark } from '../visual/AstralPrimitives';
import { Sigil } from '../visual/Sigil';
import { ASTRAL_PERKS, type AstralPerkDef } from '../../data/astralPerks';
import type { GameState } from '../../state/store';

const selectDust = (s: GameState) => s.meta.cosmicDust;
const selectDustLifetime = (s: GameState) => s.meta.cosmicDustLifetime;
const selectOwnedPerks = (s: GameState) => s.meta.astralPerks;

export function AstralForge() {
  const dust = useStore(selectDust);
  const lifetime = useStore(selectDustLifetime);
  const ownedPerks = useStore(selectOwnedPerks);

  return (
    <div className="absolute inset-0 flex flex-col items-center pointer-events-auto px-4 py-6 overflow-y-auto">
      <ScreenWatermark color="#f5c451" position="bottom-right">
        <Sigil kind="sun" size={220} color="#f5c451" />
      </ScreenWatermark>
      <ScreenHeader title="Astral Forge" subtitle="⟡ between the rolls, the stars settle ⟡" />

      <div
        className="flex items-baseline gap-4 mb-6"
        style={{
          padding: '10px 22px',
          borderRadius: 999,
          background: 'rgba(245,196,81,0.08)',
          border: '1px solid rgba(245,196,81,0.35)',
        }}
      >
        <div>
          <span className="f-mono uc text-cosmos-300" style={{ fontSize: 9, letterSpacing: '0.3em' }}>cosmic dust</span>
          <div className="font-mono text-gold" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1 }}>
            ◇ {dust.toLocaleString()}
          </div>
        </div>
        <div className="opacity-70">
          <span className="f-mono uc text-cosmos-300" style={{ fontSize: 9, letterSpacing: '0.3em' }}>lifetime</span>
          <div className="font-mono" style={{ fontSize: 14, color: '#bba8ff' }}>{lifetime.toLocaleString()}</div>
        </div>
      </div>

      <div data-coach="perk-grid" className="w-full max-w-2xl grid gap-3" style={{
        // 260→200 floor: at 260px, tight phones (≤480px wide) fell back
        // to one perk per row. 200px lets two perks share a row on a
        // 420px phone, halving the scroll height.
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      }}>
        {ASTRAL_PERKS.map((perk) => (
          <PerkCard
            key={perk.id}
            perk={perk}
            owned={ownedPerks.includes(perk.id)}
            affordable={dust >= perk.cost}
          />
        ))}
      </div>

      <NextUnlockTeaser dust={dust} ownedPerks={ownedPerks} />

      <button
        type="button"
        onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}
        className="mt-6 px-8 py-2 rounded-lg bg-cosmos-700/80 hover:bg-cosmos-600 text-cosmos-50
                   font-head ring-1 ring-cosmos-300/30 tap"
        style={{ minHeight: 44 }}
      >
        back
      </button>
    </div>
  );
}

// Wave R — closest unowned perk teaser. Fills the dead vertical space
// between the grid and the back button with a contextual "next goal"
// nudge, so players know what they're working toward without having
// to mentally scan all six perk prices.
function NextUnlockTeaser({ dust, ownedPerks }: { dust: number; ownedPerks: string[] }) {
  // Find the cheapest unowned perk. If the player owns everything,
  // surface a "complete" badge instead.
  const remaining = ASTRAL_PERKS.filter((p) => !ownedPerks.includes(p.id));
  if (remaining.length === 0) {
    return (
      <div className="mt-8 mb-2 f-mono uc" style={{
        fontSize: 10, letterSpacing: '0.32em', color: '#f5c451',
        padding: '8px 18px', borderRadius: 999,
        border: '1px solid rgba(245,196,81,0.45)',
        background: 'rgba(245,196,81,0.08)',
        textShadow: '0 0 10px rgba(245,196,81,0.4)',
      }}>
        ✦ forge complete · every star settled ✦
      </div>
    );
  }
  // Sort by remaining-dust cost first (so the closest landing is the
  // teaser), then by absolute cost as tiebreak.
  const sorted = [...remaining].sort((a, b) => a.cost - b.cost);
  const cheapest = sorted[0]!;
  const gap = Math.max(0, cheapest.cost - dust);
  const reachable = gap === 0;
  return (
    <div className="mt-8 mb-2" style={{
      maxWidth: 360,
      padding: '12px 20px', borderRadius: 12,
      border: `1px solid ${reachable ? 'rgba(123,227,255,0.6)' : 'rgba(149,119,255,0.35)'}`,
      background: 'rgba(15,9,37,0.65)',
      textAlign: 'center',
      boxShadow: reachable ? '0 0 22px rgba(123,227,255,0.18)' : undefined,
    }}>
      <div className="f-mono uc" style={{
        fontSize: 9, letterSpacing: '0.32em',
        color: reachable ? '#7be3ff' : '#bba8ff',
      }}>
        {reachable ? '◇ ready to unlock ◇' : '◇ next within reach ◇'}
      </div>
      <div className="f-display" style={{ fontSize: 18, color: '#f3f0ff', marginTop: 4 }}>
        {cheapest.name}
      </div>
      <div className="f-mono" style={{
        fontSize: 11, color: '#bba8ff', marginTop: 4, lineHeight: 1.35,
      }}>
        {cheapest.description}
      </div>
      <div className="f-mono uc" style={{
        fontSize: 10, letterSpacing: '0.28em', marginTop: 8,
        color: reachable ? '#7be3ff' : '#f5c451',
      }}>
        {reachable ? `tap above to spend ◇ ${cheapest.cost}` : `◇ ${gap.toLocaleString()} more to reach`}
      </div>
    </div>
  );
}

function PerkCard({ perk, owned, affordable }: { perk: AstralPerkDef; owned: boolean; affordable: boolean }) {
  const buy = () => {
    if (owned) return;
    if (!affordable) return;
    dispatch({ type: 'BUY_ASTRAL_PERK', perkId: perk.id });
  };
  const stateLabel = owned ? 'owned' : affordable ? `◇ ${perk.cost}` : `◇ ${perk.cost}  (locked)`;
  const ringColor = owned
    ? 'rgba(91,232,164,0.7)'
    : affordable
      ? 'rgba(245,196,81,0.55)'
      : 'rgba(149,119,255,0.25)';

  return (
    <button
      type="button"
      onClick={buy}
      disabled={owned || !affordable}
      // panel-strong baseline aligns the perk card with the rest of
      // the game's clickable cards (Hub trial, Shop offer). State-
      // specific overlays (owned wash, locked desaturation, accent
      // ring) layer on top via inline style.
      className="panel-strong text-left tap"
      aria-label={`${perk.name} — ${owned ? 'owned' : `${perk.cost} cosmic dust`}`}
      style={{
        position: 'relative',
        padding: 14,
        // panel-strong already supplies a violet-gradient background;
        // for owned perks we wash with the success tint as an overlay
        // via gradient stacking so the panel's base stays visible.
        background: owned
          ? 'linear-gradient(180deg, rgba(91,232,164,0.18), rgba(15,9,37,0.85))'
          : undefined,
        // Accent ring inherits perk-state colour; overrides panel's
        // default rgba(149,119,255,0.34) border without losing the
        // shared shadow/inset-highlight from panel-strong.
        borderColor: ringColor,
        color: owned ? '#5be8a4' : affordable ? '#f3f0ff' : '#9577ff',
        cursor: owned ? 'default' : affordable ? 'pointer' : 'not-allowed',
        opacity: owned || affordable ? 1 : 0.65,
        minHeight: 130,
        display: 'flex', flexDirection: 'column', gap: 6,
        transition: 'transform 120ms ease, border-color 120ms ease',
      }}
      onPointerEnter={(e) => { if (!owned && affordable) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
      onPointerLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display" style={{ fontSize: 18, lineHeight: 1.1 }}>{perk.name}</span>
        <span className="f-mono" style={{ fontSize: 11, color: owned ? '#5be8a4' : '#f5c451', whiteSpace: 'nowrap' }}>{stateLabel}</span>
      </div>
      <div style={{ fontSize: 13, color: '#cfc5ff' }}>{perk.description}</div>
      <div className="f-mono" style={{ fontSize: 11, fontStyle: 'italic', color: '#9577ff', marginTop: 'auto' }}>
        {perk.flavor}
      </div>
    </button>
  );
}
