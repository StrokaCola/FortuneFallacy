import { useEffect } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore } from '../../state/store';
import { TopBar } from '../hud/TopBar';
import {
  selectShards, selectShopOffers, selectAnte, selectOracles, selectVouchers,
  selectScore, selectTarget, selectHandsLeft, selectRerollsLeft,
} from '../../state/selectors';
import { lookupOracle } from '../../data/oracles';
import { lookupConsumable } from '../../core/consumables';
import { lookupVoucher } from '../../data/vouchers';
import { sfxPlay } from '../../audio/sfx';

type Meta = { name: string; icon: string; color: string; desc: string; kindLabel: string };

function offerMeta(kind: string, id: string): Meta {
  if (kind === 'oracle') {
    const o = lookupOracle(id);
    return { name: o?.name ?? id, icon: o?.icon ?? '✦', color: o?.color ?? '#7be3ff', desc: o?.desc ?? '', kindLabel: 'oracle' };
  }
  if (kind === 'consumable') {
    const c = lookupConsumable(id);
    return {
      name: c?.name ?? id,
      icon: c?.icon ?? '◇',
      color: c?.type === 'tarot' ? '#cc88ff' : '#7be3ff',
      desc: c?.description ?? '',
      kindLabel: c?.type ?? 'tarot',
    };
  }
  if (kind === 'voucher') {
    const v = lookupVoucher(id);
    return { name: v?.name ?? id, icon: '◆', color: '#f5c451', desc: v?.description ?? '', kindLabel: 'voucher' };
  }
  return { name: id, icon: '◇', color: '#7be3ff', desc: '', kindLabel: kind };
}

const accent = '#7be3ff';

export function Shop() {
  const shards   = useStore(selectShards);
  const offers   = useStore(selectShopOffers);
  const ante     = useStore(selectAnte);
  const oracles  = useStore(selectOracles);
  const vouchers = useStore(selectVouchers);
  const score    = useStore(selectScore);
  const target   = useStore(selectTarget);
  const hands    = useStore(selectHandsLeft);
  const rerolls  = useStore(selectRerollsLeft);

  useEffect(() => {
    if (offers.length === 0) dispatch({ type: 'OPEN_SHOP' });
  }, [offers.length]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
      <TopBar
        ante={ante}
        blind="Bazaar"
        shards={shards}
        hands={hands}
        rerolls={rerolls}
        target={target}
        score={score}
        oracleSlots={{ used: oracles.length, max: 6 }}
        voucherCount={vouchers.length}
        accent={accent}
      />

      <div style={{
        position: 'absolute', left: '50%', top: 180, transform: 'translateX(-50%)',
        textAlign: 'center', zIndex: 4,
      }}>
        <div className="f-mono uc" style={{ fontSize: 11, color: '#bba8ff', letterSpacing: '0.4em' }}>
          ◇ between the stars ◇
        </div>
        <div className="f-display" style={{ fontSize: 36, color: '#f3f0ff', marginTop: 8 }}>
          The Celestial Bazaar
        </div>
      </div>

      <div style={{
        position: 'absolute', left: '50%', top: 290, transform: 'translateX(-50%)',
        display: 'flex', gap: 18, zIndex: 4,
      }}>
        {offers.length === 0 && (
          <div className="f-mono panel" style={{ color: '#bba8ff', padding: '24px 36px' }}>— sold out —</div>
        )}
        {offers.map((o, i) => {
          const m = offerMeta(o.kind, o.id);
          const c = m.color;
          const affordable = shards >= o.price;
          return (
            <div
              key={`${o.id}-${i}`}
              className="panel-strong"
              onMouseEnter={() => sfxPlay('cardFlip')}
              onClick={() => affordable && dispatch({ type: 'BUY_OFFER', offerIdx: i })}
              style={{
                width: 180, height: 250, padding: 14,
                border: `1px solid ${c}55`,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                cursor: affordable ? 'pointer' : 'not-allowed',
                opacity: affordable ? 1 : 0.6,
                animation: `float-y ${3 + i * 0.4}s ease-in-out infinite`,
              }}
            >
              <div className="f-mono uc" style={{
                fontSize: 9, letterSpacing: '0.28em', color: c, marginBottom: 6,
                padding: '2px 6px', border: `1px solid ${c}55`, borderRadius: 4,
              }}>{m.kindLabel}</div>
              <div style={{
                width: 84, height: 84, borderRadius: 12, marginTop: 8,
                background: `radial-gradient(circle, ${c}30, rgba(15,9,37,0.9))`,
                border: `1px solid ${c}80`,
                display: 'grid', placeItems: 'center',
                fontSize: 40, color: c,
                filter: `drop-shadow(0 0 10px ${c}80)`,
              }}>{m.icon}</div>
              <div className="f-head" style={{ fontSize: 14, color: '#f3f0ff', marginTop: 12, textAlign: 'center' }}>
                {m.name}
              </div>
              <div style={{
                fontFamily: '"Exo 2", sans-serif',
                fontSize: 11, color: '#bba8ff', marginTop: 6, textAlign: 'center', lineHeight: 1.4, flex: 1,
              }}>
                {m.desc}
              </div>
              <div style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(149,119,255,0.2)',
              }}>
                <span className="f-mono num" style={{ color: '#f5c451', fontSize: 14 }}>◆ {o.price}</span>
                <span className="f-mono uc" style={{
                  fontSize: 9, color: affordable ? accent : '#e2334a', letterSpacing: '0.2em',
                }}>
                  {affordable ? 'buy' : 'low'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        position: 'absolute', left: '50%', bottom: 28, transform: 'translateX(-50%)',
        display: 'flex', gap: 12, zIndex: 5,
      }}>
        <button
          className="btn btn-primary mat-interactive"
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'hub' })}
        >
          Next Blind →
        </button>
      </div>
    </div>
  );
}
