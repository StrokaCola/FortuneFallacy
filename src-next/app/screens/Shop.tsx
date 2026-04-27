import { useEffect, useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore } from '../../state/store';
import {
  selectShards, selectShopOffers, selectAnte, selectOracles, selectVouchers,
} from '../../state/selectors';
import { lookupOracle } from '../../data/oracles';
import { lookupConsumable } from '../../core/consumables';
import { lookupVoucher } from '../../data/vouchers';
import { vendorLine } from '../../data/vendor-lines';
import { sfxPlay } from '../../audio/sfx';

type Meta = { name: string; icon: string; color: string; desc: string; kindLabel: string };

function offerMeta(kind: string, id: string): Meta {
  if (kind === 'oracle') {
    const o = lookupOracle(id);
    return { name: o?.name ?? id, icon: o?.icon ?? '✦', color: o?.color ?? '#7be3ff', desc: o?.desc ?? '', kindLabel: 'oracle' };
  }
  if (kind === 'consumable') {
    const c = lookupConsumable(id);
    return { name: c?.name ?? id, icon: c?.icon ?? '◇', color: c?.type === 'tarot' ? '#cc88ff' : '#7be3ff', desc: c?.description ?? '', kindLabel: c?.type ?? 'tarot' };
  }
  if (kind === 'voucher') {
    const v = lookupVoucher(id);
    return { name: v?.name ?? id, icon: '◆', color: '#f5c451', desc: v?.description ?? '', kindLabel: 'voucher' };
  }
  return { name: id, icon: '◇', color: '#7be3ff', desc: '', kindLabel: kind };
}

const ROTATIONS = [-3, 2, -1, 4, -2];

