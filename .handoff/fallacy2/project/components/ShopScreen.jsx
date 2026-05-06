/* global React */
// hooks via React.* below

/* ============================================================
   Shop screen — Celestial Bazaar.
   - Offer cards w/ idle float, hover lift+tilt
   - Rare offers get holographic shimmer overlay
   - Click to "buy": coin sucks out of treasury, wax stamp settles
   - Restock animation: cards flip-out and new ones deal in
   ============================================================ */

const RARITIES = {
  common:    { ring: '#7be3ff', tag: 'common',   holo: false },
  uncommon:  { ring: '#cc88ff', tag: 'uncommon', holo: false },
  rare:      { ring: '#f5c451', tag: 'rare',     holo: true  },
};

const INITIAL_OFFERS = [
  { id: 'lyra-pulse',     kind: 'catalyst',   name: 'Pulse of Lyra',   icon: '✦', desc: 'Each die rolling 6 adds +12 chips. Trial-long.', color: '#7be3ff', price: 6, rarity: 'common'   },
  { id: 'orion-edge',     kind: 'mod',        name: 'Orion Edge',      icon: '⫶', desc: 'Etch onto a die: +1 mult per pip on score.',     color: '#cc88ff', price: 8, rarity: 'uncommon' },
  { id: 'hour-glass',     kind: 'consumable', name: 'Hourglass',       icon: '◇', desc: 'Reroll without consuming a reroll. Single-use.',  color: '#7be3ff', price: 3, rarity: 'common'   },
  { id: 'astral-mantle',  kind: 'voucher',    name: 'Astral Mantle',   icon: '◆', desc: '+1 catalyst slot. Permanent for the run.',        color: '#f5c451', price: 12, rarity: 'rare'    },
];

function HoloOverlay() {
  return (
    <>
      <div className="ff-holo" />
      <div className="ff-holo-shimmer" />
    </>
  );
}

