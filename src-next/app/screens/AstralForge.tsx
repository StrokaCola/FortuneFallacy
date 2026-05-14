// AstralForge — meta-progression hub. Players spend Cosmic Dust earned
// across runs to unlock permanent passive perks that apply to all future
// runs. Each perk is a one-time purchase. Catalog lives in
// data/astralPerks.ts; effects resolve through core/run/applyAstralPerks.ts.

import { useStore } from '../../state/store';
import { dispatch } from '../../actions/dispatch';
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
      <h2 className="font-display text-4xl text-cosmos-50 mb-1">ASTRAL FORGE</h2>
      <div className="f-mono uc text-cosmos-300" style={{ fontSize: 10, letterSpacing: '0.4em', marginBottom: 18 }}>
        ⟡ between the rolls, the stars settle ⟡
      </div>

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

      <div data-coach="perk-grid" className="w-full max-w-2xl grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {ASTRAL_PERKS.map((perk) => (
          <PerkCard
            key={perk.id}
            perk={perk}
            owned={ownedPerks.includes(perk.id)}
            affordable={dust >= perk.cost}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}
        className="mt-8 px-8 py-2 rounded-lg bg-cosmos-700/80 hover:bg-cosmos-600 text-cosmos-50
                   font-head ring-1 ring-cosmos-300/30 tap"
        style={{ minHeight: 44 }}
      >
        back
      </button>
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
      className="text-left tap"
      aria-label={`${perk.name} — ${owned ? 'owned' : `${perk.cost} cosmic dust`}`}
      style={{
        position: 'relative',
        padding: 14,
        borderRadius: 12,
        background: owned ? 'rgba(91,232,164,0.08)' : 'rgba(28,18,69,0.6)',
        border: `1px solid ${ringColor}`,
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
