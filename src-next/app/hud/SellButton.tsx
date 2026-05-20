import { dispatch } from '../../actions/dispatch';
import { sellRefund } from '../../core/shop/sellRefund';
import { sfxPlay } from '../../audio/sfx';
import { playHaptic } from '../haptics/haptics';

// Sellable kinds — narrower than `ShopOffer['kind']` because packs are
// one-shot booster items that consume themselves on purchase.
export type SellableKind = 'catalyst' | 'voucher' | 'consumable' | 'mod';

type Props = {
  kind: SellableKind;
  id: string;
  index: number;
  disabled?: boolean;
  /** Tooltip shown when disabled. */
  disabledReason?: string;
  /** Visual variant. 'badge' = floating corner badge (HUD), 'inline' = inline button. */
  variant?: 'badge' | 'inline';
};

// Wave GG — spawns a transient gold ring + shard ember at the button's
// center when the sell fires. Lives on document.body so the parent
// catalyst card can unmount (sell removes the item from state) without
// clipping the flourish mid-animation. Mirrors the buttonJuice shockwave
// pattern. Reduce-motion bypasses.
function spawnSellSparkle(btn: HTMLElement): void {
  if (document.documentElement.classList.contains('reduce-motion')) return;
  const rect = btn.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const wave = document.createElement('div');
  wave.className = 'sell-sparkle-ring';
  wave.style.left = `${cx}px`;
  wave.style.top = `${cy}px`;
  document.body.appendChild(wave);
  const cleanup = () => {
    wave.removeEventListener('animationend', cleanup);
    if (wave.parentNode) wave.parentNode.removeChild(wave);
  };
  wave.addEventListener('animationend', cleanup);
  window.setTimeout(cleanup, 700);
  // Tiny gold ember dot that floats up + fades, the "sold!" mote.
  const ember = document.createElement('div');
  ember.className = 'sell-sparkle-ember';
  ember.style.left = `${cx}px`;
  ember.style.top = `${cy}px`;
  document.body.appendChild(ember);
  const emberCleanup = () => {
    ember.removeEventListener('animationend', emberCleanup);
    if (ember.parentNode) ember.parentNode.removeChild(ember);
  };
  ember.addEventListener('animationend', emberCleanup);
  window.setTimeout(emberCleanup, 900);
}

export function SellButton({ kind, id, index, disabled, disabledReason, variant = 'inline' }: Props) {
  const refund = sellRefund(kind, id);
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    spawnSellSparkle(e.currentTarget as HTMLElement);
    dispatch({ type: 'SELL_UPGRADE', kind, index });
    sfxPlay('buy');
  };

  // Press feedback (2026-05-20 responsiveness pass) — sell is a hard
  // commit, so we add the tap haptic alongside the existing audio cue.
  // Disabled gets a denied cue so the press still registers.
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) {
      sfxPlay('uiDenied');
      if (e.pointerType === 'touch') playHaptic('tap');
      return;
    }
    if (e.pointerType === 'touch') playHaptic('tap');
  };

  if (variant === 'badge') {
    return (
      <button
        className="sell-btn has-tip tap"
        onClick={onClick}
        onPointerDown={onPointerDown}
        aria-disabled={disabled || undefined}
        aria-label={`Sell for ${refund} shards`}
      >
        ◆{refund}
        <span className="tip tip-above">{disabled ? (disabledReason ?? 'Cannot sell') : `Sell for ${refund} ◆`}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      onPointerDown={onPointerDown}
      aria-disabled={disabled || undefined}
      className="f-mono uc has-tip tap"
      style={{
        position: 'relative',
        fontSize: 9,
        padding: '8px 12px',
        borderRadius: 4,
        background: disabled ? 'rgba(149,119,255,0.08)' : 'rgba(245,196,81,0.15)',
        border: `1px solid ${disabled ? 'rgba(149,119,255,0.3)' : 'rgba(245,196,81,0.5)'}`,
        color: disabled ? '#6a6080' : '#f5c451',
        letterSpacing: '0.18em',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      ◆ {refund} sell
      {disabled && disabledReason && <span className="tip">{disabledReason}</span>}
    </button>
  );
}