export function Shop() {
  const shards   = useStore(selectShards);
  const offers   = useStore(selectShopOffers);
  const ante     = useStore(selectAnte);
  const oracles  = useStore(selectOracles);
  const vouchers = useStore(selectVouchers);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [vline, setVline] = useState<string>(() => vendorLine());

  useEffect(() => {
    if (offers.length === 0) dispatch({ type: 'OPEN_SHOP' });
  }, [offers.length]);

  const detail = hoverIdx != null && offers[hoverIdx] ? offerMeta(offers[hoverIdx]!.kind, offers[hoverIdx]!.id) : null;

  return (
    <div className="mat-velvet" style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
      {/* top bar */}
      <div className="mat-obsidian"
        style={{
          position: 'absolute', top: 18, left: 18,
          padding: '10px 14px', borderRadius: 10, zIndex: 5,
        }}>
        <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.28em', color: '#bba8ff' }}>
          Ante {String(ante).padStart(2, '0')} · Bazaar
        </div>
      </div>
      <div className="mat-obsidian"
        style={{
          position: 'absolute', top: 18, right: 18,
          padding: '10px 14px', borderRadius: 10, zIndex: 5,
        }}>
        <span className="f-mono" style={{ color: '#f5c451', fontSize: 16 }}>◆ {shards}</span>
        <span className="f-mono" style={{ fontSize: 10, color: '#bba8ff', marginLeft: 10 }}>
          oracles {oracles.length}/6 · vouchers {vouchers.length}
        </span>
      </div>

      <div style={{
        position: 'absolute', left: '50%', top: 84, transform: 'translateX(-50%)',
        textAlign: 'center', zIndex: 4,
      }}>
        <div className="f-mono uc" style={{ fontSize: 11, color: '#bba8ff', letterSpacing: '0.4em' }}>
          ◇ between the stars ◇
        </div>
        <div className="f-display" style={{ fontSize: 30, color: '#f3f0ff', marginTop: 6 }}>
          The Celestial Bazaar
        </div>
      </div>

      {/* vendor silhouette */}
      <div style={{
        position: 'absolute', left: 80, top: 200, width: 160, height: 220,
        zIndex: 3, pointerEvents: 'none',
      }}>
        <div style={{
          width: 140, height: 180,
          background: 'radial-gradient(ellipse at 50% 30%, rgba(149,119,255,0.6), transparent 70%)',
          borderRadius: '50% 50% 18% 18%',
          margin: '0 auto', position: 'relative',
        }}>
          <div style={{
            position: 'absolute', left: '50%', top: '28%',
            transform: 'translate(-50%, -50%)',
            width: 26, height: 26, borderRadius: '50%',
            background: 'radial-gradient(circle, #f5c451 30%, transparent 70%)',
            filter: 'drop-shadow(0 0 6px #f5c451)',
          }} />
        </div>
        <div className="f-display" style={{
          fontSize: 14, color: '#f5c451', textAlign: 'center', marginTop: 8, letterSpacing: '0.18em',
        }}>The Cartomancer</div>
        <div className="f-mono" style={{
          fontSize: 11, fontStyle: 'italic', textAlign: 'center', color: '#bba8ff', marginTop: 4,
          padding: '0 10px',
        }}>"{vline}"</div>
      </div>

      {/* cards on velvet table */}
      <div style={{
        position: 'absolute', left: 280, right: 80, top: 200, bottom: 140,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, zIndex: 4,
        pointerEvents: 'auto',
      }}>
        {offers.length === 0 && (
          <div className="f-mono" style={{ color: '#bba8ff' }}>— sold out —</div>
        )}
        {offers.map((o, i) => {
          const m = offerMeta(o.kind, o.id);
          const affordable = shards >= o.price;
          const rot = ROTATIONS[i % ROTATIONS.length]!;
          const isHover = hoverIdx === i;
          return (
            <div key={`${o.id}-${i}`}
              onMouseEnter={() => { setHoverIdx(i); sfxPlay('cardFlip'); setVline(vendorLine(o.kind)); }}
              onMouseLeave={() => setHoverIdx((p) => p === i ? null : p)}
              onClick={() => affordable && dispatch({ type: 'BUY_OFFER', offerIdx: i })}
              style={{
                width: 130, height: 200,
                perspective: '900px',
                cursor: affordable ? 'pointer' : 'not-allowed',
                opacity: affordable ? 1 : 0.55,
                transform: isHover ? `rotate(0deg) translateY(-12px)` : `rotate(${rot}deg) translateY(0)`,
                transition: `transform var(--savored, 600ms) var(--ease-savor, ease)`,
              }}>
              <div style={{
                position: 'relative', width: '100%', height: '100%',
                transformStyle: 'preserve-3d',
                transform: isHover ? 'rotateY(0deg)' : 'rotateY(180deg)',
                transition: `transform var(--savored, 600ms) var(--ease-savor, ease)`,
              }}>
                {/* face-up */}
                <div className="mat-obsidian" style={{
                  position: 'absolute', inset: 0, padding: 12, borderRadius: 12,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  backfaceVisibility: 'hidden',
                  borderColor: `${m.color}80`,
                }}>
                  <div className="f-mono uc" style={{ fontSize: 8, letterSpacing: '0.28em', color: m.color, padding: '2px 6px', border: `1px solid ${m.color}55`, borderRadius: 4 }}>{m.kindLabel}</div>
                  <div style={{
                    width: 64, height: 64, borderRadius: 10, marginTop: 12,
                    background: `radial-gradient(circle, ${m.color}40, rgba(15,9,37,0.95))`,
                    border: `1px solid ${m.color}80`, display: 'grid', placeItems: 'center',
                    fontSize: 32, color: m.color,
                    filter: `drop-shadow(0 0 8px ${m.color})`,
                  }}>{m.icon}</div>
                  <div className="f-head" style={{ fontSize: 11, color: '#f3f0ff', marginTop: 10, textAlign: 'center', letterSpacing: '0.05em' }}>
                    {m.name}
                  </div>
                  <div className="f-mono" style={{ marginTop: 'auto', fontSize: 12, color: '#f5c451' }}>
                    ◆ {o.price}
                  </div>
                </div>
                {/* face-down */}
                <div className="mat-obsidian" style={{
                  position: 'absolute', inset: 0, padding: 12, borderRadius: 12,
                  display: 'grid', placeItems: 'center',
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  borderColor: 'rgba(245,196,81,0.4)',
                }}>
                  <div style={{ position: 'absolute', inset: 6, border: '1px solid rgba(245,196,81,0.4)', borderRadius: 9 }} />
                  <span style={{ fontSize: 36, color: '#f5c451', filter: 'drop-shadow(0 0 8px #f5c451)' }}>✦</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* detail strip */}
      {detail && (
        <div className="mat-crystal" style={{
          position: 'absolute', left: '50%', bottom: 80, transform: 'translateX(-50%)',
          padding: '8px 16px', borderRadius: 8, maxWidth: 480, textAlign: 'center', zIndex: 5,
        }}>
          <div className="f-head" style={{ fontSize: 13, color: detail.color }}>
            {detail.name}
          </div>
          <div className="f-mono" style={{ fontSize: 11, color: '#bba8ff', marginTop: 2 }}>
            {detail.desc}
          </div>
        </div>
      )}

      {/* next blind */}
      <div style={{ position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)', zIndex: 5 }}>
        <button className="btn btn-primary mat-interactive" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'hub' })}>
          Next Blind →
        </button>
      </div>
    </div>
  );
}
