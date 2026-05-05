import { dispatch } from '../../actions/dispatch';
import { sellRefund } from '../../core/shop/sellRefund';
import { sfxPlay } from '../../audio/sfx';
import type { ShopOffer } from '../../events/types';

type Props = {
  kind: ShopOffer['kind'];
  id: string;
  index: number;
  disabled?: boolean;
  /** Tooltip shown when disabled. */
  disabledReason?: string;
  /** Visual variant. 'badge' = floating corner badge (HUD), 'inline' = inline button. */
  variant?: 'badge' | 'inline';
};

export function SellButton({ kind, id, index, disabled, disabledReason, variant = 'inline' }: Props) {
  const refund = sellRefund(kind, id);
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    dispatch({ type: 'SELL_UPGRADE', kind, index });
    sfxPlay('buy');
  };

  if (variant === 'badge') {
    return (
      <button
        className="sell-btn has-tip"
        onClick={onClick}
        disabled={disabled}
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
      disabled={disabled}
      className="f-mono uc has-tip"
      style={{
        position: 'relative',
        fontSize: 9,
        padding: '4px 10px',
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
