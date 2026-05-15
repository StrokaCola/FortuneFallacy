// VoucherToast — fires a brief celebration when the player buys a
// voucher in the shop. Vouchers are persistent run-long perks (Bench,
// Capacity, etc.) and previously had no purchase feedback beyond the
// shard deduction. The toast gives the acquisition a real moment: a
// gold-inscribed pill with the voucher name + a star sigil.

import { useEffect, useRef } from 'react';
import { bus } from '../../events/bus';
import { lookupVoucher } from '../../data/vouchers';
import { pushToast, toastQueue } from './toastQueue';

type VoucherData = { name: string; toastId: string };

function renderVoucher({ name, toastId }: VoucherData) {
  return (
    <div
      onClick={() => toastQueue.dismiss(toastId)}
      className="mat-crystal ff-voucher-inscribe"
      style={{
        padding: '8px 18px',
        borderRadius: 10,
        cursor: 'pointer',
        border: '1px solid rgba(245,196,81,0.5)',
        boxShadow: '0 0 18px rgba(245,196,81,0.3), 0 6px 18px rgba(0,0,0,0.4)',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        minWidth: 180,
      }}
    >
      <span className="f-mono uc" style={{
        fontSize: 9, letterSpacing: '0.32em',
        color: '#f5c451',
        textShadow: '0 0 8px rgba(245,196,81,0.55)',
      }}>
        ✦ sigil inscribed
      </span>
      <span className="f-display" style={{
        fontSize: 14, color: '#f3f0ff', letterSpacing: '0.04em',
      }}>
        {name}
      </span>
    </div>
  );
}

export function VoucherToast() {
  const lastIdRef = useRef(0);

  useEffect(() => {
    const off = bus.on('onOfferBought', (payload) => {
      if (payload.kind !== 'voucher') return;
      const def = lookupVoucher(payload.id);
      if (!def) return;
      const toastId = `voucher-${payload.id}-${++lastIdRef.current}`;
      pushToast<VoucherData>({
        id: toastId,
        // Normal priority — vouchers are a meaningful acquisition but
        // they shouldn't pre-empt achievement unlocks.
        priority: 'normal',
        durationMs: 3200,
        data: { name: def.name, toastId },
        render: renderVoucher,
      });
    });
    return off;
  }, []);

  return null;
}