function OfferCard({ offer, idx, bought, onBuy, restocking }) {
  const [hover, setHover] = React.useState(false);
  const [stamp, setStamp] = React.useState(false);
  const ref = React.useRef(null);
  const [tilt, setTilt] = React.useState({ rx: 0, ry: 0, mx: 50, my: 50 });

  const rarity = RARITIES[offer.rarity];

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setTilt({ rx: -(y - 0.5) * 12, ry: (x - 0.5) * 12, mx: x * 100, my: y * 100 });
  };
  const onLeave = () => { setHover(false); setTilt({ rx: 0, ry: 0, mx: 50, my: 50 }); };

  const handleBuy = (e) => {
    if (bought) return;
    setStamp(true);
    onBuy(idx, e.clientX, e.clientY);
  };

  // Restock animation states
  const restockClass = restocking === 'out'
    ? { animation: 'card-flip-out 360ms var(--ease-savor) forwards' }
    : restocking === 'in'
    ? { animation: 'card-flip-in 460ms var(--ease-spring) forwards', animationDelay: `${idx * 80}ms` }
    : {};

  const idleFloat = {
    animation: `ff-float ${3.6 + idx * 0.3}s ease-in-out infinite`,
    animationDelay: `${idx * 0.4}s`,
    ['--ff-tilt']: `${(idx % 2 === 0 ? -1 : 1) * 1.6}deg`,
  };

  return (
    <div
      style={{
        ...idleFloat,
        ...restockClass,
        perspective: 900,
      }}
    >
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={onLeave}
        onClick={handleBuy}
        className="mat-obsidian"
        style={{
          width: 188, height: 264, padding: 14,
          borderRadius: 14,
          border: `1.5px solid ${rarity.ring}88`,
          boxShadow: hover
            ? `0 0 30px ${rarity.ring}88, 0 16px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)`
            : `0 0 12px ${rarity.ring}33, 0 8px 22px rgba(0,0,0,0.5)`,
          position: 'relative',
          cursor: bought ? 'default' : 'pointer',
          opacity: bought ? 0.7 : 1,
          transform: bought
            ? 'scale(0.98)'
            : `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) ${hover ? 'translateY(-10px) scale(1.04)' : ''}`,
          transformStyle: 'preserve-3d',
          transition: 'box-shadow 220ms var(--ease-savor), opacity 200ms ease, transform 320ms var(--ease-spring-soft)',
          overflow: 'hidden',
        }}
      >
        {/* Holographic overlay on rare */}
        {rarity.holo && <HoloOverlay />}

        {/* Cursor radial gleam */}
        {hover && !bought && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 14,
            background: `radial-gradient(circle at ${tilt.mx}% ${tilt.my}%, ${rarity.ring}30 0%, transparent 60%)`,
            mixBlendMode: 'screen',
            pointerEvents: 'none',
          }} />
        )}

        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Kind tag */}
          <div className="f-mono uc" style={{
            fontSize: 8, letterSpacing: '0.3em', color: rarity.ring,
            padding: '3px 8px', border: `1px solid ${rarity.ring}66`, borderRadius: 4,
            marginBottom: 6,
          }}>{offer.kind} · {rarity.tag}</div>

          {/* Icon */}
          <div style={{
            width: 86, height: 86, borderRadius: 14, marginTop: 6,
            background: `radial-gradient(circle at 30% 25%, ${offer.color}40, rgba(15,9,37,0.95) 75%)`,
            border: `1px solid ${offer.color}aa`,
            display: 'grid', placeItems: 'center',
            fontSize: 42, color: offer.color,
            filter: `drop-shadow(0 0 10px ${offer.color}aa)`,
            transform: 'translateZ(20px)',
            position: 'relative',
          }}>
            {offer.icon}
            {/* Inner ring */}
            <div style={{
              position: 'absolute', inset: 6,
              border: `1px dashed ${offer.color}55`,
              borderRadius: 12,
              animation: hover ? 'ff-twinkle 1.6s ease-in-out infinite' : undefined,
            }} />
          </div>

          {/* Name */}
          <div className="f-head" style={{
            fontSize: 14, color: '#f3f0ff', marginTop: 12, textAlign: 'center',
            letterSpacing: '0.04em', textShadow: '0 0 8px rgba(0,0,0,0.4)',
          }}>{offer.name}</div>

          {/* Desc */}
          <div className="f-body" style={{
            fontSize: 11, color: '#bba8ff', marginTop: 6, textAlign: 'center',
            lineHeight: 1.4, flex: 1,
          }}>{offer.desc}</div>

          {/* Price + buy */}
          <div style={{
            width: '100%',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 'auto', paddingTop: 8,
            borderTop: '1px solid rgba(149,119,255,0.2)',
          }}>
            <span className="f-mono num" style={{ color: '#f5c451', fontSize: 14 }}>◆ {offer.price}</span>
            <span className="f-mono uc" style={{
              fontSize: 9, color: rarity.ring, letterSpacing: '0.2em',
            }}>buy</span>
          </div>
        </div>

        {/* SOLD stamp on bought */}
        {stamp && (
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 5,
            pointerEvents: 'none',
            animation: 'ff-stamp 540ms var(--ease-spring) forwards',
          }}>
            <div className="f-display" style={{
              fontSize: 32, fontWeight: 900,
              color: '#ff4d6d',
              letterSpacing: '0.18em',
              border: '4px solid #ff4d6d',
              padding: '4px 16px',
              transform: 'rotate(-12deg)',
              textShadow: '0 0 12px rgba(255,77,109,0.6)',
              boxShadow: '0 0 20px rgba(255,77,109,0.4)',
              background: 'rgba(255,77,109,0.08)',
            }}>SOLD</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ShopScreen() {
  const [offers, setOffers] = React.useState(INITIAL_OFFERS);
  const [bought, setBought] = React.useState([false, false, false, false]);
  const [shards, setShards] = React.useState(20);
  const [restock, setRestock] = React.useState('idle'); // 'idle' | 'out' | 'in'
  const [coinFlight, setCoinFlight] = React.useState(null);

  const handleBuy = (idx, sx, sy) => {
    if (bought[idx]) return;
    const offer = offers[idx];
    if (shards < offer.price) return;

    // Coin animation: from treasury (top-right) to offer card
    setCoinFlight({ idx, key: Date.now() });
    setTimeout(() => setCoinFlight(null), 500);

    setBought((arr) => arr.map((b, i) => i === idx ? true : b));
    setShards((s) => s - offer.price);
  };

  const restockShop = () => {
    if (shards < 4) return;
    setShards((s) => s - 4);
    setRestock('out');
    setTimeout(() => {
      setBought([false, false, false, false]);
      setOffers((arr) => arr.map((o) => ({
        ...o,
        // shuffle prices a bit so it looks fresh
        price: Math.max(2, o.price + (Math.random() < 0.5 ? -1 : 1)),
      })));
      setRestock('in');
      setTimeout(() => setRestock('idle'), 600);
    }, 380);
  };

  const reset = () => {
    setOffers(INITIAL_OFFERS);
    setBought([false, false, false, false]);
    setShards(20);
    setRestock('idle');
  };

  return (
    <div className="ff-stage" style={{ position: 'relative' }}>
      {/* CSS for restock flips */}
      <style>{`
        @keyframes card-flip-out {
          0% { transform: rotateY(0) translateY(0); opacity: 1; }
          100% { transform: rotateY(90deg) translateY(20px); opacity: 0; }
        }
        @keyframes card-flip-in {
          0% { transform: rotateY(-90deg) translateY(-20px); opacity: 0; }
          60% { transform: rotateY(8deg) translateY(0); opacity: 1; }
          100% { transform: rotateY(0) translateY(0); opacity: 1; }
        }
      `}</style>

      <div style={{ position: 'absolute', inset: 0, padding: 18 }}>
        {/* Top bar */}
        <div style={{
          position: 'absolute', top: 16, left: 16, right: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          zIndex: 5,
        }}>
          <div className="panel" style={{ padding: '10px 18px' }}>
            <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.32em', color: '#bba8ff' }}>
              ante 03 · between trials
            </div>
            <div className="f-display" style={{ fontSize: 18, color: '#f3f0ff', marginTop: 2 }}>Bazaar</div>
          </div>
          <div
            data-treasury
            className="panel"
            style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 16 }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#f5c451', fontSize: 18, filter: 'drop-shadow(0 0 6px #f5c451)' }}>◆</span>
              <span
                className="f-display num"
                key={`shards-${shards}`}
                style={{
                  fontSize: 26, color: '#f5c451',
                  textShadow: '0 0 12px rgba(245,196,81,0.5)',
                }}
              >{shards}</span>
              <span className="f-mono uc" style={{ fontSize: 9, color: '#bba8ff', letterSpacing: '0.2em' }}>shards</span>
            </span>
          </div>
        </div>

        {/* Title */}
        <div style={{
          position: 'absolute', left: '50%', top: 100, transform: 'translateX(-50%)',
          textAlign: 'center', zIndex: 4,
        }}>
          <div className="f-mono uc" style={{ fontSize: 11, color: '#bba8ff', letterSpacing: '0.5em' }}>
            ◇ exchange ◇
          </div>
          <div className="f-display" style={{
            fontSize: 40, color: '#f3f0ff', marginTop: 8,
            textShadow: '0 0 32px rgba(245,196,81,0.4)',
          }}>
            The Celestial Bazaar
          </div>
        </div>

        {/* Offer row */}
        <div style={{
          position: 'absolute', left: '50%', top: 220, transform: 'translateX(-50%)',
          display: 'flex', gap: 22, zIndex: 4,
        }}>
          {offers.map((offer, i) => (
            <OfferCard
              key={`${offer.id}-${restock}`}
              offer={offer}
              idx={i}
              bought={bought[i]}
              onBuy={handleBuy}
              restocking={restock === 'out' ? 'out' : restock === 'in' ? 'in' : null}
            />
          ))}
        </div>

        {/* Coin flight overlay */}
        {coinFlight != null && (
          <CoinFlight idx={coinFlight.idx} keyVal={coinFlight.key} />
        )}

        {/* Helper hint */}
        <div style={{
          position: 'absolute', left: '50%', top: 510, transform: 'translateX(-50%)',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          color: 'rgba(187,168,255,0.55)',
          letterSpacing: '0.18em', textTransform: 'uppercase',
        }}>
          tap a card to seal the purchase · rare cards shimmer
        </div>

        {/* Bottom buttons */}
        <div style={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 12, zIndex: 5, alignItems: 'center',
        }}>
          <button className="ff-btn ff-btn-ghost" onClick={restockShop} disabled={restock !== 'idle'}>
            ↻ Restock <span className="f-mono num" style={{ color: '#f5c451', marginLeft: 6 }}>◆ 4</span>
          </button>
          <button className="ff-btn ff-btn-primary">Next Trial →</button>
        </div>

        <button
          onClick={reset}
          className="ff-btn ff-btn-ghost"
          style={{
            position: 'absolute', bottom: 28, right: 28,
            fontSize: 11, padding: '8px 14px',
          }}
        >↺ Reset</button>
      </div>
    </div>
  );
}

// Coin animates from treasury (~top right) to the bought card
function CoinFlight({ idx, keyVal }) {
  // Approximate: treasury at (1100, 36) within stage, cards centered around (640, 350)
  // Card index 0..3, layout pitch ~210, starting ~340
  const startX = 1100, startY = 36;
  const cardX = 340 + idx * 210, cardY = 320;
  const dx = cardX - startX;
  const dy = cardY - startY;
  return (
    <div
      key={keyVal}
      style={{
        position: 'absolute', left: startX, top: startY,
        zIndex: 12,
        pointerEvents: 'none',
        animation: 'coin-fly 460ms cubic-bezier(0.4, 0.1, 0.6, 1.2) forwards',
        ['--cx']: `${dx}px`,
        ['--cy']: `${dy}px`,
      }}
    >
      <style>{`
        @keyframes coin-fly {
          0%   { transform: translate(0, 0) scale(1) rotate(0); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translate(var(--cx), var(--cy)) scale(0.4) rotate(540deg); opacity: 0; }
        }
      `}</style>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 25%, #ffeebb, #f5c451 60%, #a87a18 100%)',
        border: '1px solid rgba(255,240,200,0.7)',
        boxShadow: '0 0 14px rgba(245,196,81,0.7), inset 0 -2px 4px rgba(120,80,6,0.5)',
        display: 'grid', placeItems: 'center',
        fontFamily: 'Cinzel Decorative, serif', fontSize: 12,
        color: '#5a3d08',
      }}>◆</div>
    </div>
  );
}

window.ShopScreen = ShopScreen;
